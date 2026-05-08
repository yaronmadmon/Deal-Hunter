import { PipelineCard } from "./PipelineCard";

interface Deal {
  id: string;
  stage: string;
  priority: string;
  updated_at?: string;
  follow_up_at?: string | null;
  follow_up_status?: string | null;
  next_step_brief?: string | null;
  next_action?: string | null;
  urgency_flag?: boolean;
  properties: {
    id: string;
    address: string;
    city: string;
    state: string;
    deal_score?: number | null;
    deal_verdict?: string | null;
    distress_types?: string[] | null;
  };
}

interface Props {
  title: string;
  stage: string;
  deals: Deal[];
  onStageChange: (dealId: string, stage: string) => void;
  onSnooze?: (dealId: string, days: number) => void;
}

const STAGE_COLORS: Record<string, string> = {
  new: "border-foreground/15",
  contacted: "border-foreground/25",
  follow_up: "border-foreground/35",
  negotiating: "border-foreground/45",
  under_contract: "border-foreground/55",
  won: "border-foreground/70",
  dead: "border-border",
};

export const KanbanColumn = ({ title, stage, deals, onStageChange, onSnooze }: Props) => (
  <div className="flex flex-col min-w-[240px] w-60 flex-shrink-0">
    <div className={`mb-3 flex items-center justify-between border-b-2 pb-2 ${STAGE_COLORS[stage] ?? "border-border"}`}>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <span className="text-xs rounded-full bg-secondary text-muted-foreground px-2 py-0.5">{deals.length}</span>
    </div>
    <div className="flex flex-col gap-3 flex-1">
      {deals.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">No deals here</p>
        </div>
      )}
      {deals.map((deal) => (
        <PipelineCard key={deal.id} deal={deal} onStageChange={onStageChange} onSnooze={onSnooze} />
      ))}
    </div>
  </div>
);
