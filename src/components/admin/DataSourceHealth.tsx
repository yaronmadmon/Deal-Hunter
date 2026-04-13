import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, Zap, Loader2, ExternalLink, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────────

interface SourceMetric {
  status: string;
  durationMs: number;
  signalCount: number;
  error?: string;
}

type SourceStatus = "ok" | "degraded" | "error" | "unknown";

interface SourceRow {
  key: string;
  label: string;
  description: string;
  status: SourceStatus;
  avgSignals: number;
  avgDurationMs: number;
  failRate: number;
  lastError?: string;
  lastSeen: string | null;
}

interface ProviderGroup {
  id: string;
  name: string;
  billingUrl: string;
  billingLabel: string;
  sources: SourceRow[];
}

// ── Source → provider mapping ────────────────────────────────────────────────

const SOURCE_META: Record<string, { label: string; description: string; provider: string }> = {
  // Serper
  serper_probe:              { label: "Quota probe",          description: "Checks remaining Serper credits before running searches",      provider: "serper" },
  serper_trends:             { label: "Search trends",        description: "Google search volume & trending queries",                       provider: "serper" },
  serper_news:               { label: "News",                 description: "Recent news articles about the market",                         provider: "serper" },
  serper_reddit:             { label: "Reddit (via Google)",  description: "Reddit discussions indexed by Google",                          provider: "serper" },
  serper_autocomplete:       { label: "Autocomplete",         description: "Google autocomplete suggestions for demand signals",             provider: "serper" },
  serper_competitor_0:       { label: "Competitor search #1", description: "Google search for direct competitors",                          provider: "serper" },
  serper_competitor_1:       { label: "Competitor search #2", description: "Secondary Google competitor search",                            provider: "serper" },
  serper_keyword_intel:      { label: "Keyword intelligence", description: "Search volume & CPC data for core keywords",                    provider: "serper" },
  // Perplexity
  perplexity_vc:             { label: "VC funding data",      description: "Recent funding rounds and investor interest",                   provider: "perplexity" },
  perplexity_competitors:    { label: "Competitor analysis",  description: "Known competitors + market saturation",                        provider: "perplexity" },
  perplexity_revenue:        { label: "Revenue benchmarks",   description: "ARR, pricing, and MRR benchmarks for similar products",         provider: "perplexity" },
  perplexity_churn:          { label: "Churn & retention",    description: "Retention rates and pain points in competitor products",        provider: "perplexity" },
  perplexity_build_costs:    { label: "Build cost estimates", description: "Dev time and infrastructure cost estimates",                    provider: "perplexity" },
  perplexity_trends:         { label: "Market trends",        description: "Trend analysis (runs only when Serper quota is exhausted)",     provider: "perplexity" },
  // Twitter / X
  twitter_counts:            { label: "Tweet volume",         description: "Weekly tweet count to measure social interest",                 provider: "twitter" },
  twitter_sentiment:         { label: "Tweet sentiment",      description: "Real tweets about the problem or market",                       provider: "twitter" },
  twitter_influencers:       { label: "Influencer signals",   description: "Founder/builder profiles active in the space",                  provider: "twitter" },
  // Free APIs
  github:                    { label: "GitHub repos",         description: "Open-source repos solving the same problem",                    provider: "github" },
  hackernews:                { label: "Hacker News",          description: "HN discussions and Show HN posts",                             provider: "hackernews" },
  producthunt:               { label: "Product Hunt",         description: "Launched products in the same category",                       provider: "producthunt" },
  itunes_appstore:           { label: "App Store (iTunes)",   description: "iOS apps — competitor discovery and ratings",                   provider: "itunes" },
  // Firecrawl
  firecrawl_competitor_reviews: { label: "Competitor reviews", description: "G2 / Capterra / Trustpilot snippets for top competitors",    provider: "firecrawl" },
};

