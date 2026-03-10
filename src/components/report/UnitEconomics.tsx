import { Calculator, TrendingDown, DollarSign } from "lucide-react";
import type { UnitEconomicsData } from "@/data/mockReport";
import { DataSourceBadge } from "./DataSourceBadge";

interface Props {
  data: UnitEconomicsData;
}

export const UnitEconomics = ({ data }: Props) => {
  return (
    <div className="bg-card border rounded-2xl p-8 mb-12">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
          <Calculator className="w-4 h-4 text-accent" />
        </div>
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground">Unit Economics & Retention</h2>
          <p className="text-[13px] text-muted-foreground italic">Will customers stay and pay?</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Churn Benchmarks */}
        <div className="bg-secondary/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-destructive" />
            <h3 className="font-semibold text-sm text-foreground">Churn Rate Benchmarks</h3>
          </div>
          <div className="space-y-3 mb-3">
            {data.churnBenchmarks.map((b) => (
              <div key={b.name} className="flex items-center justify-between">
                <span className="text-sm text-foreground">{b.name}</span>
                <div className="text-right">
                  <span className="text-sm font-bold text-foreground">{b.churnRate}</span>
                  <span className="text-[13px] text-muted-foreground ml-1">monthly</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground border-t border-border/50 pt-3">{data.churnImplication}</p>
        </div>

        {/* Revenue Modeling */}
        <div className="bg-secondary/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-sm text-foreground">Privacy-First Revenue Model</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-[13px] text-muted-foreground">Realistic ARPU</p>
              <p className="text-lg font-bold text-foreground">{data.realisticArpu}</p>
              <p className="text-sm text-muted-foreground">{data.arpuReasoning}</p>
            </div>
            <div>
              <p className="text-[13px] text-muted-foreground">Privacy Premium</p>
              <p className="text-sm text-foreground font-medium">{data.privacyPremium}</p>
            </div>
            <div>
              <p className="text-[13px] text-muted-foreground">Estimated LTV</p>
              <p className="text-lg font-bold text-foreground">{data.ltvEstimate}</p>
            </div>
          </div>
        </div>
      </div>

      {data.dataSource && (
        <div className="mt-4">
          <DataSourceBadge dataSource={data.dataSource} sourceUrls={data.sourceUrls} />
        </div>
      )}
    </div>
  );
};