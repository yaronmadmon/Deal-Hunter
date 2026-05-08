import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Clock, Calendar, Loader2, Bot, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppNav } from "@/components/AppNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Thread {
  id: string;
  property_id: string;
  homeowner_phone: string;
  unread_count: number;
  ai_draft: string | null;
  last_inbound_at: string | null;
  properties?: { address: string; city: string; state: string } | null;
}

interface FollowUpDeal {
  id: string;
  follow_up_at: string;
  next_action: string | null;
  next_step_brief: string | null;
  property_id: string;
  properties?: { address: string; city: string; state: string } | null;
}

interface Meeting {
  id: string;
  scheduled_at: string | null;
  scheduled_at_raw: string | null;
  homeowner_name: string | null;
  homeowner_phone: string;
  status: string;
  property_id: string;
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

export default function TodayView() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpDeal[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingDraft, setSendingDraft] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [threadsRes, followUpsRes, meetingsRes] = await Promise.all([
      (supabase as any)
        .from("sms_threads")
        .select("id, property_id, homeowner_phone, unread_count, ai_draft, last_inbound_at, properties(address, city, state)")
        .eq("user_id", user.id)
        .gt("unread_count", 0)
        .order("last_inbound_at", { ascending: false }),

      (supabase as any)
        .from("pipeline_deals")
        .select("id, follow_up_at, next_action, next_step_brief, property_id, properties(address, city, state)")
        .eq("user_id", user.id)
        .gte("follow_up_at", todayStart.toISOString())
        .lte("follow_up_at", todayEnd.toISOString())
        .in("follow_up_status", ["pending", "overdue"])
        .order("follow_up_at", { ascending: true }),

      (supabase as any)
        .from("meetings")
        .select("id, scheduled_at, scheduled_at_raw, homeowner_name, homeowner_phone, status, property_id, properties(address, city, state)")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .gte("scheduled_at", todayStart.toISOString())
        .lte("scheduled_at", todayEnd.toISOString())
        .order("scheduled_at", { ascending: true }),
    ]);

    setThreads(threadsRes.data ?? []);
    setFollowUps(followUpsRes.data ?? []);
    setMeetings(meetingsRes.data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleSendDraft = async (thread: Thread) => {
    if (!thread.ai_draft) return;
    setSendingDraft(thread.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: { propertyId: thread.property_id, homeownerPhone: thread.homeowner_phone, message: thread.ai_draft },
      });
      if (error || data?.error) throw new Error(data?.error ?? "Failed");
      toast.success("Reply sent.");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSendingDraft(null);
    }
  };

  if (!user) return null;

  const totalItems = threads.length + followUps.length + meetings.length;

  return (
    <div className="min-h-screen bg-background">
      <AppNav credits={profile?.credits} showCredits />

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="text-xl font-semibold text-foreground mt-1">
            {totalItems === 0 ? "All clear today" : `${totalItems} item${totalItems === 1 ? "" : "s"} need attention`}
          </h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : (
          <>
            {/* Replies waiting */}
            {threads.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">Replies waiting ({threads.length})</h2>
                </div>

                {threads.map((thread) => {
                  const prop = thread.properties;
                  const address = prop ? `${prop.address}, ${prop.city}` : formatPhone(thread.homeowner_phone);

                  return (
                    <div key={thread.id} className="rounded-xl border border-primary/20 bg-card p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">{address}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatPhone(thread.homeowner_phone)}
                            {thread.last_inbound_at && ` · ${timeAgo(thread.last_inbound_at)}`}
                          </p>
                        </div>
                        <span className="min-w-[20px] h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold px-1.5">
                          {thread.unread_count}
                        </span>
                      </div>

                      {thread.ai_draft && (
                        <div className="rounded-lg bg-primary/5 border border-primary/15 px-3 py-2 space-y-2">
                          <div className="flex items-start gap-2">
                            <Bot className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                            <p className="text-xs text-foreground italic flex-1">"{thread.ai_draft}"</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="h-7 text-xs px-3"
                              disabled={sendingDraft === thread.id}
                              onClick={() => handleSendDraft(thread)}
                            >
                              {sendingDraft === thread.id
                                ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Sending...</>
                                : <><CheckCircle2 className="h-3 w-3 mr-1" />Send Reply</>}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs px-3"
                              onClick={() => navigate(`/property/${thread.property_id}`)}
                            >
                              Edit <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {!thread.ai_draft && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => navigate(`/property/${thread.property_id}`)}
                        >
                          Open conversation <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </section>
            )}

            {/* Follow-ups due today */}
            {followUps.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-400" />
                  <h2 className="text-sm font-semibold text-foreground">Follow-ups due today ({followUps.length})</h2>
                </div>

                {followUps.map((deal) => {
                  const prop = deal.properties;
                  const address = prop ? `${prop.address}, ${prop.city}` : "Unknown property";

                  return (
                    <div
                      key={deal.id}
                      className="rounded-xl border border-amber-500/20 bg-card p-4 space-y-2 cursor-pointer hover:border-amber-500/40 transition-colors"
                      onClick={() => navigate(`/property/${deal.property_id}`)}
                    >
                      <p className="text-sm font-medium text-foreground">{address}</p>
                      {deal.next_action && (
                        <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 capitalize">
                          {deal.next_action}
                        </span>
                      )}
                      {deal.next_step_brief && (
                        <p className="text-xs text-muted-foreground line-clamp-1 italic">"{deal.next_step_brief}"</p>
                      )}
                    </div>
                  );
                })}
              </section>
            )}

            {/* Meetings today */}
            {meetings.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold text-foreground">Meetings today ({meetings.length})</h2>
                </div>

                {meetings.map((meeting) => {
                  const prop = meeting.properties;
                  const address = prop ? `${prop.address}, ${prop.city}` : "Unknown property";
                  const name = meeting.homeowner_name ?? formatPhone(meeting.homeowner_phone);
                  const time = meeting.scheduled_at
                    ? new Date(meeting.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : meeting.scheduled_at_raw ?? "Time TBD";

                  return (
                    <div
                      key={meeting.id}
                      className="rounded-xl border border-emerald-500/20 bg-card p-4 space-y-1 cursor-pointer hover:border-emerald-500/40 transition-colors"
                      onClick={() => navigate(`/property/${meeting.property_id}`)}
                    >
                      <p className="text-sm font-medium text-foreground">{name}</p>
                      <p className="text-xs text-muted-foreground">{address}</p>
                      <p className="text-xs text-emerald-400 font-medium">{time}</p>
                    </div>
                  );
                })}
              </section>
            )}

            {totalItems === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-3 text-emerald-400 opacity-60" />
                <p className="text-sm">Nothing needs your attention today.</p>
                <Button
                  variant="outline"
                  className="mt-4 h-8 text-xs"
                  onClick={() => navigate("/dashboard")}
                >
                  Search for new deals
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
