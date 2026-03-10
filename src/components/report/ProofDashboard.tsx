import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Code, MessageCircle, Smartphone, Search, ExternalLink } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, Tooltip } from "recharts";
import type { ProofDashboardData } from "@/data/mockReport";
import { ConfidenceLabel } from "./ConfidenceLabel";

interface Props {
  data: ProofDashboardData;
}

const SignalBlock = ({ icon: Icon, title, children, confidence }: { icon: React.ElementType; title: string; children: React.ReactNode; confidence?: "High" | "Medium" | "Low" }) => (
  <Card className="overflow-hidden">
    <CardContent className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <h4 className="text-[13px] font-heading font-semibold text-foreground uppercase tracking-wide">{title}</h4>
        {confidence && <ConfidenceLabel level={confidence} />}
      </div>
      {children}
    </CardContent>
  </Card>
);

const MetricRow = ({ label, value, source }: { label: string; value: string; source?: string }) => (
  <div className="flex justify-between items-baseline text-sm py-1.5 border-b border-border/30 last:border-0">
    <span className="text-muted-foreground">{label}</span>
    <div className="text-right">
      <span className="font-semibold text-foreground">{value || "Data unavailable"}</span>
      {source && <span className="text-xs text-muted-foreground block">{source}</span>}
    </div>
  </div>
);

export const ProofDashboard = ({ data }: Props) => {
  return (
    <div className="mb-12">
      <div className="flex items-center gap-3 mb-5">
        <h2 className="font-heading text-xl font-bold text-foreground">Proof Dashboard</h2>
        <Badge variant="outline" className="text-xs px-2 py-0.5 bg-primary/5 text-primary border-primary/20">Evidence-Based</Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Immediate visual evidence that this opportunity is real — every signal backed by data.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Search Demand */}
        <SignalBlock icon={Search} title="Search Demand" confidence={data.searchDemand?.confidence}>
          <MetricRow label="Primary Keyword" value={data.searchDemand?.keyword || "Data unavailable"} />
          <MetricRow label="Monthly Searches" value={data.searchDemand?.monthlySearches || "Data unavailable"} source={data.searchDemand?.source} />
          <MetricRow label="Trend Direction" value={data.searchDemand?.trend || "Data unavailable"} />
          {data.searchDemand?.relatedKeywords && data.searchDemand.relatedKeywords.length > 0 && (
            <div className="mt-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Related Keywords</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {data.searchDemand.relatedKeywords.map(kw => (
                  <Badge key={kw} variant="secondary" className="text-xs px-2 py-0">{kw}</Badge>
                ))}
              </div>
            </div>
          )}
        </SignalBlock>

        {/* Developer Activity */}
        <SignalBlock icon={Code} title="Developer Activity" confidence={data.developerActivity?.confidence}>
          <MetricRow label="GitHub Repos" value={data.developerActivity?.repoCount || "Data unavailable"} />
          <MetricRow label="Total Stars" value={data.developerActivity?.totalStars || "Data unavailable"} />
          <MetricRow label="Recent Commits (30d)" value={data.developerActivity?.recentCommits || "Data unavailable"} />
          <MetricRow label="Activity Trend" value={data.developerActivity?.trend || "Data unavailable"} source="GitHub API" />
        </SignalBlock>

        {/* Social Signals */}
        <SignalBlock icon={MessageCircle} title="Social Activity" confidence={data.socialActivity?.confidence}>
          <MetricRow label="X/Twitter Mentions (7d)" value={data.socialActivity?.twitterMentions || "Data unavailable"} source="X API v2" />
          <MetricRow label="Reddit Threads" value={data.socialActivity?.redditThreads || "Data unavailable"} source="Serper.dev" />
          <MetricRow label="Sentiment Score" value={data.socialActivity?.sentimentScore || "Data unavailable"} />
          <MetricRow label="HN/PH Launches" value={data.socialActivity?.hnPhLaunches || "Data unavailable"} />
        </SignalBlock>

        {/* App Store Signals */}
        <SignalBlock icon={Smartphone} title="App Store Signals" confidence={data.appStoreSignals?.confidence}>
          <MetricRow label="Related Apps" value={data.appStoreSignals?.relatedApps || "Data unavailable"} />
          <MetricRow label="Average Rating" value={data.appStoreSignals?.avgRating || "Data unavailable"} source="App Store / Play Store" />
          <MetricRow label="Download Estimates" value={data.appStoreSignals?.downloadEstimate || "Data unavailable"} />
          <MetricRow label="Market Gap" value={data.appStoreSignals?.marketGap || "Data unavailable"} />
        </SignalBlock>
      </div>
    </div>
  );
};