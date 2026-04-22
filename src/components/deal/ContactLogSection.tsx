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

const CONTACT_TYPES = ["call", "email", "sms", "visit", "note"];
const OUTCOMES = ["no_answer", "left_voicemail", "spoke", "interested", "not_interested"];

const outcomeLabel = (o: string) => o.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const ContactLogSection = ({ propertyId, userId, entries, onEntryAdded }: Props) => {
  const [showForm, setShowForm] = useState(false);
  const [contactType, setContactType] = useState("call");
  const [outcome, setOutcome] = useState("no_answer");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!notes.trim() && contactType !== "note") {
      toast.error("Add some notes about the contact attempt.");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("contact_log" as any)
        .insert({ property_id: propertyId, user_id: userId, contact_type: contactType, outcome, notes: notes.trim() || null })
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
        <span className="text-sm text-muted-foreground">{entries.length} contact{entries.length !== 1 ? "s" : ""} logged</span>
        <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowForm(!showForm)}>
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
                    <SelectItem key={t} value={t}>{outcomeLabel(t)}</SelectItem>
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
                      <SelectItem key={o} value={o}>{outcomeLabel(o)}</SelectItem>
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

      <div className="space-y-3">
        {entries.map((entry) => {
          const Icon = CONTACT_ICONS[entry.contact_type] ?? FileText;
          return (
            <div key={entry.id} className="flex gap-3 rounded-lg border border-border bg-background px-4 py-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground capitalize">{entry.contact_type}</span>
                  {entry.outcome && <span>• {outcomeLabel(entry.outcome)}</span>}
                  <span className="ml-auto">{new Date(entry.created_at).toLocaleDateString()}</span>
                </div>
                {entry.notes && <p className="mt-1 text-sm text-foreground">{entry.notes}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
