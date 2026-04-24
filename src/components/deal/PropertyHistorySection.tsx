import { History, Receipt, List } from "lucide-react";

interface SaleRecord {
  saleTransDate?: string | null;
  saleAmt?: number | null;
  buyerName?: string | null;
  sellerName?: string | null;
  [key: string]: unknown;
}

interface AssessmentRecord {
  taxYear?: number | string | null;
  assessedValue?: number | null;
  marketValue?: number | null;
  taxAmt?: number | null;
  [key: string]: unknown;
}

interface ListingEvent {
  date: string;
  event: string;
  price: number | null;
}

interface History {
  sales?: SaleRecord[];
  assessments?: AssessmentRecord[];
  listing?: ListingEvent[];
}

interface Props {
  history?: History | null;
}

const fmt = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `$${Math.round(n / 1_000)}K`
    : `$${n}`;

const EVENT_STYLES: Record<string, string> = {
  listed: "bg-green-500/15 text-green-400",
  "price drop": "bg-amber-500/15 text-amber-400",
  removed: "bg-red-500/15 text-red-400",
  sold: "bg-blue-500/15 text-blue-400",
};

const eventStyle = (event: string) => {
  const key = event.toLowerCase();
  for (const [k, v] of Object.entries(EVENT_STYLES)) {
    if (key.includes(k)) return v;
  }
  return "bg-secondary text-muted-foreground";
};

export const PropertyHistorySection = ({ history }: Props) => {
  const sales = history?.sales ?? [];
  const assessments = history?.assessments ?? [];
  const listing = history?.listing ?? [];

  return (
    <div className="space-y-6">
      {/* Sale History */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-sm font-medium text-foreground">Sale History</h4>
        </div>
        {sales.length === 0 ? (
          <p className="text-xs text-muted-foreground">No sale history available.</p>
        ) : (
          <div className="space-y-2">
            {sales.map((s, i) => (
              <div key={i} className="grid grid-cols-3 gap-2 text-xs border-b border-border pb-2 last:border-0">
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="text-foreground">{s.saleTransDate ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Price</p>
                  <p className="font-medium text-foreground">{s.saleAmt ? fmt(s.saleAmt) : "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Buyer</p>
                  <p className="text-foreground truncate">{s.buyerName ?? "—"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tax Assessment History */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Receipt className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-sm font-medium text-foreground">Tax Assessment History</h4>
        </div>
        {assessments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No assessment history available.</p>
        ) : (
          <div className="space-y-2">
            {assessments.map((a, i) => {
              const prevTax = assessments[i + 1]?.taxAmt;
              const taxUp = prevTax && a.taxAmt && a.taxAmt > prevTax;
              return (
                <div key={i} className="grid grid-cols-4 gap-2 text-xs border-b border-border pb-2 last:border-0">
                  <div>
                    <p className="text-muted-foreground">Year</p>
                    <p className="text-foreground">{a.taxYear ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Assessed</p>
                    <p className="font-medium text-foreground">{a.assessedValue ? fmt(a.assessedValue) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Market</p>
                    <p className="text-foreground">{a.marketValue ? fmt(a.marketValue) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tax/yr</p>
                    <p className={`font-medium ${taxUp ? "text-red-400" : "text-foreground"}`}>
                      {a.taxAmt ? fmt(a.taxAmt) : "—"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Listing History */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <List className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-sm font-medium text-foreground">Listing History</h4>
        </div>
        {listing.length === 0 ? (
          <p className="text-xs text-muted-foreground">No listing history available.</p>
        ) : (
          <div className="space-y-2">
            {listing.map((l, i) => (
              <div key={i} className="flex items-center justify-between text-xs border-b border-border pb-2 last:border-0">
                <span className="text-muted-foreground w-24 shrink-0">{l.date}</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${eventStyle(l.event)}`}>{l.event}</span>
                <span className="font-medium text-foreground text-right">{l.price ? fmt(l.price) : "—"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
