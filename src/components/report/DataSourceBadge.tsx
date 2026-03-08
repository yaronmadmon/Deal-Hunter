import { Badge } from "@/components/ui/badge";
import { ExternalLink, Globe, Search, Bot } from "lucide-react";
import type { DataSourceType } from "@/data/mockReport";

interface Props {
  dataSource?: DataSourceType;
  sourceUrl?: string | null;
  sourceUrls?: string[];
  compact?: boolean;
}

const sourceConfig: Record<DataSourceType, { label: string; icon: React.ElementType; className: string }> = {
  perplexity: {
    label: "Perplexity Sonar — live search",
    icon: Search,
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  firecrawl: {
    label: "Firecrawl — web scraping",
    icon: Globe,
    className: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  },
  serper: {
    label: "Serper — Google Search",
    icon: Search,
    className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  },
  ai_estimated: {
    label: "AI Estimated",
    icon: Bot,
    className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  },
};

export const DataSourceBadge = ({ dataSource, sourceUrl, sourceUrls, compact }: Props) => {
  if (!dataSource) return null;

  const config = sourceConfig[dataSource];
  const Icon = config.icon;
  const urls = sourceUrls?.filter(Boolean) || (sourceUrl ? [sourceUrl] : []);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 font-normal gap-1 ${config.className}`}>
        <Icon className="w-2.5 h-2.5" />
        {compact ? (dataSource === "ai_estimated" ? "Estimated" : dataSource === "perplexity" ? "Live" : dataSource === "serper" ? "Google" : "Scraped") : config.label}
      </Badge>
      {!compact && urls.length > 0 && (
        <a
          href={urls[0]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] text-muted-foreground hover:text-primary flex items-center gap-0.5 underline"
        >
          <ExternalLink className="w-2.5 h-2.5" /> source
        </a>
      )}
    </div>
  );
};
