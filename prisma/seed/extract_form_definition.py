#!/usr/bin/env python3
"""
Generate prisma/seed/form-definition.json from the Master Screen Register spec.

This is the single build-time bridge between the product spec (the .xlsx) and the
database. Content (screens / questions / options / narrative prompts) is extracted
automatically from the workbook; the rule layers (routing, signals, reflection) that
the spec only expresses in prose are hand-encoded below into the structured condition
DSL the runtime evaluator understands (see src/lib/observation/conditions.ts).

Re-run after editing the spec:
    python prisma/seed/extract_form_definition.py
Then re-seed:
    npx prisma db seed

Pure standard library (zipfile + xml) so it runs without openpyxl.
"""
import json, os, re, zipfile
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
SPEC = os.path.normpath(os.path.join(
    HERE, "..", "..",
    "client-repo-evaluation", "womb-atlas-observatory-main", "specifications",
    "Womb_Atlas_Master_Screen_Register_Engineering_Edition_v4_1_FULLY_POPULATED.xlsx",
))
OUT = os.path.join(HERE, "form-definition.json")
A = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

# Sheet name -> worksheet path, resolved from the workbook below.
def load_workbook(path):
    z = zipfile.ZipFile(path)
    shared = []
    for si in ET.fromstring(z.read("xl/sharedStrings.xml")):
        shared.append("".join(t.text or "" for t in si.iter(A + "t")))
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    relmap = {r.get("Id"): r.get("Target") for r in rels}
    rid = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
    sheets = {}
    for s in wb.find(A + "sheets", ):
        sheets[s.get("name")] = "xl/" + relmap[s.get(rid)]
    return z, shared, sheets

def col_index(ref):
    letters = "".join(c for c in ref if c.isalpha())
    n = 0
    for c in letters:
        n = n * 26 + (ord(c) - 64)
    return n - 1

def read_rows(z, shared, path):
    root = ET.fromstring(z.read(path))
    data = root.find(A + "sheetData")
    rows = []
    for r in data.findall(A + "row"):
        cells, maxc = {}, 0
        for c in r.findall(A + "c"):
            ci = col_index(c.get("r")); maxc = max(maxc, ci)
            t = c.get("t"); v = c.find(A + "v"); inl = c.find(A + "is"); val = ""
            if t == "s" and v is not None:
                val = shared[int(v.text)]
            elif t == "inlineStr" and inl is not None:
                val = "".join(x.text or "" for x in inl.iter(A + "t"))
            elif v is not None:
                val = v.text
            cells[ci] = (val or "").strip()
        rows.append([cells.get(i, "") for i in range(maxc + 1)])
    return rows

def as_dicts(rows):
    header = rows[0]
    out = []
    for row in rows[1:]:
        if not any(row):
            continue
        out.append({header[i]: (row[i] if i < len(row) else "") for i in range(len(header))})
    return out

# --------------------------------------------------------------------------
# renderKind: which screen component the runtime registry should use.
# --------------------------------------------------------------------------
def render_kind(input_type):
    it = (input_type or "").lower()
    rules = [
        ("consent checkbox", "consent"),
        ("safety flags", "safety_check"),
        ("multi-select safety", "safety_check"),
        ("safety deck", "safety_alert"),
        ("landing", "information"),
        ("loading", "processing"),
        ("review list", "review"),
        ("reflection screen", "reflection"),
        ("visualization", "constellation"),
        ("generated summary", "observed_patterns"),
        ("atlas record view", "atlas_record"),
        ("comparison", "comparison"),
        ("narrative", "narrative"),
        ("text/audio", "narrative"),
        ("confirmation", "confirmation"),
        ("video / information", "information"),
        ("information screen", "information"),
    ]
    for needle, kind in rules:
        if needle in it:
            return kind
    return "question"  # single/multi select, country, free text

def screen_order(screen_id):
    m = re.match(r"S(\d+)([A-Z]?)", screen_id)
    if not m:
        return 9999
    return int(m.group(1)) * 10 + (ord(m.group(2)) - ord("A") + 1 if m.group(2) else 0)

# --------------------------------------------------------------------------
# Option helpers
# --------------------------------------------------------------------------
def is_exclusive(label):
    l = label.strip().lower()
    return l == "none" or l.startswith("none of") or l == "not applicable"

# Field types that are NOT enumerable choice lists -> no options generated.
NON_OPTION_TYPES = {"boolean", "text", "country", "text_audio", "generated_json",
                    "single_select/text_audio"}

