import { Shield, Code, MessageCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ProofDashboardData } from "@/data/mockReport";

interface EvidenceItem {
  label: string;
  value: string;
  available: boolean;
}

interface TierData {
  tier: number;
  title: string;
  description: string;
  icon: React.ElementType;
  items: EvidenceItem[];
}

interface Props {
  proofDashboard?: ProofDashboardData;
}

/** Builds evidence tiers from proof dashboard data */
function buildTiers(data?: ProofDashboardData): TierData[] {
  const tier1Items: EvidenceItem[] = [];
  const tier2Items: EvidenceItem[] = [];
  const tier3Items: EvidenceItem[] = [];

  if (data?.searchDemand) {
    const sd = data.searchDemand;
    tier1Items.push({
      label: "Search volume",
      value: sd.monthlySearches || "Insufficient data",
      available: !!sd.monthlySearches && sd.monthlySearches !== "Insufficient data",
    });
    tier1Items.push({
      label: "Trend direction",
      value: sd.trend || "Insufficient data",
      available: !!sd.trend,
    });
  }

  if (data?.appStoreSignals) {
    const as_ = data.appStoreSignals;
    tier1Items.push({
      label: "App downloads",
      value: as_.downloadEstimate || "Insufficient data",
      available: !!as_.downloadEstimate && as_.downloadEstimate !== "Insufficient data",
    });
    tier1Items.push({
      label: "App store rating",
      value: as_.avgRating || "Insufficient data",
      available: !!as_.avgRating && as_.avgRating !== "Insufficient data",
    });
  }

  if (data?.developerActivity) {
    const da = data.developerActivity;
    tier2Items.push({
      label: "GitHub repos",
      value: da.repoCount || "Insufficient data",
      available: !!da.repoCount && da.repoCount !== "Insufficient data",
    });
    tier2Items.push({
      label: "Total stars",
      value: da.totalStars || "Insufficient data",
      available: !!da.totalStars && da.totalStars !== "Insufficient data",
    });
    tier2Items.push({
      label: "Recent commits (30d)",
      value: da.recentCommits || "Insufficient data",
      available: !!da.recentCommits && da.recentCommits !== "Insufficient data",
    });
  }

  if (data?.socialActivity) {
    const sa = data.socialActivity;
    tier3Items.push({
      label: "X/Twitter mentions (7d)",
      value: sa.twitterMentions || "Insufficient data",
      available: !!sa.twitterMentions && sa.twitterMentions !== "Insufficient data",
    });
    tier3Items.push({
      label: "Reddit threads",
      value: sa.redditThreads || "Insufficient data",
      available: !!sa.redditThreads && sa.redditThreads !== "Insufficient data",
    });
    tier3Items.push({
      label: "HN / Product Hunt launches",
      value: sa.hnPhLaunches || "Insufficient data",
      available: !!sa.hnPhLaunches && sa.hnPhLaunches !== "Insufficient data",
    });
  }

  return [
    { tier: 1, title: "Hard Market Evidence", description: "Verified search volume, downloads, revenue data", icon: Shield, items: tier1Items },
    { tier: 2, title: "Market Activity", description: "Developer adoption, product launches, startup activity", icon: Code, items: tier2Items },
    { tier: 3, title: "Social Signals", description: "Community chatter, social mentions, forum discussions", icon: MessageCircle, items: tier3Items },
  ];
}

const tierColors: Record<number, string> = {
  1: "text-green-600 dark:text-green-400",
  2: "text-blue-500 dark:text-blue-400",
  3: "text-amber-500 dark:text-amber-400",
};

const tierBadgeVariants: Record<number, string> = {
  1: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  2: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  3: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
};

export const EvidenceStrength = ({ proofDashboard }: Props) => {
  const tiers = buildTiers(proofDashboard);
  const hasAnyData = tiers.some(t => t.items.length > 0);

  if (!hasAnyData) return null;

  return (
    <div className="bg-card border rounded-2xl p-8 mb-12">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Shield className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground">Evidence Strength</h2>
          <p className="text-[13px] text-muted-foreground italic">Signals ranked by reliability tier</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        {tiers.map((tier) => {
          const Icon = tier.icon;
          const availableCount = tier.items.filter(i => i.available).length;

          return (
            <div key={tier.tier} className="bg-secondary/30 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${tierColors[tier.tier]}`} />
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${tierBadgeVariants[tier.tier]}`}>
                  Tier {tier.tier}
                </Badge>
              </div>
              <h3 className="font-semibold text-sm text-foreground mb-0.5">{tier.title}</h3>
              <p className="text-[11px] text-muted-foreground mb-3">{tier.description}</p>

              {tier.items.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No signals collected</p>
              ) : (
                <ul className="space-y-1.5">
                  {tier.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm">
                      {item.available ? (
                        <CheckCircle2 className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${tierColors[tier.tier]}`} />
                      ) : (
                        <span className="w-3.5 h-3.5 mt-0.5 shrink-0 rounded-full border border-muted-foreground/30 inline-block" />
                      )}
                      <span className="text-muted-foreground">
                        {item.label}: <span className={item.available ? "font-medium text-foreground" : "italic"}>{item.value}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <p className="text-[11px] text-muted-foreground mt-3">
                {availableCount}/{tier.items.length} signals available
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
