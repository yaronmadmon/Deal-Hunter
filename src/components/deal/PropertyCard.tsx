import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { Bed, Bath, Maximize2, Phone } from "lucide-react";
import { DealScoreBadge } from "./DealScoreBadge";
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
  onSkipTrace?: (id: string) => void;
}

const fmt = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `$${Math.round(n / 1_000)}K`
    : `$${n}`;

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

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-foreground text-sm leading-tight truncate">{property.address}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{property.city}, {property.state} {property.zip}</p>
          </div>
          {property.deal_score !== null && property.deal_score !== undefined && (
            <DealScoreBadge score={property.deal_score} />
          )}
        </div>

        {property.distress_types && property.distress_types.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {property.distress_types.map((t) => (
              <DistressTypeBadge key={t} type={t} />
            ))}
          </div>
        )}

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
          {property.equity_pct !== null && property.equity_pct !== undefined && (
            <span className="ml-auto text-green-400 font-medium">{Math.round(property.equity_pct)}% equity</span>
          )}
        </div>

        {property.estimated_value && (
          <p className="text-xs text-muted-foreground">Est. value: <span className="text-foreground font-medium">{fmt(property.estimated_value)}</span></p>
        )}

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
