import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SignalCardData } from "@/data/mockReport";

interface SignalCardProps {
  card: SignalCardData;
}

export const SignalCard = ({ card }: SignalCardProps) => {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading">{card.title}</CardTitle>
        <span className="text-xs text-muted-foreground">{card.source}</span>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4 pt-0">
        {/* Metrics */}
        <div className="space-y-2">
          {card.metrics.map((m) => (
            <div key={m.label} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{m.label}</span>
              <span className="font-medium text-foreground text-right max-w-[55%]">{m.value}</span>
            </div>
          ))}
        </div>

        {/* Evidence */}
        <div className="bg-secondary rounded-lg p-3 space-y-2">
          {card.evidence.map((e, i) => (
            <p key={i} className="text-xs text-muted-foreground italic leading-relaxed">
              {e}
            </p>
          ))}
        </div>

        {/* Verdict */}
        <p className="text-sm font-medium text-foreground mt-auto pt-2 border-t">
          {card.verdict}
        </p>
      </CardContent>
    </Card>
  );
};
