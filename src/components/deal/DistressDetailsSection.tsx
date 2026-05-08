import type { ReactNode } from "react";
import { Building2, CreditCard, Home, Receipt, ShieldAlert } from "lucide-react";

import { formatDateLabel, getDebtStatus } from "@/lib/property-history";

import { DistressTypeBadge } from "./DistressTypeBadge";

interface Props {
  distressTypes?: string[] | null;
  distressDetails?: Record<string, any> | null;
}

const formatCurrency = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
};

const formatText = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "Unavailable";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

const InfoCell = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-border bg-background px-4 py-3">
    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
    <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
  </div>
);

const SectionCard = ({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Home;
  children: ReactNode;
}) => (
  <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
    <div className="mb-4 flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
    {children}
  </div>
);

export const DistressDetailsSection = ({ distressTypes, distressDetails }: Props) => {
  const details = distressDetails ?? {};
  const mortgage = details.mortgage ?? {};
  const debtStatus = getDebtStatus(details);
  const avmLow = details.avmRange?.low;
  const avmHigh = details.avmRange?.high;

  return (
    <div className="space-y-4">
      <SectionCard title="Ownership" icon={Building2}>
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoCell label="Owner Name" value={formatText(details.ownerName ?? details.owner_name)} />
          <InfoCell label="Occupancy" value={formatText(details.absenteeInd)} />
          <InfoCell label="Mailing Address" value={formatText(details.ownerMailingAddress)} />
          <InfoCell label="Foreclosure Stage" value={formatText(details.foreclosureStatus ?? details.foreclosure_stage)} />
        </div>
      </SectionCard>

      <SectionCard title="Mortgage & Debt" icon={CreditCard}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCell label="Mortgage Amount" value={formatCurrency(mortgage.loanAmount)} />
          <InfoCell label="Lender" value={formatText(mortgage.lenderName)} />
          <InfoCell label="Loan Type" value={formatText(mortgage.loanType)} />
          <InfoCell label="Purchase Type" value={mortgage.isCashPurchase ? "Cash Purchase" : "Financed / Unavailable"} />
          <InfoCell label="Delinquent Amount" value={formatCurrency(debtStatus.delinquentAmount)} />
          <InfoCell
            label="Missed Payments"
            value={typeof debtStatus.estimatedMissedPayments === "number" ? `~${Math.round(debtStatus.estimatedMissedPayments)}` : "Unavailable"}
          />
          <InfoCell label="Default Date" value={debtStatus.defaultDate ? formatDateLabel(debtStatus.defaultDate) : "Unavailable"} />
          <InfoCell label="Auction Date" value={debtStatus.auctionDate ? formatDateLabel(debtStatus.auctionDate) : "Unavailable"} />
          <InfoCell label="Opening Bid" value={formatCurrency(debtStatus.openingBidAmount)} />
        </div>
        {debtStatus.estimateBasis ? (
          <p className="mt-3 text-xs text-muted-foreground">{debtStatus.estimateBasis}</p>
        ) : null}
      </SectionCard>

      <SectionCard title="Tax & Valuation" icon={Receipt}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCell label="Annual Tax" value={formatCurrency(details.assessmentTax?.taxamt)} />
          <InfoCell label="Tax Delinquent Year" value={formatText(debtStatus.taxDelinquentYear)} />
          <InfoCell label="Tax Lien Amount" value={formatCurrency(debtStatus.taxLienAmount)} />
          <InfoCell label="Recorded Deed Sale" value={formatCurrency(details.deedSaleAmt)} />
          <InfoCell label="Land Value" value={formatCurrency(details.assessedLandValue)} />
          <InfoCell label="Improvement Value" value={formatCurrency(details.assessedImprValue)} />
          <InfoCell
            label="AVM Range"
            value={avmLow || avmHigh ? `${formatCurrency(avmLow)} - ${formatCurrency(avmHigh)}` : "Unavailable"}
          />
          <InfoCell label="Year Built" value={formatText(details.yearBuilt)} />
        </div>
      </SectionCard>

      <SectionCard title="Distress Signals" icon={ShieldAlert}>
        {distressTypes && distressTypes.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {distressTypes.map((type) => <DistressTypeBadge key={type} type={type} />)}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No recorded distress indicators on this property.</p>
        )}

        {Array.isArray(details.events) && details.events.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Recorded Events</p>
            <div className="grid gap-2">
              {details.events.slice(0, 6).map((event: Record<string, unknown>, index: number) => (
                <div key={index} className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground">
                  {String(event.eventType ?? event.type ?? event.eventDescription ?? "Recorded event")}
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
};
