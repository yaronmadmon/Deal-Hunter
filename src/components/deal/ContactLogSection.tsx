import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, Mail, MessageSquare, MapPin, FileText, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LogEntry {
  id: string;
  contact_type: string;
  outcome?: string | null;
  notes?: string | null;
  created_at: string;
}

interface Props {
  propertyId: string;
  userId: string;
  entries: LogEntry[];
  onEntryAdded?: (entry: LogEntry) => void;
}

const CONTACT_ICONS: Record<string, any> = {
  call: Phone,
  email: Mail,
  sms: MessageSquare,
  visit: MapPin,
  note: FileText,
};

const ICON_COLORS: Record<string, string> = {
  call: "bg-sky-500/15 text-sky-400",
  email: "bg-amber-500/15 text-amber-400",
  sms: "bg-emerald-500/15 text-emerald-400",
  visit: "bg-purple-500/15 text-purple-400",
  note: "bg-secondary text-muted-foreground",
};

const OUTCOME_COLORS: Record<string, string> = {
  interested: "text-emerald-400",
  spoke: "text-sky-400",
  not_interested: "text-destructive",
  left_voicemail: "text-amber-400",
  no_answer: "text-muted-foreground",
};

const CONTACT_TYPES = ["call", "email", "sms", "visit", "note"];
const OUTCOMES = ["no_answer", "left_voicemail", "spoke", "interested", "not_interested"];

const fmt = (o: string) => o.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const relativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? "just now" : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export const ContactLogSection = ({ propertyId, userId, entries, onEntryAdded }: Props) => {
  const [showForm, setShowForm] = useState(false);
  const [contactType, setContactType] = useState("call");
  const [outcome, setOutcome] = useState("no_answer");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("contact_log" as any)
        .insert({ property_id: propertyId, user_id: userId, contact_type: contactType, outcome: contactType !== "note" ? outcome : null, notes: notes.trim() || null })
        .select()
        .single();
      if (error) throw error;
      onEntryAdded?.(data as LogEntry);
      setShowForm(false);
      setNotes("");
      setContactType("call");
      setOutcome("no_answer");
      toast.success("Contact logged.");
    } catch {
      toast.error("Failed to save contact log.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {entries.length} contact{entries.length !== 1 ? "s" : ""} logged
        </span>
        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-3 w-3 mr-1" />Log Contact
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Type</p>
              <Select value={contactType} onValueChange={setContactType}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{fmt(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {contactType !== "note" && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Outcome</p>
                <Select value={outcome} onValueChange={setOutcome}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OUTCOMES.map((o) => (
                      <SelectItem key={o} value={o}>{fmt(o)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <Textarea placeholder="Notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {entries.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">No contacts logged yet.</p>
      )}

      {/* Visual timeline */}
      {entries.length > 0 && (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[17px] top-5 bottom-2 w-px bg-border" />

          <div className="space-y-4">
            {entries.map((entry, i) => {
              const Icon = CONTACT_ICONS[entry.contact_type] ?? FileText;
              const iconColor = ICON_COLORS[entry.contact_type] ?? ICON_COLORS.note;
              const outcomeColor = entry.outcome ? (OUTCOME_COLORS[entry.outcome] ?? "text-muted-foreground") : "";

              return (
                <div key={entry.id} className="flex gap-3 relative">
                  {/* Timeline dot */}
                  <div className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconColor}`}>
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-1 pt-1.5">
                    <div className="flex items-baseline justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground capitalize">{entry.contact_type}</span>
                        {entry.outcome && (
                          <span className={`text-xs font-medium ${outcomeColor}`}>
                            {fmt(entry.outcome)}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">{relativeTime(entry.created_at)}</span>
                    </div>
                    {entry.notes && (
                      <p className="mt-1 text-sm text-foreground/80 leading-relaxed">{entry.notes}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
