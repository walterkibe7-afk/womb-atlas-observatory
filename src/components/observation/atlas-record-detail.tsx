"use client";

// Presentational Atlas Record detail, rendered from a persisted RecordResult-shaped
// payload (AtlasRecord.record_payload). Used by the My Records page. Mirrors the
// wizard's in-flow "Your Atlas Record" screen but self-contained for read views.
import { CheckCircle2, Download } from "lucide-react";
import type { ReactNode } from "react";
import type { RecordResult } from "@/app/(participant)/observation/screens/ScreenRenderer";
import { generateAtlasRecordPdf } from "@/lib/pdf/atlas-pdf";
import { burdenBadgeClass, burdenLabel } from "@/components/observation/burden-style";
import { useUiStrings } from "@/lib/observation/ui-strings-context";
import { useLocale } from "@/lib/observation/use-locale";

function BurdenBadge({ burden }: { burden?: string }) {
  const strings = useUiStrings();
  const color = burdenBadgeClass(burden);
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs border ${color}`}>
      {strings.burdenLabelPrefix} {burden ? burdenLabel(burden, strings) : "—"}
    </span>
  );
}

function RecordSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-[var(--color-surface)] border border-[var(--color-border)] p-5 rounded-2xl">
      <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-brand-gold)]">{title}</p>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function AtlasRecordDetail({
  record,
  showDownload = true,
}: {
  record: RecordResult;
  showDownload?: boolean;
}) {
  const strings = useUiStrings();
  const locale = useLocale();
  const detail = record.atlasRecordDetail;
  const archetype = record.archetype;
  const rc = record.reflectionContent;
  const whatAtlasWillWatch = detail?.whatAtlasWillWatch?.length
    ? detail.whatAtlasWillWatch
    : rc?.whatAtlasWillWatch ?? [];
  const bodyLiteracyNote = detail?.bodyLiteracyNote ?? rc?.bodyLiteracyNote;

  async function downloadRecord() {
    if (!detail) return;
    try {
      await generateAtlasRecordPdf(record, locale);
    } catch (err) {
      console.error("Failed to generate Atlas Record PDF:", err);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center space-x-2 bg-brand-green/15 text-brand-green px-3 py-1 rounded-full text-xs border border-brand-green/40">
          <CheckCircle2 size={12} />
          <span>{strings.observationValidated}</span>
        </div>
        <BurdenBadge burden={record.burden} />
      </div>

      {detail?.observationPortrait && (
        <RecordSection title={strings.sectionObservationPortrait}>
          <p className="text-sm text-fg leading-relaxed">{detail.observationPortrait}</p>
        </RecordSection>
      )}

      <RecordSection title={strings.sectionDominantPattern}>
        <p className="text-fg font-medium">{detail?.dominantPattern ?? rc?.dominantPattern ?? "—"}</p>
        {rc?.dominantPatternSummary && <p className="mt-1 text-sm text-muted">{rc.dominantPatternSummary}</p>}
      </RecordSection>

      {detail && detail.supportingPatterns.length > 0 && (
        <RecordSection title={strings.cardSupportingPatterns}>
          <div className="space-y-1">
            {detail.supportingPatterns.map((p) => (
              <p className="text-sm text-fg" key={p}>
                {p}
              </p>
            ))}
          </div>
        </RecordSection>
      )}

      {archetype && (
        <>
          <RecordSection title={strings.sectionAtlasArchetype}>
            <p className="text-fg font-medium">{archetype.name}</p>
          </RecordSection>
          <RecordSection title={strings.sectionArchetypeMeaning}>
            <p className="text-sm text-muted leading-relaxed">{archetype.whatThisMeans}</p>
          </RecordSection>
        </>
      )}

      {detail && (
        <RecordSection title={strings.sectionSignalLandscape}>
          <p className="text-fg font-medium">{detail.signalLandscape.label ?? detail.signalLandscape.name}</p>
          <p className="mt-1 text-sm text-muted">{detail.signalLandscape.description}</p>
        </RecordSection>
      )}

      {detail && detail.narrativeThemes.length > 0 && (
        <RecordSection title={strings.cardNarrativeThemes}>
          <div className="space-y-1">
            {detail.narrativeThemes.map((t, i) => (
              <p className="text-sm text-fg" key={`${t}-${i}`}>
                {t}
              </p>
            ))}
          </div>
        </RecordSection>
      )}

      {detail && detail.experienceLayers.length > 0 && (
        <RecordSection title={strings.sectionExperienceLayers}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {detail.experienceLayers.map((layer) => (
              <div
                key={layer.name}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3"
              >
                <p className="text-fg font-medium text-sm">{layer.label ?? layer.name}</p>
                <p className="mt-1 text-xs text-muted leading-relaxed">{layer.description}</p>
              </div>
            ))}
          </div>
        </RecordSection>
      )}

      {detail && detail.strengths.length > 0 && (
        <RecordSection title={strings.sectionStrengths}>
          <div className="space-y-1">
            {detail.strengths.map((s) => (
              <p className="text-sm text-fg" key={s.name}>
                {s.label ?? s.name}: {s.reflectionText}
              </p>
            ))}
          </div>
        </RecordSection>
      )}

      {bodyLiteracyNote && (
        <RecordSection title={strings.sectionBodyLiteracy}>
          <p className="text-sm text-muted leading-relaxed">{bodyLiteracyNote}</p>
        </RecordSection>
      )}

      {whatAtlasWillWatch.length > 0 && (
        <RecordSection title={strings.sectionWhatAtlasWillWatch}>
          <ul className="list-disc list-inside text-sm text-muted space-y-1">
            {whatAtlasWillWatch.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </RecordSection>
      )}

      {detail && (
        <RecordSection title={strings.sectionReflectionCompass}>
          <div className="space-y-2">
            {[
              { label: strings.compassStrongestTheme, value: detail.reflectionCompass.strongestTheme },
              { label: strings.compassEmergingTheme, value: detail.reflectionCompass.emergingTheme },
              { label: strings.compassStrengthObserved, value: detail.reflectionCompass.strengthObserved },
              { label: strings.sectionWhatAtlasWillWatch, value: detail.reflectionCompass.whatAtlasWillWatch },
            ].map((item) => (
              <div key={item.label}>
                <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-brand-gold)]">{item.label}</p>
                <p className="mt-0.5 text-sm text-muted">{item.value}</p>
              </div>
            ))}
          </div>
        </RecordSection>
      )}

      {showDownload && (
        <button
          className="w-full flex items-center justify-center gap-2 border border-[var(--color-brand-gold)] text-[var(--color-brand-gold)] px-4 py-3 rounded-xl font-medium hover:bg-[var(--color-brand-gold)]/10 transition-colors disabled:opacity-40"
          disabled={!detail}
          onClick={downloadRecord}
          type="button"
        >
          <Download size={16} /> {strings.downloadRecordButton}
        </button>
      )}

      <p className="text-xs text-faint">
        {detail?.disclaimer ?? `${strings.recordDisclaimer}${strings.recordDisclaimerEnd}`}
      </p>
    </div>
  );
}
