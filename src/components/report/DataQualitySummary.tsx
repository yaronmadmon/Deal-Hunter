import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, CheckCircle2, Info, Filter } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

interface DataQualityEntry {
  sourceName: string;
  dataTier: string;
  signalCount: string;
  reliabilityNote: string;
}

interface RelevanceFilterData {
  scored?: number;
  filtered?: number;
  discardedItems?: { source: string; title: string; score: number }[];
}

interface DataQualitySummaryProps {
  data: DataQualityEntry[];
  relevanceFilter?: RelevanceFilterData | null;
}

const tierConfig: Record<string, { icon: any; color: string; bg: string }> = {
  verified: { icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10 text-green-400 border-green-500/20" },
  reported: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  estimated: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
};

export const DataQualitySummary = ({ data, relevanceFilter }: DataQualitySummaryProps) => {
  const [showDiscarded, setShowDiscarded] = useState(false);

  if (!data || data.length === 0) return null;

  const verifiedCount = data.filter(d => d.dataTier === "verified").length;
  const reportedCount = data.filter(d => d.dataTier === "reported").length;
  const estimatedCount = data.filter(d => d.dataTier === "estimated").length;

  const hasRelevanceData = relevanceFilter && relevanceFilter.filtered && relevanceFilter.filtered > 0;

  return (
    <Card className="border-border/50 bg-card/50 mb-8">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-semibold">Data Quality Summary</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          How reliable is each data source in this report?
        </p>
        <div className="flex gap-3 mt-2 flex-wrap">
          <Badge variant="secondary" className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px]">
            {verifiedCount} Verified
          </Badge>
          <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px]">
            {reportedCount} Reported
          </Badge>
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
            {estimatedCount} Estimated
          </Badge>
          {hasRelevanceData && (
            <Badge variant="secondary" className="bg-muted text-muted-foreground border-border/50 text-[10px]">
              <Filter className="w-3 h-3 mr-1" />
              {relevanceFilter.filtered} items filtered as irrelevant
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.map((entry, i) => {
            const config = tierConfig[entry.dataTier] || tierConfig.estimated;
            const Icon = config.icon;
            return (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border border-border/30 bg-muted/10">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Icon className={`h-4 w-4 shrink-0 ${config.color}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{entry.sourceName}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{entry.reliabilityNote}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-xs text-muted-foreground">{entry.signalCount}</span>
                  <Badge variant="secondary" className={`text-[10px] ${config.bg}`}>
                    {entry.dataTier}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>

        {/* Relevance Filter Audit Trail */}
        {hasRelevanceData && relevanceFilter.discardedItems && relevanceFilter.discardedItems.length > 0 && (
          <Collapsible open={showDiscarded} onOpenChange={setShowDiscarded} className="mt-4">
            <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
              <Filter className="w-3.5 h-3.5" />
              <span>{relevanceFilter.filtered} of {relevanceFilter.scored} collected signals were filtered as irrelevant (score &lt; 5/10)</span>
              <span className="ml-auto text-[10px]">{showDiscarded ? "Hide" : "Show"} details</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="bg-muted/20 rounded-lg p-3 space-y-1.5 border border-border/20">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-2">Discarded Items</p>
                {relevanceFilter.discardedItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Badge variant="outline" className="text-[9px] shrink-0">{item.source}</Badge>
                      <span className="text-muted-foreground truncate">{item.title}</span>
                    </div>
                    <span className="text-destructive/70 shrink-0 ml-2">{item.score}/10</span>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
};