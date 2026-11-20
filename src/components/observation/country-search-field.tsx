"use client";

// Searchable country dropdown — ported from participant-app
// (src/components/observation/country-search-field.tsx), restyled to
// observatory-system's design tokens. Intl.supportedValuesOf does not support
// "region", so the ISO 3166-1 alpha-2 code list is hardcoded; display names
// come from the built-in Intl.DisplayNames (no dependency needed).
import { useId, useMemo, useState } from "react";

const countryCodes = [
  "AF", "AX", "AL", "DZ", "AS", "AD", "AO", "AI", "AQ", "AG", "AR", "AM", "AW", "AU", "AT",
  "AZ", "BS", "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BM", "BT", "BO", "BQ", "BA", "BW",
  "BV", "BR", "IO", "BN", "BG", "BF", "BI", "KH", "CM", "CA", "CV", "KY", "CF", "TD", "CL",
  "CN", "CX", "CC", "CO", "KM", "CG", "CD", "CK", "CR", "CI", "HR", "CU", "CW", "CY", "CZ",
  "DK", "DJ", "DM", "DO", "EC", "EG", "SV", "GQ", "ER", "EE", "SZ", "ET", "FK", "FO", "FJ",
  "FI", "FR", "GF", "PF", "TF", "GA", "GM", "GE", "DE", "GH", "GI", "GR", "GL", "GD", "GP",
  "GU", "GT", "GG", "GN", "GW", "GY", "HT", "HM", "VA", "HN", "HK", "HU", "IS", "IN", "ID",
  "IR", "IQ", "IE", "IM", "IL", "IT", "JM", "JP", "JE", "JO", "KZ", "KE", "KI", "KP", "KR",
  "KW", "KG", "LA", "LV", "LB", "LS", "LR", "LY", "LI", "LT", "LU", "MO", "MG", "MW", "MY",
  "MV", "ML", "MT", "MH", "MQ", "MR", "MU", "YT", "MX", "FM", "MD", "MC", "MN", "ME", "MS",
  "MA", "MZ", "MM", "NA", "NR", "NP", "NL", "NC", "NZ", "NI", "NE", "NG", "NU", "NF", "MK",
  "MP", "NO", "OM", "PK", "PW", "PS", "PA", "PG", "PY", "PE", "PH", "PN", "PL", "PT", "PR",
  "QA", "RE", "RO", "RU", "RW", "BL", "SH", "KN", "LC", "MF", "PM", "VC", "WS", "SM", "ST",
  "SA", "SN", "RS", "SC", "SL", "SG", "SX", "SK", "SI", "SB", "SO", "ZA", "GS", "SS", "ES",
  "LK", "SD", "SR", "SJ", "SE", "CH", "SY", "TW", "TJ", "TZ", "TH", "TL", "TG", "TK", "TO",
  "TT", "TN", "TR", "TM", "TC", "TV", "UG", "UA", "AE", "GB", "US", "UM", "UY", "UZ", "VU",
  "VE", "VN", "VG", "VI", "WF", "EH", "YE", "ZM", "ZW",
];

type CountryOption = { code: string; name: string };

function getCountryOptions(): CountryOption[] {
  const displayNames = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;

  return countryCodes
    .map((code) => ({ code, name: displayNames?.of(code) ?? code }))
    .filter((country) => country.name !== country.code)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function CountrySearchField({
  value,
  onChange,
  placeholder = "Start typing a country...",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const countries = useMemo(() => getCountryOptions(), []);
  const normalizedValue = value.trim().toLowerCase();

  const filteredCountries = useMemo(() => {
    if (!normalizedValue) return countries;
    return countries.filter(
      (country) =>
        country.name.toLowerCase().includes(normalizedValue) || country.code.toLowerCase().includes(normalizedValue),
    );
  }, [countries, normalizedValue]);

  function selectCountry(country: CountryOption) {
    onChange(country.name);
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <input
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="w-full bg-participant-form-paper border border-participant-sand/60 rounded-xl p-4 text-participant-plum placeholder:text-participant-plum/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] focus:outline-none focus:border-participant-copper"
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        onChange={(e) => {
          onChange(e.currentTarget.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && filteredCountries[0]) {
            e.preventDefault();
            selectCountry(filteredCountries[0]);
          }
        }}
        placeholder={placeholder}
        role="combobox"
        type="text"
        value={value}
      />
      {isOpen && (
        <div
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-participant-sand/60 bg-participant-form-paper py-1 shadow-xl"
          id={listboxId}
          role="listbox"
        >
          {filteredCountries.length > 0 ? (
            filteredCountries.map((country) => (
              <button
                aria-selected={value === country.name}
                className="block w-full px-4 py-2 text-left text-sm text-participant-plum hover:bg-participant-form-selected focus:bg-participant-form-selected focus:outline-none"
                key={country.code}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectCountry(country);
                }}
                role="option"
                type="button"
              >
                {country.name}
              </button>
            ))
          ) : (
            <p className="px-4 py-2 text-sm text-participant-plum/60">No countries found</p>
          )}
        </div>
      )}
    </div>
  );
}
