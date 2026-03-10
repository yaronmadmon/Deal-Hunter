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
  Star,
  GitFork,
  Search,
  Newspaper,
  Smartphone,
  Twitter,
  Heart,
  Repeat,
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
interface HNItem {
  title: string;
  points: number;
  comments: number;
  author: string;
  url: string;
  hnUrl: string;
  createdAt: string;
}
interface BreakoutItem {
  name: string;
  category: string;
  score: number;
  signalStrength: string;
  summary: string;
  generatedAt: string;
}
interface GitHubTrendingItem {
  name: string;
  description: string;
  stars: number;
  forks: number;
  language: string | null;
  url: string;
  createdAt: string;
}
interface GoogleTrendItem {
  title: string;
  snippet: string;
  url: string;
  date?: string | null;
  type: "search" | "news";
}
interface AppStoreItem {
  name: string;
  platform: string;
  snippet?: string;
  category?: string;
  url?: string;
  source?: string;
}
interface TwitterBuzzItem {
  text: string;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  tweetId: string;
  createdAt: string;
  source?: string;
  topic?: string;
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
  const [hackerNews, setHackerNews] = useState<HNItem[]>([]);
  const [githubTrending, setGithubTrending] = useState<GitHubTrendingItem[]>([]);
  const [googleTrends, setGoogleTrends] = useState<GoogleTrendItem[]>([]);
  const [appStoreTrends, setAppStoreTrends] = useState<AppStoreItem[]>([]);
  const [breakout, setBreakout] = useState<BreakoutItem | null>(null);
  const [topOpportunities, setTopOpportunities] = useState<any[]>([]);

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
    const seen = new Set<string>();

