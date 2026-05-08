import { useState, useEffect, useRef, useCallback } from "react";
import { Bot, Loader2, MessageSquare, PhoneCall, CheckCircle2, Send, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SmsMessage {
  id: string;
  thread_id: string;
  direction: "outbound" | "inbound";
  body: string;
  created_at: string;
}

interface SmsThread {
  id: string;
  status: string;
  ai_enabled: boolean;
  homeowner_phone: string;
  ai_draft: string | null;
  unread_count: number;
}

interface Meeting {
  id: string;
  scheduled_at_raw: string | null;
  homeowner_name: string | null;
  status: string;
}

interface Props {
  propertyId: string;
  userId: string;
  ownerPhones: string[];
}

const formatPhone = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d.startsWith("1")) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return phone;
};

const Bubble = ({ msg }: { msg: SmsMessage }) => (
  <div className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
      ${msg.direction === "outbound"
        ? "bg-foreground text-background"
        : "bg-secondary text-foreground border border-border"}`}>
      {msg.body}
      <p className={`mt-1 text-[10px] ${msg.direction === "outbound" ? "opacity-50" : "text-muted-foreground"}`}>
        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        {msg.direction === "outbound" && <span className="ml-1">· AI</span>}
      </p>
    </div>
  </div>
);

export const SMSConversationSection = ({ propertyId, userId, ownerPhones }: Props) => {
  const [thread, setThread] = useState<SmsThread | null>(null);
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [selectedPhone, setSelectedPhone] = useState(ownerPhones[0] ?? "");
  const [starting, setStarting] = useState(false);
  const [sendingDraft, setSendingDraft] = useState(false);
  const [manualReply, setManualReply] = useState("");
  const [sendingManual, setSendingManual] = useState(false);
  const [loadingThread, setLoadingThread] = useState(true);
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadThread = useCallback(async () => {
    if (!propertyId || !userId) return;

    const { data: threadData } = await (supabase as any)
      .from("sms_threads")
      .select("*")
      .eq("property_id", propertyId)
      .eq("user_id", userId)
      .in("status", ["active", "paused"])
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (threadData) {
      setThread(threadData);
      const { data: msgs } = await (supabase as any)
        .from("sms_messages")
        .select("*")
        .eq("thread_id", threadData.id)
        .order("created_at", { ascending: true });
      setMessages(msgs ?? []);

      const { data: mtg } = await (supabase as any)
        .from("meetings")
        .select("*")
        .eq("property_id", propertyId)
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setMeeting(mtg ?? null);
    }

    setLoadingThread(false);
  }, [propertyId, userId]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Realtime: new SMS messages
  useEffect(() => {
    if (!thread?.id) return;
    const channel = (supabase as any)
      .channel(`sms-messages-${thread.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "sms_messages",
        filter: `thread_id=eq.${thread.id}`,
      }, (payload: { new: SmsMessage }) => {
        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some((m) => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [thread?.id]);

  // Realtime: new meetings
  useEffect(() => {
    if (!userId) return;
    const channel = (supabase as any)
      .channel(`meetings-${propertyId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "meetings",
        filter: `property_id=eq.${propertyId}`,
      }, (payload: { new: Meeting }) => {
        setMeeting(payload.new);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [propertyId, userId]);

  const handleStart = async () => {
    if (!selectedPhone) {
      toast.error("Select a phone number first.");
      return;
    }
    setStarting(true);
    try {
      // Generate opener via existing generate-outreach function
      const { data: outreachData, error: outreachError } = await supabase.functions.invoke("generate-outreach", {
        body: { propertyId, outreachType: "sms" },
      });
      if (outreachError || !outreachData?.draft?.body) throw new Error("Failed to generate opener");

      const openerMessage: string = outreachData.draft.body;

      // Send via Telnyx
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: { propertyId, homeownerPhone: selectedPhone, message: openerMessage },
      });
      if (error || data?.error) throw new Error(data?.error ?? "Send failed");

      toast.success("AI conversation started. Waiting for reply...");
      await loadThread();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start conversation";
      toast.error(msg);
    } finally {
      setStarting(false);
    }
  };

  if (loadingThread) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm">Loading conversation...</span>
      </div>
    );
  }

  // No Telnyx configured guard — shown after attempting to start
  const noPhones = ownerPhones.length === 0;

  return (
    <div className="space-y-4">
      {/* Meeting booked banner */}
      {meeting && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <PhoneCall className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-400">Meeting booked</p>
            <p className="text-sm text-foreground mt-0.5">
              {meeting.homeowner_name ? `${meeting.homeowner_name} — ` : ""}
              {meeting.scheduled_at_raw}
            </p>
          </div>
        </div>
      )}

      {/* Active conversation */}
      {thread ? (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {/* Thread header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {formatPhone(thread.homeowner_phone)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px] px-2 text-muted-foreground"
                disabled={summarizing || messages.length === 0}
                onClick={async () => {
                  setSummarizing(true);
                  try {
                    const { data, error } = await supabase.functions.invoke("generate-outreach", {
                      body: {
                        propertyId,
                        outreachType: "summary",
                        messages: messages.map((m) => ({ direction: m.direction, body: m.body })),
                      },
                    });
                    if (error || data?.error) throw new Error(data?.error ?? "Summarize failed");
                    setSummary(data.draft?.summary ?? null);
                  } catch {
                    toast.error("Failed to generate summary.");
                  } finally {
                    setSummarizing(false);
                  }
                }}
              >
                {summarizing
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <><FileText className="h-3 w-3 mr-1" />Summarize</>}
              </Button>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full
                ${thread.status === "active"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-secondary text-muted-foreground"}`}>
                {thread.status === "active" ? "AI active" : thread.status}
              </span>
            </div>
          </div>

          {/* Conversation summary */}
          {summary && (
            <div className="border-b border-border bg-secondary/40 px-4 py-3 flex items-start gap-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">AI Summary</p>
                <p className="text-sm text-foreground leading-relaxed">{summary}</p>
              </div>
              <button className="text-[10px] text-muted-foreground hover:text-foreground shrink-0" onClick={() => setSummary(null)}>✕</button>
            </div>
          )}

          {/* Message bubbles */}
          <div className="flex flex-col gap-3 p-4 max-h-96 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-4">
                No messages yet. The AI sent the opener — waiting for a reply.
              </p>
            ) : (
              messages.map((msg) => <Bubble key={msg.id} msg={msg} />)
            )}
            <div ref={bottomRef} />
          </div>

          {/* AI draft approval */}
          {thread.ai_draft && thread.status !== "ended" && (
            <div className="border-t border-primary/20 bg-primary/5 px-4 py-3 space-y-2">
              <div className="flex items-start gap-2">
                <Bot className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-[11px] text-primary font-medium mb-1">AI draft — review before sending</p>
                  <p className="text-sm text-foreground italic">"{thread.ai_draft}"</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7 text-xs px-3"
                  disabled={sendingDraft}
                  onClick={async () => {
                    if (!thread.ai_draft) return;
                    setSendingDraft(true);
                    try {
                      const { data, error } = await supabase.functions.invoke("send-sms", {
                        body: { propertyId, homeownerPhone: thread.homeowner_phone, message: thread.ai_draft },
                      });
                      if (error || data?.error) throw new Error(data?.error ?? "Send failed");
                      toast.success("Reply sent.");
                      setThread((t) => t ? { ...t, ai_draft: null, unread_count: 0 } : t);
                      await loadThread();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Send failed");
                    } finally {
                      setSendingDraft(false);
                    }
                  }}
                >
                  {sendingDraft
                    ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Sending...</>
                    : <><CheckCircle2 className="h-3 w-3 mr-1" />Send</>}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-3"
                  onClick={async () => {
                    await (supabase as any).from("sms_threads").update({ ai_draft: null }).eq("id", thread.id);
                    setThread((t) => t ? { ...t, ai_draft: null } : t);
                  }}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          {/* Manual reply input */}
          {thread.status !== "ended" && (
            <div className="border-t border-border px-4 py-3 flex gap-2">
              <input
                className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
                placeholder="Type a reply..."
                value={manualReply}
                onChange={(e) => setManualReply(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && !e.shiftKey && manualReply.trim()) {
                    e.preventDefault();
                    setSendingManual(true);
                    const msg = manualReply.trim();
                    setManualReply("");
                    try {
                      const { data, error } = await supabase.functions.invoke("send-sms", {
                        body: { propertyId, homeownerPhone: thread.homeowner_phone, message: msg },
                      });
                      if (error || data?.error) throw new Error(data?.error ?? "Send failed");
                      await loadThread();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Send failed");
                    } finally {
                      setSendingManual(false);
                    }
                  }
                }}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-9 px-3 shrink-0"
                disabled={sendingManual || !manualReply.trim()}
                onClick={async () => {
                  if (!manualReply.trim()) return;
                  setSendingManual(true);
                  const msg = manualReply.trim();
                  setManualReply("");
                  try {
                    const { data, error } = await supabase.functions.invoke("send-sms", {
                      body: { propertyId, homeownerPhone: thread.homeowner_phone, message: msg },
                    });
                    if (error || data?.error) throw new Error(data?.error ?? "Send failed");
                    await loadThread();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Send failed");
                  } finally {
                    setSendingManual(false);
                  }
                }}
              >
                {sendingManual ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>
          )}

          {/* Footer note */}
          <div className="border-t border-border px-4 py-2">
            <p className="text-[11px] text-muted-foreground">
              {thread.status === "ended"
                ? "This conversation has ended (owner opted out)."
                : "AI drafts replies for your review. You can also type your own message above."}
            </p>
          </div>
        </div>
      ) : (
        /* No thread — start screen */
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 space-y-4">
          <div className="flex items-start gap-3">
            <MessageSquare className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Start an AI SMS conversation</p>
              <p className="text-xs text-muted-foreground mt-1">
                AI generates the opener and drafts replies for every inbound message — you review and approve each one before it sends.
                Meetings are booked automatically when confirmed by the owner.
              </p>
            </div>
          </div>

          {noPhones ? (
            <p className="text-sm text-muted-foreground">
              No phone numbers available. Run skip trace first to reveal owner contact info.
            </p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={selectedPhone} onValueChange={setSelectedPhone}>
                <SelectTrigger className="flex-1 h-9 text-sm">
                  <SelectValue placeholder="Select phone number" />
                </SelectTrigger>
                <SelectContent>
                  {ownerPhones.map((phone) => (
                    <SelectItem key={phone} value={phone} className="text-sm">
                      {formatPhone(phone)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={handleStart}
                disabled={starting || !selectedPhone}
                className="h-9 px-4 text-sm shrink-0"
              >
                {starting ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />Starting...</>
                ) : (
                  <><Bot className="h-3.5 w-3.5 mr-2" />Start AI Conversation</>
                )}
              </Button>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            Requires Telnyx — add <code className="font-mono">TELNYX_API_KEY</code> and{" "}
            <code className="font-mono">TELNYX_PHONE_NUMBER</code> to Supabase secrets.
          </p>
        </div>
      )}
    </div>
  );
};
