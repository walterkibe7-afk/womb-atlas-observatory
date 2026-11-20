"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number;
  change: number;
  loading?: boolean;
}

function formatValue(value: number): string {
  return value.toLocaleString();
}

function ChangeBadge({ change }: { change: number }) {
  if (change > 0) {
    return (
      <span className="text-[10px] text-[var(--color-brand-green)] flex items-center">
        <TrendingUp size={12} className="mr-1" />
        +{change}%
      </span>
    );
  }
  if (change < 0) {
    return (
      <span className="text-[10px] text-red-400 flex items-center">
        <TrendingDown size={12} className="mr-1" />
        {change}%
      </span>
    );
  }
  return (
    <span className="text-[10px] text-gray-400 flex items-center">
      <Minus size={12} className="mr-1" />
      0%
    </span>
  );
}

export default function StatCard({ icon: Icon, label, value, change, loading }: StatCardProps) {
  if (loading) {
    return (
      <div className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-6 animate-pulse">
        <div className="w-10 h-10 rounded-full bg-[var(--color-surface-hover)] mb-4" />
        <div className="h-8 w-24 bg-[var(--color-surface-hover)] rounded mb-2" />
        <div className="h-3 w-32 bg-[var(--color-surface-hover)] rounded mb-2" />
        <div className="h-3 w-16 bg-[var(--color-surface-hover)] rounded" />
      </div>
    );
  }

  return (
    <div className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="w-10 h-10 rounded-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center">
          <Icon size={18} className="text-[var(--color-brand-gold)]" />
        </div>
        <span className="text-[10px] text-gray-500 uppercase">Live</span>
      </div>
      <p className="text-3xl font-serif text-white mb-1">{formatValue(value)}</p>
      <p className="text-xs text-gray-400 mb-2">{label}</p>
      <ChangeBadge change={change} />
    </div>
  );
}
