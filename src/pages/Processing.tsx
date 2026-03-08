import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Loader2, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const steps = [
  { label: "Gathering market data", statusMatch: "fetching" },
  { label: "Analyzing signals", statusMatch: "analyzing" },
  { label: "Building report", statusMatch: "complete" },
];

const statusOrder = ["pending", "fetching", "analyzing", "complete"];

const Processing = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [status, setStatus] = useState("pending");

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

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

  const currentStepIndex = statusOrder.indexOf(status);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <span className="font-heading text-2xl font-bold text-foreground mb-2">⛏️ Gold Rush</span>
      <p className="text-muted-foreground mb-10">Analyzing your idea...</p>

      <div className="w-full max-w-sm space-y-5">
        {steps.map((step, i) => {
          const stepStatusIdx = statusOrder.indexOf(step.statusMatch);
          const isDone = currentStepIndex > stepStatusIdx || (status === "complete" && i <= 2);
          const isActive = currentStepIndex === stepStatusIdx || (currentStepIndex === statusOrder.indexOf(step.statusMatch));

          return (
            <div key={step.statusMatch} className="flex items-center gap-3">
              {isDone ? (
                <CheckCircle2 className="w-6 h-6 text-success shrink-0" />
              ) : isActive ? (
                <Loader2 className="w-6 h-6 text-primary shrink-0 animate-spin" />
              ) : (
                <Circle className="w-6 h-6 text-muted-foreground/40 shrink-0" />
              )}
              <span className={`text-sm font-medium ${isDone || isActive ? "text-foreground" : "text-muted-foreground/50"}`}>
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
