import { jsPDF } from "jspdf";
import type { RecordResult } from "@/app/(participant)/observation/screens/ScreenRenderer";
import type { CareJourney, LifeStage, SignalSeriesPoint, TimelineEvent } from "@/lib/observation/summary";
import { v43Text } from "@/lib/observation/intelligence/v43/v43-i18n";
import { domainLabel } from "@/components/participant/signal-domains";
import { signalTypeDomain } from "@/lib/observation/signal-types";
import { evidenceLabel, isEvidenceConfidence } from "@/lib/observation/evidence";
import { formatDateLong } from "@/lib/observation/locale-date";

const GOLD: [number, number, number] = [161, 128, 30];
const INK: [number, number, number] = [30, 26, 20];
const MUTED: [number, number, number] = [110, 105, 100];
const FAINT: [number, number, number] = [150, 145, 140];

const MARGIN = 18;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const ARABIC_FONT_NAME = "NotoNaskhArabic";
const ARABIC_FONT_FILES: Record<"normal" | "bold", string> = {
  normal: "/fonts/NotoNaskhArabic-Regular.ttf",
  bold: "/fonts/NotoNaskhArabic-Bold.ttf",
};
// jsPDF ships with Helvetica only, which has no Arabic-script glyphs at all —
// Urdu text rendered in it comes out as garbled mojibake. Noto Naskh Arabic
// (OFL, via @embedpdf/fonts-arabic) is embedded instead for the "ur" locale.
// jsPDF's bundled "Arabic Support" plugin (registered on the `preProcessText`
// hook — see its source) already does contextual letter-joining automatically
// on every `.text()` call once a font with the right glyphs is active, so no
// separate shaping/reshaping library is needed here — confirmed by rendering
// real translated strings through it and inspecting the output directly.
let arabicFontPromise: Promise<void> | null = null;
const registeredDocs = new WeakSet<jsPDF>();

