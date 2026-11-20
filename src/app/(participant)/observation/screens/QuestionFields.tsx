"use client";

import type { AnswerValue, Question } from "@/lib/observation/types";
import { CountrySearchField } from "@/components/observation/country-search-field";
import { useUiStrings } from "@/lib/observation/ui-strings-context";

// An "off-list" option ("Somewhere else", "Something else") only records that the
// real answer isn't among the choices — so it needs somewhere to put that answer.
// Selecting one reveals a free-text box stored under a companion `<fieldId>_other`
// response, which leaves the option array (and everything projecting from it)
// untouched while the detail still rides along in the observation payload.
// Matched by pattern rather than an allow-list: the LOER blueprints phrase this
// option a dozen ways ("Another approach", "Somewhere else/self-describe",
// "Another pattern — self-describe", "Other (please describe)"), and a fixed set
// of two values silently dropped the free-text box on every screen but two.
const SPECIFY_OPTION = /^(other|another|somewhere_else|something_else)(_|$)|self_describe|please_describe/;

export function specifyFieldId(fieldId: string) {
  return `${fieldId}_other`;
}

interface Props {
  question: Question;
  value: AnswerValue | undefined;
  onChange: (fieldId: string, value: AnswerValue) => void;
  disabled?: boolean;
  /** Current text of the companion `<fieldId>_other` answer, when one applies. */
  otherValue?: AnswerValue | undefined;
}

// Option-card language shared by single/multi-select and boolean questions —
// mobile-app parity: light "cream"/"paper" cards floating on the dark
// backdrop (not the app's dark palette), matching the mobile app's option
// card exactly. Selection is shown purely via the has-[:checked] border/bg
// swap, no separate check icon; a vertical stack of full-width cards, each an
// actual radio/checkbox input (native control on the left, label filling the
// rest) rather than a plain button.
//
// `onActivate` fires both on a real onChange (unchecked -> checked) and, for
// radios only, on a click while already checked — native radios never emit
// onChange in that case, so without the onClick fallback a single-option (or
// otherwise "optional") radio group could never be cleared once selected.
function OptionCard({
  type,
  name,
  checked,
  onActivate,
  label,
  disabled,
  surface = "cream",
}: {
  type: "radio" | "checkbox";
  name: string;
  checked: boolean;
  onActivate: () => void;
  label: string;
  disabled?: boolean;
  surface?: "cream" | "paper";
}) {
  const bgClass = surface === "cream" ? "bg-participant-form-cream" : "bg-participant-form-paper";
  return (
    <label
      className={`flex w-full items-start gap-2.5 rounded-[10px] border border-participant-sand/60 ${bgClass} px-4 py-3 text-[15px] leading-5 text-participant-plum shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] transition-colors duration-150 has-[:checked]:border-participant-copper has-[:checked]:bg-participant-form-selected has-[:checked]:text-participant-ink ${
        disabled
          ? "cursor-not-allowed opacity-50"
          : "cursor-pointer hover:border-participant-copper/75 focus-within:border-participant-copper"
      }`}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onActivate}
        onClick={type === "radio" ? () => checked && onActivate() : undefined}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--color-participant-copper)]"
      />
      <span className="min-w-0 flex-1 whitespace-normal break-words">{label}</span>
    </label>
  );
}

