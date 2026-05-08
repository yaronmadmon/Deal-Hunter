export interface SaleRecord {
  saleTransDate?: string | null;
  saleAmt?: number | null;
  buyerName?: string | null;
  sellerName?: string | null;
  [key: string]: unknown;
}

export interface AssessmentRecord {
  taxYear?: number | string | null;
  assessedValue?: number | null;
  marketValue?: number | null;
  taxAmt?: number | null;
  [key: string]: unknown;
}

export interface ListingEvent {
  date?: string | null;
  event?: string | null;
  price?: number | null;
}

export interface HistoryBundle {
  sales?: SaleRecord[];
  assessments?: AssessmentRecord[];
  listing?: ListingEvent[];
}

export interface ListingInsights {
  attempts: number;
  priceDrops: number;
  totalReduction: number | null;
  pendingLabel: string | null;
  pendingDate: string | null;
  lastOutcome: string | null;
  latestListPrice: number | null;
}

export interface UrgencyInsight {
  label: string;
  detail: string;
  date: string | null;
  tone: "critical" | "active" | "watch";
}

export interface DebtStatus {
  statusLabel?: string | null;
  delinquentAmount?: number | null;
  taxLienAmount?: number | null;
  openingBidAmount?: number | null;
  defaultDate?: string | null;
  auctionDate?: string | null;
  recordingDate?: string | null;
  originalLoanDate?: string | null;
  taxDelinquentYear?: number | string | null;
  estimatedMissedPayments?: number | null;
  estimatedMonthlyPayment?: number | null;
  estimateBasis?: string | null;
}

const toNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const normalized = value.replace(/[$,\s]/g, "").trim();
      if (!normalized) continue;
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
};

const toText = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
};

const parseDate = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== "string" && typeof value !== "number") return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateForSort = (value: unknown) => parseDate(value)?.getTime() ?? 0;

export const formatCurrency = (value?: number | null) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatCurrencyCompact = (value?: number | null) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);
};

export const formatDateLabel = (value?: string | null) => {
  const parsed = parseDate(value);
  if (!parsed) return "Unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
};

export const formatDateShort = (value?: string | null) => {
  const parsed = parseDate(value);
  if (!parsed) return "Unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(parsed);
};

export const getDebtStatus = (distressDetails?: Record<string, any> | null): DebtStatus => {
  const debtStatus = distressDetails?.debtStatus;
  if (!debtStatus || typeof debtStatus !== "object" || Array.isArray(debtStatus)) return {};

  return {
    statusLabel: toText(debtStatus.statusLabel, debtStatus.sourceEventType, debtStatus.stage),
    delinquentAmount: toNumber(debtStatus.delinquentAmount, debtStatus.delinquentamount),
    taxLienAmount: toNumber(debtStatus.taxLienAmount, debtStatus.taxlienamount),
    openingBidAmount: toNumber(debtStatus.openingBidAmount, debtStatus.bidAmount, debtStatus.bidamount),
    defaultDate: toText(debtStatus.defaultDate, debtStatus.defaultdate),
    auctionDate: toText(debtStatus.auctionDate, debtStatus.auctionDateTime, debtStatus.auctiondate),
    recordingDate: toText(debtStatus.recordingDate, debtStatus.recordingdate, debtStatus.filingDate, debtStatus.filingdate),
    originalLoanDate: toText(debtStatus.originalLoanDate, debtStatus.originalloandate),
    taxDelinquentYear: toNumber(debtStatus.taxDelinquentYear, debtStatus.taxdelinquentyear) ?? toText(debtStatus.taxDelinquentYear, debtStatus.taxdelinquentyear),
    estimatedMissedPayments: toNumber(debtStatus.estimatedMissedPayments, debtStatus.estimatedmissedpayments),
    estimatedMonthlyPayment: toNumber(debtStatus.estimatedMonthlyPayment, debtStatus.estimatedmonthlypayment),
    estimateBasis: toText(debtStatus.estimateBasis, debtStatus.estimatedMissedPaymentsBasis),
  };
};

const normalizeListing = (listing: ListingEvent[]) =>
  [...listing].sort((left, right) => formatDateForSort(right.date) - formatDateForSort(left.date));

