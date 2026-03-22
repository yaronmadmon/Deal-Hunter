import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface PerplexityWarningBannerProps {
  percentage: number;
  message: string;
  prominent?: boolean;
}

export const PerplexityWarningBanner = ({ percentage, message, prominent }: PerplexityWarningBannerProps) => {
  if (percentage <= 50) return null;

  const isHardCapped = percentage > 50;

  return (
    <Alert className={`mb-8 ${isHardCapped && prominent ? 'border-destructive/40 bg-destructive/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
      <AlertTriangle className={`h-4 w-4 ${isHardCapped && prominent ? 'text-destructive' : 'text-amber-400'}`} />
      <AlertTitle className={`text-sm font-semibold ${isHardCapped && prominent ? 'text-destructive' : 'text-amber-400'}`}>
        Data Quality Warning — {percentage}% AI-Synthesized{isHardCapped && prominent ? ' (Score Capped)' : ''}
      </AlertTitle>
      <AlertDescription className="text-xs text-muted-foreground mt-1">
        {message}
      </AlertDescription>
    </Alert>
  );
};
