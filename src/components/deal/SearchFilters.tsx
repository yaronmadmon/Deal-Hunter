import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark, ChevronDown, Search, SlidersHorizontal, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getBrowserTimeZone, getNextRunLabel, normalizeMonitorTime } from "@/lib/monitoring";

export const DISTRESS_TYPES = [
  { id: "tax_lien", label: "Tax Lien" },
  { id: "foreclosure", label: "Foreclosure" },
  { id: "divorce", label: "Divorce / Probate" },
  { id: "delinquency", label: "Delinquency" },
] as const;

const PROPERTY_TYPES = ["SFR", "MFR", "Condo", "Land", "Commercial"];
const ZIP_CODE_REGEX = /^\d{5}(?:-\d{4})?$/;
const STREET_HINTS = [
  " st",
  " street",
  " ave",
  " avenue",
  " rd",
  " road",
  " dr",
  " drive",
  " ln",
  " lane",
  " ct",
  " court",
  " blvd",
  " boulevard",
  " cir",
  " circle",
  " hwy",
  " highway",
  " pkwy",
  " parkway",
  " pl",
  " place",
  " ter",
  " terrace",
  " way",
];

export type SearchMode = "market" | "property";

export interface Filters {
  searchMode: SearchMode;
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

const looksLikeExactAddress = (value: string) => {
  const query = value.trim().toLowerCase();
  if (!query || ZIP_CODE_REGEX.test(query)) return false;

  const hasNumber = /\d/.test(query);
  const hasLetter = /[a-z]/.test(query);
  const hasStreetHint = STREET_HINTS.some((token) => query.includes(token)) || query.includes(",");

  return hasNumber && hasLetter && hasStreetHint;
};

export const inferSearchModeFromLocation = (location: string): SearchMode =>
  looksLikeExactAddress(location) ? "property" : "market";

export const withInferredSearchMode = (filters: Filters): Filters => ({
  ...filters,
  searchMode: inferSearchModeFromLocation(filters.location),
});

export const SearchFilters = ({
  filters,
  onChange,
  onSearch,
  searching,
  savedSearches = [],
  onSaveSearch,
  onLoadSavedSearch,
  onSearchesChange,
}: Props) => {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const navigate = useNavigate();
  const resolvedFilters = useMemo(() => withInferredSearchMode(filters), [filters]);
  const isPropertySearch = resolvedFilters.searchMode === "property";

  const handleDelete = async (id: string) => {
    await supabase.from("saved_searches" as any).delete().eq("id", id);
    onSearchesChange?.(savedSearches.filter((s) => s.id !== id));
  };

  const handleToggleMonitor = async (id: string, current: boolean) => {
    const updated = !current;
    const timezone = getBrowserTimeZone();
    const { data, error } = await supabase
      .from("saved_searches" as any)
      .update({
        is_monitored: updated,
        monitor_timezone: timezone,
      })
      .eq("id", id);
    if (error) return;
    onSearchesChange?.(savedSearches.map((search) => (
      search.id === id
        ? {
            ...search,
            is_monitored: updated,
            monitor_timezone: search.monitor_timezone ?? timezone,
            ...(data?.[0] ?? {}),
          }
        : search
    )));
  };

  const toggleDistress = (id: string) => {
    const next = resolvedFilters.distressTypes.includes(id)
      ? resolvedFilters.distressTypes.filter((type) => type !== id)
      : [...resolvedFilters.distressTypes, id];
    onChange({ ...resolvedFilters, distressTypes: next });
  };

  const togglePropertyType = (propertyType: string) => {
    const next = resolvedFilters.propertyTypes.includes(propertyType)
      ? resolvedFilters.propertyTypes.filter((type) => type !== propertyType)
      : [...resolvedFilters.propertyTypes, propertyType];
    onChange({ ...resolvedFilters, propertyTypes: next });
  };

  const handleLocationChange = (value: string) => {
    onChange(withInferredSearchMode({ ...resolvedFilters, location: value }));
  };

  const activeFilterCount = [
    resolvedFilters.distressTypes.length > 0 ? 1 : 0,
    resolvedFilters.priceMin ? 1 : 0,
    resolvedFilters.priceMax ? 1 : 0,
    resolvedFilters.equityMin ? 1 : 0,
    resolvedFilters.propertyTypes.length > 0 ? 1 : 0,
  ].reduce((total, count) => total + count, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Find Deals</p>
                <h1 className="mt-1 font-heading text-xl font-semibold text-foreground sm:text-2xl">
                  Search By ZIP Or Exact Address
                </h1>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                  Enter a ZIP code to scan a market, or paste a full street address to run a single-property analysis.
                </p>
              </div>
              <span className="inline-flex w-fit items-center rounded-full border border-border bg-secondary/50 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                {isPropertySearch ? "Exact address" : "ZIP / market scan"}
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-12 rounded-xl border-border pl-10 text-sm"
                  placeholder="90210 or 123 Main St, Detroit, MI 48201"
                  value={resolvedFilters.location}
                  onChange={(event) => handleLocationChange(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && onSearch()}
                />
              </div>

              <div className="flex gap-2 lg:flex-none">
                <Button className="h-12 flex-1 px-5 lg:min-w-[168px]" onClick={onSearch} disabled={searching}>
                  <Search className="mr-2 h-4 w-4" />
                  {searching ? (isPropertySearch ? "Analyzing..." : "Searching...") : (isPropertySearch ? "Analyze Property" : "Search Deals")}
                </Button>
                {onSaveSearch && (
                  <Button
                    variant="outline"
                    className="h-12 px-4"
                    onClick={onSaveSearch}
                    title="Save this search"
                  >
                    <Bookmark className="h-4 w-4" />
                    <span className="sr-only">Save this search</span>
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span className="rounded-full border border-border bg-secondary/40 px-2.5 py-1">
                {isPropertySearch ? "Single-property analysis" : "Market-wide scan"}
              </span>
              <span className="rounded-full border border-border bg-secondary/40 px-2.5 py-1">
                {resolvedFilters.distressTypes.length > 0
                  ? `${resolvedFilters.distressTypes.length} distress filter${resolvedFilters.distressTypes.length > 1 ? "s" : ""}`
                  : "All distress types"}
              </span>
              <span className="rounded-full border border-border bg-secondary/40 px-2.5 py-1">
                {resolvedFilters.propertyTypes.length > 0
                  ? `${resolvedFilters.propertyTypes.length} property type${resolvedFilters.propertyTypes.length > 1 ? "s" : ""}`
                  : "All property types"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <div className="overflow-hidden rounded-2xl border border-border bg-card/80">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left sm:px-5">
            <div>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Filters and saved searches</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeFilterCount > 0
                  ? `${activeFilterCount} optional filter${activeFilterCount > 1 ? "s" : ""} active`
                  : "Distress, price, equity, property type, and saved searches"}
              </p>
            </div>
            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>

          <CollapsibleContent className="border-t border-border px-4 py-4 sm:px-5 sm:py-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
              <div className="space-y-5">
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Distress Filters</Label>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Optional. Leave blank to search all distress signals on ZIP and market scans.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {DISTRESS_TYPES.map((distressType) => {
                      const selected = resolvedFilters.distressTypes.includes(distressType.id);
                      return (
                        <button
                          key={distressType.id}
                          type="button"
                          onClick={() => toggleDistress(distressType.id)}
                          className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                            selected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          }`}
                        >
                          {distressType.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {isPropertySearch ? (
                  <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
                    Exact-address searches ignore market filters like price, equity, and property type. Distress tags stay optional.
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Min Price</Label>
                        <Input
                          type="number"
                          placeholder="$0"
                          value={resolvedFilters.priceMin ?? ""}
                          onChange={(event) => onChange({
                            ...resolvedFilters,
                            priceMin: event.target.value ? Number(event.target.value) : undefined,
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Max Price</Label>
                        <Input
                          type="number"
                          placeholder="$750000"
                          value={resolvedFilters.priceMax ?? ""}
                          onChange={(event) => onChange({
                            ...resolvedFilters,
                            priceMax: event.target.value ? Number(event.target.value) : undefined,
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Min Equity %</Label>
                        <Input
                          type="number"
                          placeholder="20"
                          value={resolvedFilters.equityMin ?? ""}
                          onChange={(event) => onChange({
                            ...resolvedFilters,
                            equityMin: event.target.value ? Number(event.target.value) : undefined,
                          })}
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Property Types</Label>
                      <div className="flex flex-wrap gap-2">
                        {PROPERTY_TYPES.map((propertyType) => {
                          const selected = resolvedFilters.propertyTypes.includes(propertyType);
                          return (
                            <button
                              key={propertyType}
                              type="button"
                              onClick={() => togglePropertyType(propertyType)}
                              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                                selected
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                              }`}
                            >
                              {propertyType}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Saved Searches</Label>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Load a previous search or toggle monitoring from here.
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-[11px] font-medium text-foreground underline-offset-4 hover:underline"
                    onClick={() => navigate("/monitored-areas")}
                  >
                    Manage schedules and alert history
                  </button>
                </div>

                {savedSearches.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
                    Saved searches will appear here after you save one from the search bar.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {savedSearches.map((search) => (
                      <div key={search.id} className="rounded-xl border border-border/70 bg-background/80 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            onClick={() => onLoadSavedSearch?.(search.filters)}
                            className="flex-1 text-left min-w-0"
                          >
                            <p className="text-sm font-medium text-foreground truncate">{search.name}</p>
                            {search.filters?.location && (
                              <p className="mt-0.5 text-xs text-muted-foreground truncate">{String(search.filters.location)}</p>
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(search.id)}
                            className="shrink-0 p-1 text-muted-foreground/40 hover:text-destructive transition-colors"
                            title="Delete saved search"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <div className="min-w-0 text-[11px] text-muted-foreground">
                            {search.is_monitored && search.last_monitored_at
                              ? `Checked ${fmtTimeAgo(search.last_monitored_at)}`
                              : search.is_monitored
                              ? "Pending first run"
                              : "Monitoring off"}
                            {search.is_monitored && (
                              <div className="mt-1">
                                {getNextRunLabel({
                                  is_monitored: search.is_monitored,
                                  monitor_frequency_hours: search.monitor_frequency_hours,
                                  monitor_run_time: normalizeMonitorTime(search.monitor_run_time),
                                  monitor_timezone: search.monitor_timezone,
                                  last_monitored_at: search.last_monitored_at,
                                })}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-muted-foreground">Monitor</span>
                            <Switch
                              checked={!!search.is_monitored}
                              onCheckedChange={() => handleToggleMonitor(search.id, !!search.is_monitored)}
                              className="scale-90"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
};