def build_options(field_type, allowed_values):
    if field_type not in ("single_select", "multi_select"):
        return []
    opts = []
    for i, raw in enumerate(allowed_values.split(";")):
        v = raw.strip()
        if not v:
            continue
        opts.append({"value": v, "label": v, "order": i, "isExclusive": is_exclusive(v)})
    return opts

# ==========================================================================
# RULE LAYERS (hand-encoded from sheets 03 / 05 / 06 into the condition DSL)
# ==========================================================================

# Routing: branching screens only. Linear screens get a default route auto-built
# from the Next_Screen column. priority: lower number evaluated first; a null
# condition is the fallback (always last).
CURATED_ROUTES = {
    "S03": [
        {"priority": 1, "toScreenId": "S04",
         "condition": {"field": "SAFETY_FLAGS", "op": "any_except", "value": ["None"]},
         "note": "Any urgent safety flag -> safety alert"},
        {"priority": 2, "toScreenId": "S05", "condition": None, "note": "No flags -> context"},
    ],
    "S17": [
        {"priority": 1, "toScreenId": "S18",
         "condition": {"field": "EVER_PREGNANT", "op": "eq", "value": "Yes"},
         "note": "Pregnant before -> ask count"},
        {"priority": 2, "toScreenId": "S19", "condition": None, "note": "Skip pregnancy count"},
    ],
    "S58": [
        {"priority": 1, "toScreenId": "S59",
         "condition": {"field": "SPOKEN_TO_PROVIDER", "op": "eq", "value": "Yes"},
         "note": "Spoke to provider -> care response"},
        {"priority": 2, "toScreenId": "S60", "condition": None, "note": "Skip care response"},
    ],
    "S76": [
        {"priority": 1, "toScreenId": "S77B",
         "condition": {"burden": "High"}, "note": "High burden reflection"},
        {"priority": 2, "toScreenId": "S77A",
         "condition": {"burden": "Low"}, "note": "Minimal reflection"},
        {"priority": 3, "toScreenId": "S77", "condition": None, "note": "Standard reflection"},
    ],
}
# Screens whose Next_Screen is not a single screen id and that have no curated
# branch -> terminal (no outgoing route).
TERMINAL_SCREENS = {"S82", "S92"}

