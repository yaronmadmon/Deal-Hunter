import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

interface GlossaryTerm {
  term: string;
  definition: string;
  example?: string;
}

const glossaryTerms: GlossaryTerm[] = [
  { term: "CAC — Customer Acquisition Cost", definition: "How much it costs to get one paying customer.", example: "Spend $1,000, get 10 customers = $100 CAC." },
  { term: "CTR — Click Through Rate", definition: "What percentage of people who see your ad click it.", example: "1,000 impressions, 50 clicks = 5% CTR." },
  { term: "ROI — Return on Investment", definition: "How much you make back for every dollar spent.", example: "Spend $100, make $300 = 300% ROI." },
  { term: "TAM — Total Addressable Market", definition: "The total money available in this entire market.", example: "All students worldwide = your TAM." },
  { term: "CAGR — Compound Annual Growth Rate", definition: "How fast this market grows each year on average.", example: "29.8% CAGR means it nearly triples in 4 years." },
  { term: "LTV — Lifetime Value", definition: "Total money one customer pays you over their lifetime.", example: "$29/month for 2 years = $696 LTV." },
  { term: "Churn Rate", definition: "What percentage of customers cancel each month. Lower is always better." },
  { term: "MRR — Monthly Recurring Revenue", definition: "How much money you make every month from subscriptions." },
  { term: "ARR — Annual Recurring Revenue", definition: "Your MRR multiplied by 12." },
  { term: "CPL — Cost Per Lead", definition: "How much it costs to get one interested prospect." },
  { term: "Conversion Rate", definition: "What percentage of visitors become paying customers." },
  { term: "Market Saturation", definition: "How crowded this market is with competitors. High saturation = harder to stand out." },
  { term: "Signal Strength", definition: "How confident Gold Rush is in this market data. Strong = multiple real data sources agree." },
  { term: "Blue Ocean", definition: "A market with real demand but very few competitors. The best place to launch a new product." },
  { term: "PMF — Product Market Fit", definition: "When your product perfectly solves a real problem people are willing to pay for." },
  { term: "MVP — Minimum Viable Product", definition: "The simplest version of your app that still works and can be tested with real users." },
  { term: "SaaS — Software as a Service", definition: "Software you pay for monthly instead of buying once." },
  { term: "B2B — Business to Business", definition: "Selling your product to other companies." },
  { term: "B2C — Business to Consumer", definition: "Selling your product directly to regular people." },
];

export const GlossarySection = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-card border rounded-2xl p-8 mt-12">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full text-left group">
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground">What These Terms Mean</h2>
            <p className="text-sm text-muted-foreground mt-1">Plain English definitions for every term in this report</p>
          </div>
          <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {glossaryTerms.map((item) => (
              <div key={item.term} className="bg-secondary/30 border border-border/50 rounded-xl p-4">
                <div className="font-semibold text-sm text-foreground mb-1">{item.term}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.definition}</p>
                {item.example && (
                  <p className="text-xs text-muted-foreground/70 italic mt-1.5">{item.example}</p>
                )}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
