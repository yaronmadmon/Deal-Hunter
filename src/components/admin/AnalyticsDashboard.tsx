import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Users, Eye, MousePointerClick, TrendingUp, Activity, Clock, Timer, BarChart3 } from "lucide-react";

interface AnalyticsEvent {
  id: string;
  event_name: string;
  user_id: string | null;
  metadata: any;
  created_at: string;
}

interface MetricCard {
  label: string;
  value: number | string;
  icon: any;
  change?: string;
}

const EVENT_LABELS: Record<string, string> = {
  page_view: "Page View",
  signup: "Signup",
  login: "Login",
  analysis_created: "Analysis Created",
  analysis_completed: "Analysis Completed",
  report_viewed: "Report Viewed",
  watchlist_added: "Watchlist Add",
  credit_purchase: "Credit Purchase",
  blueprint_generated: "Blueprint Generated",
  report_downloaded: "Report Downloaded",
  session_end: "Session End",
};

const EVENT_COLORS: Record<string, string> = {
  page_view: "bg-blue-500/10 text-blue-500",
  signup: "bg-green-500/10 text-green-500",
  login: "bg-emerald-500/10 text-emerald-500",
  analysis_created: "bg-amber-500/10 text-amber-500",
  analysis_completed: "bg-purple-500/10 text-purple-500",
  report_viewed: "bg-indigo-500/10 text-indigo-500",
  watchlist_added: "bg-pink-500/10 text-pink-500",
  credit_purchase: "bg-yellow-500/10 text-yellow-500",
  session_end: "bg-slate-500/10 text-slate-500",
};

