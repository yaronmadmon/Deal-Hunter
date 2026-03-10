import { MessageSquareQuote, ExternalLink } from "lucide-react";
import type { UserQuote } from "@/data/mockReport";

interface Props {
  quotes: UserQuote[];
}

const platformBadge: Record<string, { label: string; className: string }> = {
  reddit: { label: "Reddit", className: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  app_store: { label: "App Store", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  twitter: { label: "X / Twitter", className: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  product_hunt: { label: "Product Hunt", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  other: { label: "Web", className: "bg-muted text-muted-foreground" },
};

export const UserQuotesSection = ({ quotes }: Props) => {
  if (!quotes || quotes.length === 0) return null;

  return (
    <div className="bg-card border rounded-2xl p-8 mb-12">
      <div className="flex items-center gap-2.5 mb-6">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <MessageSquareQuote className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground">What Real Users Are Saying</h2>
          <p className="text-[13px] text-muted-foreground">{quotes.length} verified quotes from real discussions & reviews</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quotes.map((q, i) => {
          const badge = platformBadge[q.platform] || platformBadge.other;
          return (
            <div key={i} className="bg-secondary/30 border border-border/50 rounded-xl p-4 flex flex-col justify-between gap-3">
              <p className="text-sm text-foreground italic leading-relaxed">
                "{q.text}"
              </p>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                  <span className="text-[13px] text-muted-foreground">
                    {q.source}
                  </span>
                  {q.upvotes && (
                    <span className="text-xs text-muted-foreground">
                      ▲ {q.upvotes}
                    </span>
                  )}
                </div>
                {q.sourceUrl && (
                  <a
                    href={q.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-0.5"
                  >
                    <ExternalLink className="w-2.5 h-2.5" /> view
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};