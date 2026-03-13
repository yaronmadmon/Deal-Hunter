import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, TrendingUp, Rocket, MessageSquare, Layers, Sparkles,
  RefreshCw, Flame, Lock, Trophy, Code, ExternalLink, Star, GitFork,
  Search, Newspaper, Smartphone, Twitter, Heart, Repeat, Lightbulb,
  Target, Filter, ChevronDown, ChevronUp, Zap, Eye, Edit3, AlertTriangle,
  CheckCircle2, Bot, Globe, ArrowUpRight, ArrowDownRight, Minus, Clock,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { toast } from "sonner";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

/* ── Types ── */
type DataReliability = "verified_api" | "web_scraper" | "ai_estimated";

interface TrendingItem { keyword: string; spike: string; snippet: string; }
interface PHItem { name: string; tagline: string; upvotes: number; category: string; }
interface RedditItem { title: string; problemSummary?: string; subreddit: string; upvotes: number; commentCount?: number; url?: string; }
interface NicheItem { name: string; description: string; }
interface HNItem { title: string; points: number; comments: number; author: string; url: string; hnUrl: string; createdAt: string; }
interface BreakoutItem { name: string; originalSignal?: string; category: string; score: number; signalStrength: string; summary: string; suggestedIdea?: string; whyNow?: string; generatedAt: string; _reliability?: DataReliability; }
interface GitHubTrendingItem { name: string; description: string; stars: number; forks: number; language: string | null; url: string; createdAt: string; starsPerDay?: number; }
interface GoogleSearchItem { title: string; snippet: string; url: string; date?: string | null; type: "search" | "news"; }
interface AppStoreItem { name: string; platform: string; snippet?: string; category?: string; url?: string; source?: string; }
interface TwitterBuzzItem { text: string; likes: number; retweets: number; replies: number; impressions: number; tweetId: string; createdAt: string; source?: string; topic?: string; }
interface MarketGap { title: string; category: string; insight: string; suggestedIdea: string; confidenceLevel: string; signalSources: string[]; }
interface EnrichedSignal {
  _source: string; _signalScore: number; _confidence: string; _momentum: string;
  _reliability?: DataReliability; _velocityDelta?: number | null; _recency?: number;
  _category?: string; _opportunityGap?: string; _suggestedIdea?: string; _whyNow?: string;
  keyword?: string; name?: string; title?: string; text?: string; problemSummary?: string;
  tagline?: string; snippet?: string; description?: string;
  [key: string]: any;
}

const CATEGORIES = [
  "All", "AI & Machine Learning", "Developer Tools", "Productivity",
  "E-Commerce & Retail", "Health & Wellness", "Social & Community",
  "Fintech & Payments", "Education", "Utilities", "Creative Tools",
  "Infrastructure", "Other",
];

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  trending_searches: <TrendingUp className="w-3.5 h-3.5" />,
  product_hunt: <Rocket className="w-3.5 h-3.5" />,
  reddit_pain_points: <MessageSquare className="w-3.5 h-3.5" />,
  growing_niches: <Layers className="w-3.5 h-3.5" />,
  hacker_news: <Code className="w-3.5 h-3.5" />,
  github_trending: <Star className="w-3.5 h-3.5" />,
  google_search: <Search className="w-3.5 h-3.5" />,
  google_trends: <Search className="w-3.5 h-3.5" />, // backward compat
  app_store_trends: <Smartphone className="w-3.5 h-3.5" />,
  twitter_buzz: <Twitter className="w-3.5 h-3.5" />,
};

const SOURCE_LABELS: Record<string, string> = {
  trending_searches: "Search Trends",
  product_hunt: "Product Hunt",
  reddit_pain_points: "Reddit",
  growing_niches: "Growing Niche",
  hacker_news: "Hacker News",
  github_trending: "GitHub",
  google_search: "Google Search",
  google_trends: "Google Search", // backward compat
  app_store_trends: "App Store",
  twitter_buzz: "X/Twitter",
};

// Default reliability per source (overridden by _reliability from backend)
const DEFAULT_SOURCE_RELIABILITY: Record<string, DataReliability> = {
  product_hunt: "verified_api",
  hacker_news: "verified_api",
  github_trending: "verified_api",
  twitter_buzz: "verified_api",
  reddit_pain_points: "verified_api",
  google_search: "web_scraper",
  google_trends: "web_scraper",
  app_store_trends: "web_scraper",
  trending_searches: "ai_estimated",
  growing_niches: "ai_estimated",
};

const CACHE_HOURS = 4;
const STALE_THRESHOLD_HOURS = 8;

