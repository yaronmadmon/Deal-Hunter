import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

interface ContaminatedSource {
  source: string;
  total: number;
  filtered: number;
  contaminationPct: number;
}

interface SourceContaminationBannerProps {
  sources: ContaminatedSource[];
}

const sourceDisplayNames: Record<string, string> = {
  github: "GitHub",
  hackernews: "Hacker News",
  producthunt: "Product Hunt",
  serper_competitor: "Google Competitor Search",
};

export const SourceContaminationBanner = ({ sources }: SourceContaminationBannerProps) => {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 mb-8">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            Source Quality Warning
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {sources.length === 1 ? "One data source" : `${sources.length} data sources`} returned mostly irrelevant results. Signals from these sources are flagged as low confidence.
          </p>
          <div className="flex gap-2 mt-2.5 flex-wrap">
            {sources.map((src, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[11px]"
              >
                {sourceDisplayNames[src.source] || src.source}: {src.contaminationPct}% irrelevant ({src.filtered}/{src.total})
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