# Signals (sheet 05). condition uses the DSL; severity drives burden scoring.
SIGNAL_RULES = [
    ("SIG_BLD_001", "Heavy bleeding", "Bleeding", "S22", "high",
     {"field": "PRODUCT_CHANGE_FREQ", "op": "in",
      "value": ["More than once per hour or leaking through", "Every 1-2 hours"]}),
    ("SIG_BLD_002", "Prolonged bleeding", "Bleeding", "S23", "moderate",
     {"field": "BLEEDING_DURATION", "op": "eq", "value": "More than 8 days"}),
    ("SIG_BLD_003", "Large clots", "Bleeding", "S24", "moderate",
     {"field": "CLOT_SIZE", "op": "eq", "value": "Large"}),
    ("SIG_BLD_004", "Interperiod bleeding", "Bleeding", "S25", "moderate",
     {"field": "INTERPERIOD_BLEEDING", "op": "eq", "value": "Frequently"}),
    ("SIG_BLD_005", "Bleeding worsening", "Bleeding", "S26", "moderate",
     {"field": "BLEEDING_PROGRESSION", "op": "in",
      "value": ["Become heavier", "Become more irregular"]}),
    ("SIG_BLD_006", "Bleeding life restriction", "Bleeding", "S27", "moderate",
     {"field": "BLEEDING_IMPACT", "op": "any_except", "value": ["None of these"]}),
    ("SIG_PAIN_001", "Persistent pain", "Pain", "S30", "high",
     {"field": "PAIN_PATTERN", "op": "eq", "value": "Constant or most days"}),
    ("SIG_PAIN_002", "Cycle-linked pain", "Pain", "S31", "moderate",
     {"field": "PAIN_TIMING", "op": "contains_any",
      "value": ["During period", "Before/days leading to period"]}),
    ("SIG_PAIN_003", "Pelvic pain distribution", "Pain", "S32", "moderate",
     {"field": "PAIN_LOCATION", "op": "contains_any",
      "value": ["Pelvic area", "Lower abdomen or pelvis", "Lower back", "Legs"]}),
    ("SIG_PAIN_004", "Activity-triggered pain", "Pain", "S33", "moderate",
     {"field": "PAIN_TRIGGERS", "op": "contains_any",
      "value": ["Sex", "Bowel movements", "Urination", "Exercise"]}),
    ("SIG_PAIN_005", "Unpredictable pain", "Pain", "S34", "moderate",
     {"field": "PAIN_PREDICTABILITY", "op": "in",
      "value": ["Often unpredictable", "Completely unpredictable"]}),
    ("SIG_PAIN_006", "Worsening pain", "Pain", "S35", "high",
     {"field": "PAIN_SEVERITY_CHANGE", "op": "in",
      "value": ["Become gradually worse", "Increased suddenly"]}),
    ("SIG_PAIN_007", "Pelvic symptom cluster", "Pain", "S36", "moderate",
     {"field": "PELVIC_SYMPTOMS", "op": "count_gte", "value": 2,
      "exclude": ["None of these"]}),
    ("SIG_HORM_001", "Irregular cycles", "Cycle", "S40", "moderate",
     {"field": "CYCLE_PREDICTABILITY", "op": "in",
      "value": ["Somewhat irregular", "Very irregular"]}),
    ("SIG_HORM_002", "Skipped periods", "Cycle", "S41", "moderate",
     {"field": "SKIPPED_PERIODS", "op": "in", "value": ["Occasionally", "Frequently"]}),
    ("SIG_HORM_003", "Hormonal signs", "Hormonal", "S42", "moderate",
     {"field": "HORMONAL_SIGNS", "op": "count_gte", "value": 2,
      "exclude": ["None of these"]}),
    ("SIG_HORM_004", "Cycle changed", "Cycle", "S43", "moderate",
     {"field": "CYCLE_CHANGES", "op": "in",
      "value": ["They have become shorter", "They have become longer",
                "They have become more irregular"]}),
    ("SIG_HORM_005", "Ovulation relationship", "Cycle", "S44", "low",
     {"field": "SYMPTOMS_RELATED_TO", "op": "in", "value": ["Ovulation", "Both"]}),
    ("SIG_DLY_001", "Functional disruption", "Daily Life", "S46", "moderate",
     {"field": "FUNCTION_IMPACT", "op": "any_except", "value": ["None of these"]}),
    ("SIG_DLY_002", "Missed activities", "Daily Life", "S47", "high",
     {"field": "MISSED_ACTIVITIES", "op": "in",
      "value": ["Every cycle", "Multiple days each cycle"]}),
    ("SIG_DLY_003", "Fatigue", "Daily Life", "S48", "moderate",
     {"field": "FATIGUE_FREQ", "op": "in", "value": ["Frequently", "Constantly"]}),
    ("SIG_DLY_004", "Sleep disruption", "Daily Life", "S49", "moderate",
     {"field": "SLEEP_DISRUPTION", "op": "in", "value": ["Frequently", "Constantly"]}),
    ("SIG_DLY_005", "Dizziness/weakness", "Daily Life", "S50", "high",
     {"field": "DIZZINESS_FREQ", "op": "eq", "value": "Frequently"}),
    ("SIG_DLY_006", "High life disruption", "Daily Life", "S51", "high",
     {"field": "LIFE_DISRUPTION", "op": "in", "value": ["Quite a lot", "Very much"]}),
    ("SIG_CARE_001", "Care not sought", "Care Access", "S58", "low",
     {"field": "SPOKEN_TO_PROVIDER", "op": "eq", "value": "No"}),
    ("SIG_CARE_002", "Unresolved care", "Care Access", "S59", "moderate",
     {"field": "CARE_RESPONSE", "op": "contains_any",
      "value": ["I did not get clear answers", "I am still waiting for answers",
                "I was told my symptoms were normal"]}),
    ("SIG_CARE_003", "Dismissal", "Care Access", "S60", "moderate",
     {"field": "CARE_DISMISSAL", "op": "eq", "value": "Yes"}),
    ("SIG_CARE_004", "No care access", "Care Access", "S61", "high",
     {"field": "ACCESS_TO_CARE", "op": "eq", "value": "No"}),
    ("SIG_SEN_001", "Pain during sex", "Sensitive", "S67", "moderate",
     {"field": "PAIN_DURING_SEX", "op": "eq", "value": "Yes"}),
    ("SIG_SEN_002", "Bowel symptoms", "Sensitive", "S68", "moderate",
     {"field": "BOWEL_SYMPTOMS", "op": "eq", "value": "Yes"}),
    ("SIG_SEN_003", "Bladder symptoms", "Sensitive", "S69", "moderate",
     {"field": "BLADDER_SYMPTOMS", "op": "eq", "value": "Yes"}),
    ("SIG_SAFE_001", "Urgent symptom marker", "Safety", "S03", "high",
     {"any": [
         {"field": "SAFETY_FLAGS", "op": "any_except", "value": ["None"]},
         {"field": "URGENT_SYMPTOMS", "op": "any_except", "value": ["None"]}]}),
]

