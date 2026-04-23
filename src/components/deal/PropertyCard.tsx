import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { Bed, Bath, Maximize2, ArrowRight } from "lucide-react";
import { DistressTypeBadge } from "./DistressTypeBadge";

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
  equity_pct?: number | null;
  deal_score?: number | null;
  deal_verdict?: string | null;
  distress_types?: string[] | null;
  status: string;
}

interface Props {
  property: Property;
}

const fmt = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `$${Math.round(n / 1_000)}K`
  : `$${n}`;

const scoreColor = (score: number) =>
  score >= 70 ? "text-emerald-500 dark:text-emerald-400"
  : score >= 40 ? "text-amber-500 dark:text-amber-400"
  : "text-red-500 dark:text-red-400";

const scoreBg = (score: number) =>
  score >= 70 ? "bg-emerald-500/8 border-emerald-500/20"
  : score >= 40 ? "bg-amber-500/8 border-amber-500/20"
  : "bg-red-500/8 border-red-500/20";

export const PropertyCard = ({ property }: Props) => {
  const navigate = useNavigate();
  const isPending = property.status === "searching" || property.status === "scoring";

  if (isPending) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-8 w-12 rounded-lg shrink-0" />
            </div>
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 w-14" />
            </div>
          </div>
          <div className="border-t border-border px-4 py-3 flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs text-muted-foreground">Analyzing…</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasScore = property.deal_score !== null && property.deal_score !== undefined;

  return (
    <Card
      className="overflow-hidden cursor-pointer transition-all duration-200 hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20"
      onClick={() => navigate(`/property/${property.id}`)}
    >
      <CardContent className="p-0">
        <div className="p-4">
          {/* Address + score */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground text-sm leading-snug truncate">{property.address}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{property.city}, {property.state} {property.zip}</p>
            </div>
            {hasScore && (
              <div className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-center ${scoreBg(property.deal_score!)}`}>
                <p className={`font-mono text-lg font-bold leading-none ${scoreColor(property.deal_score!)}`}>{property.deal_score}</p>
              </div>
            )}
          </div>

          {/* Distress badges */}
          {property.distress_types && property.distress_types.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {property.distress_types.map(t => <DistressTypeBadge key={t} type={t} />)}
            </div>
          )}

          {/* Stats */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {property.beds && <span className="flex items-center gap-1"><Bed className="h-3 w-3" />{property.beds}bd</span>}
            {property.baths && <span className="flex items-center gap-1"><Bath className="h-3 w-3" />{property.baths}ba</span>}
            {property.sqft && <span className="flex items-center gap-1"><Maximize2 className="h-3 w-3" />{property.sqft.toLocaleString()}</span>}
            {property.estimated_value && (
              <span className="ml-auto font-medium text-foreground">{fmt(property.estimated_value)}</span>
            )}
          </div>

          {/* Equity */}
          {property.equity_pct !== null && property.equity_pct !== undefined && (
            <div className="mt-2 flex items-center gap-1.5">
              <div className="h-1 flex-1 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400 transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, property.equity_pct))}%` }}
                />
              </div>
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 shrink-0">{Math.round(property.equity_pct)}% equity</span>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="border-t border-border px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs font-medium text-primary">View Deal</span>
          <ArrowRight className="h-3.5 w-3.5 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
};
