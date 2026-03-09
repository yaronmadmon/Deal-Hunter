import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  TrendingUp,
  Rocket,
  MessageSquare,
  Layers,
  Sparkles,
  RefreshCw,
  Flame,
  Lock,
  Trophy,
  Code,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { toast } from "sonner";

/* ── Types ── */
interface TrendingItem {
  keyword: string;
  spike: string;
  snippet: string;
}
interface PHItem {
  name: string;
  tagline: string;
  upvotes: number;
  category: string;
}
interface RedditItem {
  title: string;
  problemSummary?: string;
  subreddit: string;
  upvotes: number;
}
interface NicheItem {
  name: string;
  description: string;
}
interface BreakoutItem {
  name: string;
  category: string;
  score: number;
  signalStrength: string;
  summary: string;
  generatedAt: string;
}

const CACHE_HOURS = 4;

const Live = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [credits, setCredits] = useState<number>(0);
  const [isPro, setIsPro] = useState(false);

  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [productHunt, setProductHunt] = useState<PHItem[]>([]);
  const [reddit, setReddit] = useState<RedditItem[]>([]);
  const [niches, setNiches] = useState<NicheItem[]>([]);
  const [breakout, setBreakout] = useState<BreakoutItem | null>(null);

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("credits")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setCredits(data.credits);
          // Consider users with 3+ credits as "pro" — adjust as needed
          setIsPro(data.credits >= 3);
        }
      });
  }, [user]);

  const loadCachedData = useCallback(async () => {
    const { data } = await supabase
      .from("live_feed_snapshots")
      .select("*")
      .order("created_at", { ascending: false });

    if (!data || data.length === 0) return null;

    let latestTime: Date | null = null;

    for (const row of data) {
      const payload = row.data_payload as any;
      const time = new Date(row.created_at);
      if (!latestTime || time > latestTime) latestTime = time;

      switch (row.section_name) {
        case "trending_searches":
          if (Array.isArray(payload)) setTrending(payload);
          break;
        case "product_hunt":
          if (Array.isArray(payload)) setProductHunt(payload);
          break;
        case "reddit_pain_points":
          if (Array.isArray(payload)) setReddit(payload);
          break;
        case "growing_niches":
          if (Array.isArray(payload)) setNiches(payload);
          break;
        case "breakout_idea":
          if (Array.isArray(payload) && payload[0]) setBreakout(payload[0]);
          break;
      }
    }

    if (latestTime) setLastUpdated(latestTime);
    return latestTime;
  }, []);

  const refreshFeed = useCallback(async () => {
    setRefreshing(true);
    try {
      await supabase.functions.invoke("live-feed-refresh", {
        body: { section: "all" },
      });
      await loadCachedData();
      toast.success("Market signals refreshed");
    } catch {
      toast.error("Failed to refresh signals");
    } finally {
      setRefreshing(false);
    }
  }, [loadCachedData]);

  useEffect(() => {
    if (!user || !isPro) {
      setLoadingData(false);
      return;
    }

    (async () => {
      const latestTime = await loadCachedData();
      setLoadingData(false);

      // Auto-refresh if cache is stale
      if (
        !latestTime ||
        Date.now() - latestTime.getTime() > CACHE_HOURS * 60 * 60 * 1000
      ) {
        refreshFeed();
      }
    })();
  }, [user, isPro, loadCachedData, refreshFeed]);

  const analyzeIdea = async (ideaText: string) => {
    if (!user) return;
    if (credits <= 0) {
      toast.error("No credits remaining");
      navigate("/buy-credits");
      return;
    }

    const { data, error } = await supabase
      .from("analyses")
      .insert({ user_id: user.id, idea: ideaText, status: "pending" })
      .select("id")
      .single();

    if (error || !data) {
      toast.error("Failed to start analysis");
      return;
    }

    await supabase
      .from("profiles")
      .update({ credits: credits - 1 })
      .eq("id", user.id);

    await supabase.from("credits_log").insert({
      user_id: user.id,
      amount: -1,
      reason: "analysis",
      analysis_id: data.id,
    });

    supabase.functions.invoke("run-pipeline", {
      body: { analysisId: data.id, idea: ideaText },
    });

    navigate(`/processing/${data.id}`);
  };

  const minutesAgo = lastUpdated
    ? Math.max(0, Math.floor((Date.now() - lastUpdated.getTime()) / 60000))
    : null;

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto border-b border-border/50">
        <span
          className="font-heading text-xl font-bold text-foreground cursor-pointer"
          onClick={() => navigate("/dashboard")}
        >
          ⛏️ Gold Rush
        </span>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
            Dashboard
          </Button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Flame className="w-7 h-7 text-orange-500" />
            <h1 className="font-heading text-3xl font-bold text-foreground">
              Gold Rush Live
            </h1>
          </div>
          <p className="text-muted-foreground">
            Real-time market signals updated every 4 hours
          </p>
          <div className="flex items-center gap-4 mt-2">
            {refreshing ? (
              <span className="text-xs text-warning flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Refreshing market signals…
              </span>
            ) : minutesAgo !== null ? (
              <span className="text-xs text-muted-foreground">
                Last updated: {minutesAgo < 60 ? `${minutesAgo} minutes ago` : `${Math.floor(minutesAgo / 60)}h ago`}
              </span>
            ) : null}
            {isPro && (
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshFeed}
                disabled={refreshing}
                className="text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" /> Refresh
              </Button>
            )}
          </div>
        </div>

        {/* Premium Gate */}
        {!isPro ? (
          <div className="relative">
            {/* Blurred placeholder */}
            <div className="filter blur-md pointer-events-none select-none opacity-60">
              <PlaceholderGrid />
            </div>
            {/* Overlay */}
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <Card className="max-w-md text-center shadow-xl border-primary/20">
                <CardContent className="p-8">
                  <Lock className="w-10 h-10 mx-auto mb-4 text-primary" />
                  <h2 className="font-heading text-xl font-bold text-foreground mb-2">
                    Gold Rush Live is a Pro feature
                  </h2>
                  <p className="text-muted-foreground text-sm mb-6">
                    See real-time startup opportunities and market signals.
                  </p>
                  <Button size="lg" onClick={() => navigate("/buy-credits")}>
                    Upgrade to Pro
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* ── Breakout Idea of the Day ── */}
            {loadingData ? (
              <Card className="border-2 border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-background shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded bg-muted animate-pulse" />
                    <div className="h-4 w-28 rounded bg-muted animate-pulse" />
                    <div className="h-5 w-36 rounded-full bg-muted animate-pulse" />
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="h-6 w-48 rounded bg-muted animate-pulse" />
                      <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
                      <div className="h-4 w-full rounded bg-muted animate-pulse" />
                      <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                    </div>
                    <div className="text-center shrink-0 space-y-1">
                      <div className="h-9 w-12 rounded bg-muted animate-pulse mx-auto" />
                      <div className="h-3 w-8 rounded bg-muted animate-pulse mx-auto" />
                      <div className="h-5 w-16 rounded-full bg-muted animate-pulse mx-auto" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="h-8 w-28 rounded bg-muted animate-pulse" />
                  </div>
                </CardContent>
              </Card>
            ) : breakout ? (
              <Card className="border-2 border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-background shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    <span className="font-heading text-sm font-bold uppercase tracking-wider text-yellow-500">
                      Gold Rush Pick
                    </span>
                    <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30 text-[10px]">
                      Breakout Idea of the Day
                    </Badge>
                    {breakout.generatedAt &&
                      new Date(breakout.generatedAt).toDateString() !==
                        new Date().toDateString() && (
                        <Badge variant="secondary" className="text-[10px]">
                          Yesterday's Pick
                        </Badge>
                      )}
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-heading text-xl font-bold text-foreground mb-1">
                        {breakout.name}
                      </h3>
                      <Badge variant="secondary" className="text-[10px] mb-3">
                        {breakout.category}
                      </Badge>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {breakout.summary}
                      </p>
                    </div>
                    <div className="text-center shrink-0">
                      <div className="font-heading text-3xl font-bold text-foreground">
                        {breakout.score}
                      </div>
                      <div className="text-[10px] text-muted-foreground">/100</div>
                      <Badge
                        className={`mt-1 text-[10px] ${
                          breakout.signalStrength === "Strong"
                            ? "bg-success/20 text-green-500 border-success/30"
                            : "bg-warning/20 text-yellow-600 border-warning/30"
                        }`}
                      >
                        {breakout.signalStrength}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      onClick={() => analyzeIdea(breakout.name)}
                    >
                      Analyze This <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ── Section 1: Trending Searches ── */}
              <SectionCard
                icon={<TrendingUp className="w-5 h-5 text-green-500" />}
                title="Trending Searches"
                loading={loadingData}
              >
                {trending.length === 0 ? (
                  <ErrorState />
                ) : (
                  <div className="space-y-3">
                    {trending.map((t, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm truncate">
                            {t.keyword}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {t.snippet}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          <span className="text-green-500 font-heading font-bold text-sm">
                            {t.spike}
                          </span>
                          <Button
                            size="sm"
                            variant="default"
                            className="text-xs h-7 px-2.5"
                            onClick={() =>
                              analyzeIdea(`Build an app for: ${t.keyword}`)
                            }
                          >
                            Analyze <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              {/* ── Section 2: Product Hunt ── */}
              <SectionCard
                icon={<Rocket className="w-5 h-5 text-orange-500" />}
                title="Hot Launches Today"
                loading={loadingData}
              >
                {productHunt.length === 0 ? (
                  <ErrorState />
                ) : (
                  <div className="space-y-3">
                    {productHunt.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm">
                            {p.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {p.tagline}
                          </p>
                          <Badge variant="secondary" className="text-[9px] mt-1">
                            {p.category}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          <div className="flex items-center gap-1 text-orange-500">
                            <Rocket className="w-3.5 h-3.5" />
                            <span className="font-heading font-bold text-sm">
                              {p.upvotes}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="default"
                            className="text-xs h-7 px-2.5"
                            onClick={() =>
                              analyzeIdea(`${p.name} style app`)
                            }
                          >
                            Analyze <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              {/* ── Section 3: Reddit Pain Points ── */}
              <SectionCard
                icon={<MessageSquare className="w-5 h-5 text-blue-500" />}
                title="Startup Problems Blowing Up"
                loading={loadingData}
              >
                {reddit.length === 0 ? (
                  <ErrorState />
                ) : (
                  <div className="space-y-3">
                    {reddit.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm">
                            {r.problemSummary || r.title}
                          </p>
                          <Badge variant="secondary" className="text-[9px] mt-1">
                            {r.subreddit}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          <div className="flex items-center gap-1 text-blue-500">
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span className="font-heading font-bold text-sm">
                              {r.upvotes}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="default"
                            className="text-xs h-7 px-2.5"
                            onClick={() =>
                              analyzeIdea(
                                `App solving: ${r.problemSummary || r.title}`
                              )
                            }
                          >
                            Analyze <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              {/* ── Section 4: Growing Niches ── */}
              <SectionCard
                icon={<Layers className="w-5 h-5 text-purple-500" />}
                title="Fastest Growing Niches"
                loading={loadingData}
              >
                {niches.length === 0 ? (
                  <ErrorState />
                ) : (
                  <div className="space-y-3">
                    {niches.map((n, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-3.5 h-3.5 text-green-500 shrink-0" />
                            <p className="font-medium text-foreground text-sm">
                              {n.name}
                            </p>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {n.description}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="default"
                          className="text-xs h-7 px-2.5 shrink-0 ml-3"
                          onClick={() =>
                            analyzeIdea(
                              `Build an app in the niche: ${n.name}`
                            )
                          }
                        >
                          Analyze <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          </div>
        )}
      </main>

      {/* Mobile bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border sm:hidden z-50">
        <div className="flex items-center justify-around py-2">
          <NavItem label="Home" onClick={() => navigate("/dashboard")} icon="⛏️" />
          <NavItem label="Live" onClick={() => {}} icon="🔥" active />
          <NavItem label="Watchlist" onClick={() => navigate("/watchlist")} icon="👀" />
        </div>
      </div>

      <footer className="text-center py-8 text-sm text-muted-foreground border-t border-border/50 sm:block hidden">
        © 2026 Gold Rush
      </footer>
    </div>
  );
};

/* ── Sub-components ── */

function SectionCard({
  icon,
  title,
  loading,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-heading">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/5 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-4/5 rounded bg-muted animate-pulse" />
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <div className="h-4 w-10 rounded bg-muted animate-pulse" />
                  <div className="h-7 w-20 rounded bg-muted animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

function ErrorState() {
  return (
    <div className="text-center py-6">
      <p className="text-sm text-muted-foreground">
        Signal unavailable — retrying next refresh cycle
      </p>
    </div>
  );
}

function PlaceholderGrid() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="shadow-sm">
          <CardContent className="p-6">
            <div className="h-6 w-40 bg-muted rounded mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-14 bg-muted rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function NavItem({
  label,
  onClick,
  icon,
  active,
}: {
  label: string;
  onClick: () => void;
  icon: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-4 py-1 text-xs transition-colors ${
        active
          ? "text-primary font-semibold"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <span className="text-lg">{icon}</span>
      <span>{label}</span>
      {active && (
        <div className="w-1 h-1 rounded-full bg-primary" />
      )}
    </button>
  );
}

export default Live;
