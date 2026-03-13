import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Trash2, RotateCcw } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { trackEvent } from "@/lib/analytics";

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
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [subscriptionSuccess, setSubscriptionSuccess] = useState(false);
  const navigate = useNavigate();
  const { user, loading, signOut, subscription, checkSubscription } = useAuth();
  const { isAdmin } = useAdmin();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, loading, navigate]);

  // Handle redirect from Stripe subscription checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("subscription") === "success") {
      setSubscriptionSuccess(true);
      // Aggressively refresh subscription status with delay to allow Stripe to process
      const refresh = async () => {
        for (let i = 0; i < 8; i++) {
          await new Promise(r => setTimeout(r, 3000));
          await checkSubscription();
        }
      };
      refresh();
      window.history.replaceState({}, "", "/dashboard");
      // Auto-dismiss banner after 30s
      setTimeout(() => setSubscriptionSuccess(false), 30000);
    }
  }, [checkSubscription]);

  const fetchData = () => {
    if (!user) return;
    supabase.from("profiles").select("credits, suspended").eq("id", user.id).single()
      .then(({ data }) => {
        if (data) {
          setCredits(data.credits);
          if ((data as any).suspended) {
            toast.error("Your account has been suspended. Contact support.");
          }
        }
      });

    supabase.from("analyses").select("id, idea, status, overall_score, signal_strength, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setAnalyses(data); });
  };

  // Fetch data on mount and when window regains focus (returning from processing/report)
  useEffect(() => {
    fetchData();

    const handleFocus = () => fetchData();
    window.addEventListener("focus", handleFocus);

    // Also listen for visibility change (tab switching)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchData();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
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

      // Deduct credit atomically
      const { data: deducted } = await supabase.rpc("deduct_credit", { analysis_id: data.id });
      if (!deducted) {
        toast.error("Failed to deduct credit");
        return;
      }

      trackEvent("analysis_created", user.id, { idea_length: idea.length });

      // Navigate immediately, then fire off pipeline in background
      navigate(`/processing/${data.id}`);

      // Kick off pipeline (fire-and-forget — processing page tracks status via realtime)
      supabase.functions.invoke("run-pipeline", {
        body: { analysisId: data.id, idea },
      }).then(({ error: pipelineError }) => {
        if (pipelineError) {
          supabase.from("analyses").update({ status: "failed" }).eq("id", data.id);
        }
      }).catch(() => {
        supabase.from("analyses").update({ status: "failed" }).eq("id", data.id);
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, analysisId: string) => {
    e.stopPropagation();
    try {
      const { error } = await supabase.from("analyses").delete().eq("id", analysisId);
      if (error) throw error;
      setAnalyses((prev) => prev.filter((a) => a.id !== analysisId));
      toast.success("Analysis deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete analysis");
    }
  };

  const handleRetry = async (e: React.MouseEvent, item: AnalysisRow) => {
    e.stopPropagation();
    if (!user || credits <= 0) {
      toast.error("No credits remaining.");
      return;
    }

    setRetryingId(item.id);
    try {
      // Create new analysis with same idea
      const { data, error } = await supabase.from("analyses")
        .insert({ user_id: user.id, idea: item.idea, status: "pending" })
        .select("id")
        .single();

      if (error || !data) {
        toast.error("Failed to retry analysis");
        return;
      }

      const { data: deducted } = await supabase.rpc("deduct_credit", { analysis_id: data.id });
      if (!deducted) {
        toast.error("Failed to deduct credit");
        return;
      }

      setCredits((c) => Math.max(0, c - 1));
      trackEvent("analysis_created", user.id, { retry: true, original_id: item.id });

      toast.success("Retrying analysis…");
      navigate(`/processing/${data.id}`);

      supabase.functions.invoke("run-pipeline", {
        body: { analysisId: data.id, idea: item.idea },
      }).then(({ error: pipelineError }) => {
        if (pipelineError) {
          supabase.from("analyses").update({ status: "failed" }).eq("id", data.id);
        }
      }).catch(() => {
        supabase.from("analyses").update({ status: "failed" }).eq("id", data.id);
      });
    } finally {
      setRetryingId(null);
    }
  };

  const strengthVariant = (s: string | null) => {
    if (s === "Strong") return "go" as const;
    if (s === "Moderate") return "pivot" as const;
    return "nogo" as const;
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading…</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <AppNav credits={credits} onSignOut={() => { signOut(); navigate("/"); }} />

      <main className="max-w-3xl mx-auto px-6 py-10">
        {/* Subscription success banner */}
        {subscriptionSuccess && (
          <div className="mb-6 rounded-xl border border-success/30 bg-success/10 p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center text-xl">🎉</div>
            <div className="flex-1">
              <p className="text-foreground font-semibold">Subscription Activated!</p>
              <p className="text-muted-foreground text-sm">
                {subscription.tier !== "free" ? (
                  <>Your <span className="font-medium capitalize text-foreground">{subscription.tier}</span> plan is now active. 3 bonus credits have been added to your account.</>
                ) : (
                  <>Your plan is being activated. This may take a moment...</>
                )}
              </p>
            </div>
            <button onClick={() => setSubscriptionSuccess(false)} className="text-muted-foreground hover:text-foreground text-lg">×</button>
          </div>
        )}

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
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground text-sm truncate">{item.idea}</p>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(item.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {item.status === "complete" && item.overall_score !== null ? (
                        <>
                          <span className="font-heading text-lg font-bold text-foreground">{item.overall_score}</span>
                          <Badge variant={strengthVariant(item.signal_strength)}>{item.signal_strength}</Badge>
                        </>
                      ) : item.status === "failed" ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">Failed</Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleRetry(e, item)}
                            disabled={retryingId === item.id}
                            className="h-7 text-xs"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Retry
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="secondary">{item.status}</Badge>
                      )}

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Analysis</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete this analysis and its report. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={(e) => handleDelete(e, item.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