export const getLotSizeSqft = (distressDetails?: Record<string, any> | null) => {
  const lotSizeSqft = toNumber(
    distressDetails?.lotSizeSqft,
    distressDetails?.lotSqft,
    distressDetails?.lot_size_sqft,
    distressDetails?.lot?.sqft,
  );

  if (lotSizeSqft !== null) return lotSizeSqft;

  const lotSizeAcres = toNumber(
    distressDetails?.lotSizeAcres,
    distressDetails?.lot_acres,
    distressDetails?.lot?.acres,
  );

  return lotSizeAcres !== null ? Math.round(lotSizeAcres * 43_560) : null;
};

export const formatLotSize = (distressDetails?: Record<string, any> | null) => {
  const lotSizeSqft = getLotSizeSqft(distressDetails);
  if (lotSizeSqft === null) return "Unavailable";
  if (lotSizeSqft >= 43_560) {
    const acres = lotSizeSqft / 43_560;
    return `${acres.toFixed(acres >= 10 ? 1 : 2)} ac`;
  }
  return `${lotSizeSqft.toLocaleString()} sqft`;
};

export const getListingInsights = (history?: HistoryBundle | null): ListingInsights => {
  const listing = normalizeListing(history?.listing ?? []);
  const attempts = listing.filter((item) => /listed|relisted|new listing|for sale/i.test(item.event ?? "")).length;
  const priceDrops = listing.filter((item) => /price drop|price cut|reduced|reduction/i.test(item.event ?? "")).length;
  const pendingEvent = listing.find((item) => /pending|contingent|under contract/i.test(item.event ?? ""));
  const soldEvent = listing.find((item) => /sold/i.test(item.event ?? ""));
  const removedEvent = listing.find((item) => /removed|delisted|expired|cancel/i.test(item.event ?? ""));
  const prices = listing.map((item) => item.price).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const highestListPrice = prices.length > 0 ? Math.max(...prices) : null;
  const latestListPrice = listing.find((item) => typeof item.price === "number")?.price ?? null;
  const totalReduction = highestListPrice !== null && latestListPrice !== null && highestListPrice > latestListPrice
    ? highestListPrice - latestListPrice
    : null;

  return {
    attempts,
    priceDrops,
    totalReduction,
    pendingLabel: pendingEvent?.event?.trim() || null,
    pendingDate: pendingEvent?.date?.trim() || null,
    lastOutcome: soldEvent?.event?.trim() || removedEvent?.event?.trim() || null,
    latestListPrice,
  };
};

const EVENT_DATE_FIELDS = [
  "eventDate",
  "eventdate",
  "eventDateTime",
  "filingDate",
  "filingdate",
  "recordingDate",
  "recordingdate",
  "statusDate",
  "statusdate",
  "auctionDate",
  "auctiondate",
  "saleDate",
  "saledate",
  "date",
  "defaultDate",
  "defaultdate",
];

const URGENCY_PATTERNS = [
  { pattern: /auction|trustee sale|sheriff sale|sale scheduled/i, label: "Auction watch", tone: "critical" as const, weight: 5 },
  { pattern: /notice of default|default/i, label: "Default filed", tone: "critical" as const, weight: 4 },
  { pattern: /lis pendens/i, label: "Lis pendens filed", tone: "critical" as const, weight: 4 },
  { pattern: /foreclosure/i, label: "Foreclosure activity", tone: "active" as const, weight: 3 },
  { pattern: /tax lien|delinquen/i, label: "Tax delinquency", tone: "watch" as const, weight: 2 },
];

