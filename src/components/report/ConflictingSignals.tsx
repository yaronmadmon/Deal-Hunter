import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

interface ConflictingSignal {
  signalA: string;
  sourceA: string;
  signalB: string;
  sourceB: string;
  category: string;
}

interface ConflictingSignalsProps {
  signals: ConflictingSignal[];
}

const categoryColors: Record<string, string> = {
  Demand: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Sentiment: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Competition: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Growth: "bg-green-500/10 text-green-400 border-green-500/20",
};

export const ConflictingSignals = ({ signals }: ConflictingSignalsProps) => {
  if (!signals || signals.length === 0) return null;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5 mb-8">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <CardTitle className="text-base font-semibold text-foreground">
            Conflicting Evidence
          </CardTitle>
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[11px]">
            {signals.length} conflict{signals.length > 1 ? "s" : ""}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          These data sources disagree — consider both perspectives before deciding.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {signals.map((conflict, i) => (
          <div key={i} className="rounded-lg border border-border/30 bg-muted/10 p-3 space-y-2">
            <Badge variant="secondary" className={`text-[11px] ${categoryColors[conflict.category] || "bg-muted text-muted-foreground border-border/50"}`}>
              {conflict.category}
            </Badge>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Source A</p>
                <p className="text-sm text-foreground">{conflict.signalA}</p>
                <p className="text-[11px] text-muted-foreground">{conflict.sourceA}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Source B</p>
                <p className="text-sm text-foreground">{conflict.signalB}</p>
                <p className="text-[11px] text-muted-foreground">{conflict.sourceB}</p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