const PROVIDER_META: Record<string, { name: string; billingUrl: string; billingLabel: string }> = {
  serper:       { name: "Serper",       billingUrl: "https://serper.dev/dashboard",                    billingLabel: "serper.dev/dashboard" },
  perplexity:   { name: "Perplexity",   billingUrl: "https://www.perplexity.ai/settings/api",          billingLabel: "perplexity.ai/settings/api" },
  twitter:      { name: "Twitter / X",  billingUrl: "https://developer.twitter.com/en/portal/dashboard", billingLabel: "developer.twitter.com" },
  firecrawl:    { name: "Firecrawl",    billingUrl: "https://www.firecrawl.dev/app",                   billingLabel: "firecrawl.dev/app" },
  github:       { name: "GitHub",       billingUrl: "https://github.com/settings/tokens",              billingLabel: "github.com/settings/tokens" },
  producthunt:  { name: "Product Hunt", billingUrl: "https://www.producthunt.com/v2/oauth/applications", billingLabel: "producthunt.com" },
  hackernews:   { name: "Hacker News",  billingUrl: "https://hn.algolia.com",                          billingLabel: "Free API — no auth needed" },
  itunes:       { name: "App Store",    billingUrl: "https://developer.apple.com/app-store-connect",   billingLabel: "Free API — no auth needed" },
};

// ── Status dot ───────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: SourceStatus }) {
  const base = "h-2 w-2 rounded-full shrink-0";
  switch (status) {
    case "ok":       return <span className={`${base} bg-green-400`} />;
    case "degraded": return <span className={`${base} bg-amber-400`} />;
    case "error":    return <span className={`${base} bg-red-500 animate-pulse`} />;
    case "unknown":  return <span className={`${base} bg-muted-foreground/30`} />;
  }
}

function statusLabel(status: SourceStatus): string {
  switch (status) {
    case "ok":       return "OK";
    case "degraded": return "Low signals";
    case "error":    return "Error";
    case "unknown":  return "No data yet";
  }
}

