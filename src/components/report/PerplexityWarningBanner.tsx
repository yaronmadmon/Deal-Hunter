import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface PerplexityWarningBannerProps {
  percentage: number;
  message: string;
}

export const PerplexityWarningBanner = ({ percentage, message }: PerplexityWarningBannerProps) => {
  if (percentage <= 60) return null;

  return (
    <Alert className="mb-8 border-amber-500/30 bg-amber-500/5">
      <AlertTriangle className="h-4 w-4 text-amber-400" />
      <AlertTitle className="text-sm font-semibold text-amber-400">
        Data Quality Warning — {percentage}% AI-Synthesized
      </AlertTitle>
      <AlertDescription className="text-xs text-muted-foreground mt-1">
        {message}
      </AlertDescription>
    </Alert>
  );
};
