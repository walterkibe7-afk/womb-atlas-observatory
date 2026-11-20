import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceMapPath = join(rootDir, "scripts", "aikb-source-map.json");
const outputDir = join(rootDir, "src", "content", "aikb");
const sourceMap = JSON.parse(readFileSync(sourceMapPath, "utf8"));

const sectionMap = new Map([
  ["context chamber", "context"],
  ["onboarding", "context"],
  ["safety", "context"],
  ["bleeding patterns", "bleeding"],
  ["bleeding", "bleeding"],
  ["pain and discomfort", "pain"],
  ["pain", "pain"],
  ["cycles and body rhythms", "hormonal"],
  ["hormonal", "hormonal"],
  ["daily life and impact", "daily_life"],
  ["daily life", "daily_life"],
  ["care and support", "care"],
  ["care", "care"],
  ["narrative", "narrative"],
  ["sensitive topics", "sensitive"],
  ["sensitive", "sensitive"]
]);

function normalizeKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizePatternName(name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toFieldId(sourceFieldId) {
  return String(sourceFieldId ?? "")
    .trim()
    .toLowerCase();
}

function mapSection(sectionName) {
  const normalized = String(sectionName ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\s+/g, " ");

  return sectionMap.get(normalized) ?? normalized.replace(/\s+/g, "_");
}

function parseList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/[|,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function findWorkbooks() {
  const searchDir = join(rootDir, sourceMap.workbookSearchDir);

  if (!existsSync(searchDir)) {
    return [];
  }

  return readdirSync(searchDir)
    .filter((fileName) =>
      sourceMap.workbookExtensions.some((extension) => fileName.toLowerCase().endsWith(extension))
    )
    .map((fileName) => join(searchDir, fileName));
}

function findSheetName(workbook, patterns) {
  const normalizedPatterns = patterns.map((pattern) => normalizeKey(pattern));

  return workbook.SheetNames.find((sheetName) => {
    const normalizedSheet = normalizeKey(sheetName);
    return normalizedPatterns.some(
      (pattern) => normalizedSheet.includes(pattern) || pattern.includes(normalizedSheet)
    );
  });
}

function readSheetRows(workbookPath, sheetPatterns) {
  const workbook = XLSX.readFile(workbookPath, { cellDates: false });
  const sheetName = findSheetName(workbook, sheetPatterns);

  if (!sheetName) {
    return [];
  }

  console.info(`Reading ${sheetName} from ${workbookPath}`);
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
}

function readExistingJson(fileName, fallback) {
  const filePath = join(outputDir, fileName);

  if (!existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(readFileSync(filePath, "utf8"));
}

function filterWorkbooks(workbooks, pattern) {
  return workbooks.filter((workbookPath) => pattern.test(workbookPath));
}

function buildObservations(workbooks) {
  const rows = filterWorkbooks(workbooks, /AIKB_v1_Part0|Observation_Registry/i).flatMap(
    (workbookPath) => readSheetRows(workbookPath, sourceMap.sheets.observations.match)
  );

  const fields = rows
    .map((row) => ({
      observationId: String(row.Observation_ID ?? row.observation_id ?? "").trim(),
      fieldId: toFieldId(row.Source_Field_ID ?? row.source_field_id ?? row.field_id),
      section: mapSection(row.Section ?? row.section),
      label: String(row.Observation_Name ?? row.observation_name ?? row.label ?? "").trim()
    }))
    .filter((row) => row.fieldId && row.label);

  return fields;
}

function buildObservationLookup(observationFields) {
  const byObservationId = new Map();

  for (const field of observationFields) {
    if (field.observationId) {
      byObservationId.set(field.observationId, field.fieldId);
    }
  }

  return byObservationId;
}

function buildSignals(workbooks, observationLookup) {
  const rows = filterWorkbooks(
    workbooks,
    /AIKB_v1_Part[1-4]|Body_Signals|Functional_Signals|Care_Signals|Narrative_Signals/i
  ).flatMap((workbookPath) =>
    readSheetRows(workbookPath, sourceMap.sheets.signals.match)
  );

  return rows
    .map((row) => {
      const observationInputs = parseList(row.Observation_Inputs ?? row.observation_inputs);
      const mappedFieldId =
        observationInputs
          .map((observationId) => observationLookup.get(observationId))
          .find(Boolean) ??
        toFieldId(row.Source_Field_ID ?? row.source_field_id ?? "");

      return {
        id: String(row.Signal_ID ?? row.signal_id ?? row.id ?? "").trim(),
        observationFieldId: mappedFieldId,
        signalType: normalizeKey(row.Signal_Family ?? row.signal_family ?? row.signal_type),
        label: String(row.Signal_Name ?? row.signal_name ?? row.label ?? "").trim()
      };
    })
    .filter((row) => row.id && row.observationFieldId && row.label);
}

function mergePatternDetection(existingEntries, nextEntries) {
  const detectionByName = new Map(
    existingEntries.map((entry) => [normalizePatternName(entry.name), entry])
  );

  return nextEntries.map((entry) => {
    const existing = detectionByName.get(normalizePatternName(entry.name));
    return {
      ...entry,
      fieldIds: entry.fieldIds.length > 0 ? entry.fieldIds : (existing?.fieldIds ?? []),
      narrativeCues:
        entry.narrativeCues.length > 0 ? entry.narrativeCues : (existing?.narrativeCues ?? []),
      valueChecks:
        entry.valueChecks.length > 0 ? entry.valueChecks : (existing?.valueChecks ?? [])
    };
  });
}

function buildPatterns(workbooks, existingPatterns) {
  const rows = filterWorkbooks(
    workbooks,
    /AIKB_v1_Part7|Pattern_Registry/i
  ).flatMap((workbookPath) =>
    readSheetRows(workbookPath, sourceMap.sheets.patterns.match)
  );

  const entries = rows
    .map((row) => ({
      id: String(row.Pattern_ID ?? row.pattern_id ?? row.id ?? "").trim(),
      name: String(row.Pattern_Name ?? row.pattern_name ?? row.name ?? "").trim(),
      domain: String(row.Pattern_Domain ?? row.pattern_domain ?? row.domain ?? "").trim(),
      fieldIds: [],
      narrativeCues: parseList(row.Primary_Signals ?? row.primary_signals),
      valueChecks: [],
      meaning: String(
        row.Participant_Description ??
          row.participant_description ??
          row.Pattern_Definition ??
          row.meaning ??
          ""
      ).trim(),
      atlasNote: String(
        row.Detection_Guidance ?? row.detection_guidance ?? row.atlas_note ?? ""
      ).trim(),
      watchOverTime: String(
        row.Longitudinal_Behavior ??
          row.longitudinal_behavior ??
          row.watch_over_time ??
          ""
      ).trim()
    }))
    .filter((row) => row.id && row.name);

  return mergePatternDetection(existingPatterns.entries ?? [], entries);
}

function buildArchetypes(workbooks) {
  const rows = filterWorkbooks(
    workbooks,
    /AIKB_v1_Part8|Reflection_Knowledge|Archetype_Registry/i
  ).flatMap((workbookPath) =>
    readSheetRows(workbookPath, sourceMap.sheets.archetypes.match)
  );

  const archetypes = rows
    .map((row) => ({
      id: String(row.Archetype_ID ?? row.archetype_id ?? row.id ?? "").trim(),
      name: String(row.Archetype_Name ?? row.archetype_name ?? row.name ?? "").trim(),
      tone: String(row.Tone_Profile ?? row.tone_profile ?? row.tone ?? "gentle")
        .trim()
        .toLowerCase(),
      selectionSignals: parseList(row.Primary_Input_Patterns ?? row.primary_input_patterns).map(
        (patternId) => normalizeKey(patternId)
      )
    }))
    .filter((row) => row.id && row.name);

  return {
    archetypes,
    tones: [...new Set(archetypes.map((row) => row.tone).filter(Boolean))]
  };
}

function buildKnowledgeGraph(workbooks) {
  const rows = filterWorkbooks(workbooks, /AIKB_v1_Part9|Knowledge_Graph/i).flatMap(
    (workbookPath) => readSheetRows(workbookPath, sourceMap.sheets.knowledgeGraph.match)
  );

  return rows
    .map((row) => ({
      fromId: String(
        row.Source_ID ?? row.source_id ?? row.From_ID ?? row.from_id ?? row.from ?? ""
      ).trim(),
      toId: String(
        row.Target_ID ?? row.target_id ?? row.To_ID ?? row.to_id ?? row.to ?? ""
      ).trim(),
      relationship: String(
        row.Relationship ?? row.relationship ?? row.edge_type ?? ""
      ).trim()
    }))
    .filter((row) => row.fromId && row.toId && row.relationship);
}

function buildIndices(workbooks) {
  const rows = filterWorkbooks(workbooks, /AIKB_v1_Part11|Atlas_Intelligence_Indices/i).flatMap(
    (workbookPath) => readSheetRows(workbookPath, sourceMap.sheets.indices.match)
  );

  return rows
    .map((row, index) => ({
      id: String(row.Index_ID ?? row.index_id ?? row.id ?? `IDX-${String(index + 1).padStart(3, "0")}`),
      name: String(row.Index_Name ?? row.index_name ?? row.name ?? "").trim(),
      description: String(
        row.Index_Description ?? row.index_description ?? row.description ?? ""
      ).trim(),
      patternIds: parseList(row.Pattern_IDs ?? row.pattern_ids ?? row.patterns)
    }))
    .filter((row) => row.id && row.name);
}

function buildGovernance(workbooks) {
  const rows = filterWorkbooks(
    workbooks,
    /AIKB_v1_Part10|AIKB_v1_Part13|Governance/i
  ).flatMap((workbookPath) =>
    readSheetRows(workbookPath, sourceMap.sheets.governance.match)
  );

  return rows
    .map((row, index) => {
      const severityRaw = String(row.Severity ?? row.severity ?? row.level ?? "warn")
        .trim()
        .toLowerCase();

      return {
        id: String(row.Rule_ID ?? row.rule_id ?? row.id ?? `GOV-${String(index + 1).padStart(3, "0")}`),
        rule: String(row.Rule ?? row.rule ?? row.policy ?? row.guardrail ?? "").trim(),
        severity: severityRaw === "block" ? "block" : "warn"
      };
    })
    .filter((row) => row.id && row.rule);
}

function buildBundle(workbooks) {
  const existingObservations = readExistingJson("observations.json", { fields: [] });
  const existingSignals = readExistingJson("signals.json", { mappings: [] });
  const existingPatterns = readExistingJson("patterns.json", { entries: [] });
  const existingReflection = readExistingJson("reflection.json", {
    archetypes: [],
    tones: []
  });
  const existingKnowledgeGraph = readExistingJson("knowledge_graph.json", { edges: [] });
  const existingIndices = readExistingJson("indices.json", { definitions: [] });
  const existingGovernance = readExistingJson("governance.json", { rules: [] });

  const generatedAt = new Date().toISOString();
  const observationFields = buildObservations(workbooks);
  const observationLookup = buildObservationLookup(observationFields);
  const signalMappings = buildSignals(workbooks, observationLookup);
  const patternEntries = buildPatterns(workbooks, existingPatterns);
  const reflection = buildArchetypes(workbooks);
  const knowledgeGraphEdges = buildKnowledgeGraph(workbooks);
  const indexDefinitions = buildIndices(workbooks);
  const governanceRules = buildGovernance(workbooks);

  return {
    observations: {
      version: sourceMap.version,
      generatedAt,
      fields: observationFields.length > 0 ? observationFields : existingObservations.fields
    },
    signals: {
      mappings: signalMappings.length > 0 ? signalMappings : existingSignals.mappings
    },
    patterns: {
      entries: patternEntries.length > 0 ? patternEntries : existingPatterns.entries
    },
    reflection: {
      archetypes:
        reflection.archetypes.length > 0 ? reflection.archetypes : existingReflection.archetypes,
      tones: reflection.tones.length > 0 ? reflection.tones : existingReflection.tones
    },
    knowledgeGraph: {
      edges: knowledgeGraphEdges.length > 0 ? knowledgeGraphEdges : existingKnowledgeGraph.edges
    },
    indices: {
      definitions: indexDefinitions.length > 0 ? indexDefinitions : existingIndices.definitions
    },
    governance: {
      rules: governanceRules.length > 0 ? governanceRules : existingGovernance.rules
    }
  };
}

function writeBundle(bundle) {
  mkdirSync(outputDir, { recursive: true });

  writeFileSync(join(outputDir, "observations.json"), `${JSON.stringify(bundle.observations, null, 2)}\n`);
  writeFileSync(join(outputDir, "signals.json"), `${JSON.stringify(bundle.signals, null, 2)}\n`);
  writeFileSync(join(outputDir, "patterns.json"), `${JSON.stringify(bundle.patterns, null, 2)}\n`);
  writeFileSync(join(outputDir, "reflection.json"), `${JSON.stringify(bundle.reflection, null, 2)}\n`);
  writeFileSync(
    join(outputDir, "knowledge_graph.json"),
    `${JSON.stringify(bundle.knowledgeGraph, null, 2)}\n`
  );
  writeFileSync(join(outputDir, "indices.json"), `${JSON.stringify(bundle.indices, null, 2)}\n`);
  writeFileSync(join(outputDir, "governance.json"), `${JSON.stringify(bundle.governance, null, 2)}\n`);
}

const allowMissing = process.argv.includes("--allow-missing");
const workbooks = findWorkbooks();

if (workbooks.length === 0) {
  if (allowMissing) {
    console.warn(
      "No Excel workbooks found in specifications/. Existing data/aikb JSON files were left unchanged."
    );
    process.exit(0);
  }

  console.error(
    "No Excel workbooks found in specifications/. Add AIKB workbooks or rerun with --allow-missing."
  );
  process.exit(1);
}

const bundle = buildBundle(workbooks);
writeBundle(bundle);

console.info("AIKB build complete.");
console.info(`Workbooks processed: ${workbooks.length}`);
console.info(`Observations: ${bundle.observations.fields.length}`);
console.info(`Signals: ${bundle.signals.mappings.length}`);
console.info(`Patterns: ${bundle.patterns.entries.length}`);
console.info(`Archetypes: ${bundle.reflection.archetypes.length}`);
console.info(`Knowledge graph edges: ${bundle.knowledgeGraph.edges.length}`);
console.info(`Indices: ${bundle.indices.definitions.length}`);
console.info(`Governance rules: ${bundle.governance.rules.length}`);
