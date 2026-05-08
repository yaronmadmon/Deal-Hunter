import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bath,
  Bed,
  ChevronRight,
  Loader2,
  Mail,
  MapPin,
  Maximize2,
  MessageSquare,
  Phone,
  RefreshCw,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  formatCurrency,
  buildHistorySnapshot,
  formatCurrencyCompact,
  formatDateLabel,
  formatDateShort,
  formatLotSize,
  getLotSizeSqft,
  getDebtStatus,
  getUrgencyInsight,
  type HistoryBundle,
} from "@/lib/property-history";

import { DistressTypeBadge } from "./DistressTypeBadge";

interface MortgageInfo {
  loanAmount?: number | null;
  lenderName?: string | null;
  loanType?: string | null;
  isCashPurchase?: boolean;
}

interface DistressDetails {
  assessmentTax?: { taxamt?: number | null };
  mortgage?: MortgageInfo;
  avmRange?: { high?: number | null; low?: number | null };
  yearBuilt?: number | null;
  ownerName?: string | null;
  ownerMailingAddress?: string | null;
  lotSizeSqft?: number | null;
  events?: Array<Record<string, unknown>>;
}

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  estimated_value?: number | null;
  last_sale_price?: number | null;
  last_sale_date?: string | null;
  equity_pct?: number | null;
  deal_score?: number | null;
  deal_verdict?: string | null;
  distress_types?: string[] | null;
  distress_details?: DistressDetails | null;
  report_data?: {
    opportunity_type?: string | null;
    photos?: string[] | null;
    history?: HistoryBundle | null;
    history_summary?: string | null;
  } | null;
  status: string;
}

interface OwnerContact {
  owner_name?: string | null;
  phones?: Array<{ number?: string } | string> | null;
  emails?: Array<{ address?: string; email?: string } | string> | null;
}

interface Props {
  property: Property;
  ownerContact?: OwnerContact | null;
  onSkipTrace?: (id: string, forceRefresh?: boolean) => Promise<void>;
}

const extractPhone = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return String((value as { number?: string }).number ?? "");
  return "";
};

const extractEmail = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as { address?: string; email?: string };
    return String(record.address ?? record.email ?? "");
  }
  return "";
};

const formatDialLabel = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return value;
};

const Metric = ({ label, value, helper }: { label: string; value: string; helper?: string | null }) => (
  <div className="rounded-2xl border border-border bg-background px-3 py-2.5">
    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
    <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    {helper ? <p className="mt-1 text-[11px] text-muted-foreground">{helper}</p> : null}
  </div>
);

const opportunityLabels: Record<string, string> = {
  short_sale: "Short Sale",
  pre_foreclosure: "Pre-Foreclosure",
  tax_lien_buyout: "Tax Lien Buyout",
  probate_estate: "Probate / Estate",
  equity_rich_distressed: "Equity Rich",
};

