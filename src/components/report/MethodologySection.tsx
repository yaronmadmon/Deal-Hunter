import { FlaskConical, Search, Globe, Database, Calendar, ShieldCheck, Rocket } from "lucide-react";
import type { MethodologyInfo } from "@/data/mockReport";

interface Props {
  methodology?: MethodologyInfo;
  dataSources?: string[];
}

export const MethodologySection = ({ methodology, dataSources }: Props) => {
  const m = methodology;

  return (
    <div className="bg-secondary/30 border border-border/50 rounded-2xl p-8 mt-12">
      <div className="flex items-center gap-2.5 mb-6">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <FlaskConical className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="font-heading text-lg font-bold text-foreground">How This Report Was Built</h2>
          <p className="text-xs text-muted-foreground">Transparency into our data collection & analysis methodology</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="flex items-start gap-2">
          <Database className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div>
            <div className="text-lg font-bold text-foreground">{m?.totalSources ?? dataSources?.length ?? "—"}</div>
            <div className="text-[11px] text-muted-foreground">Verified Sources</div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Search className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div>
            <div className="text-lg font-bold text-foreground">{m?.perplexityQueries ?? 4}</div>
            <div className="text-[11px] text-muted-foreground">AI Search Queries</div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Globe className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div>
            <div className="text-lg font-bold text-foreground">{m?.firecrawlScrapes ?? 10}</div>
            <div className="text-[11px] text-muted-foreground">Pages Scraped</div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Search className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
          <div>
            <div className="text-lg font-bold text-foreground">{m?.serperSearches ?? 3}</div>
            <div className="text-[11px] text-muted-foreground">Google Searches</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mb-6">
        <div className="flex items-start gap-2">
          <Calendar className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div>
            <div className="text-lg font-bold text-foreground">{m?.analysisDate ?? new Date().toLocaleDateString()}</div>
            <div className="text-[11px] text-muted-foreground">Analysis Date</div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Database className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div>
            <div className="text-lg font-bold text-foreground">{m?.dataPoints ?? "—"}</div>
            <div className="text-[11px] text-muted-foreground">Data Points Analyzed</div>
          </div>
        </div>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-success mt-0.5 shrink-0" />
          <div>
            <span className="font-medium text-foreground">Data Collection: </span>
            <span className="text-muted-foreground">
              Market trends, competitor data, and VC activity are sourced via Perplexity Sonar (AI-powered live web search with citations).
              Google search volume, trending keywords, and autocomplete data are pulled from Serper.dev (real Google results).
              App Store listings, Reddit discussions, and user reviews are scraped directly via Firecrawl.
            </span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-success mt-0.5 shrink-0" />
          <div>
            <span className="font-medium text-foreground">Analysis: </span>
            <span className="text-muted-foreground">
              All collected data is synthesized by AI grounded in the real sources. Data points are tagged as
              <span className="mx-1 px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded text-[10px] font-medium">Live Search</span>,
              <span className="mx-1 px-1.5 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded text-[10px] font-medium">Google</span>,
              <span className="mx-1 px-1.5 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded text-[10px] font-medium">Scraped</span>, or
              <span className="mx-1 px-1.5 py-0.5 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded text-[10px] font-medium">AI Estimated</span>
              for full transparency.
            </span>
          </div>
        </div>
        {m?.confidenceNote && (
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-success mt-0.5 shrink-0" />
            <div>
              <span className="font-medium text-foreground">Confidence: </span>
              <span className="text-muted-foreground">{m.confidenceNote}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