# Reflection templates (sheet 06). Conditions evaluate over computed signals/burden.
# The runtime collects every matching rule (ordered by priority) to assemble copy,
# and picks the highest target screen (S77B > S77 > S77A).
REFLECTION_RULES = [
    ("REF_001", {"burden": "Low"}, "Minimal", "S77A",
     "Your responses describe experiences that may be worth continuing to observe over time."),
    ("REF_002", {"all": [{"signal": "SIG_BLD_001", "op": "present"},
                         {"signal": "SIG_BLD_006", "op": "present"}]}, "Bleeding-focused", "S77",
     "Your responses suggest bleeding is an important part of this observation, especially how "
     "it affects planning, movement, rest, or daily routines."),
    ("REF_003", {"all": [{"signal": "SIG_BLD_001", "op": "present"},
                         {"signal": "SIG_DLY_005", "op": "present"}]}, "Safety-aware bleeding", "S77B",
     "Your responses describe bleeding together with weakness, dizziness, or faintness. This may "
     "be important to discuss with a healthcare provider, especially if it continues or worsens."),
    ("REF_004", {"any": [{"signal": "SIG_PAIN_001", "op": "present"},
                         {"signal": "SIG_PAIN_006", "op": "present"}]}, "Pain-focused", "S77",
     "Your responses suggest pain or pressure has become a meaningful pattern in your experience."),
    ("REF_005", {"all": [{"signal": "SIG_PAIN_002", "op": "present"},
                         {"signal": "SIG_HORM_001", "op": "present"}]}, "Cycle-pain pattern", "S77",
     "Your responses show symptoms that may be connected to cycle timing, ovulation, or changes "
     "in rhythm."),
    ("REF_006", {"all": [{"signal": "SIG_HORM_003", "op": "present"},
                         {"signal": "SIG_HORM_002", "op": "present"}]}, "Hormonal rhythm pattern", "S77",
     "Your responses describe changes in body rhythm and hormonal signs that may be useful to "
     "track together."),
    ("REF_007", {"signal": "SIG_DLY_006", "op": "present"}, "High-burden", "S77B",
     "Some of what you described may be affecting your daily life more than expected."),
    ("REF_008", {"any": [{"signal": "SIG_CARE_003", "op": "present"},
                         {"signal": "SIG_CARE_002", "op": "present"}]}, "Care access", "S77",
     "Your responses suggest that getting answers or feeling heard has been part of the experience."),
    ("REF_009", {"any": [{"signal": "SIG_SEN_001", "op": "present"},
                         {"signal": "SIG_SEN_002", "op": "present"},
                         {"signal": "SIG_SEN_003", "op": "present"}]}, "Sensitive cluster", "S77",
     "Some experiences are more personal to describe. Your responses still help preserve patterns "
     "that may matter over time."),
    ("REF_010", {"signal": "SIG_SAFE_001", "op": "present"}, "Safety note", "S77B",
     "Some responses were marked as potentially urgent. Womb Atlas is not an emergency service; "
     "please seek local urgent or emergency care if symptoms feel severe or unsafe."),
    ("REF_012", {"burden": "High"}, "Multi-domain", "S77B",
     "Your Atlas Record shows patterns across more than one domain, which may be useful to review "
     "over time or share with a provider if you choose."),
]

# Storage-table overrides where the Data Dictionary (sheet 02) and the Supabase
# schema (sheet 10) disagree. Sheet 10 is the source of truth for storage.
QUESTION_TABLE_OVERRIDES = {
    # URGENT_SYMPTOMS: dictionary says sensitive_topics, schema sheet says observation_safety.
    "URGENT_SYMPTOMS": ("observation_safety", "urgent_symptom_flags"),
}

# Life-stage visibility (sheet 04). Screens suppressed for a given reproductive state.
# Encoded as a per-screen visibilityRule: show unless REPRODUCTIVE_STATE in `hideFor`.
# TTC + standard-cycle assumptions are suppressed while pregnant.
SCREEN_VISIBILITY = {
    "S20": {"hideForReproductiveState": ["I am pregnant"]},   # Trying to conceive
}

