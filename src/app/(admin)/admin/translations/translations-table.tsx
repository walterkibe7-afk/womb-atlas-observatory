"use client";

import { useState } from "react";
import { TranslationEditCell } from "@/components/admin/translation-edit-cell";
import { LANGUAGES } from "@/lib/observation/languages";

interface TranslationValue {
  id?: number;
  locale: string;
  value: string;
}

interface Translation {
  id: string;
  key: string;
  translationValues: TranslationValue[];
}

const LOCALES = LANGUAGES.map((language) => language.code);
const LOCALE_LABELS = Object.fromEntries(
  LANGUAGES.map((language) => [language.code, language.name]),
);

// Column widths in rem, matching the Tailwind spacing utilities below
// (w-65 = 16.25rem, w-37.5 = 9.375rem, w-22.5 = 5.625rem). The table min-width
// is the sum of its columns so the overflow-x-auto wrapper scrolls horizontally
// instead of the fixed-layout table squishing columns to fit the container.
const KEY_COL_WIDTH = 16.25;
const LOCALE_COL_WIDTH = 9.375;
const ACTION_COL_WIDTH = 5.625;
const MIN_TABLE_WIDTH = KEY_COL_WIDTH + LOCALE_COL_WIDTH * LOCALES.length + ACTION_COL_WIDTH;

interface Props {
  translations: Translation[];
  onUpdate: (id: string, locale: string, value: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function TranslationsTable({ translations, onUpdate, onDelete }: Props) {
  const [deleting, setDeleting] = useState<string | null>(null);

  const getValue = (tv: TranslationValue[], locale: string): string => {
    return tv.find((v) => v.locale === locale)?.value ?? "";
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#41223f] bg-[#130d19]">
      {/* Fixed layout + explicit widths: with `auto`, one long key or translation
          lets the browser starve every other column (the key column collapsed to
          a character per line). The table's min-width is the sum of its columns,
          so columns keep their readable widths and the overflow scrolls
          horizontally above instead of crushing them. */}
      <table className="w-full table-fixed text-sm" style={{ minWidth: `${MIN_TABLE_WIDTH}rem` }}>
        <colgroup>
          <col className="w-65" />
          {LOCALES.map((loc) => (
            <col key={loc} className="w-37.5" />
          ))}
          <col className="w-22.5" />
        </colgroup>
        <thead>
          <tr className="border-b border-[#2f1f35]">
            <th className="sticky left-0 z-10 bg-[#130d19] text-left py-3 px-4 text-[#c6a090] font-medium text-[11px] tracking-wide uppercase border-r border-[#41223f]">Key</th>
            {LOCALES.map((loc) => (
              <th key={loc} className="text-left py-3 px-2 text-[#c6a090] font-medium text-[11px] tracking-wide uppercase">
                {LOCALE_LABELS[loc]}
              </th>
            ))}
            <th className="py-3 px-2" />
          </tr>
        </thead>
        <tbody>
          {translations.map((t) => (
            <tr key={t.id} className="border-b border-[#2f1f35] hover:bg-[#1b111f]">
              <td className="sticky left-0 z-10 bg-[#130d19] hover:bg-[#1b111f] py-2.5 px-4 align-top text-xs text-[#ac826d] font-mono wrap-anywhere border-r border-[#41223f]">
                {t.key}
              </td>
              {LOCALES.map((loc) => (
                <td key={loc} className="py-2.5 px-2">
                  <TranslationEditCell
                    value={getValue(t.translationValues, loc)}
                    locale={loc}
                    onSave={async (locale, value) => {
                      await onUpdate(t.id, locale, value);
                    }}
                  />
                </td>
              ))}
              <td className="py-2.5 px-2 text-center">
                <button
                  type="button"
                  onClick={async () => {
                    if (deleting === t.id) {
                      setDeleting(null);
                      await onDelete(t.id);
                    } else {
                      setDeleting(t.id);
                    }
                  }}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  {deleting === t.id ? "Confirm?" : "Delete"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
