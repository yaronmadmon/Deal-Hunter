import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Loader2, Circle, AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const steps = [
  { label: "Finding competitors in the App Store...", statusMatch: "fetching" },
  { label: "Reading what real users are saying on Reddit...", statusMatch: "fetching" },
  { label: "Checking Google search trends...", statusMatch: "fetching" },
  { label: "Analyzing X/Twitter buzz...", statusMatch: "analyzing" },
  { label: "Calculating your market score...", statusMatch: "analyzing" },
  { label: "Almost done — writing your report...", statusMatch: "complete" },
];

const statusOrder = ["pending", "fetching", "analyzing", "complete"];

const TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

const Processing = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [status, setStatus] = useState("pending");
  const [activeStep, setActiveStep] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pipelineTriggered = useRef(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  // Timeout watchdog
  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      setTimedOut(true);
    }, TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Clear timeout if we reach a terminal state
  useEffect(() => {
    if (status === "complete" || status === "failed") {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setTimedOut(false);
    }
  }, [status]);

  // Animate steps within the same status
  useEffect(() => {
    if (status === "pending") return;

    const interval = setInterval(() => {
      setActiveStep((prev) => {
        const currentIdx = statusOrder.indexOf(status);
        const maxStep = steps.findIndex((s, i) => {
          const stepIdx = statusOrder.indexOf(s.statusMatch);
          return stepIdx > currentIdx && i > prev;
        });
        const ceiling = maxStep === -1 ? steps.length - 1 : maxStep - 1;
        if (prev < ceiling) return prev + 1;
        return prev;
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [status]);

  // Update active step when status changes
  useEffect(() => {
    const currentIdx = statusOrder.indexOf(status);
    if (currentIdx >= 0) {
      const firstStep = steps.findIndex(s => statusOrder.indexOf(s.statusMatch) >= currentIdx);
      if (firstStep >= 0 && firstStep > activeStep) setActiveStep(firstStep);
    }
  }, [status]);

  // Initial fetch + pipeline fallback trigger
  useEffect(() => {
    if (!id) return;
    supabase.from("analyses").select("status, report_data, idea").eq("id", id).single()
      .then(({ data }) => {
        if (data) {
          setStatus(data.status);
          if (data.status === "complete" || data.status === "partial") navigate(`/report/${id}`, { replace: true });
          if (data.status === "failed") {
            const reportData = data.report_data as any;
            const message = reportData?.message || reportData?.error;
            if (message) toast.error(message);
            else toast.error("Analysis failed. Please try again.");
            navigate("/dashboard", { replace: true });
            return;
          }
          // If still pending after 5s, the pipeline was never triggered (e.g. browser closed
          // on the dashboard). Re-invoke it here so the analysis can still complete.
          if (data.status === "pending" && !pipelineTriggered.current) {
            pipelineTriggered.current = true;
            setTimeout(() => {
              supabase.from("analyses").select("status").eq("id", id).single()
                .then(({ data: fresh }) => {
                  if (fresh?.status === "pending") {
                    supabase.functions.invoke("start-pipeline", {
                      body: { analysisId: id, idea: data.idea },
                    }).then(({ error }) => {
                      if (error) {
                        supabase.from("analyses").update({ status: "failed" }).eq("id", id!);
                      }
                    }).catch(() => {
                      supabase.from("analyses").update({ status: "failed" }).eq("id", id!);
                    });
                  }
                });
            }, 5000);
          }
        }
      });
  }, [id, navigate]);

  // Realtime subscription
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`analysis-${id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "analyses",
        filter: `id=eq.${id}`,
      }, (payload) => {
        const newRow = payload.new as { status: string; report_data?: any };
        setStatus(newRow.status);
        if (newRow.status === "complete" || newRow.status === "partial") {
          setTimeout(() => navigate(`/report/${id}`, { replace: true }), 800);
        }
        if (newRow.status === "failed") {
          const message = newRow.report_data?.message || newRow.report_data?.error;
          if (message) toast.error(message);
          else toast.error("Analysis failed. Please try again.");
          setTimeout(() => navigate("/dashboard", { replace: true }), 1000);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, navigate]);

  const handleRetry = () => {
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <span className="font-heading text-xl font-bold text-foreground mb-1">Gold Rush</span>
      <p className="text-sm text-muted-foreground mb-10">Scanning the market for your idea...</p>

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

      {/* Timeout warning */}
      {timedOut && (
        <div className="mt-10 w-full max-w-sm rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-center animate-in fade-in slide-in-from-bottom-2">
          <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">
            This is taking longer than expected
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            The analysis may still be processing, or it may have encountered an issue. You can wait or go back and retry.
          </p>
          <Button variant="outline" size="sm" onClick={handleRetry}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Back to Dashboard
          </Button>
        </div>
      )}
    </div>
  );
};

export default Processing;