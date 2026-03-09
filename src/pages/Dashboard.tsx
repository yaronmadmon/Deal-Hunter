import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Coins, LogOut, Flame, Shield } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";

interface AnalysisRow {
  id: string;
  idea: string;
  status: string;
  overall_score: number | null;
  signal_strength: string | null;
  created_at: string;
}

const Dashboard = () => {
  const [idea, setIdea] = useState("");
  const [credits, setCredits] = useState<number>(2);
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;

    // Fetch profile credits
    supabase.from("profiles").select("credits").eq("id", user.id).single()
      .then(({ data }) => { if (data) setCredits(data.credits); });

    // Fetch analyses
    supabase.from("analyses").select("id, idea, status, overall_score, signal_strength, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setAnalyses(data); });
  }, [user]);

  const handleSubmit = async () => {
    if (idea.length < 20 || !user) return;
    if (credits <= 0) {
      toast.error("No credits remaining. Buy more to continue.");
      navigate("/buy-credits");
      return;
    }

    setSubmitting(true);
    try {
      // Insert analysis
      const { data, error } = await supabase.from("analyses")
        .insert({ user_id: user.id, idea, status: "pending" })
        .select("id")
        .single();

      if (error || !data) {
        toast.error("Failed to start analysis");
        return;
      }

      // Deduct credit
      await supabase.from("profiles")
        .update({ credits: credits - 1 })
        .eq("id", user.id);

      // Log credit usage
      await supabase.from("credits_log")
        .insert({ user_id: user.id, amount: -1, reason: "analysis", analysis_id: data.id });

      // Kick off pipeline
      supabase.functions.invoke("run-pipeline", {
        body: { analysisId: data.id, idea },
      });

      navigate(`/processing/${data.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const strengthVariant = (s: string | null) => {
    if (s === "Strong") return "go" as const;
    if (s === "Moderate") return "pivot" as const;
    return "nogo" as const;
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto border-b border-border/50">
        <span className="font-heading text-xl font-bold text-foreground">⛏️ Gold Rush</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-card border rounded-full px-3 py-1.5 text-sm">
            <Coins className="w-4 h-4 text-primary" />
            <span className="font-semibold text-foreground">{credits}</span>
            <span className="text-muted-foreground">credits</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/live")} className="text-orange-500 border-orange-500/30 hover:bg-orange-500/10">
            <Flame className="w-3.5 h-3.5 mr-1" /> Live
          </Button>
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={() => { signOut(); navigate("/"); }}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="font-heading text-3xl font-bold text-foreground mb-2">Validate an Idea</h1>
        <p className="text-muted-foreground mb-8">Describe your startup idea and we'll analyze real market data.</p>

        <Card className="mb-10">
          <CardContent className="p-6">
            <Textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="Describe your startup or app idea (20–500 characters)..."
              className="min-h-[120px] resize-none mb-4"
              maxLength={500}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{idea.length}/500</span>
              <Button variant="default" onClick={handleSubmit} disabled={idea.length < 20 || submitting}>
                {submitting ? "Starting…" : "Validate Idea"}
                <ArrowRight className="ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {analyses.length > 0 && (
          <>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-4">Previous Analyses</h2>
            <div className="space-y-3">
              {analyses.map((item) => (
                <Card
                  key={item.id}
                  className="cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => item.status === "complete" ? navigate(`/report/${item.id}`) : item.status !== "failed" ? navigate(`/processing/${item.id}`) : null}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground text-sm">{item.idea}</p>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(item.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {item.status === "complete" && item.overall_score !== null ? (
                        <>
                          <span className="font-heading text-lg font-bold text-foreground">{item.overall_score}</span>
                          <Badge variant={strengthVariant(item.signal_strength)}>{item.signal_strength}</Badge>
                        </>
                      ) : (
                        <Badge variant="secondary">{item.status}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
