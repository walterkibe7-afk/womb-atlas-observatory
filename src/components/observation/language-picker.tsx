"use client";

import { LANGUAGES } from "@/lib/observation/languages";

interface Props {
  value: string;
  onChange: (code: string) => void;
}

export default function LanguagePicker({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-muted uppercase tracking-wider">
        Select your language
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => onChange(lang.code)}
            className={`p-4 rounded-xl border text-center transition-colors ${
              value === lang.code
                ? "bg-[var(--color-brand-purple-dark)] border-[var(--color-brand-gold)] text-fg"
                : "bg-[var(--color-background)] border-[var(--color-border)] text-muted hover:border-border-strong"
            }`}
          >
            <span className="block text-lg font-medium">{lang.nativeName}</span>
            <span className="block text-xs text-faint mt-1">{lang.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
