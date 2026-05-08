import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Phone, MessageSquare, Mail, Send, RotateCcw, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppNav } from "@/components/AppNav";
import { DistressTypeBadge } from "@/components/deal/DistressTypeBadge";
import { ContactLogSection } from "@/components/deal/ContactLogSection";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type FollowUpDeal = {
  id: string;
  stage: string;
  follow_up_at: string;
  follow_up_status: string;
  next_action: string | null;
  next_step_brief: string | null;
  urgency_flag: boolean;
  priority: string;
  property_id: string;
  properties: {
    id: string;
    address: string;
    city: string;
    state: string;
    distress_types: string[] | null;
    equity_pct: number | null;
  } | null;
};

type ContactEntry = {
  id: string;
  contact_type: string;
  outcome?: string | null;
  notes?: string | null;
  created_at: string;
};

const ACTION_CONFIG: Record<string, { label: string; icon: typeof Phone; color: string }> = {
  call: { label: "Call", icon: Phone, color: "bg-sky-500/15 text-sky-400 border-sky-500/20" },
  text: { label: "Text", icon: MessageSquare, color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  email: { label: "Email", icon: Mail, color: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  letter: { label: "Send Letter", icon: Send, color: "bg-purple-500/15 text-purple-400 border-purple-500/20" },
  pause: { label: "Pause", icon: RotateCcw, color: "bg-secondary text-muted-foreground border-border" },
};

function timeDiff(isoDate: string): { label: string; overdue: boolean; today: boolean } {
  const due = new Date(isoDate);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMs < 0) {
    const days = Math.abs(Math.round(diffMs / 86400000));
    return { label: days === 0 ? "Due today" : `${days}d overdue`, overdue: true, today: false };
  }
  if (diffDays === 0) return { label: "Due today", overdue: false, today: true };
  return { label: `Due in ${diffDays}d`, overdue: false, today: false };
}

function FollowUpCard({
  deal,
  userId,
  onSnoozed,
  onContactLogged,
}: {
  deal: FollowUpDeal;
  userId: string;
  onSnoozed: (dealId: string, days: number) => void;
  onContactLogged: (dealId: string, propertyId: string) => void;
}) {
  const navigate = useNavigate();
  const [showLog, setShowLog] = useState(false);
  const [logEntries, setLogEntries] = useState<ContactEntry[]>([]);
  const { label: timeLabel, overdue } = timeDiff(deal.follow_up_at);
  const action = deal.next_action ? ACTION_CONFIG[deal.next_action] : ACTION_CONFIG.call;
  const ActionIcon = action.icon;
  const property = deal.properties;

  const handleEntryAdded = (entry: ContactEntry) => {
    setLogEntries((prev) => [entry, ...prev]);
    setShowLog(false);
    onContactLogged(deal.id, deal.property_id);
  };

  return (
    <div
      className={`relative rounded-xl border bg-card p-4 flex flex-col gap-3 transition-all
        ${deal.urgency_flag ? "border-destructive/40" : "border-border"}
        ${overdue ? "shadow-sm" : ""}`}
    >
      {deal.urgency_flag && (
        <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-destructive" title="Urgent" />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <button
            onClick={() => navigate(`/property/${property?.id}`)}
            className="text-sm font-semibold text-foreground hover:text-primary truncate block text-left w-full"
          >
            {property?.address ?? "Unknown Address"}
          </button>
          <p className="text-xs text-muted-foreground mt-0.5">
            {property?.city}, {property?.state}
            {property?.equity_pct != null && (
              <span className="ml-2 font-mono">{Math.round(property.equity_pct)}% equity</span>
            )}
          </p>
        </div>
        <span
          className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1
            ${overdue ? "bg-destructive/15 text-destructive" : "bg-amber-500/10 text-amber-500"}`}
        >
          <Clock className="h-3 w-3" />
          {timeLabel}
        </span>
      </div>

      {/* Distress badges */}
      {property?.distress_types && property.distress_types.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {property.distress_types.map((t) => (
            <DistressTypeBadge key={t} type={t} />
          ))}
        </div>
      )}

      {/* AI brief */}
      {deal.next_step_brief && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 italic">
          "{deal.next_step_brief}"
        </p>
      )}

      {/* Action chip */}
      {deal.next_action && (
        <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium w-fit ${action.color}`}>
          <ActionIcon className="h-3 w-3" />
          {action.label}
        </div>
      )}

      {/* Actions row */}
      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => setShowLog((v) => !v)}
        >
          {showLog ? "Cancel" : "Log Contact"}
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => navigate(`/property/${property?.id}#outreach`)}
        >
          <Send className="h-3 w-3 mr-1" />
          AI Draft
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => navigate(`/property/${property?.id}`)}
        >
          View Deal
        </Button>

        <Select onValueChange={(v) => onSnoozed(deal.id, parseInt(v))}>
          <SelectTrigger className="h-7 text-xs border-dashed w-fit px-2 min-w-[90px]">
            <SelectValue placeholder="Snooze..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Snooze 1 day</SelectItem>
            <SelectItem value="3">Snooze 3 days</SelectItem>
            <SelectItem value="7">Snooze 7 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Inline contact log form */}
      {showLog && property && (
        <div className="border-t border-border pt-3">
          <ContactLogSection
            propertyId={property.id}
            userId={userId}
            entries={logEntries}
            onEntryAdded={handleEntryAdded}
          />
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  colorClass,
  deals,
  userId,
  onSnoozed,
  onContactLogged,
}: {
  title: string;
  count: number;
  colorClass: string;
  deals: FollowUpDeal[];
  userId: string;
  onSnoozed: (dealId: string, days: number) => void;
  onContactLogged: (dealId: string, propertyId: string) => void;
}) {
  if (deals.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className={`text-sm font-semibold tracking-wide uppercase ${colorClass}`}>{title}</h2>
        <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${colorClass} opacity-70`}>{count}</span>
      </div>
      <div className="flex flex-col gap-3">
        {deals.map((deal) => (
          <FollowUpCard
            key={deal.id}
            deal={deal}
            userId={userId}
            onSnoozed={onSnoozed}
            onContactLogged={onContactLogged}
          />
        ))}
      </div>
    </div>
  );
}

export default function FollowUpQueue() {
  const navigate = useNavigate();
  const { user, loading: authLoading, profile } = useAuth();
  const [deals, setDeals] = useState<FollowUpDeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
  }, [user, authLoading, navigate]);

  const fetchDeals = useCallback(async () => {
    if (!user) return;
    const { data, error } = await (supabase as any)
      .from("pipeline_deals")
      .select(`id, stage, follow_up_at, follow_up_status, next_action, next_step_brief,
               urgency_flag, priority, property_id,
               properties(id, address, city, state, distress_types, equity_pct)`)
      .eq("user_id", user.id)
      .in("stage", ["contacted", "follow_up", "negotiating"])
      .not("follow_up_at", "is", null)
      .order("follow_up_at", { ascending: true });

    if (!error) setDeals((data as FollowUpDeal[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = (supabase as any)
      .channel("followup-queue-page")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pipeline_deals", filter: `user_id=eq.${user.id}` },
        () => fetchDeals()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchDeals]);

  const handleSnooze = async (dealId: string, days: number) => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + days);
    const newIso = newDate.toISOString();

    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId
          ? { ...d, follow_up_at: newIso, follow_up_status: "pending" }
          : d
      )
    );

    await (supabase as any)
      .from("pipeline_deals")
      .update({ follow_up_at: newIso, follow_up_status: "pending" })
      .eq("id", dealId);

    toast.success(`Snoozed for ${days} day${days > 1 ? "s" : ""}`);
  };

  const handleContactLogged = async (dealId: string, propertyId: string) => {
    if (!user) return;
    // Regenerate AI brief after contact logged
    try {
      await supabase.functions.invoke("schedule-followup", {
        body: { propertyId },
      });
      // Refresh to show updated brief
      await fetchDeals();
      toast.success("AI follow-up updated");
    } catch {
      // non-blocking
    }
  };

  const handleMarkDone = async (dealId: string) => {
    setDeals((prev) => prev.filter((d) => d.id !== dealId));
    await (supabase as any)
      .from("pipeline_deals")
      .update({ follow_up_status: "completed", follow_up_at: null })
      .eq("id", dealId);
    toast.success("Marked as done");
  };

  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const overdue = deals.filter((d) => new Date(d.follow_up_at) < now);
  const dueToday = deals.filter((d) => {
    const t = new Date(d.follow_up_at);
    return t >= now && t <= endOfToday;
  });
  const upcoming = deals.filter((d) => new Date(d.follow_up_at) > endOfToday);

  const totalActive = overdue.length + dueToday.length;

  return (
    <div className="min-h-screen bg-background">
      <AppNav credits={profile?.credits} onSignOut={async () => { await supabase.auth.signOut(); }} />

      <main className="max-w-3xl mx-auto px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold text-foreground tracking-tight">Follow-Up Queue</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading
              ? "Loading your deals..."
              : totalActive > 0
              ? `${totalActive} deal${totalActive !== 1 ? "s" : ""} need your attention`
              : "You're all caught up"}
          </p>
          {!loading && deals.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {overdue.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-destructive/15 text-destructive">
                  <Clock className="h-3 w-3" />
                  {overdue.length} overdue
                </span>
              )}
              {dueToday.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-500">
                  <Clock className="h-3 w-3" />
                  {dueToday.length} due today
                </span>
              )}
              {upcoming.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {upcoming.length} upcoming
                </span>
              )}
            </div>
          )}
        </div>

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-xl bg-card border border-border animate-pulse" />
            ))}
          </div>
        )}

        {!loading && deals.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-base font-medium">All caught up</p>
            <p className="text-sm mt-1">
              Add properties to your pipeline and log your first contact to get AI follow-up coaching.
            </p>
          </div>
        )}

        {!loading && deals.length > 0 && (
          <div className="flex flex-col gap-8">
            <Section
              title="Overdue"
              count={overdue.length}
              colorClass="text-destructive"
              deals={overdue}
              userId={user?.id ?? ""}
              onSnoozed={handleSnooze}
              onContactLogged={handleContactLogged}
            />
            <Section
              title="Due Today"
              count={dueToday.length}
              colorClass="text-amber-500"
              deals={dueToday}
              userId={user?.id ?? ""}
              onSnoozed={handleSnooze}
              onContactLogged={handleContactLogged}
            />
            <Section
              title="Upcoming"
              count={upcoming.length}
              colorClass="text-muted-foreground"
              deals={upcoming}
              userId={user?.id ?? ""}
              onSnoozed={handleSnooze}
              onContactLogged={handleContactLogged}
            />
          </div>
        )}
      </main>
    </div>
  );
}
