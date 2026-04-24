import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { Bed, Bath, Maximize2, Phone, MessageSquare, Mail, User, Sparkles, MapPin } from "lucide-react";
import { DealScoreBadge } from "./DealScoreBadge";
import { DistressTypeBadge } from "./DistressTypeBadge";

interface MortgageInfo {
  loanAmount?: number | null;
  lenderName?: string | null;
  loanType?: string | null;
  isCashPurchase?: boolean;
  ltv?: number | null;
}

interface DistressDetails {
  assessmentTax?: { taxamt?: number | null };
  mortgage?: MortgageInfo;
  avmRange?: { high?: number | null; low?: number | null };
  yearBuilt?: number | null;
  ownerName?: string | null;
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
  report_data?: { opportunity_type?: string | null } | null;
  status: string;
}

interface OwnerContact {
  owner_name?: string | null;
  phones?: Array<{ number?: string; type?: string }> | null;
  emails?: Array<{ address?: string }> | null;
}

interface Props {
  property: Property;
  ownerContact?: OwnerContact | null;
}

const fmt = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `$${Math.round(n / 1_000)}K`
    : `$${n}`;

const fmtYear = (dateStr: string) => {
  const y = new Date(dateStr).getFullYear();
  return isNaN(y) ? null : y;
};

