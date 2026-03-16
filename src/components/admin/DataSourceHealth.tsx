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

const ALL_SOURCES = Object.keys(SOURCE_DISPLAY);

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
        const lastTime = new Date(runs[0].created_at).getTime();
        const now = Date.now();
        const minutesAgo = Math.round((now - lastTime) / 60000);
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

      const healthFromPipeline: SourceHealth[] = Object.entries(sourceMap).map(([name, data]) => {
        const failRate = Math.round((data.failures / data.durations.length) * 100);
        const avgDuration = Math.round(data.durations.reduce((s, v) => s + v, 0) / data.durations.length);
        const avgSignals = Math.round((data.signals.reduce((s, v) => s + v, 0) / data.signals.length) * 10) / 10;

        const mostRecentRunSources = runs[0]?.metrics?.sources;
        const latestStatus = mostRecentRunSources?.[name]?.status;
        const latestError = mostRecentRunSources?.[name]?.error;

        let status: "connected" | "degraded" | "down";
        let statusLabel: string;

        if (latestStatus === "error") {
          if (failRate >= 80) { status = "down"; statusLabel = "Down"; }
          else { status = "degraded"; statusLabel = "Intermittent"; }
        } else if (failRate > 30) {
          status = "degraded"; statusLabel = "Degraded";
        } else if (latestStatus === "ok" && avgSignals < 1) {
          status = "degraded"; statusLabel = "Low signals";
        } else {
          status = "connected"; statusLabel = "Connected";
        }

        return { name, displayName: getDisplayName(name), status, statusLabel, lastError: latestError, avgDurationMs: avgDuration, avgSignals, failRate, lastSeen: data.lastSeen };
      });

      // Ensure ALL known sources appear, even without pipeline data
      const knownNames = new Set(healthFromPipeline.map(s => s.name));
      const fullList = [...healthFromPipeline];
      for (const key of ALL_SOURCES) {
        if (!knownNames.has(key)) {
          fullList.push({
            name: key,
            displayName: getDisplayName(key),
            status: "degraded",
            statusLabel: "Not tested",
            avgDurationMs: 0,
            avgSignals: 0,
            failRate: 0,
            lastSeen: null,
          });
        }
      }

      const order = { down: 0, degraded: 1, connected: 2 };
      fullList.sort((a, b) => order[a.status] - order[b.status]);

      setSources(fullList);
    } catch (err) {
      console.error("Failed to fetch data source health:", err);
      toast.error("Failed to load data source health");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    // Auto-run live check on mount
    const timer = setTimeout(() => runLiveHealthCheck(), 500);
    return () => clearTimeout(timer);
  }, []);

  const runLiveHealthCheck = async () => {
    setLiveChecking(true);
    setLiveResults(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in");
        return;
      }
      const { data, error } = await supabase.functions.invoke("health-check", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      // Map health-check names to frontend source names
      const HEALTH_TO_SOURCES: Record<string, string[]> = {
        serper: ["serper_search", "serper_news", "serper_producthunt"],
        twitter: ["twitter_search", "twitter_counts", "twitter_influencers"],
        producthunt: ["producthunt"],
        perplexity: ["perplexity"],
        firecrawl: ["firecrawl"],
        github: ["github"],
        hackernews: ["hackernews"],
        keywords_everywhere: ["keywords_everywhere"],
      };
      const map: Record<string, any> = {};
      for (const r of data.results) {
        const result = { status: r.status, latencyMs: r.latencyMs, error: r.error };
        const targets = HEALTH_TO_SOURCES[r.name] || [r.name];
        for (const t of targets) {
          map[t] = result;
        }
      }
      setLiveResults(map);
      toast.success(`Live check complete — ${data.results.filter((r: any) => r.status === "connected").length}/${data.results.length} healthy`);
    } catch (err: any) {
      console.error("Live health check failed:", err);
      toast.error("Live health check failed");
    } finally {
      setLiveChecking(false);
    }
  };

  // Merge live results into sources for display
  const displaySources = useMemo(() => {
    if (!liveResults) return sources;
    return sources.map(src => {
      const live = liveResults[src.name];
      if (!live) return src;
      return {
        ...src,
        status: live.status,
        statusLabel: live.status === "connected" ? "OK" : live.status === "degraded" ? "Degraded" : "Down",
        lastError: live.error,
      };
    });
  }, [sources, liveResults]);

  const summary = useMemo(() => {
    const connected = displaySources.filter(s => s.status === "connected").length;
    const degraded = displaySources.filter(s => s.status === "degraded").length;
    const down = displaySources.filter(s => s.status === "down").length;
    return { connected, degraded, down, total: displaySources.length };
  }, [displaySources]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base md:text-lg font-semibold text-foreground">Data Source Health</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={runLiveHealthCheck}
            disabled={liveChecking}
            className="border-primary/30 text-primary hover:bg-primary/10"
          >
            {liveChecking ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-1.5" />
            )}
            <span className="hidden sm:inline">{liveChecking ? "Pinging..." : "Live Check"}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={fetchHealth} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
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

      {/* Source List — always visible */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {liveResults ? "Live Status" : liveChecking ? "Checking APIs..." : "API Status"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {liveChecking && !liveResults && (
            <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Pinging all APIs...
            </div>
          )}
          <div className="divide-y divide-border/30">
            {displaySources.map((src) => (
              <div key={src.name} className="flex items-center justify-between py-3 first:pt-0 last:pb-0 gap-2">
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                  <span className="text-sm md:text-base leading-none">{getStatusEmoji(src.status)}</span>
                  <div className="min-w-0">
                    <p className="text-xs md:text-sm font-medium text-foreground truncate">{src.displayName}</p>
                    {src.lastError && src.status !== "connected" && (
                      <p className="text-[10px] md:text-xs text-destructive truncate mt-0.5 max-w-[200px] md:max-w-[300px]">{src.lastError}</p>
                    )}
                  </div>
                </div>
                <Badge variant={getStatusBadgeVariant(src.status)} className="text-[10px] md:text-xs min-w-[60px] md:min-w-[80px] justify-center">
                  {src.statusLabel}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