export const AnalyticsDashboard = () => {
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"today" | "7d" | "30d">("today");

  const fetchEvents = async () => {
    setLoading(true);
    const now = new Date();
    let since: string;
    if (timeRange === "today") {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    } else if (timeRange === "7d") {
      since = new Date(now.getTime() - 7 * 86400000).toISOString();
    } else {
      since = new Date(now.getTime() - 30 * 86400000).toISOString();
    }

    const { data, error } = await supabase
      .from("analytics_events")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);

    if (!error && data) setEvents(data as AnalyticsEvent[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, [timeRange]);

  // Compute metrics
  const pageViews = events.filter(e => e.event_name === "page_view");
  const uniqueUsers = new Set(events.map(e => e.user_id).filter(Boolean));
  const actions = events.filter(e => e.event_name !== "page_view" && e.event_name !== "session_end");
  const signups = events.filter(e => e.event_name === "signup");
  const sessionEnds = events.filter(e => e.event_name === "session_end");

  // Engagement metrics from session_end events
  const sessionDurations = sessionEnds
    .map(e => e.metadata?.duration_seconds)
    .filter((d): d is number => typeof d === "number" && d > 0);
  const sessionPageCounts = sessionEnds
    .map(e => e.metadata?.pages_viewed)
    .filter((p): p is number => typeof p === "number" && p > 0);

  const avgDuration = sessionDurations.length > 0
    ? Math.round(sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length)
    : 0;
  const avgPages = sessionPageCounts.length > 0
    ? (sessionPageCounts.reduce((a, b) => a + b, 0) / sessionPageCounts.length).toFixed(1)
    : "0";
  const bounceCount = sessionPageCounts.filter(p => p <= 1).length;
  const bounceRate = sessionPageCounts.length > 0
    ? Math.round((bounceCount / sessionPageCounts.length) * 100)
    : 0;

  const formatDuration = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    if (mins < 60) return `${mins}m ${remaining}s`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const metrics: MetricCard[] = [
    { label: "Unique Visitors", value: uniqueUsers.size, icon: Users },
    { label: "Page Views", value: pageViews.length, icon: Eye },
    { label: "Avg. Duration", value: formatDuration(avgDuration), icon: Timer },
    { label: "Bounce Rate", value: `${bounceRate}%`, icon: TrendingUp },
  ];

  // Top pages
  const pageCounts: Record<string, number> = {};
  pageViews.forEach(e => {
    const page = e.metadata?.page || e.metadata?.url || "unknown";
    pageCounts[page] = (pageCounts[page] || 0) + 1;
  });
  const topPages = Object.entries(pageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Event breakdown
  const eventCounts: Record<string, number> = {};
  events.forEach(e => {
    eventCounts[e.event_name] = (eventCounts[e.event_name] || 0) + 1;
  });
  const eventBreakdown = Object.entries(eventCounts)
    .sort((a, b) => b[1] - a[1]);

  // Per-user activity
  const userActivity: Record<string, { events: number; lastSeen: string; pages: Set<string> }> = {};
  events.forEach(e => {
    if (!e.user_id) return;
    if (!userActivity[e.user_id]) {
      userActivity[e.user_id] = { events: 0, lastSeen: e.created_at, pages: new Set() };
    }
    userActivity[e.user_id].events++;
    if (e.metadata?.page) userActivity[e.user_id].pages.add(e.metadata.page);
    if (e.created_at > userActivity[e.user_id].lastSeen) {
      userActivity[e.user_id].lastSeen = e.created_at;
    }
  });
  const topUsers = Object.entries(userActivity)
    .sort((a, b) => b[1].events - a[1].events)
    .slice(0, 15);

  // Resolve emails from profiles
  const [userEmails, setUserEmails] = useState<Record<string, string>>({});
  useEffect(() => {
    const ids = [...uniqueUsers].filter(Boolean) as string[];
    if (ids.length === 0) return;
    supabase
      .from("profiles")
      .select("id, email, display_name")
      .in("id", ids.slice(0, 50))
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((p: any) => {
            map[p.id] = p.email || p.display_name || p.id.slice(0, 8);
          });
          setUserEmails(map);
        }
      });
  }, [events]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Analytics</h2>
          <p className="text-sm text-muted-foreground">Track user activity and engagement</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["today", "7d", "30d"] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  timeRange === range
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {range === "today" ? "Today" : range === "7d" ? "7 Days" : "30 Days"}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={fetchEvents} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metrics.map(m => (
          <Card key={m.label} className="bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <m.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold text-foreground">{m.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="feed" className="space-y-4">
        <TabsList className="bg-muted/50 flex-wrap">
          <TabsTrigger value="feed">Live Feed</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="pages">Top Pages</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        {/* Live Feed */}
        <TabsContent value="feed">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                {events.slice(0, 50).map(e => (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                    <Badge variant="secondary" className={`text-[10px] px-2 shrink-0 ${EVENT_COLORS[e.event_name] || "bg-muted text-muted-foreground"}`}>
                      {EVENT_LABELS[e.event_name] || e.event_name}
                    </Badge>
                    <span className="text-xs text-foreground truncate flex-1">
                      {e.user_id ? (userEmails[e.user_id] || e.user_id.slice(0, 8)) : "anon"}
                      {e.metadata?.page && (
                        <span className="text-muted-foreground ml-1">→ {e.metadata.page}</span>
                      )}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(e.created_at)}
                    </span>
                  </div>
                ))}
                {events.length === 0 && !loading && (
                  <p className="text-sm text-muted-foreground text-center py-8">No events recorded yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Pages */}
        <TabsContent value="pages">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                Most Visited Pages
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {topPages.map(([page, count], i) => {
                  const maxCount = topPages[0]?.[1] || 1;
                  const pct = Math.round((count / maxCount) * 100);
                  return (
                    <div key={page} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                      <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{page}</p>
                        <div className="w-full h-1.5 bg-muted rounded-full mt-1.5">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className="text-sm font-bold text-foreground shrink-0">{count}</span>
                    </div>
                  );
                })}
                {topPages.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No page views yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Event Breakdown */}
        <TabsContent value="events">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MousePointerClick className="h-4 w-4 text-primary" />
                Event Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {eventBreakdown.map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={`text-[10px] ${EVENT_COLORS[name] || ""}`}>
                        {EVENT_LABELS[name] || name}
                      </Badge>
                    </div>
                    <span className="text-sm font-bold text-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Activity */}
        <TabsContent value="users">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                User Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="px-4 py-2 text-xs text-muted-foreground font-medium">User</th>
                      <th className="px-4 py-2 text-xs text-muted-foreground font-medium text-right">Events</th>
                      <th className="px-4 py-2 text-xs text-muted-foreground font-medium text-right">Pages</th>
                      <th className="px-4 py-2 text-xs text-muted-foreground font-medium text-right">Last Seen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {topUsers.map(([uid, info]) => (
                      <tr key={uid} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 text-foreground font-medium truncate max-w-[200px]">
                          {userEmails[uid] || uid.slice(0, 12)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold">{info.events}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{info.pages.size}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground text-xs">{formatTime(info.lastSeen)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {topUsers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No user activity yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Engagement */}
        <TabsContent value="engagement">
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-card/50">
                <CardContent className="p-4">
                  <Timer className="h-4 w-4 text-muted-foreground mb-2" />
                  <div className="text-2xl font-bold text-foreground">{formatDuration(avgDuration)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Avg. Session</p>
                </CardContent>
              </Card>
              <Card className="bg-card/50">
                <CardContent className="p-4">
                  <BarChart3 className="h-4 w-4 text-muted-foreground mb-2" />
                  <div className="text-2xl font-bold text-foreground">{avgPages}</div>
                  <p className="text-xs text-muted-foreground mt-1">Pages / Session</p>
                </CardContent>
              </Card>
              <Card className="bg-card/50">
                <CardContent className="p-4">
                  <TrendingUp className="h-4 w-4 text-muted-foreground mb-2" />
                  <div className="text-2xl font-bold text-foreground">{bounceRate}%</div>
                  <p className="text-xs text-muted-foreground mt-1">Bounce Rate</p>
                </CardContent>
              </Card>
              <Card className="bg-card/50">
                <CardContent className="p-4">
                  <Activity className="h-4 w-4 text-muted-foreground mb-2" />
                  <div className="text-2xl font-bold text-foreground">{sessionEnds.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">Total Sessions</p>
                </CardContent>
              </Card>
            </div>

            {/* Session details table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Timer className="h-4 w-4 text-primary" />
                  Recent Sessions
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="px-4 py-2 text-xs text-muted-foreground font-medium">User</th>
                        <th className="px-4 py-2 text-xs text-muted-foreground font-medium text-right">Duration</th>
                        <th className="px-4 py-2 text-xs text-muted-foreground font-medium text-right">Pages</th>
                        <th className="px-4 py-2 text-xs text-muted-foreground font-medium text-right">When</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {sessionEnds.slice(0, 20).map(e => (
                        <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5 text-foreground font-medium truncate max-w-[180px]">
                            {e.user_id ? (userEmails[e.user_id] || e.user_id.slice(0, 12)) : "anon"}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold">
                            {formatDuration(e.metadata?.duration_seconds || 0)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground">
                            {e.metadata?.pages_viewed || 0}
                          </td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground text-xs">
                            {formatTime(e.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {sessionEnds.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">No session data yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Session data is recorded when users leave or close the app</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
