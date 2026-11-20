"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

export function AuditFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const entityTypeParam = searchParams.get("entityType") || "";
  const userEmailParam = searchParams.get("userEmail") || "";

  const [entityType, setEntityType] = useState(entityTypeParam);
  const [userEmail, setUserEmail] = useState(userEmailParam);

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      // Any filter change invalidates the current page offset.
      params.delete("page");
      return params.toString();
    },
    [searchParams]
  );

  const applyTextFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (entityType) params.set("entityType", entityType);
    else params.delete("entityType");

    if (userEmail) params.set("userEmail", userEmail);
    else params.delete("userEmail");

    params.delete("page");

    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 mb-6">
      <select
        className="bg-[#1A1325] border border-[#3A2B4A] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        value={searchParams.get("actionType") || ""}
        onChange={(e) => router.push(`?${createQueryString("actionType", e.target.value)}`)}
      >
        <option value="">All Actions</option>
        <option value="CREATE">CREATE</option>
        <option value="UPDATE">UPDATE</option>
        <option value="DELETE">DELETE</option>
      </select>

      <input
        type="text"
        placeholder="Entity Type (e.g. User)"
        className="bg-[#1A1325] border border-[#3A2B4A] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder-gray-500 flex-1 max-w-xs"
        value={entityType}
        onChange={(e) => setEntityType(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') applyTextFilters();
        }}
      />

      <input
        type="text"
        placeholder="User Email"
        className="bg-[#1A1325] border border-[#3A2B4A] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder-gray-500 flex-1 max-w-xs"
        value={userEmail}
        onChange={(e) => setUserEmail(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') applyTextFilters();
        }}
      />

      <button
        onClick={applyTextFilters}
        className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
      >
        Apply
      </button>

      {(searchParams.get("actionType") || entityTypeParam || userEmailParam) && (
        <button
          onClick={() => {
            setEntityType("");
            setUserEmail("");
            router.push("?");
          }}
          className="text-gray-400 hover:text-white px-2 py-2.5 text-sm transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}
