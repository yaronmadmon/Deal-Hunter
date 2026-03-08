import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Loader2, Circle } from "lucide-react";

const steps = [
  { label: "Gathering market data", key: "fetch" },
  { label: "Analyzing signals", key: "analyze" },
  { label: "Building report", key: "report" },
];

const Processing = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  // Simulate progress – will be replaced with Supabase Realtime
  useEffect(() => {
    const timers = [
      setTimeout(() => setCurrentStep(1), 2000),
      setTimeout(() => setCurrentStep(2), 4000),
      setTimeout(() => navigate(`/report/${id || "demo"}`), 6000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [id, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <span className="font-heading text-2xl font-bold text-foreground mb-2">⛏️ Gold Rush</span>
      <p className="text-muted-foreground mb-10">Analyzing your idea...</p>

      <div className="w-full max-w-sm space-y-5">
        {steps.map((step, i) => (
          <div key={step.key} className="flex items-center gap-3">
            {i < currentStep ? (
              <CheckCircle2 className="w-6 h-6 text-success shrink-0" />
            ) : i === currentStep ? (
              <Loader2 className="w-6 h-6 text-primary shrink-0 animate-spin" />
            ) : (
              <Circle className="w-6 h-6 text-muted-foreground/40 shrink-0" />
            )}
            <span className={`text-sm font-medium ${i <= currentStep ? "text-foreground" : "text-muted-foreground/50"}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Processing;
