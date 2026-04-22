import { Bed, Bath, Maximize2, Home, Calendar, DollarSign } from "lucide-react";

interface Props {
  property: {
    property_type?: string | null;
    beds?: number | null;
    baths?: number | null;
    sqft?: number | null;
    estimated_value?: number | null;
    last_sale_price?: number | null;
    last_sale_date?: string | null;
    equity_pct?: number | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    report_data?: { photos?: string[] } | null;
  };
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3">
    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  </div>
);

export const PropertyInfoSection = ({ property }: Props) => {
  const photos = property.report_data?.photos;

  return (
    <div className="space-y-4">
      {photos && photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.slice(0, 6).map((url, i) => (
            <img key={i} src={url} alt={`Property photo ${i + 1}`} className="rounded-lg object-cover aspect-video w-full" />
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {property.property_type && (
          <InfoRow icon={Home} label="Type" value={property.property_type} />
        )}
        {property.beds && (
          <InfoRow icon={Bed} label="Bedrooms" value={String(property.beds)} />
        )}
        {property.baths && (
          <InfoRow icon={Bath} label="Bathrooms" value={String(property.baths)} />
        )}
        {property.sqft && (
          <InfoRow icon={Maximize2} label="Sq Ft" value={property.sqft.toLocaleString()} />
        )}
        {property.estimated_value && (
          <InfoRow icon={DollarSign} label="Est. Value" value={fmt(property.estimated_value)} />
        )}
        {property.last_sale_price && (
          <InfoRow icon={DollarSign} label="Last Sale" value={fmt(property.last_sale_price)} />
        )}
        {property.last_sale_date && (
          <InfoRow icon={Calendar} label="Sale Date" value={new Date(property.last_sale_date).toLocaleDateString()} />
        )}
        {property.equity_pct !== null && property.equity_pct !== undefined && (
          <InfoRow icon={DollarSign} label="Equity" value={`${Math.round(property.equity_pct)}%`} />
        )}
      </div>
    </div>
  );
};
