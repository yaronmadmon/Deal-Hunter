import { DollarSign } from "lucide-react";
import type { RevenueBenchmarkData } from "@/data/mockReport";
import { DataSourceBadge } from "./DataSourceBadge";

interface Props {
  benchmark: RevenueBenchmarkData;
}

export const RevenueBenchmark = ({ benchmark }: Props) => {
  return (
    <div className="bg-card border rounded-2xl p-8 mb-12">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
          <DollarSign className="w-4 h-4 text-accent" />
        </div>
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground">Revenue Benchmark</h2>
          <p className="text-xs text-muted-foreground italic">What similar apps charge</p>
        </div>
      </div>
      <p className="text-foreground font-medium mb-2">{benchmark.summary}</p>
      <p className="text-sm text-muted-foreground mb-3">{benchmark.basis}</p>
      <DataSourceBadge dataSource={benchmark.dataSource} sourceUrls={benchmark.sourceUrls} />
    </div>
  );
};