    for (const row of data) {
      // Only use the latest snapshot per section
      if (seen.has(row.section_name)) continue;
      seen.add(row.section_name);

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
        case "hacker_news":
          if (Array.isArray(payload)) setHackerNews(payload);
          break;
        case "github_trending":
          if (Array.isArray(payload)) setGithubTrending(payload);
          break;
        case "google_trends":
          if (Array.isArray(payload)) setGoogleTrends(payload);
          break;
        case "app_store_trends":
          if (Array.isArray(payload)) setAppStoreTrends(payload);
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

  // Compute top opportunities from all feeds
  useEffect(() => {
    const all: any[] = [
      ...trending.map((t) => ({ ...t, _key: t.keyword, _label: t.keyword })),
      ...productHunt.map((p) => ({ ...p, _key: p.name, _label: p.name })),
      ...reddit.map((r) => ({ ...r, _key: r.problemSummary || r.title, _label: r.problemSummary || r.title })),
      ...niches.map((n) => ({ ...n, _key: n.name, _label: n.name })),
      ...hackerNews.map((h) => ({ ...h, _key: h.title, _label: h.title })),
      ...githubTrending.map((g) => ({ ...g, _key: g.name, _label: g.name })),
      ...googleTrends.map((g) => ({ ...g, _key: g.title, _label: g.title })),
      ...appStoreTrends.map((a) => ({ ...a, _key: a.name, _label: a.name })),
    ];
    all.sort((a, b) => ((b as any)._signalScore ?? 0) - ((a as any)._signalScore ?? 0));
    setTopOpportunities(all.slice(0, 5));
  }, [trending, productHunt, reddit, niches, hackerNews, githubTrending, googleTrends, appStoreTrends]);

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

    // Use RPC to safely deduct credit with race-condition protection
    const { data: deducted } = await supabase.rpc("deduct_credit", { analysis_id: data.id });
    if (!deducted) {
      toast.error("No credits remaining");
      // Clean up the analysis row
      await supabase.from("analyses").delete().eq("id", data.id);
      navigate("/buy-credits");
      return;
    }
    setCredits((c) => Math.max(0, c - 1));

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

            {/* ── Top Opportunities ── */}
            {loadingData ? (
              <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-background shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-5 h-5 rounded bg-muted animate-pulse" />
                    <div className="h-4 w-36 rounded bg-muted animate-pulse" />
                  </div>
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-3/5 rounded bg-muted animate-pulse" />
                          <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
                        </div>
                        <div className="h-7 w-20 rounded bg-muted animate-pulse" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : topOpportunities.length > 0 ? (
              <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-background shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h3 className="font-heading text-lg font-bold text-foreground">
                      Top Opportunities
                    </h3>
                    <Badge variant="secondary" className="text-[9px]">
                      Cross-feed
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {topOpportunities.map((opp, i) => {
                      const score = (opp as any)._signalScore;
                      const confidence = (opp as any)._confidence;
                      const momentum = (opp as any)._momentum;
                      const source = (opp as any)._source;
                      const label = opp._label || "Opportunity";
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-primary/70 w-5 shrink-0">
                                #{i + 1}
                              </span>
                              <p className="font-medium text-foreground text-sm truncate">
                                {label}
                              </p>
                              <SignalBadge score={score} confidence={confidence} />
                            </div>
                            <div className="flex items-center gap-2 ml-7 mt-1.5">
                              <div className="relative w-28 h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                                    (score ?? 0) >= 75 ? "bg-success" :
                                    (score ?? 0) >= 40 ? "bg-warning" :
                                    "bg-destructive"
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(0, score ?? 0))}%` }}
                                />
                              </div>
                              <span className="text-[10px] tabular-nums text-muted-foreground font-medium">
                                {score ?? 0}/100
                              </span>
                            </div>
                            <div className="flex items-center gap-2 ml-7 mt-1">
                              {source && (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                  {source.replace(/_/g, " ")}
                                </Badge>
                              )}
                              {momentum && (
                                <Badge className={`text-[9px] px-1.5 py-0 ${
                                  momentum === "Exploding" ? "bg-destructive/15 text-destructive border-destructive/20" :
                                  momentum === "Rising" ? "bg-success/15 text-green-600 border-success/20" :
                                  "bg-muted text-muted-foreground"
                                }`}>
                                  {momentum}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="default"
                            className="text-xs h-7 px-2.5 shrink-0 ml-3"
                            onClick={() => analyzeIdea(label)}
                          >
                            Analyze <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </div>
                      );
                    })}
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
                  <EmptyCategory category="search trends" />
                ) : (
                  <div className="space-y-3">
                    {trending.map((t, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground text-sm truncate">
                              {t.keyword}
                            </p>
                            <SignalBadge score={(t as any)._signalScore} confidence={(t as any)._confidence} />
                          </div>
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
                  <EmptyCategory category="product launches" />
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
                  <EmptyCategory category="startup problems" />
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
                  <EmptyCategory category="growing niches" />
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

              {/* ── Section 5: Hacker News Dev Buzz ── */}
              <SectionCard
                icon={<Code className="w-5 h-5 text-orange-600" />}
                title="Hacker News Dev Buzz"
                loading={loadingData}
              >
                {hackerNews.length === 0 ? (
                  <EmptyCategory category="developer buzz" />
                ) : (
                  <div className="space-y-3">
                    {hackerNews.map((hn, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm truncate">
                            {hn.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-[9px]">
                              {hn.points} pts
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {hn.comments} comments
                            </span>
                            <a
                              href={hn.hnUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-2.5 h-2.5" /> HN
                            </a>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="default"
                          className="text-xs h-7 px-2.5 shrink-0 ml-3"
                          onClick={() =>
                            analyzeIdea(`${hn.title}`)
                          }
                        >
                          Analyze <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
              {/* ── Section 6: GitHub Trending Repos ── */}
              <SectionCard
                icon={<Star className="w-5 h-5 text-warning" />}
                title="GitHub Trending Repos"
                loading={loadingData}
              >
                {githubTrending.length === 0 ? (
                  <EmptyCategory category="open source" />
                ) : (
                  <div className="space-y-3">
                    {githubTrending.map((repo, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <a
                            href={repo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-foreground text-sm hover:text-primary flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {repo.name}
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {repo.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Star className="w-3 h-3 text-warning" /> {repo.stars.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <GitFork className="w-3 h-3" /> {repo.forks}
                            </span>
                            {repo.language && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0">
                                {repo.language}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="default"
                          className="text-xs h-7 px-2.5 shrink-0 ml-3"
                          onClick={() =>
                            analyzeIdea(`Open source tool like ${repo.name.split("/").pop()}`)
                          }
                        >
                          Analyze <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              {/* ── Section 7: Google Trends & News ── */}
              <SectionCard
                icon={<Search className="w-5 h-5 text-primary" />}
                title="Google Trends & News"
                loading={loadingData}
              >
                {googleTrends.length === 0 ? (
                  <EmptyCategory category="Google trends" />
                ) : (
                  <div className="space-y-3">
                    {googleTrends.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {item.type === "news" ? (
                              <Newspaper className="w-3 h-3 text-primary shrink-0" />
                            ) : (
                              <Search className="w-3 h-3 text-muted-foreground shrink-0" />
                            )}
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-foreground text-sm hover:text-primary truncate"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {item.title}
                            </a>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {item.snippet}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-[9px]">
                              {item.type === "news" ? "News" : "Search"}
                            </Badge>
                            {item.date && (
                              <span className="text-[10px] text-muted-foreground">{item.date}</span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="default"
                          className="text-xs h-7 px-2.5 shrink-0 ml-3"
                          onClick={() => analyzeIdea(item.title)}
                        >
                          Analyze <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              {/* ── Section 8: App Store Trends ── */}
              <SectionCard
                icon={<Smartphone className="w-5 h-5 text-indigo-500" />}
                title="App Store Trends"
                loading={loadingData}
              >
                {appStoreTrends.length === 0 ? (
                  <EmptyCategory category="app store trends" />
                ) : (
                  <div className="space-y-3">
                    {appStoreTrends.map((app, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {app.url ? (
                              <a
                                href={app.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-foreground text-sm hover:text-primary flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {app.name}
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            ) : (
                              <p className="font-medium text-foreground text-sm">
                                {app.name}
                              </p>
                            )}
                            <SignalBadge score={(app as any)._signalScore} confidence={(app as any)._confidence} />
                          </div>
                          {app.snippet && (
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {app.snippet}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-[9px]">
                              {app.platform}
                            </Badge>
                            {app.category && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                {app.category}
                              </Badge>
                            )}
                            {app.source && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0">
                                {app.source === "firecrawl" ? "Live Data" : "AI Estimated"}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="default"
                          className="text-xs h-7 px-2.5 shrink-0 ml-3"
                          onClick={() =>
                            analyzeIdea(`${app.name} style app`)
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

function EmptyCategory({ category }: { category: string }) {
  return (
    <div className="text-center py-6">
      <p className="text-sm text-muted-foreground">
        No strong signals detected in {category} right now.
      </p>
      <p className="text-[10px] text-muted-foreground mt-1">
        Will retry on next refresh cycle.
      </p>
    </div>
  );
}

function SignalBadge({ score, confidence }: { score?: number; confidence?: string }) {
  if (score == null) return null;
  const color =
    score >= 65
      ? "bg-success/20 text-green-600 border-success/30"
      : score >= 35
      ? "bg-warning/20 text-yellow-600 border-warning/30"
      : "bg-muted text-muted-foreground";
  const confLabel = confidence && confidence !== "undefined" ? ` · ${confidence}` : "";
  return (
    <Badge className={`text-[9px] px-1.5 py-0 ${color}`}>
      {score}{confLabel}
    </Badge>
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
