import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SignalCardData } from "@/data/mockReport";

interface SignalCardProps {
  card: SignalCardData;
}

const confidenceColor = (c: string) => {
  if (c === "High") return "text-success";
  if (c === "Medium") return "text-primary";
  return "text-muted-foreground";
};

export const SignalCard = ({ card }: SignalCardProps) => {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base font-heading">{card.title}</CardTitle>
            <span className="text-xs text-muted-foreground">{card.source}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <span className={`text-xs font-medium ${confidenceColor(card.confidence)}`}>
            {card.confidence} confidence
          </span>
          <span className="text-xs text-muted-foreground">
            Evidence analyzed: {card.evidenceCount} signals
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4 pt-0">
        {/* Metrics view */}
        {card.type === "metrics" && card.metrics && (
          <div className="space-y-2">
            {card.metrics.map((m) => (
              <div key={m.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{m.label}</span>
                <span className="font-medium text-foreground text-right max-w-[55%]">{m.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Competitors view */}
        {card.type === "competitors" && card.competitors && (
          <div className="space-y-3">
            {card.competitors.map((c) => (
              <div key={c.name} className="border rounded-lg p-3 space-y-1">
                <div className="font-medium text-sm text-foreground">{c.name}</div>
                <div className="grid grid-cols-3 gap-1 text-xs text-muted-foreground">
                  <span>{c.rating}</span>
                  <span>{c.reviews} reviews</span>
                  <span>{c.downloads} downloads</span>
                </div>
                <div className="text-xs text-destructive/80">⚠ {c.weakness}</div>
              </div>
            ))}
          </div>
        )}

        {/* Sentiment view */}
        {card.type === "sentiment" && card.sentiment && (
          <div className="space-y-3">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Top Complaints</div>
              <ul className="space-y-1">
                {card.sentiment.complaints.map((c) => (
                  <li key={c} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-destructive mt-0.5">•</span> {c}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">What Users Love</div>
              <ul className="space-y-1">
                {card.sentiment.loves.map((l) => (
                  <li key={l} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span> {l}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Dominant Emotion</span>
              <span className="font-medium text-foreground">{card.sentiment.emotion}</span>
            </div>
          </div>
        )}

        {/* Evidence */}
        <div className="bg-secondary rounded-lg p-3 space-y-2">
          {card.evidence.map((e, i) => (
            <p key={i} className="text-xs text-muted-foreground italic leading-relaxed">
              {e}
            </p>
          ))}
        </div>

        {/* Insight */}
        <p className="text-sm font-medium text-foreground mt-auto pt-2 border-t">
          {card.insight}
        </p>
      </CardContent>
    </Card>
  );
};
