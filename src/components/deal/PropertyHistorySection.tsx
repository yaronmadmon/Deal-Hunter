import { Clock3, History, List, Receipt } from "lucide-react";

import {
  formatCurrency,
  formatDateLabel,
  getDebtStatus,
  getListingInsights,
  getUrgencyInsight,
  type HistoryBundle,
} from "@/lib/property-history";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface Props {
  history?: HistoryBundle | null;
  distressDetails?: Record<string, any> | null;
}

const SummaryTile = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-border bg-background px-4 py-3">
    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
    <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
  </div>
);

const EVENT_STYLES: Record<string, string> = {
  listed: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  "price drop": "border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  removed: "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  sold: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  pending: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  contingent: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
};

const eventStyle = (event: string) => {
  const key = event.toLowerCase();
  for (const [match, styles] of Object.entries(EVENT_STYLES)) {
    if (key.includes(match)) return styles;
  }
  return "border-border bg-secondary/60 text-foreground";
};

export const PropertyHistorySection = ({ history, distressDetails }: Props) => {
  const sales = history?.sales ?? [];
  const assessments = history?.assessments ?? [];
  const listing = history?.listing ?? [];
  const mortgage = distressDetails?.mortgage ?? {};
  const annualTax = distressDetails?.assessmentTax?.taxamt ?? null;
  const debtStatus = getDebtStatus(distressDetails);
  const listingInsights = getListingInsights(history);
  const urgency = getUrgencyInsight(distressDetails);
  const purchase = sales[0] ?? null;
  const showBuyerColumn = sales.some((sale) => Boolean(sale.buyerName));
  const showSellerColumn = sales.some((sale) => Boolean(sale.sellerName));

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryTile label="Recorded Purchase" value={purchase?.saleAmt ? formatCurrency(purchase.saleAmt) : "Unavailable"} />
        <SummaryTile label="Listing Attempts" value={listingInsights.attempts ? String(listingInsights.attempts) : "None surfaced"} />
        <SummaryTile label="Price Cuts" value={listingInsights.priceDrops ? String(listingInsights.priceDrops) : "None surfaced"} />
        <SummaryTile label="Pending Type" value={listingInsights.pendingLabel || "No pending event"} />
        <SummaryTile label="Urgency" value={urgency?.detail || "No dated default trigger surfaced"} />
        <SummaryTile label="Recorded Debt" value={mortgage.isCashPurchase ? "Cash purchase" : formatCurrency(mortgage.loanAmount)} />
        <SummaryTile label="Delinquent Amount" value={formatCurrency(debtStatus.delinquentAmount)} />
        <SummaryTile label="Tax Lien Amount" value={formatCurrency(debtStatus.taxLienAmount)} />
        <SummaryTile label="Default Filed" value={debtStatus.defaultDate ? formatDateLabel(debtStatus.defaultDate) : "Unavailable"} />
        <SummaryTile label="Auction Date" value={debtStatus.auctionDate ? formatDateLabel(debtStatus.auctionDate) : "Unavailable"} />
        <SummaryTile
          label="Missed Payments"
          value={typeof debtStatus.estimatedMissedPayments === "number" ? `~${Math.round(debtStatus.estimatedMissedPayments)}` : "Unavailable"}
        />
        <SummaryTile label="Annual Tax" value={formatCurrency(annualTax)} />
      </div>

      {(debtStatus.statusLabel || debtStatus.delinquentAmount !== null || debtStatus.taxLienAmount !== null || debtStatus.auctionDate || debtStatus.defaultDate) ? (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <List className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-medium text-foreground">Debt / Delinquency</h4>
          </div>
          <div className="rounded-2xl border border-border bg-background px-4 py-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <SummaryTile label="Status" value={debtStatus.statusLabel || "Recorded distress filing"} />
              <SummaryTile label="Recording Date" value={debtStatus.recordingDate ? formatDateLabel(debtStatus.recordingDate) : "Unavailable"} />
              <SummaryTile label="Original Loan Date" value={debtStatus.originalLoanDate ? formatDateLabel(debtStatus.originalLoanDate) : "Unavailable"} />
              <SummaryTile label="Opening Bid" value={formatCurrency(debtStatus.openingBidAmount)} />
              <SummaryTile label="Tax Delinquent Year" value={debtStatus.taxDelinquentYear ? String(debtStatus.taxDelinquentYear) : "Unavailable"} />
              <SummaryTile
                label="Monthly P&I Est."
                value={typeof debtStatus.estimatedMonthlyPayment === "number" ? formatCurrency(debtStatus.estimatedMonthlyPayment) : "Unavailable"}
              />
            </div>
            {debtStatus.estimateBasis ? (
              <p className="mt-3 text-xs text-muted-foreground">{debtStatus.estimateBasis}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div>
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-medium text-foreground">Sale History</h4>
        </div>
        {sales.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recorded sale history available.</p>
        ) : (
          <div className="space-y-2">
            {sales.map((sale, index) => (
              <div
                key={index}
                className={`grid gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm ${
                  showBuyerColumn || showSellerColumn ? "sm:grid-cols-4" : "sm:grid-cols-2"
                }`}
              >
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Date</p>
                  <p className="mt-1 text-foreground">{formatDateLabel(sale.saleTransDate)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Price</p>
                  <p className="mt-1 font-medium text-foreground">{formatCurrency(sale.saleAmt)}</p>
                </div>
                {showBuyerColumn ? (
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Buyer</p>
                    <p className="mt-1 text-foreground">{sale.buyerName || "Not surfaced in deed record"}</p>
                  </div>
                ) : null}
                {showSellerColumn ? (
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Seller</p>
                    <p className="mt-1 text-foreground">{sale.sellerName || "Not surfaced in deed record"}</p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-medium text-foreground">Listing Timeline</h4>
        </div>
        {listing.length === 0 ? (
          <p className="text-sm text-muted-foreground">No listing history available.</p>
        ) : (
          <div className="space-y-2">
            {listing.map((item, index) => (
              <div key={index} className="grid gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm sm:grid-cols-[160px_minmax(0,1fr)_140px] sm:items-center">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Date</p>
                  <p className="mt-1 text-foreground">{formatDateLabel(item.date)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Event</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${eventStyle(item.event ?? "")}`}>
                      {item.event || "Listing update"}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Price</p>
                  <p className="mt-1 font-medium text-foreground">{formatCurrency(item.price)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-background px-4 py-1">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="tax-history" className="border-b-0">
            <AccordionTrigger className="py-3 text-left hover:no-underline">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Tax Assessment History</p>
                  <p className="text-xs text-muted-foreground">
                    {assessments.length > 0 ? `${assessments.length} recorded tax year${assessments.length === 1 ? "" : "s"}` : "No assessment history available"}
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-1">
              {assessments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No assessment history available.</p>
              ) : (
                <div className="space-y-2">
                  {assessments.map((assessment, index) => (
                    <div key={index} className="grid gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm sm:grid-cols-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Year</p>
                        <p className="mt-1 text-foreground">{assessment.taxYear || "Unavailable"}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Assessed</p>
                        <p className="mt-1 font-medium text-foreground">{formatCurrency(assessment.assessedValue)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Market</p>
                        <p className="mt-1 text-foreground">{formatCurrency(assessment.marketValue)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Tax</p>
                        <p className="mt-1 font-medium text-foreground">{formatCurrency(assessment.taxAmt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {urgency ? (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <List className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-medium text-foreground">Urgency Trigger</h4>
          </div>
          <div className="rounded-2xl border border-border bg-background px-4 py-3">
            <p className="text-sm font-medium text-foreground">{urgency.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{urgency.detail}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
};
