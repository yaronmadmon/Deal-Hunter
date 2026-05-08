import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Clock, Pencil, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
    notes?: string | null;
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
  };
  onStageChange: (dealId: string, stage: string) => void;
  onSnooze?: (dealId: string, days: number) => void;
}

export const PipelineCard = ({ deal, onStageChange, onSnooze }: Props) => {
  const navigate = useNavigate();
  const property = deal.properties;
  const priority = PRIORITIES.find((p) => p.value === deal.priority);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(deal.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);

  const saveNotes = async () => {
    setSavingNotes(true);
    await (supabase as any)
      .from("pipeline_deals")
      .update({ notes: notesValue || null })
      .eq("id", deal.id);
    setSavingNotes(false);
    setEditingNotes(false);
  };

  // Follow-up chip calculation
  let followUpChip: { label: string; overdue: boolean } | null = null;
  if (deal.follow_up_at) {
    const due = new Date(deal.follow_up_at);
    const now = new Date();
    const diffMs = due.getTime() - now.getTime();
    const diffDays = Math.round(Math.abs(diffMs) / 86400000);
    if (diffMs < 0) {
      followUpChip = { label: diffDays === 0 ? "Due today" : `${diffDays}d overdue`, overdue: true };
    } else if (diffDays === 0) {
      followUpChip = { label: "Due today", overdue: false };
    } else {
      followUpChip = { label: `Due in ${diffDays}d`, overdue: false };
    }
  }

  return (
    <div className={`rounded-xl border bg-card p-4 space-y-3 hover:border-primary/40 transition-colors
      ${deal.urgency_flag ? "border-destructive/40" : "border-border"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground leading-tight truncate">{property.address}</p>
          <p className="text-xs text-muted-foreground">{property.city}, {property.state}</p>
        </div>
      </div>

      {priority && (
        <span className={`text-xs font-medium ${priority.color}`}>{priority.label} priority</span>
      )}

      {/* Follow-up chip */}
      {followUpChip && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full
            ${followUpChip.overdue
              ? "bg-destructive/15 text-destructive"
              : "bg-amber-500/10 text-amber-500"}`}>
            <Clock className="h-3 w-3" />
            {followUpChip.label}
          </span>
          {onSnooze && (
            <Select onValueChange={(v) => onSnooze(deal.id, parseInt(v))}>
              <SelectTrigger className="h-6 text-[11px] border-dashed w-fit px-2 min-w-[80px]">
                <SelectValue placeholder="Snooze" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">+1 day</SelectItem>
                <SelectItem value="3">+3 days</SelectItem>
                <SelectItem value="7">+7 days</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* AI brief */}
      {deal.next_step_brief && (
        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 italic">
          "{deal.next_step_brief}"
        </p>
      )}

      {/* Notes */}
      {editingNotes ? (
        <div className="space-y-1.5">
          <textarea
            autoFocus
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary resize-none"
            rows={3}
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            placeholder="Add a note..."
          />
          <div className="flex gap-1.5">
            <Button size="sm" className="h-6 text-[10px] px-2" disabled={savingNotes} onClick={saveNotes}>
              <Check className="h-3 w-3 mr-1" />Save
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => { setNotesValue(deal.notes ?? ""); setEditingNotes(false); }}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="group flex items-start gap-1.5 cursor-pointer min-h-[20px]"
          onClick={() => setEditingNotes(true)}
        >
          {notesValue ? (
            <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 flex-1">{notesValue}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground/40 flex-1">Add a note...</p>
          )}
          <Pencil className="h-2.5 w-2.5 text-muted-foreground/40 group-hover:text-muted-foreground mt-0.5 shrink-0 transition-colors" />
        </div>
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
        variant="outline"
        className="h-8 w-full rounded-xl border-border/80 bg-background text-xs font-medium text-foreground hover:bg-secondary/70"
        onClick={() => navigate(`/property/${property.id}`)}
      >
        <ExternalLink className="h-3 w-3 mr-1" />View Deal
      </Button>
    </div>
  );
};
