import { Badge } from "@/components/ui/badge";
import { ScoreInterpretation } from "./ScoreInterpretation";

interface Props {
  score: number;
  signalStrength: "Strong" | "Moderate" | "Weak";
}

export const ScoreRing = ({ score, signalStrength }: Props) => {
  const circumference = 2 * Math.PI * 54;
  const progress = (score / 100) * circumference;
  const strengthVariant = signalStrength === "Strong" ? "go" as const : signalStrength === "Moderate" ? "pivot" as const : "nogo" as const;

  return (
    <div className="flex items-center gap-6">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="54" fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-heading text-3xl font-bold text-foreground">{score}</span>
          <span className="text-[10px] text-muted-foreground">/100</span>
        </div>
      </div>
      <div>
        <div className="text-sm text-muted-foreground mb-1.5">Signal Strength</div>
        <Badge variant={strengthVariant} className="text-sm px-4 py-1">{signalStrength}</Badge>
        <ScoreInterpretation score={score} />
      </div>
    </div>
  );
};
