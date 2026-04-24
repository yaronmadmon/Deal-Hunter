import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Bookmark, Search } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  savedSearches?: any[];
  onSaveSearch?: () => void;
  onLoadSavedSearch?: (filters: Filters) => void;
  onSearchesChange?: (updated: any[]) => void;
}

const fmtTimeAgo = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
};

export const SearchFilters = ({ filters, onChange, onSearch, searching, savedSearches = [], onSaveSearch, onLoadSavedSearch, onSearchesChange }: Props) => {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const handleToggleMonitor = async (id: string, current: boolean) => {
    const updated = !current;
    await supabase
      .from("saved_searches" as any)
      .update({ is_monitored: updated })
      .eq("id", id);
    onSearchesChange?.(savedSearches.map((s) => s.id === id ? { ...s, is_monitored: updated } : s));
  };

  const toggleDistress = (id: string) => {
    const next = filters.distressTypes.includes(id)
      ? filters.distressTypes.filter((t) => t !== id)
      : [...filters.distressTypes, id];
    onChange({ ...filters, distressTypes: next });
  };

  const togglePropertyType = (pt: string) => {
    const next = filters.propertyTypes.includes(pt)
      ? filters.propertyTypes.filter((t) => t !== pt)
      : [...filters.propertyTypes, pt];
    onChange({ ...filters, propertyTypes: next });
  };

  return (
    <div className="space-y-6">
      {/* Location */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Location</Label>
        <Input
          placeholder="City, zip, or county..."
          value={filters.location}
          onChange={(e) => onChange({ ...filters, location: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
        />
      </div>

      {/* Distress types */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Distress Type</Label>
        <div className="space-y-2">
          {DISTRESS_TYPES.map((dt) => (
            <div key={dt.id} className="flex items-center gap-2">
              <Checkbox
                id={dt.id}
                checked={filters.distressTypes.includes(dt.id)}
                onCheckedChange={() => toggleDistress(dt.id)}
              />
              <label htmlFor={dt.id} className="text-sm cursor-pointer select-none">{dt.label}</label>
            </div>
          ))}
        </div>
      </div>

      {/* Collapsible advanced filters */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
          More Filters
          <ChevronDown className={`h-3 w-3 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Price Range</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Min $"
                value={filters.priceMin ?? ""}
                onChange={(e) => onChange({ ...filters, priceMin: e.target.value ? Number(e.target.value) : undefined })}
              />
              <Input
                type="number"
                placeholder="Max $"
                value={filters.priceMax ?? ""}
                onChange={(e) => onChange({ ...filters, priceMax: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Min Equity %</Label>
            <Input
              type="number"
              placeholder="e.g. 20"
              value={filters.equityMin ?? ""}
              onChange={(e) => onChange({ ...filters, equityMin: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Property Type</Label>
            <div className="flex flex-wrap gap-2">
              {PROPERTY_TYPES.map((pt) => (
                <button
                  key={pt}
                  onClick={() => togglePropertyType(pt)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    filters.propertyTypes.includes(pt)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {pt}
                </button>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Button className="w-full" onClick={onSearch} disabled={searching}>
        <Search className="h-4 w-4 mr-2" />
        {searching ? "Searching..." : "Search Deals"}
      </Button>

      {onSaveSearch && (
        <Button variant="outline" size="sm" className="w-full text-xs" onClick={onSaveSearch}>
          <Bookmark className="h-3 w-3 mr-1.5" />Save This Search
        </Button>
      )}

      {savedSearches.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Saved Searches</p>
          {savedSearches.map((ss) => (
            <div key={ss.id} className="rounded-lg border border-border/50 overflow-hidden">
              <button
                onClick={() => onLoadSavedSearch?.(ss.filters)}
                className="w-full text-left text-sm px-3 py-2 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                {ss.name}
              </button>
              <div className="flex items-center justify-between px-3 pb-2 gap-2">
                <div className="min-w-0">
                  {ss.is_monitored && ss.last_monitored_at && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      Checked {fmtTimeAgo(ss.last_monitored_at)}
                    </p>
                  )}
                  {ss.is_monitored && !ss.last_monitored_at && (
                    <p className="text-[11px] text-muted-foreground">Pending first run</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] text-muted-foreground">Monitor</span>
                  <Switch
                    checked={!!ss.is_monitored}
                    onCheckedChange={() => handleToggleMonitor(ss.id, !!ss.is_monitored)}
                    className="scale-75"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
