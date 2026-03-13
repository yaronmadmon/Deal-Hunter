import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, TrendingUp, Users, Lightbulb, BarChart3, Info } from "lucide-react";
import type { FounderInsightData } from "@/data/mockReport";

interface FounderInsightProps {
  data: FounderInsightData;
}

const blocks = [
  { key: "marketReality" as const, title: "Market Reality", icon: TrendingUp, description: "Is there real demand?", color: "text-green-500 dark:text-green-400" },
  { key: "competitivePressure" as const, title: "Competitive Pressure", icon: Users, description: "How crowded is it?", color: "text-blue-500 dark:text-blue-400" },
  { key: "possibleGaps" as const, title: "Possible Gaps", icon: Lightbulb, description: "Where are the openings?", color: "text-purple-500 dark:text-purple-400" },
  { key: "signalInterpretation" as const, title: "Signal Interpretation", icon: BarChart3, description: "What does it all mean?", color: "text-teal" },
];

export function FounderInsight({ data }: FounderInsightProps) {
  return (
    <div className="mb-12 space-y-6">
      {/* Section 1: Founder Insight Summary */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-heading">
            <BookOpen className="w-5 h-5 text-primary" />
            What the Signals Say
            {data.confidence && (
              <Badge className={`text-[9px] ml-2 ${
                data.confidence === "High" ? "bg-success/20 text-green-600 border-success/30" :
                data.confidence === "Medium" ? "bg-warning/20 text-yellow-600 border-warning/30" :
                "bg-muted text-muted-foreground"
              }`}>
                {data.confidence} confidence
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[15px] text-foreground/90 leading-relaxed whitespace-pre-line">
            {data.summary}
          </p>
        </CardContent>
      </Card>

      {/* Section 2: Opportunity Interpretation */}
      <div>
        <h3 className="font-heading text-base font-bold text-foreground mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          Opportunity Interpretation
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {blocks.map(({ key, title, icon: Icon, description, color }) => {
            const content = data[key];
            if (!content) return null;
            return (
              <Card key={key} className="shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <h4 className="font-heading text-sm font-bold text-foreground">{title}</h4>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{description}</p>
                  <p className="text-sm text-foreground/85 leading-relaxed">{content}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
        <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          This interpretation summarizes patterns observed in publicly available data and competitor signals. It is intended to help readers understand the market landscape and does not predict the success of any specific product.
        </p>
      </div>
    </div>
  );
}
