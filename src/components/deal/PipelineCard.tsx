import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { DealScoreBadge } from "./DealScoreBadge";
import { ExternalLink } from "lucide-react";

const STAGES = [
  { value: "new", label: "New Lead" },
  { value: "contacted", label: "Contacted" },
  { value: "follow_up", label: "Follow-up" },
  { value: "negotiating", label: "Negotiating" },
  { value: "under_contract", label: "Under Contract" },
  { value: "won", label: "Won" },
  { value: "dead", label: "Dead" },
];

const PRIORITIES = [
  { value: "high", label: "High", color: "text-red-400" },
  { value: "medium", label: "Medium", color: "text-yellow-400" },
  { value: "low", label: "Low", color: "text-muted-foreground" },
];

interface Props {
  deal: {
    id: string;
    stage: string;
    priority: string;
    updated_at?: string;
    properties: {
      id: string;
      address: string;
      city: string;
      state: string;
      deal_score?: number | null;
      deal_verdict?: string | null;
      distress_types?: string[] | null;
    };
  };
  onStageChange: (dealId: string, stage: string) => void;
}

export const PipelineCard = ({ deal, onStageChange }: Props) => {
  const navigate = useNavigate();
  const property = deal.properties;
  const priority = PRIORITIES.find((p) => p.value === deal.priority);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight truncate">{property.address}</p>
          <p className="text-xs text-muted-foreground">{property.city}, {property.state}</p>
        </div>
        {property.deal_score !== null && property.deal_score !== undefined && (
          <DealScoreBadge score={property.deal_score} size="sm" />
        )}
      </div>

      {priority && (
        <span className={`text-xs font-medium ${priority.color}`}>{priority.label} priority</span>
      )}

      <Select value={deal.stage} onValueChange={(val) => onStageChange(deal.id, val)}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STAGES.map((s) => (
            <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        size="sm"
        variant="ghost"
        className="w-full text-xs text-muted-foreground hover:text-foreground"
        onClick={() => navigate(`/property/${property.id}`)}
      >
        <ExternalLink className="h-3 w-3 mr-1" />View Deal
      </Button>
    </div>
  );
};