// Renders the input control for a single question, driven entirely by its
// fieldType + options (all DB-sourced). Shared by question / safety / consent screens.
export default function QuestionFields({
  question,
  value,
  onChange,
  disabled = false,
  otherValue,
}: Props) {
  const strings = useUiStrings();
  const q = question;

  const specifyOption = q.options.find((o) => SPECIFY_OPTION.test(o.value));
  const specifySelected = specifyOption
    ? Array.isArray(value)
      ? value.includes(specifyOption.value)
      : value === specifyOption.value
    : false;

  // Dropping the off-list option drops the text that only existed to explain it,
  // so a stale description can't survive into the payload.
  const clearSpecify = () => onChange(specifyFieldId(q.fieldId), null);

  const commitMulti = (next: string[]) => {
    if (specifyOption && !next.includes(specifyOption.value)) clearSpecify();
    onChange(q.fieldId, next);
  };

  const toggleMulti = (optValue: string, isExclusive: boolean) => {
    const current = Array.isArray(value) ? [...value] : [];
    const exclusiveValues = q.options.filter((o) => o.isExclusive).map((o) => o.value);
    if (current.includes(optValue)) {
      commitMulti(current.filter((v) => v !== optValue));
      return;
    }
    if (isExclusive) {
      commitMulti([optValue]); // exclusive clears everything else
      return;
    }
    // selecting a normal option removes any exclusive selection
    const next = current.filter((v) => !exclusiveValues.includes(v));
    commitMulti([...next, optValue]);
  };

  const selectSingle = (optValue: string) => {
    const next = value === optValue ? null : optValue;
    if (specifyOption && next !== specifyOption.value) clearSpecify();
    onChange(q.fieldId, next);
  };

  const specifyField = specifyOption && specifySelected && (
    <input
      type="text"
      value={typeof otherValue === "string" ? otherValue : ""}
      onChange={(e) => onChange(specifyFieldId(q.fieldId), e.target.value)}
      placeholder={`${specifyOption.label} — ${strings.pleaseDescribe}`}
      aria-label={`${specifyOption.label} — ${strings.pleaseDescribe}`}
      disabled={disabled}
      className="w-full bg-participant-form-paper border border-participant-sand/60 rounded-[10px] p-4 text-participant-plum placeholder:text-participant-plum/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] focus:outline-none focus:border-participant-copper disabled:cursor-not-allowed"
    />
  );

  return (
    <div className={`space-y-4 ${disabled ? "opacity-50" : ""}`}>
      <label className="block font-serif text-xl font-light leading-snug text-fg">{q.questionText}</label>

      {q.fieldType === "single_select" && (
        <div className="grid gap-2.5">
          {q.options.map((opt) => (
            <OptionCard
              key={opt.value}
              type="radio"
              name={q.fieldId}
              checked={value === opt.value}
              disabled={disabled}
              onActivate={() => selectSingle(opt.value)}
              label={opt.label}
            />
          ))}
          {specifyField}
        </div>
      )}

      {q.fieldType === "multi_select" && (
        <div className="grid gap-2.5">
          {q.options.map((opt) => {
            const selected = Array.isArray(value) && value.includes(opt.value);
            return (
              <OptionCard
                key={opt.value}
                type="checkbox"
                name={`${q.fieldId}-${opt.value}`}
                checked={selected}
                disabled={disabled}
                onActivate={() => toggleMulti(opt.value, opt.isExclusive)}
                label={opt.label}
                surface="paper"
              />
            );
          })}
          {specifyField}
        </div>
      )}

      {q.fieldType === "boolean" && (
        <div className="grid gap-2.5">
          <OptionCard
            type="radio"
            name={q.fieldId}
            checked={value === true}
            disabled={disabled}
            onActivate={() => onChange(q.fieldId, value === true ? null : true)}
            label={strings.yes}
          />
          <OptionCard
            type="radio"
            name={q.fieldId}
            checked={value === false}
            disabled={disabled}
            onActivate={() => onChange(q.fieldId, value === false ? null : false)}
            label={strings.no}
          />
        </div>
      )}

      {q.fieldType === "country" && (
        <CountrySearchField
          value={typeof value === "string" ? value : ""}
          onChange={(next) => onChange(q.fieldId, next)}
        />
      )}

      {q.fieldType === "text" && (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(q.fieldId, e.target.value)}
          placeholder={strings.typeYourAnswer}
          disabled={disabled}
          className="w-full bg-participant-form-paper border border-participant-sand/60 rounded-[10px] p-4 text-participant-plum placeholder:text-participant-plum/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] focus:outline-none focus:border-participant-copper disabled:cursor-not-allowed"
        />
      )}
    </div>
  );
}
