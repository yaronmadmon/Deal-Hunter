import { AlertTriangle } from "lucide-react";

const KILL_LABELS: Record<string, string> = {
  flood_zone: "Flood Zone",
  environmental: "Environmental",
  title_dispute: "Title Dispute",
  underwater: "Underwater",
  hoa_overleveraged: "HOA Overleveraged",
};

interface Props {
  type: string;
  evidence?: string;
}

export const DealKillerBadge = ({ type, evidence }: Props) => (
  <div className="flex flex-col gap-1">
    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400">
      <AlertTriangle className="h-3 w-3 shrink-0" />
      {KILL_LABELS[type] ?? type}
    </span>
    {evidence && <p className="pl-1 text-xs text-muted-foreground">{evidence}</p>}
  </div>
);
