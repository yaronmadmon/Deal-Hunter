import { DistressTypeBadge } from "./DistressTypeBadge";

interface Props {
  distressTypes?: string[] | null;
  distressDetails?: Record<string, any> | null;
}

const FIELD_LABELS: Record<string, string> = {
  lienAmount: "Lien Amount",
  lien_amount: "Lien Amount",
  foreclosureStage: "Foreclosure Stage",
  foreclosure_stage: "Foreclosure Stage",
  auctionDate: "Auction Date",
  auction_date: "Auction Date",
  delinquencyAmount: "Delinquency Amount",
  delinquency_amount: "Delinquency Amount",
  recordDate: "Record Date",
  record_date: "Record Date",
  caseNumber: "Case Number",
  case_number: "Case Number",
  ownerName: "Owner Name",
  owner_name: "Owner Name",
};

const formatValue = (v: any): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number" && v > 1000) return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return new Date(v).toLocaleDateString();
  return String(v);
};

export const DistressDetailsSection = ({ distressTypes, distressDetails }: Props) => {
  const types = distressTypes ?? [];
  const details = distressDetails ?? {};

  return (
    <div className="space-y-4">
      {types.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {types.map((t) => <DistressTypeBadge key={t} type={t} />)}
        </div>
      )}

      {Object.keys(details).length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Object.entries(details).map(([key, value]) => {
            if (typeof value === "object" && value !== null) return null;
            const label = FIELD_LABELS[key] ?? key.replace(/_/g, " ");
            return (
              <div key={key} className="rounded-lg border border-border bg-background px-4 py-3">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground capitalize">{label}</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{formatValue(value)}</p>
              </div>
            );
          })}
        </div>
      )}

      {types.length === 0 && Object.keys(details).length === 0 && (
        <p className="text-sm text-muted-foreground">No distress detail data available.</p>
      )}
    </div>
  );
};
