import {
  Activity, BatteryLow, ChevronRight, Droplet, Flower, Heart, Loader2, MessageCircle,
  RefreshCw, Sparkles, Stethoscope, Users, Waves, type LucideIcon,
} from "lucide-react";
import { SectionCard, SectionLink } from "@/components/ui";
import type { MeaningSignal } from "@/lib/steward/analytics";

/** AtlasSignalRow.signalType → the icon that stands for that domain. */
const TYPE_ICONS: Record<string, LucideIcon> = {
  bleeding_characteristics: Droplet,
  pain_characteristics: Waves,
  cycle_characteristics: RefreshCw,
  hormonal_manifestations: Flower,
  body_changes_physical_manifestations: Sparkles,
  sleep_recovery: BatteryLow,
  social_participation: Users,
  self_management: Activity,
  care_access: Stethoscope,
  care_emotion: Heart,
  expression_language: MessageCircle,
};

export function MeaningSignals({ data }: { data: MeaningSignal[] | null }) {
  return (
    <SectionCard title="Meaning Signals" isNew action={<SectionLink>View all →</SectionLink>}>
      <p className="text-xs text-faint -mt-1 mb-3">
        Explore how women describe similar experiences
      </p>

      <div className="flex flex-col gap-3">
        {!data ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 text-brand-gold animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <p className="text-xs text-faint py-2">No signals recorded yet.</p>
        ) : (
          data.map((s) => {
            const Icon = TYPE_ICONS[s.signalType] ?? Activity;
            return (
              <div key={s.label} className="flex items-center gap-2.5">
                <Icon size={15} className="text-brand-gold shrink-0" />
                <span className="flex-1 text-[13px] text-secondary truncate" title={s.label}>
                  {s.label}
                </span>
                <span className="text-xs text-muted shrink-0">
                  {s.languages} {s.languages === 1 ? "language" : "languages"}
                </span>
                <ChevronRight size={14} className="text-faint shrink-0" />
              </div>
            );
          })
        )}
      </div>

      <div className="text-center mt-3.5 pt-3 border-t border-[var(--color-border-subtle)]">
        <SectionLink className="text-[13px]">Go to Meaning Signals →</SectionLink>
      </div>
    </SectionCard>
  );
}
