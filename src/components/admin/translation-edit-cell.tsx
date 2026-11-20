"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  value: string;
  locale: string;
  onSave: (locale: string, value: string) => Promise<void>;
}

export function TranslationEditCell({ value, locale, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = async () => {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(locale, draft);
      setEditing(false);
    } catch {
      setDraft(value);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        disabled={saving}
        className="w-full bg-[#0d0912] border border-[#cf8c5e] rounded px-2 py-1 text-sm text-[#f9ddca] focus:outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="w-full text-left text-sm text-[#c6a090] hover:text-[#f9ddca] px-2 py-1 rounded hover:bg-[#1b111f] transition-colors min-h-7 wrap-anywhere"
      title="Click to edit"
    >
      {value || <span className="text-[#6a5a50] italic">Empty</span>}
    </button>
  );
}
