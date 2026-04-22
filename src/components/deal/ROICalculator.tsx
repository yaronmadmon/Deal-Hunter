import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  estimatedValue?: number | null;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const pct = (n: number) => `${n.toFixed(1)}%`;

interface Field {
  id: keyof Inputs;
  label: string;
  help?: string;
}

interface Inputs {
  purchasePrice: number;
  rehabCost: number;
  arv: number;
  buyClosing: number;
  sellClosing: number;
  holdMonths: number;
  monthlyHolding: number;
}

const FIELDS: Field[] = [
  { id: "purchasePrice", label: "Purchase Price ($)" },
  { id: "rehabCost", label: "Rehab Cost ($)" },
  { id: "arv", label: "After Repair Value — ARV ($)" },
  { id: "buyClosing", label: "Buy-Side Closing ($)" },
  { id: "sellClosing", label: "Sell-Side Closing ($)" },
  { id: "holdMonths", label: "Hold Time (months)" },
  { id: "monthlyHolding", label: "Monthly Holding Cost ($)" },
];

export const ROICalculator = ({ estimatedValue }: Props) => {
  const arv = estimatedValue ?? 200_000;
  const purchaseDefault = Math.round(arv * 0.7);

  const [inputs, setInputs] = useState<Inputs>({
    purchasePrice: purchaseDefault,
    rehabCost: 0,
    arv,
    buyClosing: Math.round(purchaseDefault * 0.03),
    sellClosing: Math.round(arv * 0.08),
    holdMonths: 6,
    monthlyHolding: Math.round(purchaseDefault * 0.01 / 12),
  });

  const set = (key: keyof Inputs, val: string) => {
    const n = parseFloat(val.replace(/,/g, "")) || 0;
    setInputs((prev) => ({ ...prev, [key]: n }));
  };

  const calc = useMemo(() => {
    const { purchasePrice, rehabCost, arv, buyClosing, sellClosing, holdMonths, monthlyHolding } = inputs;
    const totalIn = purchasePrice + rehabCost + buyClosing;
    const totalOut = totalIn + holdMonths * monthlyHolding + sellClosing;
    const netProfit = arv - totalOut;
    const roi = totalIn > 0 ? (netProfit / totalIn) * 100 : 0;
    const mao = arv * 0.7 - rehabCost;
    return { netProfit, roi, mao, totalIn };
  }, [inputs]);

  const roiColor =
    calc.roi >= 20 ? "text-green-400" : calc.roi >= 10 ? "text-yellow-400" : "text-red-400";
  const profitColor = calc.netProfit >= 0 ? "text-green-400" : "text-red-400";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.id} className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{f.label}</Label>
            <Input
              type="number"
              value={inputs[f.id]}
              onChange={(e) => set(f.id, e.target.value)}
              className="h-9"
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-2">
        <div className="rounded-xl border border-border bg-background p-4 text-center">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Net Profit</p>
          <p className={`text-xl font-bold ${profitColor}`}>{fmt(calc.netProfit)}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-4 text-center">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">ROI</p>
          <p className={`text-xl font-bold ${roiColor}`}>{pct(calc.roi)}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-4 text-center">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Max Offer (70%)</p>
          <p className="text-xl font-bold text-foreground">{fmt(calc.mao)}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-4 text-center">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Total Cash In</p>
          <p className="text-xl font-bold text-foreground">{fmt(calc.totalIn)}</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Max Allowable Offer uses the 70% rule: ARV × 0.70 − rehab. Adjust inputs for your actual costs.
      </p>
    </div>
  );
};
