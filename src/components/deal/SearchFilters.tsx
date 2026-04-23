import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Bookmark, Search, Loader2, MapPin } from "lucide-react";
import { useState } from "react";

const DISTRESS_TYPES = [
  { id: "tax_lien", label: "Tax Lien" },
  { id: "foreclosure", label: "Foreclosure" },
  { id: "divorce", label: "Divorce / Probate" },
  { id: "delinquency", label: "Delinquency" },
];

const PROPERTY_TYPES = ["SFR", "MFR", "Condo", "Land", "Commercial"];

export interface Filters {
  location: string;
  distressTypes: string[];
  priceMin?: number;
  priceMax?: number;
  propertyTypes: string[];
  equityMin?: number;
}

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  onSearch: () => void;
  searching: boolean;
  savedSearches?: { id: string; name: string; filters: Filters }[];
  onSaveSearch?: () => void;
  onLoadSavedSearch?: (filters: Filters) => void;
}

export const SearchFilters = ({ filters, onChange, onSearch, searching, savedSearches = [], onSaveSearch, onLoadSavedSearch }: Props) => {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const toggleDistress = (id: string) => {
    const next = filters.distressTypes.includes(id)
      ? filters.distressTypes.filter(t => t !== id)
      : [...filters.distressTypes, id];
    onChange({ ...filters, distressTypes: next });
  };

  const togglePropertyType = (pt: string) => {
    const next = filters.propertyTypes.includes(pt)
      ? filters.propertyTypes.filter(t => t !== pt)
      : [...filters.propertyTypes, pt];
    onChange({ ...filters, propertyTypes: next });
  };

  return (
    <div className="space-y-5">
      {/* Location */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Location</Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="City, zip, or county"
            value={filters.location}
            onChange={e => onChange({ ...filters, location: e.target.value })}
            onKeyDown={e => e.key === "Enter" && onSearch()}
            className="pl-8"
          />
        </div>
      </div>

      {/* Distress types */}
      <div className="space-y-2">
        <Label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Distress Type</Label>
        <div className="flex flex-wrap gap-2">
          {DISTRESS_TYPES.map(dt => (
            <button
              key={dt.id}
              onClick={() => toggleDistress(dt.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150 ${
                filters.distressTypes.includes(dt.id)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {dt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced filters */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between text-xs font-medium uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors py-1">
          More Filters
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Price Range</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Min $"
                value={filters.priceMin ?? ""}
                onChange={e => onChange({ ...filters, priceMin: e.target.value ? Number(e.target.value) : undefined })}
              />
              <Input
                type="number"
                placeholder="Max $"
                value={filters.priceMax ?? ""}
                onChange={e => onChange({ ...filters, priceMax: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Min Equity %</Label>
            <Input
              type="number"
              placeholder="e.g. 20"
              value={filters.equityMin ?? ""}
              onChange={e => onChange({ ...filters, equityMin: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Property Type</Label>
            <div className="flex flex-wrap gap-1.5">
              {PROPERTY_TYPES.map(pt => (
                <button
                  key={pt}
                  onClick={() => togglePropertyType(pt)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
                    filters.propertyTypes.includes(pt)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {pt}
                </button>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Search button */}
      <Button className="w-full font-semibold gap-2" onClick={onSearch} disabled={searching}>
        {searching ? (
          <><Loader2 className="h-4 w-4 animate-spin" />Searching…</>
        ) : (
          <><Search className="h-4 w-4" />Search Deals</>
        )}
      </Button>

      {/* Save search */}
      {onSaveSearch && (
        <Button variant="outline" size="sm" className="w-full text-xs gap-1.5" onClick={onSaveSearch}>
          <Bookmark className="h-3 w-3" /> Save This Search
        </Button>
      )}

      {/* Saved searches */}
      {savedSearches.length > 0 && (
        <div className="space-y-1 pt-1">
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground px-1">Saved Searches</p>
          {savedSearches.map(ss => (
            <button
              key={ss.id}
              onClick={() => onLoadSavedSearch?.(ss.filters)}
              className="w-full text-left text-xs px-3 py-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors truncate"
            >
              {ss.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
