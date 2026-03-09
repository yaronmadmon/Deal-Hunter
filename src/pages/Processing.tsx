import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Loader2, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const steps = [
  { label: "Finding competitors in the App Store...", statusMatch: "fetching" },
  { label: "Reading what real users are saying on Reddit...", statusMatch: "fetching" },
  { label: "Checking Google search trends...", statusMatch: "fetching" },
  { label: "Analyzing X/Twitter buzz...", statusMatch: "analyzing" },
  { label: "Calculating your market score...", statusMatch: "analyzing" },
  { label: "Almost done — writing your report...", statusMatch: "complete" },
];

const statusOrder = ["pending", "fetching", "analyzing", "complete"];

const Processing = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [status, setStatus] = useState("pending");
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  // Animate steps within the same status
  useEffect(() => {
    if (status === "pending") return;

    const interval = setInterval(() => {
      setActiveStep((prev) => {
        // Find the max step for current status
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

  // Initial fetch
  useEffect(() => {
    if (!id) return;
    supabase.from("analyses").select("status").eq("id", id).single()
      .then(({ data }) => {
        if (data) {
          setStatus(data.status);
          if (data.status === "complete") navigate(`/report/${id}`, { replace: true });
          if (data.status === "failed") navigate("/dashboard", { replace: true });
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
        const newStatus = (payload.new as { status: string }).status;
        setStatus(newStatus);
        if (newStatus === "complete") {
          setTimeout(() => navigate(`/report/${id}`, { replace: true }), 800);
        }
        if (newStatus === "failed") {
          setTimeout(() => navigate("/dashboard", { replace: true }), 1000);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <span className="font-heading text-2xl font-bold text-foreground mb-2">⛏️ Gold Rush</span>
      <p className="text-muted-foreground mb-10">Building your market report...</p>

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
    </div>
  );
};

export default Processing;
