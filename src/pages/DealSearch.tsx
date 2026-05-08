import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MapPin, Search, FolderOpen, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

import { AppNav } from "@/components/AppNav";
import { PropertyCard } from "@/components/deal/PropertyCard";
import { Filters, SearchFilters, withInferredSearchMode } from "@/components/deal/SearchFilters";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_FILTERS: Filters = {
  searchMode: "market",
  location: "",
  distressTypes: [],
  propertyTypes: [],
};

const normalizeFilters = (raw?: Partial<Filters> | null): Filters => {
  const normalized = {
    searchMode: raw?.searchMode === "property" ? "property" : "market",
    location: typeof raw?.location === "string" ? raw.location : "",
    distressTypes: Array.isArray(raw?.distressTypes)
      ? raw.distressTypes.filter((value): value is string => typeof value === "string")
      : [],
    propertyTypes: Array.isArray(raw?.propertyTypes)
      ? raw.propertyTypes.filter((value): value is string => typeof value === "string")
      : [],
    priceMin: typeof raw?.priceMin === "number" ? raw.priceMin : undefined,
    priceMax: typeof raw?.priceMax === "number" ? raw.priceMax : undefined,
    equityMin: typeof raw?.equityMin === "number" ? raw.equityMin : undefined,
  } satisfies Filters;

  return withInferredSearchMode(normalized);
};

const hasSubstantiatedDistress = (property: any) => {
  const distressTypes = Array.isArray(property.distress_types) ? property.distress_types : [];
  if (distressTypes.length === 0) return false;

  if (distressTypes.length === 1 && distressTypes[0] === "delinquency") {
    const events = Array.isArray(property.distress_details?.events) ? property.distress_details.events : [];
    return events.length > 0;
  }

  return true;
};

