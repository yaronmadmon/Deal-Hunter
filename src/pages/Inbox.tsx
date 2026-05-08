import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Bot, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppNav } from "@/components/AppNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Thread {
  id: string;
  property_id: string;
  homeowner_phone: string;
  status: string;
  unread_count: number;
  last_inbound_at: string | null;
  last_message_at: string | null;
  ai_draft: string | null;
  properties?: { address: string; city: string; state: string } | null;
}

const formatPhone = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d.startsWith("1")) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return phone;
};

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export default function Inbox() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [lastMessages, setLastMessages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);

  const loadThreads = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("sms_threads")
      .select("*, properties(address, city, state)")
      .eq("user_id", user.id)
      .neq("status", "ended")
      .order("last_inbound_at", { ascending: false, nullsFirst: false });
    const threads = data ?? [];
    setThreads(threads);
    setLoading(false);

    // Load last message preview for each thread
    const ids = threads.map((t: Thread) => t.id);
    if (ids.length > 0) {
      const { data: msgs } = await (supabase as any)
        .from("sms_messages")
        .select("thread_id, body, direction, created_at")
        .in("thread_id", ids)
        .order("created_at", { ascending: false });
      const preview: Record<string, string> = {};
      for (const msg of msgs ?? []) {
        if (!preview[msg.thread_id]) {
          preview[msg.thread_id] = (msg.direction === "inbound" ? "Owner: " : "You: ") + msg.body;
        }
      }
      setLastMessages(preview);
    }
  }, [user]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  // Realtime updates
  useEffect(() => {
    if (!user) return;
    const channel = (supabase as any)
      .channel("inbox-threads")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "sms_threads",
        filter: `user_id=eq.${user.id}`,
      }, () => { loadThreads(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadThreads]);

  const handleSendDraft = async (thread: Thread) => {
    if (!thread.ai_draft) return;
    setSending(thread.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: {
          propertyId: thread.property_id,
          homeownerPhone: thread.homeowner_phone,
          message: thread.ai_draft,
        },
      });
      if (error || data?.error) throw new Error(data?.error ?? "Send failed");
      toast.success("Message sent.");
      loadThreads();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(null);
    }
  };

  const handleDismissDraft = async (threadId: string) => {
    await (supabase as any)
      .from("sms_threads")
      .update({ ai_draft: null })
      .eq("id", threadId);
    loadThreads();
  };

  const handleMarkRead = async (thread: Thread) => {
    if (thread.unread_count === 0) return;
    await (supabase as any)
      .from("sms_threads")
      .update({ unread_count: 0 })
      .eq("id", thread.id);
    loadThreads();
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <AppNav credits={profile?.credits} showCredits />

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-2">
        <div className="flex items-center gap-2 mb-6">
          <MessageSquare className="h-5 w-5 text-foreground" />
          <h1 className="text-lg font-semibold text-foreground">SMS Inbox</h1>
          {threads.filter((t) => t.unread_count > 0).length > 0 && (
            <span className="ml-1 min-w-[20px] h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold px-1">
              {threads.filter((t) => t.unread_count > 0).length}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm">Loading inbox...</span>
          </div>
        ) : threads.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No SMS threads yet.</p>
            <p className="text-xs mt-1">Start an AI conversation from any property detail page.</p>
          </div>
        ) : (
          threads.map((thread) => {
            const prop = thread.properties;
            const address = prop ? `${prop.address}, ${prop.city}, ${prop.state}` : thread.homeowner_phone;
            const hasUnread = thread.unread_count > 0;
            const hasDraft = !!thread.ai_draft;

            return (
              <div
                key={thread.id}
                className={`rounded-xl border bg-card transition-colors ${
                  hasUnread ? "border-primary/30" : "border-border"
                }`}
              >
                {/* Thread row */}
                <div
                  className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/40 rounded-t-xl"
                  onClick={() => {
                    handleMarkRead(thread);
                    navigate(`/property/${thread.property_id}`);
                  }}
                >
                  {/* Unread dot */}
                  <div className="mt-1.5 shrink-0">
                    {hasUnread ? (
                      <span className="block h-2 w-2 rounded-full bg-primary" />
                    ) : (
                      <span className="block h-2 w-2 rounded-full bg-transparent" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{address}</p>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {thread.last_inbound_at ? timeAgo(thread.last_inbound_at) : ""}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatPhone(thread.homeowner_phone)}</p>
                    {lastMessages[thread.id] && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate opacity-70">{lastMessages[thread.id]}</p>
                    )}

                    <div className="flex items-center gap-2 mt-1.5">
                      {hasUnread && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive">
                          {thread.unread_count} new {thread.unread_count === 1 ? "reply" : "replies"}
                        </span>
                      )}
                      {hasDraft && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                          <Bot className="h-2.5 w-2.5" />
                          AI draft ready
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        thread.status === "active"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-secondary text-muted-foreground"
                      }`}>
                        {thread.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* AI draft approval panel */}
                {hasDraft && (
                  <div className="border-t border-border px-4 py-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Bot className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      <p className="text-sm text-foreground italic">"{thread.ai_draft}"</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="h-7 text-xs px-3"
                        disabled={sending === thread.id}
                        onClick={() => handleSendDraft(thread)}
                      >
                        {sending === thread.id ? (
                          <><Loader2 className="h-3 w-3 animate-spin mr-1" />Sending...</>
                        ) : (
                          <><CheckCircle2 className="h-3 w-3 mr-1" />Send Reply</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-3"
                        onClick={() => handleDismissDraft(thread.id)}
                      >
                        Dismiss
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs px-3 ml-auto"
                        onClick={() => navigate(`/property/${thread.property_id}`)}
                      >
                        Open Conversation →
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