export const getUrgencyInsight = (distressDetails?: Record<string, any> | null): UrgencyInsight | null => {
  const debtStatus = getDebtStatus(distressDetails);
  const events = Array.isArray(distressDetails?.events) ? distressDetails.events : [];
  const debtCandidates = [
    debtStatus.auctionDate
      ? {
          label: "Auction watch",
          detail: debtStatus.statusLabel
            ? `${debtStatus.statusLabel} scheduled`
            : "Foreclosure auction scheduled",
          date: debtStatus.auctionDate,
          tone: "critical" as const,
          weight: 5,
        }
      : null,
    debtStatus.defaultDate
      ? {
          label: debtStatus.statusLabel && /tax|delinquen/i.test(debtStatus.statusLabel) ? "Tax delinquency" : "Default filed",
          detail: debtStatus.statusLabel
            ? `${debtStatus.statusLabel} recorded`
            : "Default-related filing recorded",
          date: debtStatus.defaultDate,
          tone: debtStatus.statusLabel && /tax|delinquen/i.test(debtStatus.statusLabel) ? ("watch" as const) : ("critical" as const),
          weight: debtStatus.statusLabel && /tax|delinquen/i.test(debtStatus.statusLabel) ? 2 : 4,
        }
      : null,
    !debtStatus.defaultDate && debtStatus.recordingDate
      ? {
          label: debtStatus.statusLabel && /tax|delinquen/i.test(debtStatus.statusLabel) ? "Tax delinquency" : "Recorded distress filing",
          detail: debtStatus.statusLabel
            ? `${debtStatus.statusLabel} recorded`
            : "Recorded distress filing",
          date: debtStatus.recordingDate,
          tone: debtStatus.statusLabel && /tax|delinquen/i.test(debtStatus.statusLabel) ? ("watch" as const) : ("active" as const),
          weight: debtStatus.statusLabel && /tax|delinquen/i.test(debtStatus.statusLabel) ? 2 : 3,
        }
      : null,
  ].filter((value): value is { label: string; detail: string; date: string | null; tone: "critical" | "active" | "watch"; weight: number } => Boolean(value));

  const eventCandidates = events
    .map((event) => {
      const label = toText(event?.eventType, event?.type, event?.eventDescription, event?.description, event?.status) ?? "Recorded event";
      const match = URGENCY_PATTERNS.find((item) => item.pattern.test(label));
      if (!match) return null;

      const date = EVENT_DATE_FIELDS
        .map((field) => toText(event?.[field]))
        .find(Boolean) ?? null;

      return {
        label: match.label,
        detail: label,
        date,
        tone: match.tone,
        weight: match.weight,
      };
    })
    .filter((value): value is { label: string; detail: string; date: string | null; tone: "critical" | "active" | "watch"; weight: number } => Boolean(value));

  const candidates = [...debtCandidates, ...eventCandidates]
    .sort((left, right) => {
      if (right.weight !== left.weight) return right.weight - left.weight;
      return formatDateForSort(right.date) - formatDateForSort(left.date);
    });

  if (candidates.length === 0) return null;

  const top = candidates[0];
  return {
    label: top.label,
    detail: top.date ? `${top.detail} on ${formatDateLabel(top.date)}` : top.detail,
    date: top.date,
    tone: top.tone,
  };
};

export const buildHistorySnapshot = (options: {
  history?: HistoryBundle | null;
  property?: { last_sale_date?: string | null; last_sale_price?: number | null } | null;
  distressDetails?: Record<string, any> | null;
}) => {
  const listingInsights = getListingInsights(options.history);
  const urgency = getUrgencyInsight(options.distressDetails);
  const latestSale = (options.history?.sales ?? [])[0] ?? null;
  const saleDate = toText(latestSale?.saleTransDate, options.property?.last_sale_date);
  const salePrice = toNumber(latestSale?.saleAmt, options.property?.last_sale_price);

  const parts: string[] = [];

  if (salePrice !== null || saleDate) {
    const when = saleDate ? ` ${formatDateShort(saleDate)}` : "";
    const amount = salePrice !== null ? ` for ${formatCurrencyCompact(salePrice)}` : "";
    parts.push(`Last sold${when}${amount}`.trim());
  }

  if (listingInsights.attempts > 0) {
    parts.push(`Listed ${listingInsights.attempts}x`);
  }

  if (listingInsights.priceDrops > 0) {
    const reduction = listingInsights.totalReduction !== null ? ` (${formatCurrencyCompact(listingInsights.totalReduction)} down)` : "";
    parts.push(`${listingInsights.priceDrops} price cut${listingInsights.priceDrops === 1 ? "" : "s"}${reduction}`);
  }

  if (listingInsights.pendingLabel) {
    parts.push(listingInsights.pendingLabel);
  } else if (listingInsights.lastOutcome) {
    parts.push(listingInsights.lastOutcome);
  }

  if (urgency?.date) {
    parts.push(`${urgency.label} ${formatDateShort(urgency.date)}`);
  }

  return parts.slice(0, 3).join(" • ");
};

