"use client";

import { FileCheck, Search, Filter } from "lucide-react";

export default function AuditLogs() {
  return (
    <div className="p-4 sm:p-8 pb-20 max-w-6xl mx-auto space-y-6">
      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-serif text-white mb-2">Audit Logs</h1>
        <p className="text-sm text-gray-400">Track all clinical review actions taken on participant observations for compliance and accountability.</p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center bg-[#1A1325] p-4 rounded-xl border border-[#3A2B4A]">
        <div className="relative w-full sm:w-96">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search by Action or Steward ID..." className="w-full bg-[#0F0C16] border border-[#3A2B4A] rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-brand-gold)]" />
        </div>
        <button className="flex items-center justify-center space-x-2 border border-[#3A2B4A] text-gray-300 px-4 py-2 rounded-lg text-sm hover:text-white hover:bg-[#2A1F36] transition-colors shrink-0">
          <Filter size={14} />
          <span>Filter Date Range</span>
        </button>
      </div>

      <div className="border border-[#3A2B4A] rounded-2xl bg-[#0F0C16] overflow-x-auto">
        <table className="w-full min-w-[720px] text-left border-collapse">
          <thead>
            <tr className="bg-[#1A1325] border-b border-[#3A2B4A]">
              <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Timestamp</th>
              <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Action</th>
              <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Target Resource</th>
              <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Actor (Steward)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2A1F36]">
            {[
              { time: "2026-06-24 14:32:01 UTC", action: "OBSERVATION_APPROVED", resource: "OBS-5512", actor: "Dr. Reviewer (ID: 991)" },
              { time: "2026-06-24 14:15:44 UTC", action: "NARRATIVE_AUDIO_PLAYED", resource: "OBS-5512", actor: "Dr. Reviewer (ID: 991)" },
              { time: "2026-06-24 11:05:12 UTC", action: "OBSERVATION_FLAGGED", resource: "OBS-4491", actor: "Staff-42 (ID: 882)" },
              { time: "2026-06-24 09:00:00 UTC", action: "STEWARD_LOGIN", resource: "SYSTEM", actor: "Dr. Reviewer (ID: 991)" },
            ].map((row, i) => (
              <tr key={i} className="hover:bg-[#1A1325] transition-colors">
                <td className="p-4 text-sm text-gray-400 font-mono text-xs whitespace-nowrap">{row.time}</td>
                <td className="p-4 text-sm text-white font-medium">{row.action}</td>
                <td className="p-4 text-sm text-[var(--color-brand-gold)]">{row.resource}</td>
                <td className="p-4 text-sm text-gray-300">{row.actor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
