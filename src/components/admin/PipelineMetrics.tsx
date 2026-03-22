import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, Clock, Signal, AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface SourceMetric {
  status: string;
  durationMs: number;
  signalCount: number;
  error?: string;
}

interface PipelineMetrics {
  totalFetchDurationMs: number;
  totalSignals: number;
  failedSources: string[];
  sources: Record<string, SourceMetric>;
  timestamp: string;
}

interface AnalysisWithMetrics {
  id: string;
  idea: string;
  status: string;
  overall_score: number | null;
  created_at: string;
  pipelineMetrics: PipelineMetrics | null;
}

const SOURCE_COLORS: Record<string, string> = {
  perplexity: "hsl(270, 70%, 60%)",
  firecrawl: "hsl(20, 80%, 55%)",
  serper: "hsl(210, 70%, 55%)",
  producthunt: "hsl(15, 85%, 55%)",
  github: "hsl(0, 0%, 55%)",
  twitter: "hsl(200, 85%, 55%)",
};

function getSourceColor(name: string): string {
  const prefix = name.split("_")[0];
  return SOURCE_COLORS[prefix] || "hsl(var(--muted-foreground))";
}

export const PipelineMetricsPanel = () => {
  const [analyses, setAnalyses] = useState<AnalysisWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("analyses")
        .select("id, idea, status, overall_score, created_at, report_data")
        .in("status", ["complete", "completed", "partial", "failed"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const mapped: AnalysisWithMetrics[] = (data || []).map((a: any) => ({
        id: a.id,
        idea: a.idea,
        status: a.status,
        overall_score: a.overall_score,
        created_at: a.created_at,
        pipelineMetrics: (a.report_data as any)?.pipelineMetrics ?? null,
      }));

      setAnalyses(mapped);
    } catch (err) {
      console.error("Failed to fetch pipeline metrics:", err);
      toast.error("Failed to load pipeline metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const withMetrics = analyses.filter(a => a.pipelineMetrics);

  // Aggregate stats
  const aggregateStats = useMemo(() => {
    if (withMetrics.length === 0) return null;

    const sourceFailCounts: Record<string, number> = {};
    const sourceDurations: Record<string, number[]> = {};
    const sourceSignals: Record<string, number[]> = {};
    let totalDuration = 0;
    let totalSignals = 0;
    let totalFailures = 0;

    for (const a of withMetrics) {
      const m = a.pipelineMetrics!;
      totalDuration += m.totalFetchDurationMs;
      totalSignals += m.totalSignals;
      totalFailures += m.failedSources.length;

      for (const [name, src] of Object.entries(m.sources)) {
        if (!sourceDurations[name]) { sourceDurations[name] = []; sourceSignals[name] = []; sourceFailCounts[name] = 0; }
        sourceDurations[name].push(src.durationMs);
        sourceSignals[name].push(src.signalCount);
        if (src.status === "error") sourceFailCounts[name]++;
      }
    }

    const sourceAverages = Object.keys(sourceDurations).map(name => ({
      name,
      avgDuration: Math.round(sourceDurations[name].reduce((s, v) => s + v, 0) / sourceDurations[name].length),
      avgSignals: Math.round((sourceSignals[name].reduce((s, v) => s + v, 0) / sourceSignals[name].length) * 10) / 10,
      failRate: Math.round((sourceFailCounts[name] / withMetrics.length) * 100),
      totalRuns: sourceDurations[name].length,
    })).sort((a, b) => b.avgDuration - a.avgDuration);

    return {
      totalRuns: withMetrics.length,
      avgDuration: Math.round(totalDuration / withMetrics.length),
      avgSignals: Math.round(totalSignals / withMetrics.length),
      totalFailures,
      failureRate: Math.round((withMetrics.filter(a => a.pipelineMetrics!.failedSources.length > 0).length / withMetrics.length) * 100),
      sourceAverages,
    };
  }, [withMetrics]);

  const durationChartData = aggregateStats?.sourceAverages.map(s => ({
    name: s.name.replace(/_/g, " "),
    duration: s.avgDuration,
    fullName: s.name,
  })) || [];

  const signalChartData = aggregateStats?.sourceAverages
    .filter(s => s.avgSignals > 0)
    .sort((a, b) => b.avgSignals - a.avgSignals)
    .map(s => ({
      name: s.name.replace(/_/g, " "),
      signals: s.avgSignals,
      fullName: s.name,
    })) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Pipeline Metrics</h2>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Aggregate KPIs */}
      {aggregateStats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Tracked Runs", value: aggregateStats.totalRuns, icon: Signal, color: "text-blue-400" },
            { label: "Avg Duration", value: `${(aggregateStats.avgDuration / 1000).toFixed(1)}s`, icon: Clock, color: "text-amber-400" },
            { label: "Avg Signals", value: aggregateStats.avgSignals, icon: CheckCircle2, color: "text-green-400" },
            { label: "Total Failures", value: aggregateStats.totalFailures, icon: XCircle, color: "text-red-400" },
            { label: "Failure Rate", value: `${aggregateStats.failureRate}%`, icon: AlertTriangle, color: aggregateStats.failureRate > 10 ? "text-red-400" : "text-green-400" },
          ].map(card => (
            <Card key={card.label} className="border-border/50 bg-card/50">
              <CardContent className="pt-5 pb-4 px-4">
                <div className="flex items-center gap-2 mb-2">
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                  <span className="text-xs text-muted-foreground">{card.label}</span>
                </div>
                <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Charts */}
      {aggregateStats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Duration Chart */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Duration by Source (ms)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={durationChartData} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                    <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(value: number) => [`${value}ms`, "Avg Duration"]}
                    />
                    <Bar dataKey="duration" radius={[0, 4, 4, 0]}>
                      {durationChartData.map((entry) => (
                        <Cell key={entry.fullName} fill={getSourceColor(entry.fullName)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Signal Count Chart */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Signals by Source</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={signalChartData} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                    <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(value: number) => [value, "Avg Signals"]}
                    />
                    <Bar dataKey="signals" radius={[0, 4, 4, 0]}>
                      {signalChartData.map((entry) => (
                        <Cell key={entry.fullName} fill={getSourceColor(entry.fullName)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Source Failure Rates Table */}
      {aggregateStats && aggregateStats.sourceAverages.some(s => s.failRate > 0) && (
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Source Failure Rates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {aggregateStats.sourceAverages.filter(s => s.failRate > 0).sort((a, b) => b.failRate - a.failRate).map(s => (
                <div key={s.name} className="flex items-center justify-between text-sm">
                  <span className="text-foreground font-mono text-xs">{s.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-xs">{s.totalRuns} runs</span>
                    <Badge variant={s.failRate > 20 ? "destructive" : "secondary"} className="text-xs">
                      {s.failRate}% fail
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-Analysis Drill-Down */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-base">Recent Pipeline Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {withMetrics.length === 0 && !loading && (
            <p className="text-muted-foreground text-center py-8">No analyses with pipeline metrics found. Run an analysis to see data here.</p>
          )}
          <div className="space-y-2">
            {withMetrics.map(a => {
              const m = a.pipelineMetrics!;
              const isExpanded = expandedId === a.id;
              const hasFails = m.failedSources.length > 0;
              return (
                <div key={a.id} className="border border-border/50 rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors text-left"
                    onClick={() => setExpandedId(isExpanded ? null : a.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{a.idea.slice(0, 60)}{a.idea.length > 60 ? "..." : ""}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{formatDistanceToNow(new Date(a.created_at))} ago</span>
                        <span>{(m.totalFetchDurationMs / 1000).toFixed(1)}s</span>
                        <span>{m.totalSignals} signals</span>
                        <span>{Object.keys(m.sources).length} sources</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      {hasFails && (
                        <Badge variant="destructive" className="text-xs">{m.failedSources.length} failed</Badge>
                      )}
                      {!hasFails && (
                        <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-400 border-green-500/20">All OK</Badge>
                      )}
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border/50 p-3 bg-muted/10">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {Object.entries(m.sources)
                          .sort(([, a], [, b]) => b.durationMs - a.durationMs)
                          .map(([name, src]) => (
                            <div
                              key={name}
                              className={`flex items-center justify-between p-2 rounded-md text-xs border ${
                                src.status === "error" ? "border-red-500/30 bg-red-500/5" : "border-border/30 bg-card/30"
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="font-mono text-foreground truncate">{name}</p>
                                {src.error && <p className="text-red-400 truncate mt-0.5">{src.error}</p>}
                              </div>
                              <div className="flex items-center gap-2 ml-2 shrink-0">
                                <span className="text-muted-foreground">{src.durationMs}ms</span>
                                <Badge variant="secondary" className="text-[10px] px-1.5">{src.signalCount}</Badge>
                                {src.status === "ok" ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5 text-red-400" />
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
