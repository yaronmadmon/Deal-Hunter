import { DollarSign } from "lucide-react";
import type { RevenueBenchmarkData } from "@/data/mockReport";

interface Props {
  benchmark: RevenueBenchmarkData;
}

export const RevenueBenchmark = ({ benchmark }: Props) => {
  return (
    <div className="bg-card border rounded-2xl p-8 mb-10">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <DollarSign className="w-5 h-5 text-primary" />
        </div>
        <h2 className="font-heading text-xl font-bold text-foreground">Revenue Benchmark</h2>
      </div>
      <p className="text-foreground font-medium mb-2">{benchmark.summary}</p>
      <p className="text-sm text-muted-foreground">{benchmark.basis}</p>
    </div>
  );
};