function statusColor(status: SourceStatus): string {
  switch (status) {
    case "ok":       return "text-green-400";
    case "degraded": return "text-amber-400";
    case "error":    return "text-red-400";
    case "unknown":  return "text-muted-foreground";
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export const DataSourceHealth = () => {
  const [sourceMap, setSourceMap] = useState<Record<string, SourceRow>>({});
  const [loading, setLoading] = useState(true);
  const [liveChecking, setLiveChecking] = useState(false);
  const [lastPipelineTime, setLastPipelineTime] = useState<string | null>(null);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("analyses")
        .select("created_at, report_data")
        .in("status", ["complete", "partial"])
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      const runs = (data || [])
        .map((a: any) => ({ created_at: a.created_at, sources: (a.report_data as any)?.pipelineMetrics?.sources as Record<string, SourceMetric> | null }))
        .filter(r => r.sources);

      if (runs.length === 0) { setLoading(false); return; }
      setLastPipelineTime(runs[0].created_at);

      // Aggregate per-source across recent runs
      const agg: Record<string, { durations: number[]; signals: number[]; errors: string[]; failures: number; lastSeen: string | null }> = {};
      for (const run of runs) {
        for (const [key, src] of Object.entries(run.sources!)) {
          if (!agg[key]) agg[key] = { durations: [], signals: [], errors: [], failures: 0, lastSeen: null };
          agg[key].durations.push(src.durationMs);
          agg[key].signals.push(src.signalCount);
          if (src.status === "error" || src.status === "quota_exhausted") {
            agg[key].failures++;
            if (src.error) agg[key].errors.push(src.error);
          }
          if (!agg[key].lastSeen || run.created_at > agg[key].lastSeen!) agg[key].lastSeen = run.created_at;
        }
      }

      const latestSources = runs[0].sources!;
      const rows: Record<string, SourceRow> = {};

      for (const [key, d] of Object.entries(agg)) {
        const meta = SOURCE_META[key];
        if (!meta) continue; // skip unknown sources

        const latest = latestSources[key];
        const failRate = Math.round((d.failures / d.durations.length) * 100);
        const avgSignals = Math.round((d.signals.reduce((s, v) => s + v, 0) / d.signals.length) * 10) / 10;
        const avgDurationMs = Math.round(d.durations.reduce((s, v) => s + v, 0) / d.durations.length);

        let status: SourceStatus;
        if (latest?.status === "error" || latest?.status === "quota_exhausted") status = "error";
        else if (failRate > 25) status = "error";
        else if (avgSignals < 1 && latest?.status === "ok") status = "degraded";
        else status = "ok";

        rows[key] = {
          key,
          label: meta.label,
          description: meta.description,
          status,
          avgSignals,
          avgDurationMs,
          failRate,
          lastError: latest?.error || d.errors[0],
          lastSeen: d.lastSeen,
        };
      }

      setSourceMap(rows);
      // Auto-expand providers that have issues
      const problemProviders = new Set<string>();
      for (const [key, row] of Object.entries(rows)) {
        if (row.status === "error") {
          const provider = SOURCE_META[key]?.provider;
          if (provider) problemProviders.add(provider);
        }
      }
      if (problemProviders.size > 0) setExpandedProviders(problemProviders);
    } catch (err) {
      console.error("Failed to fetch data source health:", err);
      toast.error("Failed to load data source health");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const timer = setTimeout(() => runLiveHealthCheck(), 600);
    return () => clearTimeout(timer);
  }, []);

  const runLiveHealthCheck = async () => {
    setLiveChecking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Not authenticated"); return; }
      const { data, error } = await supabase.functions.invoke("health-check", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;

      const HEALTH_KEY_MAP: Record<string, string[]> = {
        serper:    ["serper_trends", "serper_news", "serper_reddit", "serper_autocomplete", "serper_competitor_0", "serper_competitor_1"],
        perplexity:["perplexity_vc", "perplexity_competitors", "perplexity_revenue", "perplexity_churn", "perplexity_build_costs"],
        twitter:   ["twitter_counts", "twitter_sentiment", "twitter_influencers"],
        firecrawl: ["firecrawl_competitor_reviews"],
        github:    ["github"],
        producthunt: ["producthunt"],
        hackernews:  ["hackernews"],
      };

      setSourceMap(prev => {
        const updated = { ...prev };
        for (const r of data.results) {
          const targetKeys = HEALTH_KEY_MAP[r.name] || [];
          for (const key of targetKeys) {
            const meta = SOURCE_META[key];
            if (!meta) continue;
            const existingRow = updated[key];
            updated[key] = {
              key,
              label: meta.label,
              description: meta.description,
              status: r.status === "connected" ? "ok" : r.status === "degraded" ? "degraded" : "error",
              avgSignals: existingRow?.avgSignals ?? 0,
              avgDurationMs: r.latencyMs ?? existingRow?.avgDurationMs ?? 0,
              failRate: existingRow?.failRate ?? 0,
              lastError: r.error,
              lastSeen: existingRow?.lastSeen ?? null,
            };
          }
        }
        return updated;
      });

      const healthy = data.results.filter((r: any) => r.status === "connected").length;
      toast.success(`Live check: ${healthy}/${data.results.length} healthy`);
    } catch (err: any) {
      toast.error("Live health check failed");
    } finally {
      setLiveChecking(false);
    }
  };

  const groups = useMemo((): ProviderGroup[] => {
    const providerOrder = ["serper", "perplexity", "twitter", "firecrawl", "github", "producthunt", "hackernews", "itunes"];
    return providerOrder.map(pid => {
      const pm = PROVIDER_META[pid];
      const sources = Object.values(SOURCE_META)
        .filter(m => m.provider === pid)
        .map(m => {
          const key = Object.keys(SOURCE_META).find(k => SOURCE_META[k] === m)!;
          return sourceMap[key] ?? {
            key,
            label: m.label,
            description: m.description,
            status: "unknown" as SourceStatus,
            avgSignals: 0,
            avgDurationMs: 0,
            failRate: 0,
            lastSeen: null,
          };
        });
      return { id: pid, name: pm.name, billingUrl: pm.billingUrl, billingLabel: pm.billingLabel, sources };
    });
  }, [sourceMap]);

  const summary = useMemo(() => {
    const rows = Object.values(sourceMap);
    return {
      ok: rows.filter(r => r.status === "ok").length,
      degraded: rows.filter(r => r.status === "degraded").length,
      error: rows.filter(r => r.status === "error").length,
      total: Object.keys(SOURCE_META).length,
    };
  }, [sourceMap]);

  const hasIssues = summary.error > 0 || summary.degraded > 0;

  const toggleProvider = (id: string) => {
    setExpandedProviders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const groupStatus = (group: ProviderGroup): SourceStatus => {
    if (group.sources.some(s => s.status === "error")) return "error";
    if (group.sources.some(s => s.status === "degraded")) return "degraded";
    if (group.sources.every(s => s.status === "unknown")) return "unknown";
    return "ok";
  };

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base md:text-lg font-semibold text-foreground">API Health</h2>
          {lastPipelineTime && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Last pipeline run {formatDistanceToNow(new Date(lastPipelineTime))} ago
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={runLiveHealthCheck} disabled={liveChecking}
            className="border-primary/30 text-primary hover:bg-primary/10">
            {liveChecking ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Zap className="h-4 w-4 mr-1.5" />}
            <span className="hidden sm:inline">{liveChecking ? "Checking..." : "Live Check"}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={fetchHealth} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Alert banner */}
      {hasIssues && !loading && (
        <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
          summary.error > 0
            ? "border-red-500/30 bg-red-500/5 text-red-400"
            : "border-amber-500/30 bg-amber-500/5 text-amber-400"
        }`}>
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="text-sm">
            {summary.error > 0 && (
              <p className="font-medium">
                {summary.error} API{summary.error > 1 ? "s" : ""} down — check billing or credentials below
              </p>
            )}
            {summary.degraded > 0 && (
              <p className={summary.error > 0 ? "mt-0.5 opacity-80" : "font-medium"}>
                {summary.degraded} source{summary.degraded > 1 ? "s" : ""} returning low signals
              </p>
            )}
          </div>
        </div>
      )}

      {/* Summary row */}
      {!loading && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground px-0.5">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-400 inline-block" />
            {summary.ok} healthy
          </span>
          {summary.degraded > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
              {summary.degraded} low signals
            </span>
          )}
          {summary.error > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse inline-block" />
              {summary.error} errors
            </span>
          )}
        </div>
      )}

      {/* Provider groups */}
      <div className="space-y-2">
        {groups.map(group => {
          const gStatus = groupStatus(group);
          const isExpanded = expandedProviders.has(group.id);
          const isFreeTier = ["hackernews", "itunes"].includes(group.id);

          return (
            <Card key={group.id} className={`border-border/50 overflow-hidden transition-colors ${
              gStatus === "error" ? "border-red-500/30" : gStatus === "degraded" ? "border-amber-500/20" : ""
            }`}>
              {/* Group header — always visible */}
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors text-left"
                onClick={() => toggleProvider(group.id)}
              >
                <div className="flex items-center gap-3">
                  <StatusDot status={gStatus} />
                  <span className="text-sm font-medium text-foreground">{group.name}</span>
                  {isFreeTier && (
                    <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">free</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {group.sources.filter(s => s.status === "ok").length}/{group.sources.length} sources OK
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {gStatus === "error" && (
                    <a
                      href={group.billingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 underline-offset-2 hover:underline"
                    >
                      Check billing
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {isExpanded
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  }
                </div>
              </button>

              {/* Expanded source rows */}
              {isExpanded && (
                <div className="border-t border-border/30">
                  {group.sources.map((src, i) => (
                    <div
                      key={src.key}
                      className={`flex items-start justify-between px-4 py-2.5 gap-3 ${
                        i < group.sources.length - 1 ? "border-b border-border/20" : ""
                      } ${src.status === "error" ? "bg-red-500/5" : ""}`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <StatusDot status={src.status} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground">{src.label}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{src.description}</p>
                          {src.lastError && src.status !== "ok" && (
                            <p className="text-[11px] text-red-400 mt-1 font-mono break-all">{src.lastError.slice(0, 200)}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-[11px] text-muted-foreground mt-0.5">
                        {src.status !== "unknown" && (
                          <>
                            <span title="Average signals per run">{src.avgSignals} sig</span>
                            <span title="Average response time">{src.avgDurationMs}ms</span>
                          </>
                        )}
                        <span className={`font-medium ${statusColor(src.status)}`}>
                          {statusLabel(src.status)}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Billing footer */}
                  {!isFreeTier && (
                    <div className="px-4 py-2 border-t border-border/20 bg-muted/10 flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">{group.billingLabel}</span>
                      <a
                        href={group.billingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80"
                      >
                        Open dashboard <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};