# --------------------------------------------------------------------------
def main():
    z, shared, sheets = load_workbook(SPEC)
    screens_rows = as_dicts(read_rows(z, shared, sheets["01_Master_Screens"]))
    dict_rows = as_dicts(read_rows(z, shared, sheets["02_Data_Dictionary"]))
    narr_rows = as_dicts(read_rows(z, shared, sheets["08_Narrative_Engine"]))

    # ---- Screens ----
    screens = []
    screen_ids = set()
    for r in screens_rows:
        sid = r["Screen_ID"].strip()
        if not sid:
            continue
        screen_ids.add(sid)
        flow = "first_observation" if r.get("MVP_Phase", "").strip() == "MVP" else "atlas_checkin"
        screens.append({
            "screenId": sid,
            "flowKey": flow,
            "name": r["Screen_Name"].strip(),
            "section": r["Section"].strip(),
            "purpose": r["Purpose"].strip(),
            "inputType": r["Input_Type"].strip(),
            "renderKind": render_kind(r["Input_Type"]),
            "primaryActionLabel": r["Primary_Action"].strip(),
            "nextScreenRaw": r["Next_Screen"].strip(),
            "order": screen_order(sid),
            "atlasDomain": r.get("Atlas_Domain", "").strip() or None,
            "mvpPhase": r.get("MVP_Phase", "").strip() or "MVP",
            "status": r.get("Status", "").strip() or "Locked",
            "visibilityRule": SCREEN_VISIBILITY.get(sid),
        })

    # ---- Questions + options ----
    questions = []
    for i, r in enumerate(dict_rows):
        fid = r["Field_ID"].strip()
        if not fid:
            continue
        ftype = r["Field_Type"].strip()
        table = r.get("DB_Table", "").strip()
        column = r.get("DB_Column", "").strip()
        if fid in QUESTION_TABLE_OVERRIDES:
            table, column = QUESTION_TABLE_OVERRIDES[fid]
        questions.append({
            "fieldId": fid,
            "screenId": r["Screen_ID"].strip(),
            "questionText": r["Question_or_Element"].strip(),
            "fieldType": ftype,
            "required": r.get("Required", "Optional").strip() or "Optional",
            "validation": r.get("Validation", "").strip() or None,
            "notes": r.get("Notes", "").strip() or None,
            "targetTable": table,
            "targetColumn": column,
            "order": i,
            "options": build_options(ftype, r.get("Allowed_Values", "")),
        })

    # ---- Narrative prompts ----
    prompts = []
    for i, r in enumerate(narr_rows):
        pid = r["Prompt_ID"].strip()
        if not pid:
            continue
        prompts.append({
            "promptId": pid,
            "screenId": r["Screen_ID"].strip(),
            "promptText": r["Prompt_Text"].strip(),
            "captureType": r.get("Capture_Type", "Text/audio").strip(),
            "order": i,
        })

    # ---- Routes: curated branches + auto default routes ----
    routes = []
    for s in screens:
        sid = s["screenId"]
        if sid in CURATED_ROUTES:
            for rt in CURATED_ROUTES[sid]:
                routes.append({"fromScreenId": sid, **rt})
            continue
        if sid in TERMINAL_SCREENS:
            continue
        nxt = s["nextScreenRaw"]
        if re.fullmatch(r"S\d+[A-Z]?", nxt):
            routes.append({"fromScreenId": sid, "priority": 1, "toScreenId": nxt,
                           "condition": None, "note": "Linear"})

    # ---- Signals ----
    signals = [{"signalId": sid, "name": name, "domain": dom, "sourceScreen": src,
                "severity": sev, "condition": cond}
               for (sid, name, dom, src, sev, cond) in SIGNAL_RULES]

    # ---- Reflection rules ----
    reflections = [{"ruleId": rid, "condition": cond, "reflectionType": rtype,
                    "targetScreen": target, "templateCopy": copy, "priority": i}
                   for i, (rid, cond, rtype, target, copy) in enumerate(REFLECTION_RULES)]

    flows = [
        {"key": "first_observation", "name": "First Observation"},
        {"key": "atlas_checkin", "name": "Atlas Check-In"},
    ]

    out = {
        "flows": flows,
        "screens": screens,
        "questions": questions,
        "narrativePrompts": prompts,
        "routes": routes,
        "signals": signals,
        "reflectionRules": reflections,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print(f"Wrote {OUT}")
    print(f"  flows={len(flows)} screens={len(screens)} questions={len(questions)} "
          f"prompts={len(prompts)} routes={len(routes)} signals={len(signals)} "
          f"reflectionRules={len(reflections)}")

if __name__ == "__main__":
    main()
