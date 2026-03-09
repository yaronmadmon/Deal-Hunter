import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Trash2, TrendingUp, TrendingDown, Minus, ArrowLeft } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WatchlistItem {
  id: string;
  analysis_id: string;
  idea: string;
  current_score: number | null;
  previous_score: number | null;
  score_change: number | null;
  last_analyzed_at: string;
  created_at: string;
}

const Watchlist = () => {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [reanalyzing, setReanalyzing] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    fetchWatchlist();
  }, [user]);

  const fetchWatchlist = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("watchlist")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setItems(data as WatchlistItem[]);
  };

  const handleReanalyze = async (item: WatchlistItem) => {
    if (!user) return;
    setReanalyzing(item.id);

    try {
      // Create new analysis
      const { data: newAnalysis, error } = await supabase
        .from("analyses")
        .insert({ user_id: user.id, idea: item.idea, status: "pending" })
        .select("id")
        .single();

      if (error || !newAnalysis) {
        toast.error("Failed to start re-analysis");
        return;
      }

      // Deduct credit atomically
      const { data: deducted } = await supabase.rpc("deduct_credit", { analysis_id: newAnalysis.id });
      if (!deducted) {
        toast.error("No credits remaining. Buy more to re-analyze.");
        navigate("/buy-credits");
        return;
      }

      // Store previous score before updating
      await supabase
        .from("watchlist")
        .update({
          previous_score: item.current_score,
          analysis_id: newAnalysis.id,
          last_analyzed_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      // Kick off pipeline
      supabase.functions.invoke("run-pipeline", {
        body: { analysisId: newAnalysis.id, idea: item.idea },
      });

      toast.success("Re-analysis started! Redirecting to processing...");
      navigate(`/processing/${newAnalysis.id}`);
    } finally {
      setReanalyzing(null);
    }
  };

  const handleRemove = async (itemId: string) => {
    await supabase.from("watchlist").delete().eq("id", itemId);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    toast.success("Removed from watchlist");
  };

  const changeIndicator = (change: number | null) => {
    if (change === null || change === 0) {
      return (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Minus className="w-3 h-3" />
          <span className="text-xs">No change</span>
        </div>
      );
    }
    if (change > 0) {
      return (
        <div className="flex items-center gap-1 text-success">
          <TrendingUp className="w-3 h-3" />
          <span className="text-xs font-semibold">+{change}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 text-destructive">
        <TrendingDown className="w-3 h-3" />
        <span className="text-xs font-semibold">{change}</span>
      </div>
    );
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto border-b border-border/50">
        <span className="font-heading text-xl font-bold text-foreground">⛏️ Gold Rush</span>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
            Dashboard
          </Button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="font-heading text-3xl font-bold text-foreground">Idea Watchlist</h1>
        </div>
        <p className="text-muted-foreground mb-8 ml-12">
          Track your saved ideas and monitor market changes over time.
        </p>

        {items.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <p className="text-muted-foreground">No ideas tracked yet. Open a report and click "Track This Idea" to get started.</p>
              <Button variant="outline" className="mt-4" onClick={() => navigate("/dashboard")}>
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Card key={item.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => navigate(`/report/${item.analysis_id}`)}
                    >
                      <p className="font-medium text-foreground text-sm">{item.idea}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-2">
                          <span className="font-heading text-lg font-bold text-foreground">
                            {item.current_score ?? "—"}
                          </span>
                          <span className="text-xs text-muted-foreground">/100</span>
                        </div>
                        {changeIndicator(item.score_change)}
                        <span className="text-[10px] text-muted-foreground">
                          Last analyzed: {new Date(item.last_analyzed_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReanalyze(item)}
                        disabled={reanalyzing === item.id}
                      >
                        <RefreshCw className={`w-3 h-3 mr-1 ${reanalyzing === item.id ? "animate-spin" : ""}`} />
                        {reanalyzing === item.id ? "Running…" : "Re-analyze"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemove(item.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Watchlist;
