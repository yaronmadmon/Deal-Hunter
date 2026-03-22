import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare, Bug, Lightbulb, PartyPopper, Trash2, RefreshCw } from "lucide-react";

interface FeedbackItem {
  id: string;
  user_id: string;
  category: string;
  message: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  user_email?: string;
}

const categoryConfig: Record<string, { icon: any; label: string; color: string }> = {
  bug: { icon: Bug, label: "Bug", color: "destructive" },
  suggestion: { icon: Lightbulb, label: "Suggestion", color: "secondary" },
  positive: { icon: PartyPopper, label: "Positive", color: "default" },
  general: { icon: MessageSquare, label: "General", color: "outline" },
};

const statusOptions = ["new", "reviewed", "in_progress", "resolved", "dismissed"];

export const FeedbackManagement = () => {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesText, setNotesText] = useState("");

  const fetchFeedback = async () => {
    setLoading(true);
    try {
      let query = supabase.from("feedback").select("*").order("created_at", { ascending: false });
      if (filter !== "all") {
        query = query.eq("category", filter);
      }
      const { data, error } = await query;
      if (error) throw error;

      // Resolve user emails
      const userIds = [...new Set((data as any[]).map((d: any) => d.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, email, display_name").in("id", userIds);
      const profileMap = new Map((profiles || []).map(p => [p.id, p.email || p.display_name || "Unknown"]));

      setItems((data as any[]).map((d: any) => ({
        ...d,
        user_email: profileMap.get(d.user_id) || "Unknown",
      })));
    } catch (err: any) {
      toast.error(err.message || "Failed to load feedback");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFeedback(); }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("feedback" as any).update({ status } as any).eq("id", id);
    if (error) { toast.error("Failed to update"); return; }
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    toast.success("Status updated");
  };

  const saveNotes = async (id: string) => {
    const { error } = await supabase.from("feedback" as any).update({ admin_notes: notesText } as any).eq("id", id);
    if (error) { toast.error("Failed to save notes"); return; }
    setItems(prev => prev.map(i => i.id === id ? { ...i, admin_notes: notesText } : i));
    setEditingNotes(null);
    toast.success("Notes saved");
  };

  const deleteFeedback = async (id: string) => {
    const { error } = await supabase.from("feedback" as any).delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success("Feedback deleted");
  };

  const counts = {
    total: items.length,
    new: items.filter(i => i.status === "new").length,
    bugs: items.filter(i => i.category === "bug").length,
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{counts.total}</p>
          <p className="text-xs text-muted-foreground">Total Feedback</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{counts.new}</p>
          <p className="text-xs text-muted-foreground">New / Unread</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-destructive">{counts.bugs}</p>
          <p className="text-xs text-muted-foreground">Bug Reports</p>
        </CardContent></Card>
      </div>

      {/* Filter & Refresh */}
      <div className="flex items-center gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="bug">🐛 Bugs</SelectItem>
            <SelectItem value="suggestion">💡 Suggestions</SelectItem>
            <SelectItem value="positive">🎉 Positive</SelectItem>
            <SelectItem value="general">💬 General</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={fetchFeedback}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-muted-foreground text-sm animate-pulse">Loading feedback…</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm">No feedback yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const cat = categoryConfig[item.category] || categoryConfig.general;
            const CatIcon = cat.icon;
            return (
              <Card key={item.id} className={item.status === "new" ? "border-primary/30" : ""}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <CatIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <Badge variant={cat.color as any}>{cat.label}</Badge>
                      <span className="text-xs text-muted-foreground truncate">{item.user_email}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Select value={item.status} onValueChange={(v) => updateStatus(item.id, v)}>
                        <SelectTrigger className="h-7 text-xs w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map(s => (
                            <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace("_", " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteFeedback(item.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{item.message}</p>
                  {/* Admin notes */}
                  {editingNotes === item.id ? (
                    <div className="space-y-2">
                      <Textarea value={notesText} onChange={(e) => setNotesText(e.target.value)} placeholder="Admin notes…" className="min-h-[60px] text-xs" />
                      <div className="flex gap-2">
                        <Button size="sm" variant="default" onClick={() => saveNotes(item.id)}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingNotes(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => { setEditingNotes(item.id); setNotesText(item.admin_notes || ""); }}
                    >
                      {item.admin_notes ? `📝 ${item.admin_notes}` : "+ Add admin note"}
                    </button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