const urgencyToneClass: Record<string, string> = {
  critical: "border-indigo-500/25 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  active: "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  watch: "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

const actionLinkClass =
  "inline-flex min-w-0 items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-foreground/25 hover:bg-secondary";

const historyEventStyle = (event: string) => {
  const key = event.toLowerCase();
  if (key.includes("listed")) return "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300";
  if (key.includes("price drop") || key.includes("price cut") || key.includes("reduced")) {
    return "border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300";
  }
  if (key.includes("pending") || key.includes("contingent")) {
    return "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  }
  if (key.includes("sold")) return "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300";
  if (key.includes("removed") || key.includes("delisted") || key.includes("expired")) {
    return "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300";
  }
  return "border-border bg-secondary/60 text-foreground";
};

export const PropertyCard = ({ property, ownerContact, onSkipTrace }: Props) => {
  const navigate = useNavigate();
  const [tracing, setTracing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const isPending = property.status === "searching" || property.status === "scoring";

  if (isPending) {
    return (
      <Card>
        <CardContent className="space-y-3 p-4">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-14 rounded-2xl" />
            ))}
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-full" />
            <Skeleton className="h-9 w-36 rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const details = property.distress_details ?? {};
  const mortgage = details.mortgage ?? {};
  const history = property.report_data?.history ?? null;
  const ownerName = ownerContact?.owner_name || details.ownerName || "Owner unavailable";
  const phones = (ownerContact?.phones ?? []).map(extractPhone).filter(Boolean);
  const emails = (ownerContact?.emails ?? []).map(extractEmail).filter(Boolean);
  const phone = phones[0] ?? "";
  const email = emails[0] ?? "";
  const isSparseContact = Boolean(ownerContact) && (phones.length < 2 || emails.length === 0);
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${property.address}, ${property.city}, ${property.state} ${property.zip}`)}`;
  const opportunityType = property.report_data?.opportunity_type ?? null;
  const urgency = getUrgencyInsight(details);
  const debtStatus = getDebtStatus(details);
  const historySnapshot = buildHistorySnapshot({ history, property, distressDetails: details });
  const listingPreview = [...(history?.listing ?? [])]
    .sort((left, right) => new Date(String(right.date ?? "")).getTime() - new Date(String(left.date ?? "")).getTime())
    .slice(0, 2);
  const lotSizeSqft = getLotSizeSqft(details);
  const mailHref = email
    ? `mailto:${email}?subject=${encodeURIComponent(`Regarding ${property.address}`)}`
    : "";
  const ownerDisplay = ownerName === "Owner unavailable" ? "Refreshing owner info..." : ownerName;
  const metrics = [
    property.estimated_value
      ? { label: "Estimated Value", value: formatCurrencyCompact(property.estimated_value), helper: null }
      : null,
    mortgage.isCashPurchase
      ? { label: "Mortgage", value: "Cash Purchase", helper: mortgage.lenderName ?? null }
      : mortgage.loanAmount
      ? {
          label: "Mortgage",
          value: formatCurrencyCompact(mortgage.loanAmount),
          helper: mortgage.lenderName ?? mortgage.loanType ?? null,
        }
      : null,
    lotSizeSqft
      ? { label: "Lot Size", value: formatLotSize(details), helper: null }
      : null,
    property.last_sale_price
      ? {
          label: "Last Sale",
          value: formatCurrencyCompact(property.last_sale_price),
          helper: property.last_sale_date ? formatDateLabel(property.last_sale_date) : null,
        }
      : null,
  ].filter((metric): metric is { label: string; value: string; helper: string | null } => Boolean(metric));

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("run-deal-analyze", {
        body: { propertyId: property.id },
      });
      if (error || data?.error) throw error ?? new Error(data?.error ?? "Refresh failed");
      toast.success("Property data refreshed.");
    } catch {
      toast.error("Failed to refresh property data.");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Card className="overflow-hidden border-border/80 bg-card/90 transition-colors hover:border-foreground/20">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
          <div className="min-w-0 xl:w-[31%]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-foreground sm:text-lg">{property.address}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:text-sm">
                  <span>{property.city}, {property.state} {property.zip}</span>
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    Map
                  </a>
                </div>
              </div>

              {urgency ? (
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${urgencyToneClass[urgency.tone]}`}>
                  {urgency.label}
                  {urgency.date ? ` • ${formatDateShort(urgency.date)}` : ""}
                </span>
              ) : null}
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {(property.distress_types ?? []).map((type) => (
                <DistressTypeBadge key={type} type={type} />
              ))}
              {opportunityType && opportunityLabels[opportunityType] ? (
                <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-foreground">
                  {opportunityLabels[opportunityType]}
                </span>
              ) : null}
            </div>

            {(debtStatus.auctionDate || debtStatus.defaultDate || debtStatus.recordingDate || debtStatus.taxDelinquentYear) ? (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {debtStatus.auctionDate ? (
                  <>Auction: <span className="font-medium text-foreground">{formatDateLabel(debtStatus.auctionDate)}</span></>
                ) : debtStatus.defaultDate || debtStatus.recordingDate ? (
                  <>Filed: <span className="font-medium text-foreground">{formatDateLabel(debtStatus.defaultDate ?? debtStatus.recordingDate)}</span></>
                ) : debtStatus.taxDelinquentYear ? (
                  <>Tax delinquent since <span className="font-medium text-foreground">{String(debtStatus.taxDelinquentYear)}</span></>
                ) : null}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:text-sm">
              {property.beds ? <span className="inline-flex items-center gap-1"><Bed className="h-3.5 w-3.5" />{property.beds} bd</span> : null}
              {property.baths ? <span className="inline-flex items-center gap-1"><Bath className="h-3.5 w-3.5" />{property.baths} ba</span> : null}
              {property.sqft ? <span className="inline-flex items-center gap-1"><Maximize2 className="h-3.5 w-3.5" />{property.sqft.toLocaleString()} sqft</span> : null}
              {lotSizeSqft ? <span>Lot {formatLotSize(details)}</span> : null}
            </div>

            <p className="mt-2 truncate text-xs text-muted-foreground">
              Owner: <span className="font-medium text-foreground">{ownerDisplay}</span>
            </p>

            {historySnapshot ? (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{historySnapshot}</p>
            ) : null}

            <div className="mt-2 rounded-2xl border border-border bg-background px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Listing History</p>
              {listingPreview.length > 0 ? (
                <div className="mt-2 space-y-1.5">
                  {listingPreview.map((item, index) => (
                    <div key={`${item.date ?? "listing"}-${item.event ?? "event"}-${index}`} className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="text-muted-foreground">{formatDateLabel(item.date)}</span>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 font-medium ${historyEventStyle(item.event ?? "")}`}>
                        {item.event || "Listing update"}
                      </span>
                      {typeof item.price === "number" ? (
                        <span className="font-medium text-foreground">{formatCurrency(item.price)}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">No listing history surfaced yet.</p>
              )}
            </div>
          </div>

          {metrics.length > 0 ? (
            <div className="grid flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <Metric key={metric.label} label={metric.label} value={metric.value} helper={metric.helper} />
              ))}
            </div>
          ) : (
            <div className="flex-1 rounded-2xl border border-dashed border-border bg-background px-4 py-3 text-sm text-muted-foreground">
              Core financial fields are still being refreshed from the record source.
            </div>
          )}

          <div className="flex w-full flex-col gap-2 xl:w-[24%] xl:items-end">
            <div className="flex w-full flex-wrap gap-2 xl:justify-end">
              {phone ? (
                <a href={`tel:${phone}`} className={actionLinkClass} title={`Call ${formatDialLabel(phone)}`}>
                  <Phone className="h-3.5 w-3.5" />
                  <span className="truncate">{formatDialLabel(phone)}</span>
                </a>
              ) : null}
              {phone ? (
                <a
                  href={`sms:${phone}?body=${encodeURIComponent(`Hi, I'm a local investor reaching out about your property at ${property.address}. Would you be open to a quick conversation?`)}`}
                  className={actionLinkClass}
                  title={`Text ${formatDialLabel(phone)}`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Text</span>
                </a>
              ) : null}
              {email ? (
                <a href={mailHref} className={actionLinkClass} title={`Email ${email}`}>
                  <Mail className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[11rem]">{email}</span>
                </a>
              ) : null}
              <Button
                size="sm"
                className="h-8 rounded-full px-3 text-xs font-medium"
                onClick={() => navigate(`/property/${property.id}`)}
              >
                View Deal
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 text-xs text-muted-foreground xl:justify-end">
              <button
                type="button"
                className="inline-flex items-center gap-1 font-medium text-foreground hover:text-foreground/75"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {refreshing ? "Refreshing" : "Refresh Data"}
              </button>

              {onSkipTrace ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-medium text-foreground hover:text-foreground/75"
                  disabled={tracing}
                  onClick={async () => {
                    setTracing(true);
                    await onSkipTrace(property.id, Boolean(ownerContact));
                    setTracing(false);
                  }}
                >
                  {tracing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <User className="h-3.5 w-3.5" />}
                  {tracing ? "Tracing" : ownerContact ? "Refresh Owner Info" : "Get Owner Info"}
                </button>
              ) : null}
            </div>

            <p className="w-full text-xs text-muted-foreground xl:text-right">
              {phones.length} phone{phones.length === 1 ? "" : "s"} and {emails.length} email{emails.length === 1 ? "" : "s"}
              {isSparseContact ? " available. Refresh to pull a deeper owner match." : " available."}
            </p>

            {!phone && !email ? (
              <p className="w-full text-xs text-muted-foreground xl:text-right">
                No direct contact surfaced yet. Run owner info to reveal clickable phone and email links.
              </p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
