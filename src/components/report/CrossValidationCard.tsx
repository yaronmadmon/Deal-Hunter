import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";

interface CrossValidatedSignal {
  claim: string;
  sources: string[];
  category: string;
}

interface CrossValidationCardProps {
  signals: CrossValidatedSignal[];
}

const categoryColors: Record<string, string> = {
  Competition: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Demand: "bg-green-500/10 text-green-400 border-green-500/20",
  Sentiment: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Growth: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

export const CrossValidationCard = ({ signals }: CrossValidationCardProps) => {
  if (!signals || signals.length === 0) return null;

  return (
    <Card className="border-green-500/20 bg-green-500/5 mb-8">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-green-400" />
          <CardTitle className="text-base font-semibold">Cross-Validated Signals</CardTitle>
          <Badge variant="secondary" className="bg-green-500/10 text-green-400 border-green-500/20 text-[11px] ml-auto">
            {signals.length} confirmed
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          These findings were independently confirmed by 2+ data sources — highest confidence signals.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {signals.map((signal, i) => (
            <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg border border-green-500/10 bg-background/50">
              <ShieldCheck className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">{signal.claim}</p>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <Badge variant="secondary" className={`text-[11px] ${categoryColors[signal.category] || "bg-muted text-muted-foreground"}`}>
                    {signal.category}
                  </Badge>
                  {signal.sources.map((src, j) => (
                    <Badge key={j} variant="outline" className="text-[11px]">
                      {src}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
