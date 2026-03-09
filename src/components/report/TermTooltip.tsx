import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

const termDefinitions: Record<string, string> = {
  "CAC": "Cost to acquire one paying customer",
  "CTR": "Percentage of viewers who click your ad",
  "ROI": "Money earned per dollar spent",
  "TAM": "Total money in this entire market",
  "CAGR": "Average annual growth rate of the market",
  "LTV": "Total revenue from one customer over time",
  "MRR": "Monthly subscription revenue",
  "ARR": "Annual subscription revenue (MRR × 12)",
  "Market Saturation": "How crowded the market is with competitors",
  "Signal Strength": "Confidence level based on data source agreement",
  "Blue Ocean": "Market with demand but few competitors",
  "Churn": "Percentage of customers who cancel",
  "Conversion Rate": "Percentage of visitors who become customers",
  "PMF": "When your product solves a real paid problem",
  "MVP": "Simplest testable version of your product",
  "SaaS": "Software paid monthly, not bought once",
  "B2B": "Selling to businesses",
  "B2C": "Selling to consumers",
  "ARPU": "Average revenue per user",
  "CPL": "Cost to acquire one interested prospect",
  "CPC": "Cost per ad click",
  "Freemium": "Free basic tier, paid premium features",
};

/**
 * Scans text for known technical terms and wraps them with tooltips.
 * Use this to make any text founder-friendly.
 */
export const withTermTooltips = (text: string): React.ReactNode => {
  // Sort terms by length (longest first) to avoid partial matches
  const terms = Object.keys(termDefinitions).sort((a, b) => b.length - a.length);
  const regex = new RegExp(`\\b(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const matchedText = match[0];
    const key = terms.find(t => t.toLowerCase() === matchedText.toLowerCase()) || matchedText;
    const definition = termDefinitions[key];
    if (definition) {
      parts.push(
        <TermWithTooltip key={`${match.index}-${matchedText}`} term={matchedText} definition={definition} />
      );
    } else {
      parts.push(matchedText);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : text;
};

/** Inline tooltip for a single term — shows (?) icon on hover/tap */
const TermWithTooltip = ({ term, definition }: { term: string; definition: string }) => (
  <TooltipProvider delayDuration={0}>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-0.5 cursor-help border-b border-dotted border-muted-foreground/40">
          {term}
          <HelpCircle className="w-3 h-3 text-muted-foreground/60 inline shrink-0" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-xs">
        {definition}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export { TermWithTooltip, termDefinitions };