async function arrayBufferToBase64(buf: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function fetchFontBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load PDF font at ${url}: ${res.status}`);
  return arrayBufferToBase64(await res.arrayBuffer());
}

/** Fetches both weights once (module-level cache) and registers them on this
 *  specific jsPDF instance — addFont() is per-document, fetch is not. */
async function ensureArabicFont(doc: jsPDF): Promise<void> {
  if (!arabicFontPromise) {
    arabicFontPromise = Promise.all([
      fetchFontBase64(ARABIC_FONT_FILES.normal),
      fetchFontBase64(ARABIC_FONT_FILES.bold),
    ]).then(([normal, bold]) => {
      arabicFontBase64 = { normal, bold };
    });
  }
  await arabicFontPromise;
  if (!registeredDocs.has(doc) && arabicFontBase64) {
    doc.addFileToVFS("NotoNaskhArabic-Regular.ttf", arabicFontBase64.normal);
    doc.addFont("NotoNaskhArabic-Regular.ttf", ARABIC_FONT_NAME, "normal");
    doc.addFileToVFS("NotoNaskhArabic-Bold.ttf", arabicFontBase64.bold);
    doc.addFont("NotoNaskhArabic-Bold.ttf", ARABIC_FONT_NAME, "bold");
    registeredDocs.add(doc);
  }
}
let arabicFontBase64: { normal: string; bold: string } | null = null;

type PdfTextOpts = { size?: number; color?: [number, number, number]; bold?: boolean };

/** Shared paginated report builder behind the Timeline / Atlas Record PDF exports. */
class PdfReport {
  private doc = new jsPDF({ unit: "mm", format: "a4" });
  private y = MARGIN;
  private pageNum = 1;
  private locale?: string;
  private isArabic: boolean;

  private constructor(locale?: string) {
    this.locale = locale;
    this.isArabic = locale === "ur";
  }

  /** Async because the Arabic font (only needed for "ur") is fetched from
   *  /fonts on demand rather than bundled into every participant's JS, so
   *  fr/es/sw exports pay nothing for a font they'll never use. */
  static async create(title: string, subtitleParts: string[], locale?: string): Promise<PdfReport> {
    const report = new PdfReport(locale);
    if (report.isArabic) {
      await ensureArabicFont(report.doc);
    }
    report.renderHeader(title, subtitleParts);
    return report;
  }

  private fontFamily(): string {
    return this.isArabic ? ARABIC_FONT_NAME : "helvetica";
  }

  /** Confirmed by isolating each candidate in its own `.text()` call: both
   *  the em dash "—" and a plain hyphen "-" render as nothing at all with
   *  this font, while "." does render. "—" is kept for Latin-script locales,
   *  where it renders fine via Helvetica. */
  private dash(): string {
    return this.isArabic ? "." : "—";
  }

  /**
   * Every method below that takes more than one independently-translated
   * phrase (this header's subtitle, entryTitleSegmented, bulletListSegmented)
   * draws them on SEPARATE lines rather than side by side when using the
   * embedded Arabic font.
   *
   * jsPDF's Arabic plugin shapes and joins letters correctly within a single
   * `.text()` call, but placing two such calls side by side on one line and
   * positioning them by hand was confirmed — through extensive direct visual
   * testing (marker lines at known x coordinates, rendered PDFs inspected as
   * images) — to be unreliable: the plugin's effective horizontal anchor for
   * a given call depends on whether that string starts with an Arabic letter
   * or a digit, so two segments starting with different kinds of character
   * (e.g. a translated label and a formatted date) don't consistently land
   * in reading order relative to each other. One phrase per line sidesteps
   * the problem entirely — each line is just the single-call case, which was
   * separately confirmed correct for every real translated string tried. For
   * Latin script, segments are still joined onto one line as before, since
   * Helvetica has none of these issues.
   */
  private renderHeader(title: string, subtitleParts: string[]) {
    const d = this.doc;
    d.setFont("helvetica", "bold");
    d.setFontSize(18);
    d.setTextColor(...GOLD);
    d.text("Womb Atlas", MARGIN, this.y + 6);

    d.setFont(this.fontFamily(), "normal");
    d.setFontSize(12);
    d.setTextColor(...INK);
    d.text(title, MARGIN, this.y + 14);

    // Subtitle lines sit at fixed offsets below the title (the header isn't
    // paginated, so this doesn't flow through `this.y`/ensureSpace like the
    // rest of the report) — stacked one per line for Arabic, same rationale
    // as this method's doc comment above.
    if (subtitleParts.length > 0) {
      d.setFont(this.fontFamily(), "normal");
      d.setFontSize(9);
      d.setTextColor(...MUTED);
      if (!this.isArabic) {
        d.text(subtitleParts.join(" · "), MARGIN, this.y + 20);
      } else {
        subtitleParts.forEach((part, i) => d.text(part, MARGIN, this.y + 20 + i * 4.5));
      }
    }

    const subtitleHeight = this.isArabic ? Math.max(0, subtitleParts.length - 1) * 4.5 : 0;
    d.setDrawColor(...GOLD);
    d.setLineWidth(0.4);
    d.line(MARGIN, this.y + 24 + subtitleHeight, PAGE_WIDTH - MARGIN, this.y + 24 + subtitleHeight);
    this.y += 32 + subtitleHeight;
  }

  private renderFooter() {
    const d = this.doc;
    d.setFont(this.fontFamily(), "normal");
    d.setFontSize(8);
    d.setTextColor(...FAINT);
    d.text(
      `${v43Text("_template", "pdfPage", "Page", this.locale)} ${this.pageNum}`,
      PAGE_WIDTH - MARGIN,
      PAGE_HEIGHT - 10,
      { align: "right" },
    );
    d.text(
      v43Text(
        "_template",
        "pdfGeneratedByFooter",
        `Generated by Womb Atlas ${this.dash()} observational, not diagnostic`,
        this.locale,
      ),
      MARGIN,
      PAGE_HEIGHT - 10,
    );
  }

  private ensureSpace(height: number) {
    if (this.y + height > PAGE_HEIGHT - MARGIN - 12) {
      this.renderFooter();
      this.doc.addPage();
      this.pageNum += 1;
      this.y = MARGIN;
    }
  }

  sectionTitle(text: string) {
    this.ensureSpace(10);
    const d = this.doc;
    d.setFont(this.fontFamily(), "bold");
    d.setFontSize(10);
    d.setTextColor(...GOLD);
    d.text(text.toUpperCase(), MARGIN, this.y);
    this.y += 6;
  }

  paragraph(text: string, opts?: PdfTextOpts) {
    const d = this.doc;
    const size = opts?.size ?? 10;
    const color = opts?.color ?? INK;
    d.setFont(this.fontFamily(), opts?.bold ? "bold" : "normal");
    d.setFontSize(size);
    d.setTextColor(...color);
    const lines: string[] = d.splitTextToSize(text, CONTENT_WIDTH);
    for (const line of lines) {
      this.ensureSpace(6);
      d.text(line, MARGIN, this.y);
      this.y += size * 0.52;
    }
    this.y += 3;
  }

  bulletList(items: string[]) {
    const d = this.doc;
    d.setFont(this.fontFamily(), "normal");
    d.setFontSize(10);
    d.setTextColor(...INK);
    for (const item of items) {
      const lines: string[] = d.splitTextToSize(`•  ${item}`, CONTENT_WIDTH - 4);
      for (const line of lines) {
        this.ensureSpace(6);
        d.text(line, MARGIN + 2, this.y);
        this.y += 5.2;
      }
    }
    this.y += 3;
  }

  /** Like bulletList, but each item is two independently-translated segments
   *  — e.g. a Care Journey phase name and its Done/Pending status. Latin
   *  script draws "label — status" on one bulleted line; Arabic draws the
   *  label as its own bulleted line and the status as an indented line
   *  beneath it (see renderHeader's doc comment for why). */
  bulletListSegmented(items: [string, string][]) {
    const d = this.doc;
    for (const [label, status] of items) {
      d.setFont(this.fontFamily(), "normal");
      d.setFontSize(10);
      d.setTextColor(...INK);
      if (!this.isArabic) {
        this.ensureSpace(6);
        d.text("•", MARGIN, this.y);
        d.text(`${label} ${this.dash()} ${status}`, MARGIN + 4, this.y);
        this.y += 5.2;
      } else {
        this.ensureSpace(6);
        d.text("•", MARGIN, this.y);
        d.text(label, MARGIN + 4, this.y);
        this.y += 5.2;
        this.ensureSpace(6);
        d.text(status, MARGIN + 4, this.y);
        this.y += 5.2;
      }
    }
    this.y += 3;
  }

  table(headers: string[], rows: string[][]) {
    if (rows.length === 0) return;
    const d = this.doc;
    const colWidth = CONTENT_WIDTH / headers.length;

    const drawHeaderRow = () => {
      d.setFont(this.fontFamily(), "bold");
      d.setFontSize(8.5);
      d.setTextColor(...GOLD);
      headers.forEach((h, i) => d.text(h.toUpperCase(), MARGIN + i * colWidth, this.y));
      this.y += 4;
      d.setDrawColor(...GOLD);
      d.setLineWidth(0.2);
      d.line(MARGIN, this.y, PAGE_WIDTH - MARGIN, this.y);
      this.y += 4.5;
    };

    this.ensureSpace(16);
    drawHeaderRow();

    for (const row of rows) {
      d.setFont(this.fontFamily(), "normal");
      d.setFontSize(8.5);
      const cellLines = row.map((cell) => d.splitTextToSize(cell || this.dash(), colWidth - 3) as string[]);
      const lineCount = Math.max(...cellLines.map((lines) => lines.length), 1);
      const rowHeight = lineCount * 4.2 + 1.5;

      if (this.y + rowHeight > PAGE_HEIGHT - MARGIN - 12) {
        this.renderFooter();
        this.doc.addPage();
        this.pageNum += 1;
        this.y = MARGIN;
        drawHeaderRow();
      }

      d.setTextColor(...INK);
      cellLines.forEach((lines, i) => {
        lines.forEach((line, li) => d.text(line, MARGIN + i * colWidth, this.y + li * 4.2));
      });
      this.y += rowHeight;
    }
    this.y += 3;
  }

  entryTitle(text: string) {
    this.ensureSpace(6);
    const d = this.doc;
    d.setFont(this.fontFamily(), "bold");
    d.setFontSize(10);
    d.setTextColor(...INK);
    d.text(text, MARGIN, this.y);
    this.y += 5.5;
  }

  /** Date + title. Latin script draws them on one line; Arabic draws the
   *  title as its own bold line and the date as a smaller line beneath it
   *  (see renderHeader's doc comment for why they aren't placed side by side). */
  entryTitleSegmented(date: string, title: string) {
    const d = this.doc;
    if (!this.isArabic) {
      this.ensureSpace(6);
      d.setFont(this.fontFamily(), "bold");
      d.setFontSize(10);
      d.setTextColor(...INK);
      d.text(`${date} ${this.dash()} ${title}`, MARGIN, this.y);
      this.y += 5.5;
      return;
    }
    this.ensureSpace(6);
    d.setFont(this.fontFamily(), "bold");
    d.setFontSize(10);
    d.setTextColor(...INK);
    d.text(title, MARGIN, this.y);
    this.y += 5;
    this.ensureSpace(5);
    d.setFont(this.fontFamily(), "normal");
    d.setFontSize(8.5);
    d.setTextColor(...MUTED);
    d.text(date, MARGIN, this.y);
    this.y += 5;
  }

  labelValue(label: string, value: string) {
    this.ensureSpace(10);
    const d = this.doc;
    d.setFont(this.fontFamily(), "bold");
    d.setFontSize(8);
    d.setTextColor(...GOLD);
    d.text(label.toUpperCase(), MARGIN, this.y);
    this.y += 4.5;
    this.paragraph(value, { size: 9.5, color: MUTED });
  }

  spacer(mm = 4) {
    this.y += mm;
  }

  save(filename: string) {
    this.renderFooter();
    this.doc.save(filename);
  }
}

function fmtDate(iso?: string, locale?: string) {
  const date = iso ? new Date(iso) : new Date();
  return formatDateLong(date, locale);
}

// Signal domains come through as raw AIKB taxonomy slugs (e.g.
// "bleeding_characteristics", "body_changes_physical_manifestations") — not
// meant for display. Title-case them for the export instead of showing snake_case.
function humanizeSlug(raw: string): string {
  return raw
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** The signals table's "Domain" column: `s.domain` is actually an AIKB
 *  signalType slug (see api/observation/intelligence/route.ts), so it's
 *  mapped to one of the six display domains and translated the same way as
 *  everywhere else, rather than title-casing the raw slug. */
function signalDomainLabel(signalType: string, locale?: string): string {
  return domainLabel(signalTypeDomain(signalType), locale);
}

/** The signals table's "Severity" column: values are drawn from the
 *  EvidenceConfidence ladder (in practice always "moderate" — see
 *  summary.ts) but title-cased as a raw slug rather than translated. Reuse
 *  the same evidence-ladder translation used everywhere else when the value
 *  is recognized; fall back to the old behaviour otherwise. */
function signalSeverityLabel(severity: string, locale?: string): string {
  return isEvidenceConfidence(severity) ? evidenceLabel(severity, locale) : humanizeSlug(severity);
}

export interface TimelineExportData {
  events: TimelineEvent[];
  signalSeries: SignalSeriesPoint[];
  signalDomains: string[];
  careJourney: CareJourney | null;
  lifeStage: LifeStage | null;
  locale?: string;
}

/** Replaces the old JSON export — a formatted, paginated Atlas Timeline PDF. */
export async function generateTimelinePdf(data: TimelineExportData) {
  const locale = data.locale;
  const t = (field: string, fallback: string) => v43Text("_template", field, fallback, locale);
  const real = data.events.filter((e) => !e.pending);
  const eventWord = t(real.length === 1 ? "pdfEventSingular" : "pdfEventPlural", real.length === 1 ? "event" : "events");
  const report = await PdfReport.create(
    t("pdfTimelineTitle", "Atlas Timeline"),
    [`${t("pdfGeneratedPrefix", "Generated")} ${fmtDate(undefined, locale)}`, `${real.length} ${eventWord}`],
    locale,
  );

  report.sectionTitle(t("pdfHealthJourney", "Health Journey"));
  if (real.length === 0) {
    report.paragraph(
      t(
        "pdfNoTimelineEvents",
        "No timeline events yet — this will populate once your first observation is complete.",
      ),
    );
  } else {
    for (const event of real) {
      report.entryTitleSegmented(event.date, event.title);
      report.paragraph(event.description, { size: 9.5, color: MUTED });
    }
  }

  report.spacer(2);
  report.sectionTitle(t("pdfSignalEvolutionOverTime", "Signal Evolution Over Time"));
  if (data.signalSeries.length === 0 || data.signalDomains.length === 0) {
    report.paragraph(
      t(
        "pdfSignalTrendsEmpty",
        "Your signal trends will appear here once your first Atlas Record is generated.",
      ),
    );
  } else {
    report.table(
      [t("pdfDateColumn", "Date"), ...data.signalDomains.map((domain) => domainLabel(domain, locale))],
      data.signalSeries.map((point) => [
        point.name,
        ...data.signalDomains.map((domain) => {
          const value = point[domain];
          return typeof value === "number" ? String(value) : "—";
        }),
      ]),
    );
  }

  report.spacer(2);
  report.sectionTitle(t("pdfCareJourney", "Care Journey"));
  if (!data.careJourney) {
    report.paragraph(t("pdfCareJourneyEmpty", "Begins once you complete your first observation."));
  } else {
    report.paragraph(`${t("pdfCurrentPhasePrefix", "Current phase:")} ${data.careJourney.currentLabel}`);
    report.paragraph(data.careJourney.description, { size: 9.5, color: MUTED });
    const doneWord = t("pdfDone", "Done");
    const pendingWord = t("pdfPending", "Pending");
    report.bulletListSegmented(
      data.careJourney.phases.map((phase) => [phase.label, phase.done ? doneWord : pendingWord]),
    );
  }

  report.spacer(2);
  report.sectionTitle(t("pdfLifeStageJourney", "Life Stage Journey"));
  if (!data.lifeStage) {
    report.paragraph(t("pdfLifeStageEmpty", "Share your context in your first observation to see this here."));
  } else {
    report.paragraph(`${t("pdfYouAreInYour", "You are in your")} ${data.lifeStage.label}`);
    report.paragraph(data.lifeStage.description, { size: 9.5, color: MUTED });
  }

  report.save("atlas-timeline.pdf");
}

function burdenLevelLabel(burden: string | undefined, locale?: string): string {
  switch (burden) {
    case "Low":
      return v43Text("_template", "burdenLevelLow", "Low", locale);
    case "Moderate":
      return v43Text("_template", "burdenLevelModerate", "Moderate", locale);
    case "High":
      return v43Text("_template", "burdenLevelHigh", "High", locale);
    default:
      return "—";
  }
}

/** Replaces the old JSON export — a formatted, paginated Atlas Record PDF. */
export async function generateAtlasRecordPdf(record: RecordResult, locale?: string) {
  const t = (field: string, fallback: string) => v43Text("_template", field, fallback, locale);
  const detail = record.atlasRecordDetail;
  const archetype = record.archetype;
  const rc = record.reflectionContent;
  const whatAtlasWillWatch = detail?.whatAtlasWillWatch?.length
    ? detail.whatAtlasWillWatch
    : rc?.whatAtlasWillWatch ?? [];
  const bodyLiteracyNote = detail?.bodyLiteracyNote ?? rc?.bodyLiteracyNote;

  const report = await PdfReport.create(
    t("pdfRecordTitle", "Atlas Record"),
    [
      `${t("pdfGeneratedPrefix", "Generated")} ${fmtDate(detail?.generatedAt, locale)}`,
      `${t("pdfBurdenPrefix", "Burden:")} ${burdenLevelLabel(record.burden, locale)}`,
    ],
    locale,
  );

  if (detail?.observationPortrait) {
    report.sectionTitle(t("pdfObservationPortrait", "Observation Portrait"));
    report.paragraph(detail.observationPortrait);
  }

  report.sectionTitle(t("pdfDominantPattern", "Dominant Pattern"));
  report.paragraph(detail?.dominantPattern ?? rc?.dominantPattern ?? "—");
  if (rc?.dominantPatternSummary) {
    report.paragraph(rc.dominantPatternSummary, { size: 9.5, color: MUTED });
  }

  if (detail && detail.supportingPatterns.length > 0) {
    report.sectionTitle(t("pdfSupportingPatterns", "Supporting Patterns"));
    report.bulletList(detail.supportingPatterns);
  }

  if (archetype) {
    report.sectionTitle(t("pdfAtlasArchetype", "Atlas Archetype"));
    report.paragraph(archetype.name);
    report.sectionTitle(t("pdfWhatArchetypeMeans", "What This Archetype Means"));
    report.paragraph(archetype.whatThisMeans);
  }

  if (detail) {
    report.sectionTitle(t("pdfSignalLandscape", "Signal Landscape"));
    report.paragraph(detail.signalLandscape.label ?? detail.signalLandscape.name);
    report.paragraph(detail.signalLandscape.description, { size: 9.5, color: MUTED });
  }

  if (record.signals.length > 0) {
    report.sectionTitle(t("pdfSignalsObserved", "Signals Observed"));
    report.table(
      [t("pdfDomainColumn", "Domain"), t("pdfSignalColumn", "Signal"), t("pdfSeverityColumn", "Severity")],
      record.signals.map((s) => [
        signalDomainLabel(s.domain, locale),
        v43Text(s.signalId, "label", s.name, locale),
        signalSeverityLabel(s.severity, locale),
      ]),
    );
  }

  if (detail && detail.narrativeThemes.length > 0) {
    report.sectionTitle(t("pdfNarrativeThemes", "Narrative Themes"));
    report.bulletList(detail.narrativeThemes);
  }

  if (detail && detail.experienceLayers.length > 0) {
    report.sectionTitle(t("pdfExperienceLayers", "Experience Layers"));
    for (const layer of detail.experienceLayers) {
      report.labelValue(layer.label ?? layer.name, layer.description);
    }
  }

  if (detail && detail.strengths.length > 0) {
    report.sectionTitle(t("pdfStrengthsObserved", "Strengths Atlas Observed"));
    report.bulletList(detail.strengths.map((s) => `${s.label ?? s.name}: ${s.reflectionText}`));
  }

  if (bodyLiteracyNote) {
    report.sectionTitle(t("pdfBodyLiteracy", "Body Literacy"));
    report.paragraph(bodyLiteracyNote);
  }

  if (whatAtlasWillWatch.length > 0) {
    report.sectionTitle(t("pdfWhatAtlasWillWatch", "What Atlas Will Watch"));
    report.bulletList(whatAtlasWillWatch);
  }

  if (detail) {
    report.sectionTitle(t("pdfReflectionCompass", "Reflection Compass"));
    report.labelValue(t("pdfStrongestTheme", "Strongest Theme"), detail.reflectionCompass.strongestTheme);
    report.labelValue(t("pdfEmergingTheme", "Emerging Theme"), detail.reflectionCompass.emergingTheme);
    report.labelValue(t("pdfStrengthObserved", "Strength Observed"), detail.reflectionCompass.strengthObserved);
    report.labelValue(t("pdfWhatAtlasWillWatch", "What Atlas Will Watch"), detail.reflectionCompass.whatAtlasWillWatch);
  }

  report.spacer(2);
  report.paragraph(
    detail?.disclaimer ??
      t(
        "pdfRecordDisclaimerFallback",
        "This Atlas Record is observational and reflective. It is not a diagnosis.",
      ),
    { size: 8, color: FAINT },
  );

  report.save("womb-atlas-record.pdf");
}