export const buildDerivedOpportunitySummary = (options: {
  reportData?: Record<string, any> | null;
  history?: HistoryBundle | null;
  property?: { equity_pct?: number | null } | null;
  distressDetails?: Record<string, any> | null;
}) => {
  const reportData = options.reportData ?? {};
  if (typeof reportData.history_summary === "string" && reportData.history_summary.trim()) {
    return reportData.history_summary.trim();
  }

  const listingInsights = getListingInsights(options.history);
  const urgency = getUrgencyInsight(options.distressDetails);
  const debtStatus = getDebtStatus(options.distressDetails);
  const equity = toNumber(options.property?.equity_pct);
  const thoughts: string[] = [];

  if (listingInsights.attempts >= 2) {
    thoughts.push(`The property has hit the market ${listingInsights.attempts} times, which usually signals seller friction or weak buyer demand at prior pricing.`);
  } else if (listingInsights.attempts === 1) {
    thoughts.push("There is at least one recorded sale attempt, so the owner has already tested the market.");
  }

  if (listingInsights.priceDrops > 0) {
    const reduction = listingInsights.totalReduction !== null ? ` with roughly ${formatCurrencyCompact(listingInsights.totalReduction)} in visible cuts` : " with visible price cuts";
    thoughts.push(`Pricing softened ${listingInsights.priceDrops} time${listingInsights.priceDrops === 1 ? "" : "s"}${reduction}, which can open a discount conversation.`);
  }

  if (equity !== null && equity >= 25) {
    thoughts.push(`Recorded equity still looks healthy at about ${Math.round(equity)}%, so there may be room to structure an off-market or pre-list deal without relying on a thin margin.`);
  }

  if (debtStatus.delinquentAmount !== null && debtStatus.delinquentAmount !== undefined) {
    thoughts.push(`Recorded delinquent debt is roughly ${formatCurrencyCompact(debtStatus.delinquentAmount)}, which gives a usable opening point for owner outreach and payoff discovery.`);
  } else if (debtStatus.taxDelinquentYear) {
    thoughts.push(`Public records flag unpaid property taxes tied to tax year ${debtStatus.taxDelinquentYear}, which still signals pressure even without a surfaced lien balance.`);
  }

  if (urgency) {
    thoughts.push(`${urgency.label} is the clearest urgency signal${urgency.date ? `, dated ${formatDateLabel(urgency.date)}` : ""}.`);
  }

  return thoughts.join(" ").trim() || "History is still sparse, but the property is worth reviewing for owner motivation, debt load, and current disposition path.";
};

export const buildDerivedUrgencySummary = (options: {
  reportData?: Record<string, any> | null;
  distressDetails?: Record<string, any> | null;
  history?: HistoryBundle | null;
}) => {
  const reportData = options.reportData ?? {};
  if (typeof reportData.urgency_summary === "string" && reportData.urgency_summary.trim()) {
    return reportData.urgency_summary.trim();
  }

  const urgency = getUrgencyInsight(options.distressDetails);
  const listingInsights = getListingInsights(options.history);
  const debtStatus = getDebtStatus(options.distressDetails);

  if (urgency) return urgency.detail;
  if (debtStatus.delinquentAmount !== null && debtStatus.delinquentAmount !== undefined) {
    return `Recorded delinquent amount is about ${formatCurrency(debtStatus.delinquentAmount)}${debtStatus.estimatedMissedPayments ? `, or roughly ${Math.round(debtStatus.estimatedMissedPayments)} missed payment${Math.round(debtStatus.estimatedMissedPayments) === 1 ? "" : "s"} on the current loan balance.` : "."}`;
  }
  if (listingInsights.pendingLabel) {
    return listingInsights.pendingDate
      ? `${listingInsights.pendingLabel} as of ${formatDateLabel(listingInsights.pendingDate)}.`
      : listingInsights.pendingLabel;
  }

  return "No dated foreclosure or pending trigger is surfaced yet. Treat urgency as moderate until new public-record activity appears.";
};

export const buildDerivedNextStep = (options: {
  reportData?: Record<string, any> | null;
  distressDetails?: Record<string, any> | null;
  history?: HistoryBundle | null;
}) => {
  const reportData = options.reportData ?? {};
  if (typeof reportData.next_step === "string" && reportData.next_step.trim()) {
    return reportData.next_step.trim();
  }

  const urgency = getUrgencyInsight(options.distressDetails);
  const listingInsights = getListingInsights(options.history);

  if (urgency?.tone === "critical") {
    return "Prioritize direct owner outreach now and verify the exact filing timeline before the property advances further.";
  }

  if (listingInsights.priceDrops > 0 || listingInsights.attempts > 1) {
    return "Lead with the failed-listing story: reference the repeated list activity, ask what changed, and test for a faster off-market exit.";
  }

  return "Verify the debt stack, confirm current disposition status, and use owner outreach to test motivation before investing more time.";
};
