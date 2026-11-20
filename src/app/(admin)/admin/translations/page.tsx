"use client";

import { useState, useEffect } from "react";
import { TranslationsTable } from "./translations-table";

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

interface PageResponse {
  content: Translation[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

const ENTITY_TYPES = [
  { prefix: "SCREEN.", label: "Screens" },
  { prefix: "QUESTION.", label: "Questions" },
  { prefix: "OPTION.", label: "Options" },
  { prefix: "PROMPT.", label: "Prompts" },
  { prefix: "UI.", label: "UI Chrome" },
];

export default function TranslationsAdminPage() {
  const [data, setData] = useState<PageResponse | null>(null);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTranslations = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ fetchAll: "true" });
      if (entityFilter && search) {
        params.set("entityType", entityFilter);
        params.set("search", search);
      } else if (entityFilter) {
        params.set("entityType", entityFilter);
      } else if (search) {
        params.set("search", search);
      }
      const res = await fetch(`/api/translations?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json: PageResponse = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTranslations();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, entityFilter]);

  const handleUpdate = async (id: string, locale: string, value: string) => {
    try {
      setError(null);
      const res = await fetch(`/api/translations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          translationValues: [{ locale, value }],
        }),
      });
      if (!res.ok) throw new Error(`Update failed: ${res.status}`);
      await fetchTranslations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setError(null);
      const res = await fetch(`/api/translations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      await fetchTranslations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-serif text-[#cf8c5e]">Translations</h1>
        <p className="text-sm text-[#c6a090] mt-1">
          Manage observation flow translations across all languages.
        </p>
      </header>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search keys or translations..."
          className="flex-1 min-w-0 bg-[#130d19] border border-[#41223f] rounded-xl px-4 py-2 text-sm text-[#f9ddca] focus:outline-none focus:border-[#cf8c5e] placeholder-[#ac826d]"
        />
        <select
          value={entityFilter}
          onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
          className="bg-[#130d19] border border-[#41223f] rounded-xl px-4 py-2 text-sm text-[#f9ddca] focus:outline-none focus:border-[#cf8c5e]"
        >
          <option value="" className="bg-[#130d19]">All Types</option>
          {ENTITY_TYPES.map((et) => (
            <option key={et.prefix} value={et.prefix} className="bg-[#130d19]">{et.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-[#c6a090] text-sm">Loading translations...</p>
      ) : data && data.content.length > 0 ? (
        <>
          <TranslationsTable
            translations={data.content}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
          <p className="text-xs text-[#ac826d]">
            {data.total} translation key{data.total !== 1 ? "s" : ""}
          </p>
        </>
      ) : (
        <p className="text-[#c6a090] text-sm">No translations found.</p>
      )}
    </div>
  );
}
