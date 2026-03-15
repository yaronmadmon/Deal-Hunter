import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, Wifi, WifiOff, AlertTriangle, Clock, Activity, Zap, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SourceMetric {
  status: string;
  durationMs: number;
  signalCount: number;
  error?: string;
}

interface SourceHealth {
  name: string;
  displayName: string;
  status: "connected" | "degraded" | "down";
  statusLabel: string;
  lastError?: string;
  avgDurationMs: number;
  avgSignals: number;
  failRate: number;
  lastSeen: string | null;
}

const SOURCE_DISPLAY: Record<string, string> = {
  perplexity: "Perplexity Sonar",
  firecrawl: "Firecrawl (App Store / Reddit)",
  serper_search: "Serper Search",
  serper_news: "Serper News",
  serper_producthunt: "Serper Product Hunt",
  producthunt: "Product Hunt API",
  github: "GitHub",
  twitter_search: "Twitter / X Search",
  twitter_counts: "Twitter / X Counts",
  twitter_influencers: "Twitter / X Influencers",
  hackernews: "Hacker News",
};

function getDisplayName(key: string): string {
  return SOURCE_DISPLAY[key] || key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function getStatusEmoji(status: "connected" | "degraded" | "down") {
  switch (status) {
    case "connected": return "🟢";
    case "degraded": return "🟡";
    case "down": return "🔴";
  }
}

function getStatusBadgeVariant(status: "connected" | "degraded" | "down") {
  switch (status) {
    case "connected": return "go" as const;
    case "degraded": return "pivot" as const;
    case "down": return "nogo" as const;
  }
}

export const DataSourceHealth = () => {
  const [sources, setSources] = useState<SourceHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastPipelineTime, setLastPipelineTime] = useState<string | null>(null);
  const [nextRefreshMinutes, setNextRefreshMinutes] = useState<number | null>(null);
  const [liveChecking, setLiveChecking] = useState(false);
  const [liveResults, setLiveResults] = useState<Record<string, { status: "connected" | "degraded" | "down"; latencyMs: number; error?: string }> | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("analyses")
        .select("created_at, report_data")
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      const runs = (data || [])
        .map((a: any) => ({
          created_at: a.created_at,
          metrics: (a.report_data as any)?.pipelineMetrics as {
            sources: Record<string, SourceMetric>;
            failedSources: string[];
          } | null,
        }))
        .filter(r => r.metrics);

      if (runs.length > 0) {
        setLastPipelineTime(runs[0].created_at);

        // Calculate next refresh (cron runs every 4 hours for live feed, but pipeline is on-demand)
        const lastTime = new Date(runs[0].created_at).getTime();
        const now = Date.now();
        const minutesAgo = Math.round((now - lastTime) / 60000);
        // Show a suggested "next check" based on 4-hour intervals
        const nextIn = Math.max(0, 240 - minutesAgo);
        setNextRefreshMinutes(nextIn);
      }

      // Aggregate per-source health across recent runs
      const sourceMap: Record<string, { durations: number[]; signals: number[]; errors: string[]; failures: number; lastSeen: string | null }> = {};

      for (const run of runs) {
        if (!run.metrics) continue;
        for (const [name, src] of Object.entries(run.metrics.sources)) {
          if (!sourceMap[name]) {
            sourceMap[name] = { durations: [], signals: [], errors: [], failures: 0, lastSeen: null };
          }
          sourceMap[name].durations.push(src.durationMs);
          sourceMap[name].signals.push(src.signalCount);
          if (src.status === "error") {
            sourceMap[name].failures++;
            if (src.error) sourceMap[name].errors.push(src.error);
          }
          if (!sourceMap[name].lastSeen || run.created_at > sourceMap[name].lastSeen!) {
            sourceMap[name].lastSeen = run.created_at;
          }
        }
      }

      const healthList: SourceHealth[] = Object.entries(sourceMap).map(([name, data]) => {
        const failRate = Math.round((data.failures / data.durations.length) * 100);
        const avgDuration = Math.round(data.durations.reduce((s, v) => s + v, 0) / data.durations.length);
        const avgSignals = Math.round((data.signals.reduce((s, v) => s + v, 0) / data.signals.length) * 10) / 10;

        // Most recent run's status
        const mostRecentRunSources = runs[0]?.metrics?.sources;
        const latestStatus = mostRecentRunSources?.[name]?.status;
        const latestError = mostRecentRunSources?.[name]?.error;

        let status: "connected" | "degraded" | "down";
        let statusLabel: string;

        if (latestStatus === "error") {
          // Check if it's been failing consistently
          if (failRate >= 80) {
            status = "down";
            statusLabel = "Down";
          } else {
            status = "degraded";
            statusLabel = "Intermittent";
          }
        } else if (failRate > 30) {
          status = "degraded";
          statusLabel = "Degraded";
        } else if (latestStatus === "ok" && avgSignals < 1) {
          status = "degraded";
          statusLabel = "Low signals";
        } else {
          status = "connected";
          statusLabel = "Connected";
        }

        return {
          name,
          displayName: getDisplayName(name),
          status,
          statusLabel,
          lastError: latestError,
          avgDurationMs: avgDuration,
          avgSignals,
          failRate,
          lastSeen: data.lastSeen,
        };
      });

      // Sort: down first, then degraded, then connected
      const order = { down: 0, degraded: 1, connected: 2 };
      healthList.sort((a, b) => order[a.status] - order[b.status]);

      setSources(healthList);
    } catch (err) {
      console.error("Failed to fetch data source health:", err);
      toast.error("Failed to load data source health");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHealth(); }, []);

  const summary = useMemo(() => {
    const connected = sources.filter(s => s.status === "connected").length;
    const degraded = sources.filter(s => s.status === "degraded").length;
    const down = sources.filter(s => s.status === "down").length;
    return { connected, degraded, down, total: sources.length };
  }, [sources]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base md:text-lg font-semibold text-foreground">Data Source Health</h2>
        <Button variant="outline" size="sm" onClick={fetchHealth} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4 pb-3 px-3 md:pt-5 md:pb-4 md:px-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-[10px] md:text-xs text-muted-foreground">Total</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-foreground">{summary.total}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4 pb-3 px-3 md:pt-5 md:pb-4 md:px-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Wifi className="h-4 w-4 text-green-400" />
              <span className="text-[10px] md:text-xs text-muted-foreground">Connected</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-green-400">{summary.connected}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4 pb-3 px-3 md:pt-5 md:pb-4 md:px-4">
            <div className="flex items-center gap-2 mb-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span className="text-[10px] md:text-xs text-muted-foreground">Degraded</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-amber-400">{summary.degraded}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4 pb-3 px-3 md:pt-5 md:pb-4 md:px-4">
            <div className="flex items-center gap-2 mb-1.5">
              <WifiOff className="h-4 w-4 text-red-400" />
              <span className="text-[10px] md:text-xs text-muted-foreground">Down</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-red-400">{summary.down}</p>
          </CardContent>
        </Card>
      </div>

      {/* Timeline info */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>
            Last test:{" "}
            {lastPipelineTime
              ? formatDistanceToNow(new Date(lastPipelineTime)) + " ago"
              : "Never"}
          </span>
        </div>
        {nextRefreshMinutes !== null && nextRefreshMinutes > 0 && (
          <div className="flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5 shrink-0" />
            <span>Next check: {nextRefreshMinutes} min</span>
          </div>
        )}
      </div>

      {/* Source List */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Source Status (based on last {Math.min(10, sources.length > 0 ? 10 : 0)} pipeline runs)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sources.length === 0 && !loading && (
            <p className="text-muted-foreground text-center py-8">
              No pipeline data yet. Run an analysis to populate health data.
            </p>
          )}
          <div className="divide-y divide-border/30">
            {sources.map((src) => (
              <div key={src.name} className="flex items-center justify-between py-3 first:pt-0 last:pb-0 gap-2">
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                  <span className="text-sm md:text-base leading-none">{getStatusEmoji(src.status)}</span>
                  <div className="min-w-0">
                    <p className="text-xs md:text-sm font-medium text-foreground truncate">{src.displayName}</p>
                    {src.lastError && src.status !== "connected" && (
                      <p className="text-[10px] md:text-xs text-red-400 truncate mt-0.5 max-w-[200px] md:max-w-[300px]">{src.lastError}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 md:gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-muted-foreground">{src.avgDurationMs}ms avg</p>
                    <p className="text-xs text-muted-foreground">{src.avgSignals} signals</p>
                  </div>
                  {src.failRate > 0 && (
                    <span className="text-[10px] md:text-xs text-muted-foreground hidden sm:inline">{src.failRate}% fail</span>
                  )}
                  <Badge variant={getStatusBadgeVariant(src.status)} className="text-[10px] md:text-xs min-w-[60px] md:min-w-[80px] justify-center">
                    {src.statusLabel}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
