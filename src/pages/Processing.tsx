import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Loader2, Circle, AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const steps = [
  { label: "Querying ATTOM for distressed properties...", statusMatch: "searching" },
  { label: "Mapping equity positions and lien amounts...", statusMatch: "searching" },
  { label: "Gathering market heat signals...", statusMatch: "scoring" },
  { label: "Running adversarial deal killer check...", statusMatch: "scoring" },
  { label: "Scoring deals with AI...", statusMatch: "scoring" },
  { label: "Finalizing your results...", statusMatch: "complete" },
];

const statusOrder = ["searching", "scoring", "complete"];

const TIMEOUT_MS = 4 * 60 * 1000; // 4 minutes

const Processing = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [currentStatus, setCurrentStatus] = useState("searching");
  const [activeStep, setActiveStep] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  // Global timeout
  useEffect(() => {
    timeoutRef.current = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  // Animate steps within the same status
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => {
        const currentIdx = statusOrder.indexOf(currentStatus);
        const ceiling = steps.findIndex((s, i) => {
          const stepIdx = statusOrder.indexOf(s.statusMatch);
          return stepIdx > currentIdx && i > prev;
        });
        const max = ceiling === -1 ? steps.length - 1 : ceiling - 1;
        return prev < max ? prev + 1 : prev;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [currentStatus]);

  // Advance active step when status changes
  useEffect(() => {
    const currentIdx = statusOrder.indexOf(currentStatus);
    if (currentIdx >= 0) {
      const firstStep = steps.findIndex((s) => statusOrder.indexOf(s.statusMatch) >= currentIdx);
      if (firstStep >= 0 && firstStep > activeStep) setActiveStep(firstStep);
    }
  }, [currentStatus]);

  // Poll the batch status every 8 seconds as a fallback
  useEffect(() => {
    if (!id || !user) return;
    const interval = setInterval(async () => {
      if (doneRef.current) return;
      const { data } = await supabase
        .from("properties" as any)
        .select("status")
        .eq("search_batch_id", id)
        .eq("user_id", user.id);
      if (!data || data.length === 0) return;
      const statuses = data.map((r: any) => r.status);
      const hasScoring = statuses.some((s: string) => s === "scoring");
      const allDone = statuses.every((s: string) => s === "complete" || s === "failed");
      if (hasScoring || statuses.some((s: string) => s === "searching")) {
        setCurrentStatus(hasScoring ? "scoring" : "searching");
      }
      if (allDone && data.length > 0) {
        doneRef.current = true;
        clearInterval(interval);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setCurrentStatus("complete");
        setActiveStep(steps.length - 1);
        setTimeout(() => navigate("/dashboard", { replace: true }), 1200);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [id, user, navigate]);

  // Realtime: watch properties in this batch
  useEffect(() => {
    if (!id || !user) return;
    const channel = supabase
      .channel(`batch-${id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "properties",
        filter: `search_batch_id=eq.${id}`,
      }, async (payload) => {
        if (doneRef.current) return;
        const row = payload.new as any;
        if (row.status === "scoring") setCurrentStatus("scoring");

        // Check if all properties in this batch are done
        const { data } = await supabase
          .from("properties" as any)
          .select("status")
          .eq("search_batch_id", id)
          .eq("user_id", user.id);
        if (!data || data.length === 0) return;
        const allDone = data.every((r: any) => r.status === "complete" || r.status === "failed");
        if (allDone) {
          doneRef.current = true;
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setCurrentStatus("complete");
          setActiveStep(steps.length - 1);
          setTimeout(() => navigate("/dashboard", { replace: true }), 1200);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, user, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <span className="font-heading text-xl font-bold text-foreground mb-1">Deal Hunter</span>
      <p className="text-sm text-muted-foreground mb-10">Searching for distressed deals in your market…</p>

      <div className="w-full max-w-sm space-y-4">
        {steps.map((step, i) => {
          const isDone = i < activeStep;
          const isActive = i === activeStep;
          return (
            <div key={i} className={`flex items-center gap-3 transition-opacity duration-300 ${isDone || isActive ? "opacity-100" : "opacity-30"}`}>
              {isDone ? (
                <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
              ) : isActive ? (
                <Loader2 className="w-5 h-5 text-primary shrink-0 animate-spin" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground/40 shrink-0" />
              )}
              <span className={`text-sm ${isDone ? "text-muted-foreground" : isActive ? "text-foreground font-medium" : "text-muted-foreground/50"}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {timedOut && (
        <div className="mt-10 w-full max-w-sm rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-center animate-in fade-in slide-in-from-bottom-2">
          <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">Taking longer than expected</p>
          <p className="text-xs text-muted-foreground mb-4">
            The search may still be running. You can wait or return to see results so far.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" />Back to Dashboard
          </Button>
        </div>
      )}
    </div>
  );
};

export default Processing;