const OPPORTUNITY_LABELS: Record<string, { label: string; color: string }> = {
  short_sale: { label: "Short Sale Opp", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  pre_foreclosure: { label: "Pre-Foreclosure", color: "bg-red-500/15 text-red-400 border-red-500/30" },
  tax_lien_buyout: { label: "Tax Lien Buyout", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  probate_estate: { label: "Probate/Estate", color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  equity_rich_distressed: { label: "Equity-Rich", color: "bg-green-500/15 text-green-400 border-green-500/30" },
};

export const PropertyCard = ({ property, ownerContact }: Props) => {
  const navigate = useNavigate();
  const isPending = property.status === "searching" || property.status === "scoring";

  if (isPending) {
    return (
      <Card>
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-8 w-full rounded-md" />
        </CardContent>
      </Card>
    );
  }

  const dd = property.distress_details ?? {};
  const taxAmt = dd.assessmentTax?.taxamt ?? null;
  const mtg = dd.mortgage ?? {};
  const avmHigh = dd.avmRange?.high ?? null;
  const avmLow = dd.avmRange?.low ?? null;
  const yearBuilt = dd.yearBuilt ?? null;
  const saleYear = property.last_sale_date ? fmtYear(property.last_sale_date) : null;

  // Owner info — prefer traced contact, fall back to ATTOM owner name
  const ownerName = ownerContact?.owner_name || dd.ownerName || null;
  const firstPhone = ownerContact?.phones?.[0]?.number ?? null;
  const firstEmail = ownerContact?.emails?.[0]?.address ?? null;
  const hasContact = !!(firstPhone || firstEmail);

  // LTV color coding
  const ltvPct = mtg.loanAmount && property.estimated_value
    ? Math.round(mtg.loanAmount / property.estimated_value * 100)
    : null;
  const ltvColor = ltvPct === null
    ? "text-foreground"
    : ltvPct > 100 ? "text-red-400"
    : ltvPct > 80 ? "text-amber-400"
    : "text-green-400";

  // Opportunity type badge
  const oppType = property.report_data?.opportunity_type ?? null;
  const oppBadge = oppType && OPPORTUNITY_LABELS[oppType] ? OPPORTUNITY_LABELS[oppType] : null;

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="p-5 space-y-3">
        {/* Header: address + score */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-foreground text-sm leading-tight truncate">{property.address}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-muted-foreground">{property.city}, {property.state} {property.zip}</p>
              <a
                href={`https://www.google.com/maps?q=${encodeURIComponent(`${property.address}, ${property.city}, ${property.state} ${property.zip}`)}&layer=c`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-[11px] text-primary/70 hover:text-primary transition-colors shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MapPin className="w-2.5 h-2.5" />Street View
              </a>
            </div>
            {ownerName && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <User className="w-3 h-3 shrink-0" />
                <span className="truncate">{ownerName}</span>
              </p>
            )}
          </div>
          {property.deal_score !== null && property.deal_score !== undefined && (
            <DealScoreBadge score={property.deal_score} />
          )}
        </div>

        {/* Distress badges */}
        {property.distress_types && property.distress_types.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {property.distress_types.map((t) => (
              <DistressTypeBadge key={t} type={t} />
            ))}
          </div>
        )}

        {/* Opportunity badge */}
        {oppBadge && (
          <div>
            <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border ${oppBadge.color}`}>
              {oppBadge.label}
            </span>
          </div>
        )}

        {/* Physical specs */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {property.beds && (
            <span className="flex items-center gap-1"><Bed className="w-3 h-3" />{property.beds}bd</span>
          )}
          {property.baths && (
            <span className="flex items-center gap-1"><Bath className="w-3 h-3" />{property.baths}ba</span>
          )}
          {property.sqft && (
            <span className="flex items-center gap-1"><Maximize2 className="w-3 h-3" />{property.sqft.toLocaleString()} sqft</span>
          )}
          {yearBuilt && (
            <span className="text-muted-foreground">Built {yearBuilt}</span>
          )}
        </div>

        {/* Financial grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs border-t border-border pt-3">
          {property.estimated_value && (
            <div>
              <p className="text-muted-foreground">Est. Value</p>
              <p className="font-medium text-foreground">{fmt(property.estimated_value)}</p>
            </div>
          )}
          {property.equity_pct !== null && property.equity_pct !== undefined && (
            <div>
              <p className="text-muted-foreground">Equity</p>
              <p className={`font-medium ${property.equity_pct >= 30 ? "text-green-400" : property.equity_pct >= 0 ? "text-foreground" : "text-red-400"}`}>
                {Math.round(property.equity_pct)}%
              </p>
            </div>
          )}
          {property.last_sale_price && (
            <div>
              <p className="text-muted-foreground">Last Sale{saleYear ? ` (${saleYear})` : ""}</p>
              <p className="font-medium text-foreground">{fmt(property.last_sale_price)}</p>
            </div>
          )}
          {taxAmt && (
            <div>
              <p className="text-muted-foreground">Annual Tax</p>
              <p className="font-medium text-foreground">{fmt(taxAmt)}/yr</p>
            </div>
          )}
          {mtg.isCashPurchase ? (
            <div>
              <p className="text-muted-foreground">Purchase Type</p>
              <p className="font-medium text-emerald-400">Cash</p>
            </div>
          ) : mtg.loanAmount ? (
            <div>
              <p className="text-muted-foreground">Mortgage{ltvPct !== null ? ` (LTV ${ltvPct}%)` : ""}</p>
              <p className={`font-medium ${ltvColor}`}>{fmt(mtg.loanAmount)}</p>
              {mtg.lenderName && <p className="text-[10px] text-muted-foreground truncate">{mtg.lenderName}</p>}
            </div>
          ) : null}
          {mtg.loanType && (
            <div>
              <p className="text-muted-foreground">Loan Type</p>
              <p className="font-medium text-foreground truncate">{mtg.loanType}</p>
            </div>
          )}
          {avmHigh && avmLow && (
            <div className="col-span-2">
              <p className="text-muted-foreground">AVM Range</p>
              <p className="font-medium text-foreground">{fmt(avmLow)} – {fmt(avmHigh)}</p>
            </div>
          )}
        </div>

        {/* Contact buttons — only when traced */}
        {hasContact && (
          <div className="flex items-center gap-1.5 border-t border-border pt-2.5">
            <span className="text-xs text-muted-foreground mr-1">Contact:</span>
            {firstPhone && (
              <>
                <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                  <a href={`tel:${firstPhone}`} title="Call"><Phone className="w-3.5 h-3.5" /></a>
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                  <a href={`sms:${firstPhone}`} title="Text"><MessageSquare className="w-3.5 h-3.5" /></a>
                </Button>
              </>
            )}
            {firstEmail && (
              <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                <a href={`mailto:${firstEmail}`} title="Email"><Mail className="w-3.5 h-3.5" /></a>
              </Button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="default" className="flex-1 text-xs" onClick={() => navigate(`/property/${property.id}`)}>
            View Deal
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => navigate(`/property/${property.id}#outreach`)}>
            <Sparkles className="w-3 h-3 mr-1" />AI Outreach
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
