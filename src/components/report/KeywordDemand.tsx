import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Minus, Search } from "lucide-react";
import type { KeywordDemandData } from "@/data/mockReport";
import { ConfidenceLabel } from "./ConfidenceLabel";

interface Props {
  data: KeywordDemandData;
}

const TrendIcon = ({ direction }: { direction: string }) => {
  const lower = direction.toLowerCase();
  if (lower.includes("rising") || lower.includes("up") || lower.includes("growing")) return <TrendingUp className="w-3.5 h-3.5 text-success" />;
  if (lower.includes("declining") || lower.includes("down") || lower.includes("falling")) return <TrendingDown className="w-3.5 h-3.5 text-destructive" />;
  return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
};

const DifficultyBadge = ({ level }: { level: string }) => {
  const lower = level.toLowerCase();
  const variant = lower.includes("low") ? "go" as const : lower.includes("high") ? "nogo" as const : "pivot" as const;
  return <Badge variant={variant} className="text-xs px-2 py-0">{level}</Badge>;
};

export const KeywordDemand = ({ data }: Props) => {
  if (!data.keywords || data.keywords.length === 0) return null;

  const hasCpc = data.keywords.some(kw => kw.cpc);

  return (
    <div className="bg-card border rounded-2xl p-8 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Search className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground">Keyword Demand</h2>
            <p className="text-[13px] text-muted-foreground">Real search volume data for related keywords</p>
          </div>
        </div>
        <ConfidenceLabel level={data.confidence || "Medium"} />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/30">
              <TableHead className="h-9 text-[13px] font-semibold">Keyword</TableHead>
              <TableHead className="h-9 text-[13px] font-semibold text-right">Monthly Volume</TableHead>
              {hasCpc && <TableHead className="h-9 text-[13px] font-semibold text-right">CPC</TableHead>}
              <TableHead className="h-9 text-[13px] font-semibold text-center">Difficulty</TableHead>
              <TableHead className="h-9 text-[13px] font-semibold text-center">Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.keywords.map((kw) => (
              <TableRow key={kw.keyword}>
                <TableCell className="py-2.5 text-sm font-medium text-foreground">{kw.keyword}</TableCell>
                <TableCell className="py-2.5 text-sm text-right font-semibold text-foreground">{kw.volume}</TableCell>
                {hasCpc && <TableCell className="py-2.5 text-sm text-right text-muted-foreground">{kw.cpc || "—"}</TableCell>}
                <TableCell className="py-2.5 text-center"><DifficultyBadge level={kw.difficulty} /></TableCell>
                <TableCell className="py-2.5">
                  <div className="flex items-center justify-center gap-1.5">
                    <TrendIcon direction={kw.trend} />
                    <span className="text-[13px] text-muted-foreground">{kw.trend}</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data.source && (
        <p className="text-xs text-muted-foreground mt-3">Source: {data.source}</p>
      )}
    </div>
  );
};
