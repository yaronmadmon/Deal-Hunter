import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { Bed, Bath, Maximize2, Phone } from "lucide-react";
import { DealScoreBadge } from "./DealScoreBadge";
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
  status: string;
}

interface Props {
  property: Property;
  onSkipTrace?: (id: string) => void;
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

export const PropertyCard = ({ property, onSkipTrace }: Props) => {
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

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="p-5 space-y-3">
        {/* Header: address + score */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-foreground text-sm leading-tight truncate">{property.address}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{property.city}, {property.state} {property.zip}</p>
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
              <p className="text-muted-foreground">Mortgage</p>
              <p className="font-medium text-foreground">{fmt(mtg.loanAmount)}</p>
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

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="default" className="flex-1 text-xs" onClick={() => navigate(`/property/${property.id}`)}>
            View Deal
          </Button>
          {onSkipTrace && (
            <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => onSkipTrace(property.id)}>
              <Phone className="w-3 h-3 mr-1" />Get Owner
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
