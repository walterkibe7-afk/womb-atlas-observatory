"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { Globe, Users, Languages, Activity, Filter, Download, ChevronDown } from "lucide-react";
import type { SeedIntelligenceStats } from "@/lib/admin/seed-intelligence-stats";

// Pie/legend colors, cycled when there are more languages than hues.
const COLORS = ['#D4AF37', '#6B21A8', '#E67E22', '#3B82F6', '#10B981', '#EC4899'];

// "Filter Data" time-range options (scopes the whole page server-side).
type RangeKey = "all" | "7d" | "30d" | "90d";
const RANGE_OPTIONS: { key: RangeKey; label: string; short: string }[] = [
  { key: "all", label: "All time", short: "All Time" },
  { key: "7d", label: "Last 7 days", short: "7 Days" },
  { key: "30d", label: "Last 30 days", short: "30 Days" },
  { key: "90d", label: "Last 90 days", short: "90 Days" },
];

// Quote a CSV field only when it contains a comma, quote, or newline.
function csvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

// Build a CSV of the currently-displayed data and trigger a client-side download.
function exportCsv(stats: SeedIntelligenceStats, range: RangeKey) {
  const rows: string[][] = [["Section", "Label", "Value"]];
  rows.push(["Metric", "Total Observations", String(stats.totalObservations)]);
  rows.push(["Metric", "Active Regions", String(stats.activeRegions)]);
  rows.push(["Metric", "Supported Languages", String(stats.supportedLanguages)]);
  rows.push(["Metric", "Unique Signals", String(stats.uniqueSignals)]);
  for (const g of stats.geoData) rows.push(["Geography (observations)", g.region, String(g.volume)]);
  for (const l of stats.langData) rows.push(["Language (%)", l.name, String(l.value)]);
  for (const s of stats.signalFreqData) rows.push(["Signal frequency", s.name, String(s.freq)]);

  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `seed-intelligence-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Small centered note for a chart with no data yet (keeps the panel height).
function ChartEmpty({ loading }: { loading: boolean }) {
  return (
    <div className="h-full w-full flex items-center justify-center text-xs text-gray-500">
      {loading ? "Loading…" : "No data yet"}
    </div>
  );
}

export default function SeedIntelligence() {
  const [stats, setStats] = useState<SeedIntelligenceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>("all");
  const [rangeOpen, setRangeOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/admin/stats/seed-intelligence?range=${range}`)
      .then((r) => r.json())
      .then((data) => {
        if (active) setStats(data);
      })
      .catch(() => {
        if (active) setStats(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [range]);

  const geoData = stats?.geoData ?? [];
  const langData = stats?.langData ?? [];
  const signalFreqData = stats?.signalFreqData ?? [];

  const metrics = [
    { label: "Total Observations", val: stats ? stats.totalObservations.toLocaleString() : "—", icon: Users },
    { label: "Active Regions", val: stats ? stats.activeRegions.toLocaleString() : "—", icon: Globe },
    { label: "Supported Languages", val: stats ? stats.supportedLanguages.toLocaleString() : "—", icon: Languages },
    { label: "Unique Signals", val: stats ? stats.uniqueSignals.toLocaleString() : "—", icon: Activity },
  ];

  return (
    <div className="p-8 pb-20 max-w-[1400px] mx-auto space-y-6">

      {/* Header */}
      <header className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-serif text-white mb-2 flex items-center">
            Seed Intelligence Layer <span className="text-[var(--color-brand-gold)] ml-2">✧</span>
          </h1>
          <p className="text-gray-400 text-sm">
            Aggregate observation volumes and global distributions.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Filter Data — scopes every metric and chart to a time range */}
          <div className="relative">
            <button
              onClick={() => setRangeOpen((o) => !o)}
              className="flex items-center space-x-2 bg-[var(--color-surface)] border border-[var(--color-border)] text-gray-300 px-4 py-2 rounded-lg text-xs hover:text-white transition-colors"
              aria-haspopup="listbox"
              aria-expanded={rangeOpen}
            >
              <Filter size={14} />
              <span>
                {range === "all" ? "Filter Data" : RANGE_OPTIONS.find((o) => o.key === range)?.short}
              </span>
              <ChevronDown
                size={12}
                className={`transition-transform ${rangeOpen ? "rotate-180" : ""}`}
              />
            </button>
            {rangeOpen && (
              <>
                {/* Click-away overlay */}
                <div className="fixed inset-0 z-10" onClick={() => setRangeOpen(false)} />
                <ul
                  role="listbox"
                  className="absolute right-0 mt-2 z-20 min-w-[150px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg"
                >
                  {RANGE_OPTIONS.map((o) => (
                    <li key={o.key}>
                      <button
                        role="option"
                        aria-selected={range === o.key}
                        onClick={() => {
                          setRange(o.key);
                          setRangeOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-xs transition-colors hover:bg-[var(--color-background)] ${
                          range === o.key ? "text-[var(--color-brand-gold)]" : "text-gray-300"
                        }`}
                      >
                        {o.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          {/* Export CSV — downloads the currently-displayed data */}
          <button
            onClick={() => stats && exportCsv(stats, range)}
            disabled={!stats}
            className="flex items-center space-x-2 bg-[var(--color-surface)] border border-[var(--color-border)] text-gray-300 px-4 py-2 rounded-lg text-xs hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </header>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {metrics.map((m, i) => (
           <div key={i} className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-6 flex items-center justify-between">
             <div>
               <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">{m.label}</p>
               <p className="text-3xl font-serif text-white">{m.val}</p>
             </div>
             <div className="w-12 h-12 rounded-full bg-[var(--color-background)] border border-[var(--color-border)] flex items-center justify-center">
               <m.icon size={20} className="text-[var(--color-brand-gold)]" />
             </div>
           </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Geography Distribution */}
        <div className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-6">
           <p className="text-xs text-[var(--color-brand-gold)] uppercase tracking-widest mb-6">Geography Distribution</p>
           <div className="h-[250px] w-full">
             {geoData.length === 0 ? (
               <ChartEmpty loading={loading} />
             ) : (
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={geoData} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#2A1F36" horizontal={false} />
                 <XAxis type="number" stroke="#3A2B4A" tick={{fill: '#6b7280', fontSize: 10}} allowDecimals={false} />
                 <YAxis dataKey="region" type="category" stroke="#3A2B4A" tick={{fill: '#6b7280', fontSize: 12}} width={100} />
                 <Tooltip
                   contentStyle={{ backgroundColor: '#1C1525', borderColor: '#3A2B4A', borderRadius: '8px' }}
                   itemStyle={{ color: '#D4AF37', fontSize: '12px' }}
                   cursor={{ fill: '#2A1F36' }}
                 />
                 <Bar dataKey="volume" fill="#6B21A8" radius={[0, 4, 4, 0]} barSize={24} />
               </BarChart>
             </ResponsiveContainer>
             )}
           </div>
        </div>

        {/* Signal Frequency */}
        <div className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-6">
           <p className="text-xs text-[var(--color-brand-gold)] uppercase tracking-widest mb-6">Signal Frequency (Aggregate)</p>
           <div className="h-[250px] w-full">
             {signalFreqData.length === 0 ? (
               <ChartEmpty loading={loading} />
             ) : (
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={signalFreqData} margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#2A1F36" vertical={false} />
                 <XAxis dataKey="name" stroke="#3A2B4A" tick={{fill: '#6b7280', fontSize: 10}} />
                 <YAxis stroke="#3A2B4A" tick={{fill: '#6b7280', fontSize: 10}} allowDecimals={false} />
                 <Tooltip
                   contentStyle={{ backgroundColor: '#1C1525', borderColor: '#3A2B4A', borderRadius: '8px' }}
                   itemStyle={{ color: '#E67E22', fontSize: '12px' }}
                   cursor={{ fill: '#2A1F36' }}
                 />
                 <Bar dataKey="freq" fill="#E67E22" radius={[4, 4, 0, 0]} barSize={32} />
               </BarChart>
             </ResponsiveContainer>
             )}
           </div>
        </div>

        {/* Language Distribution */}
        <div className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-6 lg:col-span-2 flex items-center justify-between">
           <div className="w-1/2">
             <p className="text-xs text-[var(--color-brand-gold)] uppercase tracking-widest mb-4">Language Distribution</p>
             <p className="text-sm text-gray-400 max-w-sm mb-6">Current breakdown of the languages participants prefer, drawn from the same records as the coverage map.</p>
             <div className="space-y-3">
               {langData.length === 0 ? (
                 <p className="text-xs text-gray-500">{loading ? "Loading…" : "No data yet"}</p>
               ) : (
                 langData.map((entry, index) => (
                   <div key={index} className="flex items-center space-x-3">
                     <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                     <span className="text-sm text-white">{entry.name}</span>
                     <span className="text-xs text-gray-500">{entry.value}%</span>
                   </div>
                 ))
               )}
             </div>
           </div>

           <div className="w-1/2 h-[200px]">
             {langData.length === 0 ? (
               <ChartEmpty loading={loading} />
             ) : (
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie
                   data={langData}
                   cx="50%"
                   cy="50%"
                   innerRadius={60}
                   outerRadius={80}
                   paddingAngle={5}
                   dataKey="value"
                   stroke="none"
                 >
                   {langData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                   ))}
                 </Pie>
                 <Tooltip
                   contentStyle={{ backgroundColor: '#1C1525', borderColor: '#3A2B4A', borderRadius: '8px' }}
                   itemStyle={{ color: '#fff', fontSize: '12px' }}
                 />
               </PieChart>
             </ResponsiveContainer>
             )}
           </div>
        </div>

      </div>
    </div>
  );
}