const DealSearch = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading, profile } = useAuth();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [properties, setProperties] = useState<any[]>([]);
  const [ownerContacts, setOwnerContacts] = useState<Record<string, any>>({});
  const [loadingProps, setLoadingProps] = useState(true);
  const [searching, setSearching] = useState(false);
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [pipelineStageMap, setPipelineStageMap] = useState<Record<string, string>>({});
  const [engagementFilter, setEngagementFilter] = useState<string>("all");
  const [campaignsExpanded, setCampaignsExpanded] = useState(true);
  const ownerRefreshRequestedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    setLoadingProps(true);
    supabase
      .from("properties" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) console.error("Error loading properties:", error);
        const props = data ?? [];
        setProperties(props);
        setLoadingProps(false);

        const ids = props.map((property: any) => property.id);
        if (ids.length === 0) return;

        supabase
          .from("owner_contacts" as any)
          .select("property_id, owner_name, phones, emails, traced_at")
          .eq("user_id", user.id)
          .in("property_id", ids)
          .then(({ data: contacts }) => {
            setOwnerContacts(
              Object.fromEntries((contacts ?? []).map((contact: any) => [contact.property_id, contact]))
            );
          });
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("saved_searches" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setSavedSearches(data ?? []));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .from("search_campaigns")
      .select("id, name, property_count, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }: any) => setCampaigns(data ?? []));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .from("pipeline_deals")
      .select("property_id, stage")
      .eq("user_id", user.id)
      .then(({ data }: any) => {
        const map: Record<string, string> = {};
        for (const deal of data ?? []) {
          map[deal.property_id] = deal.stage;
        }
        setPipelineStageMap(map);
      });
  }, [user]);

  useEffect(() => {
    const savedSearchId = searchParams.get("savedSearch");
    if (!savedSearchId || savedSearches.length === 0) return;

    const savedSearch = savedSearches.find((search) => search.id === savedSearchId);
    if (!savedSearch?.filters) return;

    setFilters(normalizeFilters(savedSearch.filters));
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("savedSearch");
    setSearchParams(nextParams, { replace: true });
  }, [savedSearches, searchParams, setSearchParams]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("properties-user")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "properties",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        if (payload.eventType === "INSERT") {
          setProperties((prev) => [payload.new as any, ...prev]);
        } else if (payload.eventType === "UPDATE") {
          setProperties((prev) => [payload.new as any, ...prev.filter((property) => property.id !== (payload.new as any).id)]);

          if ((payload.new as any).status === "complete") {
            const propertyId = (payload.new as any).id;
            supabase
              .from("owner_contacts" as any)
              .select("property_id, owner_name, phones, emails, traced_at")
              .eq("user_id", user.id)
              .eq("property_id", propertyId)
              .maybeSingle()
              .then(({ data: contact }) => {
                if (contact) {
                  setOwnerContacts((prev) => ({ ...prev, [propertyId]: contact }));
                }
              });
          }
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const campaignStats = useMemo(() => {
    const stats: Record<string, { total: number; contacted: number }> = {};
    for (const p of properties) {
      if (!p.campaign_id) continue;
      if (!stats[p.campaign_id]) stats[p.campaign_id] = { total: 0, contacted: 0 };
      stats[p.campaign_id].total++;
      const stage = pipelineStageMap[p.id];
      if (stage && stage !== "new") stats[p.campaign_id].contacted++;
    }
    return stats;
  }, [properties, pipelineStageMap]);

  const resolvedFilters = useMemo(() => withInferredSearchMode(filters), [filters]);
  const isPropertySearch = resolvedFilters.searchMode === "property";

  useEffect(() => {
    if (!user || properties.length === 0) return;

    const missingOwnerPropertyIds = properties
      .filter((property) => {
        if (property.address === "__no_results__" || property.address === "Search failed") return false;
        if (property.status === "searching" || property.status === "scoring") return false;

        const ownerName =
          ownerContacts[property.id]?.owner_name ||
          property.distress_details?.ownerName ||
          property.distress_details?.owner_name;
        const mortgageAmount = property.distress_details?.mortgage?.loanAmount;
        const deedBuyerName = property.distress_details?.deedBuyerName;
        const deedSellerName = property.distress_details?.deedSellerName;

        return (!ownerName || mortgageAmount === null || mortgageAmount === undefined || (property.last_sale_date && (!deedBuyerName || !deedSellerName))) &&
          !ownerRefreshRequestedRef.current.has(property.id);
      })
      .slice(0, 24)
      .map((property) => property.id);

    if (missingOwnerPropertyIds.length === 0) return;

    for (const propertyId of missingOwnerPropertyIds) {
      ownerRefreshRequestedRef.current.add(propertyId);
    }

    void supabase.functions.invoke("refresh-owner-basics", {
      body: { propertyIds: missingOwnerPropertyIds },
    }).then(({ error }) => {
      if (error) {
        for (const propertyId of missingOwnerPropertyIds) {
          ownerRefreshRequestedRef.current.delete(propertyId);
        }
        console.error("Failed to refresh owner basics:", error);
      }
    });
  }, [user, properties, ownerContacts]);

  const handleSearch = async () => {
    const nextFilters = withInferredSearchMode(filters);
    const nextIsPropertySearch = nextFilters.searchMode === "property";

    if (!nextFilters.location.trim()) {
      toast.error("Enter a ZIP code or exact property address.");
      return false;
    }

    setFilters(nextFilters);
    setSearching(true);

    try {
      const { data, error } = await supabase.functions.invoke("start-property-search", {
        body: {
          searchMode: nextFilters.searchMode,
          location: nextFilters.location,
          distressTypes: nextFilters.distressTypes,
          priceMin: nextFilters.priceMin,
          priceMax: nextFilters.priceMax,
          propertyTypes: nextFilters.propertyTypes.length > 0 ? nextFilters.propertyTypes : undefined,
          equityMin: nextFilters.equityMin,
        },
      });

      if (error || !data?.searchBatchId) {
        toast.error("Search failed. Please try again.");
        return false;
      }

      navigate(`/processing/${data.searchBatchId}`);
      return true;
    } catch {
      toast.error(nextIsPropertySearch ? "Property analysis failed. Please try again." : "Search failed. Please try again.");
      return false;
    } finally {
      setSearching(false);
    }
  };

  const handleSaveSearch = async () => {
    const nextFilters = withInferredSearchMode(filters);
    const nextIsPropertySearch = nextFilters.searchMode === "property";

    if (!user || !nextFilters.location.trim()) {
      toast.error("Set a ZIP code or exact address before saving.");
      return;
    }

    setFilters(nextFilters);

    const searchScopeLabel = nextIsPropertySearch
      ? "Exact Property"
      : nextFilters.distressTypes.join(", ") || "All Distress";
    const name = `${nextFilters.location} - ${searchScopeLabel}`;

    const { data, error } = await supabase
      .from("saved_searches" as any)
      .insert({ user_id: user.id, name, filters: nextFilters })
      .select()
      .single();

    if (error) {
      toast.error("Failed to save search.");
      return;
    }

    setSavedSearches((prev) => [data, ...prev]);
    toast.success("Search saved.");
  };

  const handleSkipTrace = async (propertyId: string, forceRefresh = false) => {
    const { data, error } = await supabase.functions.invoke("skip-trace", {
      body: { propertyId, forceRefresh },
    });
    if (error || !data?.ok) {
      const message = data?.code === "NO_CREDITS" ? "No skip trace credits remaining." : "Skip trace failed. Try again.";
      toast.error(message);
      return;
    }
    setOwnerContacts((prev) => ({ ...prev, [propertyId]: data.contact }));
    toast.success(data.cached ? "Contact info loaded." : "Owner contact found.");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) return null;

  const visibleProperties = properties.filter((property) => {
    if (property.address === "__no_results__") return false;
    const propertySearchMode = property.search_filters?.searchMode === "property" ? "property" : "market";
    if (propertySearchMode !== "property" && !hasSubstantiatedDistress(property)) return false;
    if (selectedCampaignId && property.campaign_id !== selectedCampaignId) return false;
    if (engagementFilter === "phone") {
      const contact = ownerContacts[property.id];
      if (!contact?.phones?.length) return false;
    } else if (engagementFilter === "email") {
      const contact = ownerContacts[property.id];
      if (!contact?.emails?.length) return false;
    } else if (engagementFilter === "in_pipeline") {
      if (!pipelineStageMap[property.id]) return false;
    } else if (engagementFilter === "not_contacted") {
      const stage = pipelineStageMap[property.id];
      if (stage && stage !== "new") return false;
    }
    return true;
  });
  const pendingCount = visibleProperties.filter((property) => property.status === "searching" || property.status === "scoring").length;
  const searchModeLabel = resolvedFilters.location.trim()
    ? isPropertySearch
      ? "Exact property"
      : "Market scan"
    : "Ready to search";
  const searchSummary = resolvedFilters.location.trim() || "ZIP code or exact address";
  const distressSummary = resolvedFilters.distressTypes.length > 0
    ? `${resolvedFilters.distressTypes.length} distress filter${resolvedFilters.distressTypes.length > 1 ? "s" : ""}`
    : isPropertySearch
    ? "Optional distress tags"
    : "All distress types";
  const propertyTypeSummary = resolvedFilters.propertyTypes.length > 0
    ? `${resolvedFilters.propertyTypes.length} property type${resolvedFilters.propertyTypes.length > 1 ? "s" : ""}`
    : "All property types";

  return (
    <div className="min-h-screen bg-background">
      <AppNav credits={profile?.credits} onSignOut={handleSignOut} />

      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-4 sm:py-6">
        <SearchFilters
          filters={resolvedFilters}
          onChange={(nextFilters) => setFilters(withInferredSearchMode(nextFilters))}
          onSearch={handleSearch}
          searching={searching}
          savedSearches={savedSearches}
          onSaveSearch={handleSaveSearch}
          onLoadSavedSearch={(saved) => setFilters(normalizeFilters(saved))}
          onSearchesChange={setSavedSearches}
        />

        {/* Campaign selector */}
        {campaigns.length > 0 && (
          <div className="rounded-2xl border border-border bg-card/70 p-4">
            <button
              className="flex items-center gap-2 text-sm font-medium text-foreground w-full"
              onClick={() => setCampaignsExpanded((v) => !v)}
            >
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              Search Campaigns
              <span className="ml-auto text-muted-foreground">
                {campaignsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            </button>
            {campaignsExpanded && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCampaignId(null)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    selectedCampaignId === null
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All Results
                </button>
                {campaigns.map((c) => {
                  const stats = campaignStats[c.id];
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCampaignId(c.id === selectedCampaignId ? null : c.id)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        selectedCampaignId === c.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {c.name}
                      {(stats?.total ?? c.property_count) > 0 && (
                        <span className="ml-1.5 opacity-60">{stats?.total ?? c.property_count}</span>
                      )}
                      {stats?.contacted > 0 && (
                        <span className="ml-1 text-emerald-400 opacity-80">· {stats.contacted} contacted</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Engagement filters */}
        <div className="flex flex-wrap gap-2 items-center">
          {[
            { key: "all", label: "All" },
            { key: "phone", label: "Phone available" },
            { key: "email", label: "Email available" },
            { key: "in_pipeline", label: "In pipeline" },
            { key: "not_contacted", label: "Not yet contacted" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setEngagementFilter(key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                engagementFilter === key
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card/70 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Deal Pipeline</p>
              <h2 className="mt-1 font-heading text-xl font-semibold text-foreground sm:text-2xl">
                {visibleProperties.length > 0 ? `${visibleProperties.length} Properties` : "No deals yet"}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[20rem]">{searchSummary}</span>
                </span>
                <span className="rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[11px]">
                  {searchModeLabel}
                </span>
                <span className="rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[11px]">
                  {distressSummary}
                </span>
                {!isPropertySearch && (
                  <span className="rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[11px]">
                    {propertyTypeSummary}
                  </span>
                )}
              </div>
            </div>

            {pendingCount > 0 && (
              <span className="inline-flex w-fit items-center rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs text-yellow-400">
                {pendingCount} analyzing...
              </span>
            )}
          </div>
        </div>

        {loadingProps ? (
          <div className="grid grid-cols-1 gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="space-y-3 rounded-xl border border-border bg-card p-5 animate-pulse">
                <div className="h-4 w-3/4 rounded bg-secondary" />
                <div className="h-3 w-1/2 rounded bg-secondary" />
                <div className="h-8 rounded bg-secondary" />
              </div>
            ))}
          </div>
        ) : visibleProperties.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-20 text-center">
            <Search className="mb-4 h-10 w-10 text-muted-foreground" />
            <h2 className="mb-2 font-heading text-xl font-semibold text-foreground">Start from the search bar above</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Enter a ZIP code for a market scan or paste a full address for a one-property analysis.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {visibleProperties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                ownerContact={ownerContacts[property.id] ?? null}
                onSkipTrace={handleSkipTrace}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DealSearch;
