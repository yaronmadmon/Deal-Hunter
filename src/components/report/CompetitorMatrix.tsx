import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Check, X, Minus } from "lucide-react";
import type { CompetitorMatrixData } from "@/data/mockReport";
import { ConfidenceLabel } from "./ConfidenceLabel";

interface Props {
  data: CompetitorMatrixData;
}

const CellValue = ({ value }: { value: string }) => {
  const lower = value.toLowerCase();
  if (lower === "yes" || lower === "strong") return (
    <div className="flex items-center justify-center gap-1">
      <Check className="w-3.5 h-3.5 text-success" />
      <span className="text-[13px] font-semibold text-success">{value}</span>
    </div>
  );
  if (lower === "no" || lower === "weak" || lower === "none") return (
    <div className="flex items-center justify-center gap-1">
      <X className="w-3.5 h-3.5 text-destructive" />
      <span className="text-[13px] font-semibold text-destructive">{value}</span>
    </div>
  );
  if (lower === "medium" || lower === "partial") return (
    <div className="flex items-center justify-center gap-1">
      <Minus className="w-3.5 h-3.5 text-warning" />
      <span className="text-[13px] font-semibold text-warning">{value}</span>
    </div>
  );
  return <span className="text-[13px] text-muted-foreground">{value}</span>;
};

export const CompetitorMatrix = ({ data }: Props) => {
  if (!data.features || data.features.length === 0 || !data.competitors || data.competitors.length === 0) return null;

  return (
    <div className="bg-card border rounded-2xl p-8 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground">Competitor Comparison Matrix</h2>
            <p className="text-[13px] text-muted-foreground">How your idea stacks up against the competition</p>
          </div>
        </div>
        <ConfidenceLabel level={data.confidence || "Medium"} />
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/30">
              <TableHead className="h-9 text-[13px] font-semibold min-w-[140px]">Feature</TableHead>
              {data.competitors.map((comp) => (
                <TableHead key={comp.name} className="h-9 text-[13px] font-semibold text-center min-w-[100px]">
                  {comp.isYou ? (
                    <Badge variant="go" className="text-xs px-2 py-0">{comp.name}</Badge>
                  ) : comp.name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.features.map((feature) => (
              <TableRow key={feature}>
                <TableCell className="py-2.5 text-sm font-medium text-foreground">{feature}</TableCell>
                {data.competitors.map((comp) => (
                  <TableCell key={`${feature}-${comp.name}`} className={`py-2.5 text-center ${comp.isYou ? 'bg-primary/5' : ''}`}>
                    <CellValue value={comp.scores[feature] || "—"} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};