const Live = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [credits, setCredits] = useState<number>(0);
  const [isPro, setIsPro] = useState(false);

  // Data
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [productHunt, setProductHunt] = useState<PHItem[]>([]);
  const [reddit, setReddit] = useState<RedditItem[]>([]);
  const [niches, setNiches] = useState<NicheItem[]>([]);
  const [hackerNews, setHackerNews] = useState<HNItem[]>([]);
  const [githubTrending, setGithubTrending] = useState<GitHubTrendingItem[]>([]);
  const [googleSearch, setGoogleSearch] = useState<GoogleSearchItem[]>([]);
  const [appStoreTrends, setAppStoreTrends] = useState<AppStoreItem[]>([]);
  const [twitterBuzz, setTwitterBuzz] = useState<TwitterBuzzItem[]>([]);
  const [breakout, setBreakout] = useState<BreakoutItem | null>(null);
  const [enrichedOpportunities, setEnrichedOpportunities] = useState<EnrichedSignal[]>([]);
  const [marketGaps, setMarketGaps] = useState<MarketGap[]>([]);

  // Per-source timestamps
  const [sourceTimestamps, setSourceTimestamps] = useState<Record<string, string>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // UI state
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set(["enriched"]));
  const [validateDialog, setValidateDialog] = useState<{ open: boolean; idea: string; originalSignal: string }>({ open: false, idea: "", originalSignal: "" });

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
    const timestamps: Record<string, string> = {};

    for (const row of data) {
      if (seen.has(row.section_name)) continue;
      seen.add(row.section_name);

      const payload = row.data_payload as any;
      const time = new Date(row.created_at);
      if (!latestTime || time > latestTime) latestTime = time;

      // Track per-source timestamps
      if (row.section_name !== "source_timestamps") {
        timestamps[row.section_name] = row.created_at;
      }

      switch (row.section_name) {
        case "trending_searches": if (Array.isArray(payload)) setTrending(payload); break;
        case "product_hunt": if (Array.isArray(payload)) setProductHunt(payload); break;
        case "reddit_pain_points": if (Array.isArray(payload)) setReddit(payload); break;
        case "growing_niches": if (Array.isArray(payload)) setNiches(payload); break;
        case "hacker_news": if (Array.isArray(payload)) setHackerNews(payload); break;
        case "github_trending": if (Array.isArray(payload)) setGithubTrending(payload); break;
        case "google_search": if (Array.isArray(payload)) setGoogleSearch(payload); break;
        case "google_trends": if (Array.isArray(payload)) setGoogleSearch(payload); break; // backward compat
        case "app_store_trends": if (Array.isArray(payload)) setAppStoreTrends(payload); break;
        case "twitter_buzz": if (Array.isArray(payload)) setTwitterBuzz(payload); break;
        case "breakout_idea": if (Array.isArray(payload) && payload[0]) setBreakout(payload[0]); break;
        case "enriched_opportunities": if (Array.isArray(payload)) setEnrichedOpportunities(payload); break;
        case "market_gaps": if (Array.isArray(payload)) setMarketGaps(payload); break;
        case "source_timestamps": if (payload && typeof payload === "object") Object.assign(timestamps, payload); break;
      }
    }

    setSourceTimestamps(timestamps);
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
      toast.success("Market signals refreshed with opportunity insights");
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

      if (!latestTime || Date.now() - latestTime.getTime() > CACHE_HOURS * 60 * 60 * 1000) {
        refreshFeed();
      }
    })();
  }, [user, isPro, loadCachedData, refreshFeed]);

  // Filter enriched opportunities by category
  const filteredOpportunities = useMemo(() => {
    if (selectedCategory === "All") return enrichedOpportunities;
    return enrichedOpportunities.filter(s => s._category === selectedCategory);
  }, [enrichedOpportunities, selectedCategory]);

  // Get active categories from data
  const activeCategories = useMemo(() => {
    const cats = new Set<string>();
    enrichedOpportunities.forEach(s => { if (s._category) cats.add(s._category); });
    return ["All", ...Array.from(cats).sort()];
  }, [enrichedOpportunities]);

  const filteredGaps = useMemo(() => {
    if (selectedCategory === "All") return marketGaps;
    return marketGaps.filter(g => g.category === selectedCategory);
  }, [marketGaps, selectedCategory]);

  // Detect stale sources
  const staleSources = useMemo(() => {
    const stale: string[] = [];
    const now = Date.now();
    for (const [src, ts] of Object.entries(sourceTimestamps)) {
      if (src === "source_timestamps" || src === "enriched_opportunities" || src === "market_gaps" || src === "breakout_idea") continue;
      const age = now - new Date(ts).getTime();
      if (age > STALE_THRESHOLD_HOURS * 60 * 60 * 1000) {
        stale.push(src);
      }
    }
    return stale;
  }, [sourceTimestamps]);

  const openValidateDialog = (suggestedIdea: string, originalSignal: string) => {
    setValidateDialog({ open: true, idea: suggestedIdea, originalSignal });
  };

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

    const { data: deducted } = await supabase.rpc("deduct_credit", { analysis_id: data.id });
    if (!deducted) {
      toast.error("No credits remaining");
      await supabase.from("analyses").delete().eq("id", data.id);
      navigate("/buy-credits");
      return;
    }
    setCredits((c) => Math.max(0, c - 1));

    try {
      const { error: pipelineError } = await supabase.functions.invoke("run-pipeline", {
        body: { analysisId: data.id, idea: ideaText },
      });

      if (pipelineError) {
        await supabase.from("analyses").update({ status: "failed" }).eq("id", data.id);
        const message = pipelineError.message?.includes("429")
          ? "Rate limit reached. Please try again in a minute."
          : "Analysis failed to start. Please try again.";
        toast.error(message);
        return;
      }
    } catch (pipelineErr: any) {
      await supabase.from("analyses").update({ status: "failed" }).eq("id", data.id);
      const text = String(pipelineErr?.message || "").toLowerCase();
      const message = text.includes("429") || text.includes("rate limit")
        ? "Rate limit reached. Please try again in a minute."
        : "Analysis failed to start. Please try again.";
      toast.error(message);
      return;
    }

    navigate(`/processing/${data.id}`);
  };

  const handleValidateSubmit = () => {
    if (validateDialog.idea.trim()) {
      analyzeIdea(validateDialog.idea.trim());
      setValidateDialog({ open: false, idea: "", originalSignal: "" });
    }
  };

  const toggleSource = (source: string) => {
    setExpandedSources(prev => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };

  const getSignalLabel = (s: EnrichedSignal) =>
    s.keyword || s.name || s.title || s.problemSummary || s.text?.slice(0, 60) || "Signal";

  const minutesAgo = lastUpdated
    ? Math.max(0, Math.floor((Date.now() - lastUpdated.getTime()) / 60000))
    : null;

  if (loading) return null;

  return (
    <TooltipProvider>
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto border-b border-border/50">
        <span className="font-heading text-xl font-bold text-foreground cursor-pointer" onClick={() => navigate("/dashboard")}>
          ⛏️ Gold Rush
        </span>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>Dashboard</Button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Flame className="w-7 h-7 text-orange-500" />
            <h1 className="font-heading text-3xl font-bold text-foreground">Gold Rush Live</h1>
          </div>
          <p className="text-muted-foreground">
            Real-time market gaps & startup opportunities — updated every 4 hours
          </p>
          <div className="flex items-center gap-4 mt-2">
            {refreshing ? (
              <span className="text-xs text-warning flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> Analyzing market signals…
              </span>
            ) : minutesAgo !== null ? (
              <span className="text-xs text-muted-foreground">
                Updated: {minutesAgo < 60 ? `${minutesAgo}m ago` : `${Math.floor(minutesAgo / 60)}h ago`}
              </span>
            ) : null}
            {isPro && (
              <Button variant="ghost" size="sm" onClick={refreshFeed} disabled={refreshing} className="text-xs">
                <RefreshCw className="w-3 h-3 mr-1" /> Refresh
              </Button>
            )}
          </div>
        </div>

        {/* Premium Gate */}
        {!isPro ? (
          <div className="relative">
            <div className="filter blur-md pointer-events-none select-none opacity-60">
              <PlaceholderGrid />
            </div>
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <Card className="max-w-md text-center shadow-xl border-primary/20">
                <CardContent className="p-8">
                  <Lock className="w-10 h-10 mx-auto mb-4 text-primary" />
                  <h2 className="font-heading text-xl font-bold text-foreground mb-2">Gold Rush Live is a Pro feature</h2>
                  <p className="text-muted-foreground text-sm mb-6">See real-time startup opportunities, market gaps, and AI-generated ideas.</p>
                  <Button size="lg" onClick={() => navigate("/buy-credits")}>Upgrade to Pro</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="space-y-6">

            {/* ── Stale Data Warning Banner ── */}
            {staleSources.length > 0 && !loadingData && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/30">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-warning">Some data sources are stale (&gt;{STALE_THRESHOLD_HOURS}h old)</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {staleSources.map(s => SOURCE_LABELS[s] || s).join(", ")} — hit Refresh to update
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={refreshFeed} disabled={refreshing} className="text-xs shrink-0">
                  <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                </Button>
              </div>
            )}

            {/* ── Category Filter Bar ── */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
              {activeCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* ── Breakout Opportunity of the Day ── */}
            {loadingData ? (
              <BreakoutSkeleton />
            ) : breakout ? (
              <Card className="border-2 border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-background shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    <span className="font-heading text-sm font-bold uppercase tracking-wider text-yellow-500">
                      Opportunity of the Day
                    </span>
                    <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30 text-[10px]">
                      AI-Identified Gap
                    </Badge>
                    <ReliabilityBadge reliability={breakout._reliability} />
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-heading text-xl font-bold text-foreground mb-1">
                        {breakout.suggestedIdea || breakout.name}
                      </h3>
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="secondary" className="text-[10px]">{breakout.category}</Badge>
                        {breakout.originalSignal && breakout.originalSignal !== breakout.name && (
                          <span className="text-[10px] text-muted-foreground">
                            Inspired by: {breakout.originalSignal}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-2">{breakout.summary}</p>
                      {breakout.whyNow && (
                        <div className="flex items-start gap-1.5 mt-2">
                          <Zap className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">{breakout.whyNow}</p>
                        </div>
                      )}
                    </div>
                    <div className="text-center shrink-0">
                      <div className="font-heading text-3xl font-bold text-foreground">{breakout.score}</div>
                      <div className="text-[10px] text-muted-foreground">/100</div>
                      <Badge className={`mt-1 text-[10px] ${
                        breakout.signalStrength === "Strong"
                          ? "bg-success/20 text-green-500 border-success/30"
                          : "bg-warning/20 text-yellow-600 border-warning/30"
                      }`}>{breakout.signalStrength}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      onClick={() => openValidateDialog(
                        breakout.suggestedIdea || breakout.name,
                        breakout.originalSignal || breakout.name
                      )}
                    >
                      <Target className="w-3.5 h-3.5 mr-1" />
                      Validate This Opportunity
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* ── Market Gaps ── */}
            {loadingData ? (
              <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-background">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-5 h-5 rounded bg-muted animate-pulse" />
                    <div className="h-4 w-36 rounded bg-muted animate-pulse" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="p-4 rounded-lg bg-muted/50 space-y-2">
                        <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                        <div className="h-3 w-full rounded bg-muted animate-pulse" />
                        <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : filteredGaps.length > 0 ? (
              <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-background shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="w-5 h-5 text-primary" />
                    <h3 className="font-heading text-lg font-bold text-foreground">Market Gaps</h3>
                    <Badge variant="secondary" className="text-[9px]">AI Pattern Recognition</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredGaps.map((gap, i) => (
                      <div key={i} className="p-4 rounded-lg bg-muted/30 border border-border/50 hover:border-primary/30 transition-colors group">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-heading text-sm font-bold text-foreground leading-tight">{gap.title}</h4>
                          <Badge className={`text-[9px] px-1.5 py-0 shrink-0 ${
                            gap.confidenceLevel === "High" ? "bg-success/20 text-green-600 border-success/30" :
                            gap.confidenceLevel === "Medium" ? "bg-warning/20 text-yellow-600 border-warning/30" :
                            "bg-muted text-muted-foreground"
                          }`}>{gap.confidenceLevel}</Badge>
                        </div>
                        <Badge variant="secondary" className="text-[9px] mb-2">{gap.category}</Badge>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-3">{gap.insight}</p>
                        <div className="flex items-center gap-1.5 mb-3">
                          {gap.signalSources?.map((src, j) => (
                            <span key={j} className="inline-flex items-center gap-1 text-[9px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                              {SOURCE_ICONS[src] || null}
                              {SOURCE_LABELS[src] || src}
                            </span>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                          onClick={() => openValidateDialog(gap.suggestedIdea, gap.title)}
                        >
                          <Target className="w-3 h-3 mr-1" />
                          Validate: {gap.suggestedIdea}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* ── Enriched Opportunity Feed ── */}
            {filteredOpportunities.length > 0 && (
              <Collapsible open={expandedSources.has("enriched")} onOpenChange={() => toggleSource("enriched")}>
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CollapsibleTrigger className="flex items-center justify-between w-full">
                      <CardTitle className="flex items-center gap-2 text-base font-heading">
                        <Sparkles className="w-5 h-5 text-primary" />
                        Opportunity Feed
                        <Badge variant="secondary" className="text-[9px]">{filteredOpportunities.length} signals</Badge>
                      </CardTitle>
                      {expandedSources.has("enriched") ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </CollapsibleTrigger>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        {filteredOpportunities.map((opp, i) => {
                          const label = getSignalLabel(opp);
                          const hasInsight = !!opp._opportunityGap;
                          return (
                            <div key={i} className="p-4 rounded-lg bg-muted/30 border border-border/50 hover:border-primary/20 transition-colors">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  {/* Source + Category + Reliability */}
                                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                    <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                                      {SOURCE_ICONS[opp._source] || null}
                                      {SOURCE_LABELS[opp._source] || opp._source}
                                    </span>
                                    <ReliabilityBadge reliability={opp._reliability || DEFAULT_SOURCE_RELIABILITY[opp._source]} />
                                    {opp._category && opp._category !== "Other" && (
                                      <Badge variant="secondary" className="text-[9px]">{opp._category}</Badge>
                                    )}
                                    <SignalBadge score={opp._signalScore} confidence={opp._confidence} />
                                    {opp._momentum && (
                                      <Badge className={`text-[9px] px-1.5 py-0 ${
                                        opp._momentum === "Exploding" ? "bg-destructive/15 text-destructive border-destructive/20" :
                                        opp._momentum === "Rising" ? "bg-success/15 text-green-600 border-success/20" :
                                        "bg-muted text-muted-foreground"
                                      }`}>{opp._momentum}</Badge>
                                    )}
                                    <VelocityDelta delta={opp._velocityDelta} />
                                  </div>

                                  {/* Signal name */}
                                  <p className="font-medium text-foreground text-sm mb-1">
                                    📡 {label}
                                  </p>

                                  {/* Opportunity gap insight */}
                                  {hasInsight && (
                                    <div className="mt-2 pl-3 border-l-2 border-primary/30">
                                      <p className="text-xs text-foreground/80 leading-relaxed">
                                        <span className="font-semibold text-primary">Gap:</span> {opp._opportunityGap}
                                      </p>
                                      {opp._whyNow && (
                                        <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                                          <Zap className="w-3 h-3 text-yellow-500" /> {opp._whyNow}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* CTA */}
                                <div className="shrink-0 flex flex-col items-end gap-2">
                                  <div className="text-right">
                                    <div className="font-heading text-lg font-bold text-foreground">{opp._signalScore}</div>
                                    <div className="text-[9px] text-muted-foreground">/100</div>
                                  </div>
                                  {opp._suggestedIdea ? (
                                    <Button
                                      size="sm"
                                      className="text-xs h-7 px-2.5"
                                      onClick={() => openValidateDialog(opp._suggestedIdea!, label)}
                                    >
                                      <Target className="w-3 h-3 mr-1" /> Validate
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-xs h-7 px-2.5"
                                      onClick={() => openValidateDialog(
                                        `Build a better alternative for: ${label}`,
                                        label
                                      )}
                                    >
                                      <Target className="w-3 h-3 mr-1" /> Validate
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            {/* ── Raw Signal Sources (collapsible) ── */}
            <h3 className="font-heading text-lg font-bold text-foreground flex items-center gap-2 mt-4">
              <Eye className="w-5 h-5 text-muted-foreground" />
              Raw Signal Sources
              <span className="text-xs font-normal text-muted-foreground">(tap to expand)</span>
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Trending Searches */}
              <CollapsibleSourceCard
                icon={<TrendingUp className="w-5 h-5 text-green-500" />}
                title="Search Trends"
                loading={loadingData}
                count={trending.length}
                expanded={expandedSources.has("trending")}
                onToggle={() => toggleSource("trending")}
                reliability="ai_estimated"
                timestamp={sourceTimestamps["trending_searches"]}
              >
                {trending.length === 0 ? <EmptyCategory category="search trends" /> : (
                  <div className="space-y-2">
                    {trending.map((t, i) => (
                      <RawSignalRow key={i} label={t.keyword} subtitle={t.snippet} meta={<span className="text-green-500 font-heading font-bold text-sm">{t.spike}</span>} signal={t as any} onValidate={() => openValidateDialog(`Build an app for: ${t.keyword}`, t.keyword)} />
                    ))}
                  </div>
                )}
              </CollapsibleSourceCard>

              {/* Product Hunt */}
              <CollapsibleSourceCard
                icon={<Rocket className="w-5 h-5 text-orange-500" />}
                title="Hot Launches"
                loading={loadingData}
                count={productHunt.length}
                expanded={expandedSources.has("ph")}
                onToggle={() => toggleSource("ph")}
                reliability={productHunt[0] && (productHunt[0] as any)._reliability || "verified_api"}
                timestamp={sourceTimestamps["product_hunt"]}
              >
                {productHunt.length === 0 ? <EmptyCategory category="product launches" /> : (
                  <div className="space-y-2">
                    {productHunt.map((p, i) => (
                      <RawSignalRow key={i} label={p.name} subtitle={p.tagline} meta={<span className="text-orange-500 font-heading font-bold text-sm flex items-center gap-1"><Rocket className="w-3 h-3" />{p.upvotes}</span>} badge={p.category} signal={p as any} onValidate={() => openValidateDialog(`A simpler alternative to ${p.name} focused on ${p.category.toLowerCase()}`, p.name)} />
                    ))}
                  </div>
                )}
              </CollapsibleSourceCard>

              {/* Reddit */}
              <CollapsibleSourceCard
                icon={<MessageSquare className="w-5 h-5 text-blue-500" />}
                title="Pain Points"
                loading={loadingData}
                count={reddit.length}
                expanded={expandedSources.has("reddit")}
                onToggle={() => toggleSource("reddit")}
                reliability={reddit[0] && (reddit[0] as any)._reliability || "verified_api"}
                timestamp={sourceTimestamps["reddit_pain_points"]}
              >
                {reddit.length === 0 ? <EmptyCategory category="startup problems" /> : (
                  <div className="space-y-2">
                    {reddit.map((r, i) => (
                      <RawSignalRow key={i} label={r.problemSummary || r.title} meta={<div className="flex items-center gap-2"><span className="text-blue-500 font-heading font-bold text-sm flex items-center gap-1"><TrendingUp className="w-3 h-3" />{r.upvotes}</span>{r.commentCount != null && <span className="text-[10px] text-muted-foreground">{r.commentCount} comments</span>}</div>} badge={r.subreddit} signal={r as any} onValidate={() => openValidateDialog(`App solving: ${r.problemSummary || r.title}`, r.problemSummary || r.title)} linkUrl={r.url || (r.subreddit ? `https://www.reddit.com/${r.subreddit}/search/?q=${encodeURIComponent(r.title?.slice(0, 60) || "")}` : undefined)} />
                    ))}
                  </div>
                )}
              </CollapsibleSourceCard>

              {/* Growing Niches */}
              <CollapsibleSourceCard
                icon={<Layers className="w-5 h-5 text-purple-500" />}
                title="Growing Niches"
                loading={loadingData}
                count={niches.length}
                expanded={expandedSources.has("niches")}
                onToggle={() => toggleSource("niches")}
                reliability="ai_estimated"
                timestamp={sourceTimestamps["growing_niches"]}
              >
                {niches.length === 0 ? <EmptyCategory category="growing niches" /> : (
                  <div className="space-y-2">
                    {niches.map((n, i) => (
                      <RawSignalRow key={i} label={n.name} subtitle={n.description} signal={n as any} onValidate={() => openValidateDialog(`Build a focused tool in the ${n.name} niche`, n.name)} />
                    ))}
                  </div>
                )}
              </CollapsibleSourceCard>

              {/* Hacker News */}
              <CollapsibleSourceCard
                icon={<Code className="w-5 h-5 text-orange-600" />}
                title="Dev Buzz"
                loading={loadingData}
                count={hackerNews.length}
                expanded={expandedSources.has("hn")}
                onToggle={() => toggleSource("hn")}
                reliability="verified_api"
                timestamp={sourceTimestamps["hacker_news"]}
              >
                {hackerNews.length === 0 ? <EmptyCategory category="developer buzz" /> : (
                  <div className="space-y-2">
                    {hackerNews.map((hn, i) => (
                      <RawSignalRow key={i} label={hn.title} meta={<div className="flex items-center gap-2"><Badge variant="secondary" className="text-[9px]">{hn.points} pts</Badge><a href={hn.hnUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5" onClick={e => e.stopPropagation()}><ExternalLink className="w-2.5 h-2.5" /> HN</a></div>} signal={hn as any} onValidate={() => openValidateDialog(`Build a solution inspired by: ${hn.title}`, hn.title)} />
                    ))}
                  </div>
                )}
              </CollapsibleSourceCard>

              {/* GitHub */}
              <CollapsibleSourceCard
                icon={<Star className="w-5 h-5 text-warning" />}
                title="Trending Repos"
                loading={loadingData}
                count={githubTrending.length}
                expanded={expandedSources.has("github")}
                onToggle={() => toggleSource("github")}
                reliability="verified_api"
                timestamp={sourceTimestamps["github_trending"]}
              >
                {githubTrending.length === 0 ? <EmptyCategory category="open source" /> : (
                  <div className="space-y-2">
                    {githubTrending.map((repo, i) => (
                      <RawSignalRow key={i} label={repo.name} subtitle={repo.description} meta={<div className="flex items-center gap-2"><span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Star className="w-3 h-3 text-warning" /> {repo.stars.toLocaleString()}</span>{repo.starsPerDay != null && <span className="text-[10px] text-green-500 font-medium">⚡ {repo.starsPerDay}/day</span>}{repo.language && <Badge variant="outline" className="text-[9px] px-1 py-0">{repo.language}</Badge>}</div>} signal={repo as any} onValidate={() => openValidateDialog(`A hosted/managed version of ${repo.name.split("/").pop()}`, repo.name)} linkUrl={repo.url} />
                    ))}
                  </div>
                )}
              </CollapsibleSourceCard>

              {/* Google Search (renamed from Google Trends) */}
              <CollapsibleSourceCard
                icon={<Search className="w-5 h-5 text-primary" />}
                title="Google Search & News"
                loading={loadingData}
                count={googleSearch.length}
                expanded={expandedSources.has("google")}
                onToggle={() => toggleSource("google")}
                reliability="web_scraper"
                timestamp={sourceTimestamps["google_search"] || sourceTimestamps["google_trends"]}
              >
                {googleSearch.length === 0 ? <EmptyCategory category="search results" /> : (
                  <div className="space-y-2">
                    {googleSearch.map((item, i) => (
                      <RawSignalRow key={i} label={item.title} subtitle={item.snippet} meta={<Badge variant="secondary" className="text-[9px]">{item.type === "news" ? "News" : "Search"}</Badge>} signal={item as any} onValidate={() => openValidateDialog(`Build a tool related to: ${item.title}`, item.title)} linkUrl={item.url} />
                    ))}
                  </div>
                )}
              </CollapsibleSourceCard>

              {/* App Store */}
              <CollapsibleSourceCard
                icon={<Smartphone className="w-5 h-5 text-indigo-500" />}
                title="App Store"
                loading={loadingData}
                count={appStoreTrends.length}
                expanded={expandedSources.has("appstore")}
                onToggle={() => toggleSource("appstore")}
                reliability={appStoreTrends[0] && (appStoreTrends[0] as any)._reliability || "web_scraper"}
                timestamp={sourceTimestamps["app_store_trends"]}
              >
                {appStoreTrends.length === 0 ? <EmptyCategory category="app store trends" /> : (
                  <div className="space-y-2">
                    {appStoreTrends.map((app, i) => (
                      <RawSignalRow key={i} label={app.name} subtitle={app.snippet} meta={<div className="flex items-center gap-1"><Badge variant="secondary" className="text-[9px]">{app.platform}</Badge>{app.category && <Badge variant="outline" className="text-[9px] px-1 py-0">{app.category}</Badge>}</div>} signal={app as any} onValidate={() => openValidateDialog(`A better ${app.category || ""} app alternative to ${app.name}`, app.name)} linkUrl={app.url} />
                    ))}
                  </div>
                )}
              </CollapsibleSourceCard>

              {/* Twitter */}
              <CollapsibleSourceCard
                icon={<Twitter className="w-5 h-5 text-sky-500" />}
                title="X / Twitter"
                loading={loadingData}
                count={twitterBuzz.length}
                expanded={expandedSources.has("twitter")}
                onToggle={() => toggleSource("twitter")}
                reliability={twitterBuzz[0] && (twitterBuzz[0] as any)._reliability || "verified_api"}
                timestamp={sourceTimestamps["twitter_buzz"]}
              >
                {twitterBuzz.length === 0 ? <EmptyCategory category="Twitter buzz" /> : (
                  <div className="space-y-2">
                    {twitterBuzz.map((tweet, i) => (
                      <RawSignalRow key={i} label={tweet.text} meta={<div className="flex items-center gap-3"><span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Heart className="w-3 h-3 text-red-400" /> {tweet.likes}</span><span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Repeat className="w-3 h-3 text-green-500" /> {tweet.retweets}</span></div>} badge={tweet.topic} signal={tweet as any} onValidate={() => openValidateDialog(tweet.topic ? `Build a tool for: ${tweet.topic}` : `Build a solution for: ${tweet.text.slice(0, 60)}`, tweet.topic || tweet.text.slice(0, 60))} linkUrl={tweet.tweetId ? `https://x.com/i/status/${tweet.tweetId}` : undefined} />
                    ))}
                  </div>
                )}
              </CollapsibleSourceCard>
            </div>
          </div>
        )}
      </main>

      {/* Validate Dialog */}
      <Dialog open={validateDialog.open} onOpenChange={(open) => !open && setValidateDialog({ open: false, idea: "", originalSignal: "" })}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading">
              <Target className="w-5 h-5 text-primary" />
              Validate This Opportunity
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Inspired by signal:</p>
              <p className="text-sm text-foreground/70 italic">{validateDialog.originalSignal}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                <Edit3 className="w-3 h-3" />
                Edit the idea before validating (costs 1 credit):
              </p>
              <Textarea
                value={validateDialog.idea}
                onChange={(e) => setValidateDialog(prev => ({ ...prev, idea: e.target.value }))}
                placeholder="Describe the startup idea you want to validate..."
                className="min-h-[80px] text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setValidateDialog({ open: false, idea: "", originalSignal: "" })}>
              Cancel
            </Button>
            <Button onClick={handleValidateSubmit} disabled={!validateDialog.idea.trim()}>
              <ArrowRight className="w-3.5 h-3.5 mr-1" />
              Validate Idea ({credits} credits left)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </TooltipProvider>
  );
};

/* ── Sub-components ── */

function ReliabilityBadge({ reliability }: { reliability?: DataReliability }) {
  if (!reliability) return null;
  const config = {
    verified_api: { label: "Verified API", icon: CheckCircle2, className: "bg-success/15 text-green-600 dark:text-green-400 border-success/25", tooltip: "Data sourced directly from an official API" },
    web_scraper: { label: "Web Scraped", icon: Globe, className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25", tooltip: "Data collected by scraping web pages" },
    ai_estimated: { label: "AI Estimated", icon: Bot, className: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/25", tooltip: "Data generated or estimated by AI — may not be factual" },
  };
  const c = config[reliability];
  if (!c) return null;
  const Icon = c.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 font-normal gap-0.5 cursor-help ${c.className}`}>
          <Icon className="w-2.5 h-2.5" />
          {c.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs max-w-[200px]">
        {c.tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function VelocityDelta({ delta }: { delta?: number | null }) {
  if (delta == null) return null;
  if (delta === 0) return (
    <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground">
      <Minus className="w-2.5 h-2.5" /> 0
    </span>
  );
  return delta > 0 ? (
    <span className="inline-flex items-center gap-0.5 text-[9px] text-green-600 font-medium">
      <ArrowUpRight className="w-2.5 h-2.5" /> +{delta}
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 text-[9px] text-red-500 font-medium">
      <ArrowDownRight className="w-2.5 h-2.5" /> {delta}
    </span>
  );
}

function SourceFreshness({ timestamp }: { timestamp?: string }) {
  if (!timestamp) return null;
  const mins = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000));
  const isStale = mins > STALE_THRESHOLD_HOURS * 60;
  const label = mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] ${isStale ? "text-warning" : "text-muted-foreground"}`}>
      <Clock className="w-2.5 h-2.5" /> {label}
    </span>
  );
}

function CollapsibleSourceCard({
  icon, title, loading, count, expanded, onToggle, children,
  reliability, timestamp,
}: {
  icon: React.ReactNode; title: string; loading: boolean; count: number;
  expanded: boolean; onToggle: () => void; children: React.ReactNode;
  reliability?: DataReliability; timestamp?: string;
}) {
  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <CardTitle className="flex items-center gap-2 text-sm font-heading">
              {icon} {title}
              <Badge variant="secondary" className="text-[9px]">{count}</Badge>
              <ReliabilityBadge reliability={reliability} />
            </CardTitle>
            <div className="flex items-center gap-2">
              <SourceFreshness timestamp={timestamp} />
              {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-3/5 rounded bg-muted animate-pulse" />
                      <div className="h-3 w-4/5 rounded bg-muted animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function RawSignalRow({
  label, subtitle, meta, badge, signal, onValidate, linkUrl,
}: {
  label: string; subtitle?: string; meta?: React.ReactNode; badge?: string;
  signal: any; onValidate: () => void; linkUrl?: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {linkUrl ? (
            <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground text-sm hover:text-primary flex items-center gap-1 truncate" onClick={e => e.stopPropagation()}>
              {label} <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          ) : (
            <p className="font-medium text-foreground text-sm truncate">{label}</p>
          )}
        </div>
        {subtitle && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{subtitle}</p>}
        <div className="flex items-center gap-2 mt-1">
          {meta}
          {badge && <Badge variant="secondary" className="text-[9px]">{badge}</Badge>}
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="text-xs h-7 px-2.5 shrink-0 ml-3"
        onClick={onValidate}
      >
        <Target className="w-3 h-3 mr-1" /> Validate
      </Button>
    </div>
  );
}

function BreakoutSkeleton() {
  return (
    <Card className="border-2 border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-background shadow-lg">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded bg-muted animate-pulse" />
          <div className="h-4 w-28 rounded bg-muted animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-6 w-48 rounded bg-muted animate-pulse" />
          <div className="h-4 w-full rounded bg-muted animate-pulse" />
          <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
          <div className="h-8 w-40 rounded bg-muted animate-pulse mt-3" />
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyCategory({ category }: { category: string }) {
  return (
    <div className="text-center py-4">
      <p className="text-sm text-muted-foreground">No strong signals in {category} right now.</p>
    </div>
  );
}

function SignalBadge({ score, confidence }: { score?: number; confidence?: string }) {
  if (score == null) return null;
  const color = score >= 65 ? "bg-success/20 text-green-600 border-success/30" :
    score >= 35 ? "bg-warning/20 text-yellow-600 border-warning/30" :
    "bg-muted text-muted-foreground";
  const confLabel = confidence && confidence !== "undefined" ? ` · ${confidence}` : "";
  return <Badge className={`text-[9px] px-1.5 py-0 ${color}`}>{score}{confLabel}</Badge>;
}

function PlaceholderGrid() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {[1, 2, 3, 4].map(i => (
        <Card key={i} className="shadow-sm">
          <CardContent className="p-6">
            <div className="h-6 w-40 bg-muted rounded mb-4" />
            <div className="space-y-3">{[1, 2, 3].map(j => <div key={j} className="h-14 bg-muted rounded" />)}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function NavItem({ label, onClick, icon, active }: { label: string; onClick: () => void; icon: string; active?: boolean }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-0.5 px-4 py-1 text-xs transition-colors ${active ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"}`}>
      <span className="text-lg">{icon}</span>
      <span>{label}</span>
      {active && <div className="w-1 h-1 rounded-full bg-primary" />}
    </button>
  );
}

export default Live;
