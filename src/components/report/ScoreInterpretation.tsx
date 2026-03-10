import { Badge } from "@/components/ui/badge";

interface Props {
  score: number;
}

const getInterpretation = (score: number) => {
  if (score >= 90) return { label: "Exceptional", description: "Strong demand, low competition, clear path to revenue.", className: "bg-[hsl(45,93%,47%)]/15 text-[hsl(45,93%,35%)] dark:text-[hsl(45,93%,60%)] border-[hsl(45,93%,47%)]/30" };
  if (score >= 75) return { label: "Strong Signal", description: "Real demand exists. Competition is manageable with the right angle.", className: "bg-success/15 text-success border-success/30" };
  if (score >= 60) return { label: "Moderate", description: "Market exists but you need a sharp niche to stand out.", className: "bg-warning/15 text-warning border-warning/30" };
  if (score >= 45) return { label: "Weak Signal", description: "Low demand or crowded market. Consider a different angle.", className: "bg-[hsl(25,95%,53%)]/15 text-[hsl(25,95%,40%)] dark:text-[hsl(25,95%,60%)] border-[hsl(25,95%,53%)]/30" };
  return { label: "Hard Pass", description: "Data shows low demand or extreme competition. Pivot the idea.", className: "bg-destructive/15 text-destructive border-destructive/30" };
};

export const ScoreInterpretation = ({ score }: Props) => {
  const { label, description, className } = getInterpretation(score);

  return (
    <div className="mt-3">
      <Badge variant="outline" className={`text-sm px-3 py-1 font-semibold ${className}`}>
        {label}
      </Badge>
      <p className="text-[13px] text-muted-foreground mt-1.5 max-w-sm leading-relaxed">
        {description}
      </p>
    </div>
  );
};