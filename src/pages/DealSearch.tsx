import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronDown, Loader2, Mail, Phone, Plus, Search, UserSearch, X } from "lucide-react";
import { toast } from "sonner";

import { AppNav } from "@/components/AppNav";
import { PropertyCard } from "@/components/deal/PropertyCard";
import { Filters, SearchFilters, withInferredSearchMode } from "@/components/deal/SearchFilters";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
      ? raw.distressTypes.filter((v): v is string => typeof v === "string")
      : [],
    propertyTypes: Array.isArray(raw?.propertyTypes)
      ? raw.propertyTypes.filter((v): v is string => typeof v === "string")
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

const relativeDate = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const VERDICT_GROUPS = [
  { key: "analyzing", label: "Analyzing",   colorClass: "text-yellow-400",        defaultExpanded: true  },
  { key: "strong",    label: "Strong Deal",  colorClass: "text-emerald-400",       defaultExpanded: true  },
  { key: "invest",    label: "Investigate",  colorClass: "text-amber-400",         defaultExpanded: true  },
  { key: "pass",      label: "Pass",         colorClass: "text-muted-foreground",  defaultExpanded: false },
];

const ENGAGEMENT_FILTERS = [
  { key: "all",           label: "All"           },
  { key: "phone",         label: "Phone"         },
  { key: "email",         label: "Email"         },
  { key: "in_pipeline",   label: "In pipeline"   },
  { key: "not_contacted", label: "Not contacted" },
];

const DealSearch = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading, profile } = useAuth();

  // Core data
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [properties, setProperties] = useState<any[]>([]);
  const [ownerContacts, setOwnerContacts] = useState<Record<string, any>>({});
  const [loadingProps, setLoadingProps] = useState(true);
  const [searching, setSearching] = useState(false);
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [pipelineStageMap, setPipelineStageMap] = useState<Record<string, string>>({});

  // UI state
  const [textSearch, setTextSearch] = useState("");
  const [sort, setSort] = useState<"score" | "equity" | "date">("score");
  const [engagementFilter, setEngagementFilter] = useState("all");
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    Object.fromEntries(VERDICT_GROUPS.map(g => [g.key, g.defaultExpanded]))
  );

  const autoSelectedRef = useRef(false);
  const ownerRefreshRequestedRef = useRef<Set<string>>(new Set());

  // Direct skip-trace (no property in DB required)
  const [quickLookup, setQuickLookup] = useState({ address: "", city: "", state: "", zip: "" });
  const [quickLookupLoading, setQuickLookupLoading] = useState(false);
  const [quickLookupResult, setQuickLookupResult] = useState<any>(null);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  // Load properties
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
        const ids = props.map((p: any) => p.id);
        if (ids.length === 0) return;
        supabase
          .from("owner_contacts" as any)
          .select("property_id, owner_name, phones, emails, traced_at")
          .eq("user_id", user.id)
          .in("property_id", ids)
          .then(({ data: contacts }) => {
            setOwnerContacts(Object.fromEntries((contacts ?? []).map((c: any) => [c.property_id, c])));
          });
      });
  }, [user]);

  // Load saved searches
  useEffect(() => {
    if (!user) return;
    supabase
      .from("saved_searches" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setSavedSearches(data ?? []));
  }, [user]);

  // Load campaigns — auto-select most recent
  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .from("search_campaigns")
      .select("id, name, property_count, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }: any) => {
        const list = data ?? [];
        setCampaigns(list);
        if (!autoSelectedRef.current) {
          autoSelectedRef.current = true;
          if (list.length > 0) {
            setSelectedCampaignId(list[0].id);
          } else {
            setShowSearchPanel(true);
          }
        }
      });
  }, [user]);

  // Load pipeline stage map
  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .from("pipeline_deals")
      .select("property_id, stage")
      .eq("user_id", user.id)
      .then(({ data }: any) => {
        const map: Record<string, string> = {};
        for (const deal of data ?? []) map[deal.property_id] = deal.stage;
        setPipelineStageMap(map);
      });
  }, [user]);

  // Apply saved search from URL param
  useEffect(() => {
    const savedSearchId = searchParams.get("savedSearch");
    if (!savedSearchId || savedSearches.length === 0) return;
    const saved = savedSearches.find(s => s.id === savedSearchId);
    if (!saved?.filters) return;
    setFilters(normalizeFilters(saved.filters));
    setShowSearchPanel(true);
    const next = new URLSearchParams(searchParams);
    next.delete("savedSearch");
    setSearchParams(next, { replace: true });
  }, [savedSearches, searchParams, setSearchParams]);

  // Realtime property updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("properties-user")
      .on("postgres_changes", { event: "*", schema: "public", table: "properties", filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          setProperties(prev => [payload.new as any, ...prev]);
        } else if (payload.eventType === "UPDATE") {
          setProperties(prev => [payload.new as any, ...prev.filter(p => p.id !== (payload.new as any).id)]);
          if ((payload.new as any).status === "complete") {
            const propertyId = (payload.new as any).id;
            supabase
              .from("owner_contacts" as any)
              .select("property_id, owner_name, phones, emails, traced_at")
              .eq("user_id", user.id)
              .eq("property_id", propertyId)
              .maybeSingle()
              .then(({ data: contact }) => {
                if (contact) setOwnerContacts(prev => ({ ...prev, [propertyId]: contact }));
              });
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Auto-refresh missing owner basics
  useEffect(() => {
    if (!user || properties.length === 0) return;
    const missing = properties
      .filter(p => {
        if (p.address === "__no_results__" || p.address === "Search failed") return false;
        if (p.status === "searching" || p.status === "scoring") return false;
        const ownerName = ownerContacts[p.id]?.owner_name || p.distress_details?.ownerName || p.distress_details?.owner_name;
        const mortgageAmount = p.distress_details?.mortgage?.loanAmount;
        return (!ownerName || mortgageAmount === null || mortgageAmount === undefined) && !ownerRefreshRequestedRef.current.has(p.id);
      })
      .slice(0, 24)
      .map(p => p.id);
    if (missing.length === 0) return;
    for (const id of missing) ownerRefreshRequestedRef.current.add(id);
    void supabase.functions.invoke("refresh-owner-basics", { body: { propertyIds: missing } })
      .then(({ error }) => {
        if (error) for (const id of missing) ownerRefreshRequestedRef.current.delete(id);
      });
  }, [user, properties, ownerContacts]);

  // Derived data
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

  const filteredAndSortedProperties = useMemo(() => {
    const q = textSearch.toLowerCase();
    return properties
      .filter(p => {
        if (p.address === "__no_results__") return false;
        const mode = p.search_filters?.searchMode === "property" ? "property" : "market";
        if (mode !== "property" && !hasSubstantiatedDistress(p)) return false;
        if (selectedCampaignId && p.campaign_id !== selectedCampaignId) return false;
        if (engagementFilter === "phone" && !ownerContacts[p.id]?.phones?.length) return false;
        if (engagementFilter === "email" && !ownerContacts[p.id]?.emails?.length) return false;
        if (engagementFilter === "in_pipeline" && !pipelineStageMap[p.id]) return false;
        if (engagementFilter === "not_contacted") {
          const stage = pipelineStageMap[p.id];
          if (stage && stage !== "new") return false;
        }
        if (q) {
          const ownerName = (ownerContacts[p.id]?.owner_name || p.distress_details?.ownerName || p.distress_details?.owner_name || "").toLowerCase();
          const addr = `${p.address ?? ""} ${p.city ?? ""} ${p.state ?? ""} ${p.zip ?? ""}`.toLowerCase();
          if (!addr.includes(q) && !ownerName.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sort === "score") return (b.deal_score ?? -1) - (a.deal_score ?? -1);
        if (sort === "equity") return (b.equity_pct ?? -1) - (a.equity_pct ?? -1);
        return new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime();
      });
  }, [properties, selectedCampaignId, engagementFilter, textSearch, sort, ownerContacts, pipelineStageMap]);

  const verdictGroups = useMemo(() => {
    const analyzing = filteredAndSortedProperties.filter(p => ["searching", "scoring"].includes(p.status));
    const strong     = filteredAndSortedProperties.filter(p => p.deal_verdict === "Strong Deal");
    const invest     = filteredAndSortedProperties.filter(p => p.deal_verdict === "Investigate");
    const pass       = filteredAndSortedProperties.filter(p => p.deal_verdict === "Pass");
    return [
      analyzing.length > 0 ? { key: "analyzing", props: analyzing } : null,
      strong.length > 0    ? { key: "strong",    props: strong    } : null,
      invest.length > 0    ? { key: "invest",    props: invest    } : null,
      pass.length > 0      ? { key: "pass",      props: pass      } : null,
    ].filter(Boolean) as Array<{ key: string; props: any[] }>;
  }, [filteredAndSortedProperties]);

  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId) ?? null;
  const pendingCount = filteredAndSortedProperties.filter(p => ["searching", "scoring"].includes(p.status)).length;

  // Handlers
  const handleSearch = async () => {
    const next = withInferredSearchMode(filters);
    if (!next.location.trim()) { toast.error("Enter a ZIP code or exact property address."); return false; }
    setFilters(next);
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("start-property-search", {
        body: {
          searchMode: next.searchMode,
          location: next.location,
          distressTypes: next.distressTypes,
          priceMin: next.priceMin,
          priceMax: next.priceMax,
          propertyTypes: next.propertyTypes.length > 0 ? next.propertyTypes : undefined,
          equityMin: next.equityMin,
        },
      });
      if (error || !data?.searchBatchId) { toast.error("Search failed. Please try again."); return false; }
      navigate(`/processing/${data.searchBatchId}`);
      return true;
    } catch {
      toast.error(next.searchMode === "property" ? "Property analysis failed." : "Search failed. Please try again.");
      return false;
    } finally {
      setSearching(false);
    }
  };

  const handleSaveSearch = async () => {
    const next = withInferredSearchMode(filters);
    if (!user || !next.location.trim()) { toast.error("Set a location before saving."); return; }
    setFilters(next);
    const name = `${next.location} — ${next.distressTypes.join(", ") || "All Distress"}`;
    const { data, error } = await supabase
      .from("saved_searches" as any)
      .insert({ user_id: user.id, name, filters: next })
      .select()
      .single();
    if (error) { toast.error("Failed to save search."); return; }
    setSavedSearches(prev => [data, ...prev]);
    toast.success("Search saved.");
  };

  const handleSkipTrace = async (propertyId: string, forceRefresh = false) => {
    const { data, error } = await supabase.functions.invoke("skip-trace", { body: { propertyId, forceRefresh } });
    if (error || !data?.ok) {
      toast.error(data?.code === "NO_CREDITS" ? "No skip trace credits remaining." : "Skip trace failed. Try again.");
      return;
    }
    setOwnerContacts(prev => ({ ...prev, [propertyId]: data.contact }));
    toast.success(data.cached ? "Contact info loaded." : "Owner contact found.");
  };

  const handleQuickSkipTrace = async () => {
    if (!quickLookup.address.trim()) { toast.error("Enter an address."); return; }
    setQuickLookupLoading(true);
    setQuickLookupResult(null);
    const { data, error } = await supabase.functions.invoke("skip-trace", {
      body: { address: quickLookup.address, city: quickLookup.city, state: quickLookup.state, zip: quickLookup.zip },
    });
    setQuickLookupLoading(false);
    if (error || !data?.ok) {
      toast.error(data?.code === "NO_CREDITS" ? "No skip trace credits remaining." : "Skip trace failed. Try again.");
      return;
    }
    setQuickLookupResult(data.contact);
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); navigate("/"); };

  const toggleSection = (key: string) =>
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const selectCampaign = (id: string) => {
    setSelectedCampaignId(id);
    setShowSearchPanel(false);
    setTextSearch("");
  };

  if (loading) return null;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <AppNav credits={profile?.credits} onSignOut={handleSignOut} />

      <div className="flex flex-1 min-h-0">

        {/* ── Sidebar (desktop) ── */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-border bg-card/30">
          {/* New Search button */}
          <div className="p-3 border-b border-border shrink-0">
            <button
              onClick={() => setShowSearchPanel(v => !v)}
              className={`w-full flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                showSearchPanel
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-dashed border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              New Search
            </button>
          </div>

          {/* Campaign list */}
          <div className="flex-1 overflow-y-auto">
            <p className="px-4 pt-4 pb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
              Searches
            </p>
            {campaigns.map(c => {
              const stats = campaignStats[c.id];
              const total = stats?.total ?? c.property_count;
              const contacted = stats?.contacted ?? 0;
              return (
                <button
                  key={c.id}
                  onClick={() => selectCampaign(c.id)}
                  className={`w-full text-left px-4 py-3 border-l-2 transition-colors hover:bg-secondary/40 ${
                    selectedCampaignId === c.id && !showSearchPanel
                      ? "border-primary bg-secondary/30"
                      : "border-transparent"
                  }`}
                >
                  <p className="text-sm font-medium text-foreground truncate leading-snug">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <span>{total} props</span>
                    {contacted > 0 && (
                      <span className="text-emerald-400">· {contacted} contacted</span>
                    )}
                  </p>
                </button>
              );
            })}
            {campaigns.length === 0 && (
              <p className="px-4 py-8 text-xs text-muted-foreground text-center leading-relaxed">
                No searches yet.<br />Run your first search above.
              </p>
            )}
          </div>

          {/* Quick Owner Lookup */}
          <div className="border-t border-border p-3 shrink-0">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
              <UserSearch className="h-3 w-3" />Quick Owner Lookup
            </p>
            <div className="space-y-1.5">
              <input
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Address"
                value={quickLookup.address}
                onChange={e => setQuickLookup(p => ({ ...p, address: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && handleQuickSkipTrace()}
              />
              <div className="flex gap-1.5">
                <input
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="City"
                  value={quickLookup.city}
                  onChange={e => setQuickLookup(p => ({ ...p, city: e.target.value }))}
                />
                <input
                  className="w-16 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="State"
                  value={quickLookup.state}
                  onChange={e => setQuickLookup(p => ({ ...p, state: e.target.value }))}
                />
              </div>
              <input
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="ZIP (optional)"
                value={quickLookup.zip}
                onChange={e => setQuickLookup(p => ({ ...p, zip: e.target.value }))}
              />
              <button
                onClick={handleQuickSkipTrace}
                disabled={quickLookupLoading}
                className="w-full flex items-center justify-center gap-1.5 rounded-md bg-foreground text-background text-xs font-medium py-1.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {quickLookupLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                {quickLookupLoading ? "Looking up…" : "Find Owner"}
              </button>
            </div>

            {/* Result */}
            {quickLookupResult && (
              <div className="mt-2 rounded-lg border border-border bg-secondary/30 p-2.5 space-y-1.5">
                {quickLookupResult.ownerName && (
                  <p className="text-xs font-semibold text-foreground">{quickLookupResult.ownerName}</p>
                )}
                {(quickLookupResult.phones ?? []).slice(0, 3).map((ph: any, i: number) => (
                  <a key={i} href={`tel:${ph.number}`} className="flex items-center gap-1.5 text-xs text-foreground hover:text-primary">
                    <Phone className="h-3 w-3 text-muted-foreground" />{ph.number}{ph.type ? ` · ${ph.type}` : ""}
                  </a>
                ))}
                {(quickLookupResult.emails ?? []).slice(0, 2).map((em: any, i: number) => (
                  <a key={i} href={`mailto:${em.address}`} className="flex items-center gap-1.5 text-xs text-foreground hover:text-primary truncate">
                    <Mail className="h-3 w-3 text-muted-foreground" />{em.address}
                  </a>
                ))}
                {!quickLookupResult.hit && (
                  <p className="text-xs text-muted-foreground">No contact info found.</p>
                )}
                <button onClick={() => setQuickLookupResult(null)} className="text-[10px] text-muted-foreground hover:text-foreground">Clear</button>
              </div>
            )}
          </div>
        </aside>

        {/* ── Main content ── */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

          {/* Mobile: campaign scroll + new button */}
          <div className="lg:hidden overflow-x-auto border-b border-border bg-card/40 py-3 px-4 flex gap-2 shrink-0 items-center">
            <button
              onClick={() => setShowSearchPanel(v => !v)}
              className={`shrink-0 h-7 rounded-full border px-3 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                showSearchPanel ? "border-primary bg-primary/10 text-primary" : "border-dashed border-border text-muted-foreground"
              }`}
            >
              <Plus className="h-3 w-3" />New
            </button>
            {campaigns.map(c => (
              <button
                key={c.id}
                onClick={() => selectCampaign(c.id)}
                className={`shrink-0 h-7 rounded-full border px-3 text-xs font-medium transition-colors ${
                  selectedCampaignId === c.id && !showSearchPanel
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary text-muted-foreground"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Search panel */}
          {showSearchPanel && (
            <div className="border-b border-border bg-card/60 shrink-0 overflow-y-auto max-h-[55vh]">
              <div className="p-4 lg:p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-foreground">New Search</p>
                  {campaigns.length > 0 && (
                    <button
                      onClick={() => setShowSearchPanel(false)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />Close
                    </button>
                  )}
                </div>
                <SearchFilters
                  filters={resolvedFilters}
                  onChange={next => setFilters(withInferredSearchMode(next))}
                  onSearch={handleSearch}
                  searching={searching}
                  savedSearches={savedSearches}
                  onSaveSearch={handleSaveSearch}
                  onLoadSavedSearch={saved => setFilters(normalizeFilters(saved))}
                  onSearchesChange={setSavedSearches}
                />
              </div>
            </div>
          )}

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            {selectedCampaign ? (
              <div className="p-4 lg:p-6 space-y-5 max-w-4xl">

                {/* Campaign header */}
                <div>
                  <h1 className="text-xl font-semibold text-foreground leading-tight">{selectedCampaign.name}</h1>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {relativeDate(selectedCampaign.created_at)} · {filteredAndSortedProperties.length} properties
                  </p>
                </div>

                {/* Controls row */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Text search */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      className="pl-8 pr-8 h-8 text-sm bg-secondary border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary w-48 placeholder:text-muted-foreground text-foreground"
                      placeholder="Search address, owner…"
                      value={textSearch}
                      onChange={e => setTextSearch(e.target.value)}
                    />
                    {textSearch && (
                      <button onClick={() => setTextSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Sort */}
                  <Select value={sort} onValueChange={v => setSort(v as any)}>
                    <SelectTrigger className="h-8 text-xs w-32 bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="score">Best Score</SelectItem>
                      <SelectItem value="equity">Most Equity</SelectItem>
                      <SelectItem value="date">Newest</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="h-5 w-px bg-border" />

                  {/* Engagement filters */}
                  {ENGAGEMENT_FILTERS.map(f => (
                    <button
                      key={f.key}
                      onClick={() => setEngagementFilter(f.key)}
                      className={`h-8 rounded-full border px-3 text-xs font-medium transition-colors ${
                        engagementFilter === f.key
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Analyzing badge */}
                {pendingCount > 0 && (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs text-yellow-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {pendingCount} still analyzing…
                  </div>
                )}

                {/* Results */}
                {loadingProps ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-32 rounded-xl border border-border bg-card animate-pulse" />
                    ))}
                  </div>
                ) : filteredAndSortedProperties.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
                    <Search className="h-8 w-8 text-muted-foreground mb-3 opacity-40" />
                    <p className="text-sm font-medium text-foreground">No properties match your filters</p>
                    {textSearch && (
                      <button onClick={() => setTextSearch("")} className="mt-2 text-xs text-primary hover:underline">
                        Clear search
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {verdictGroups.map(({ key, props: groupProps }) => {
                      const meta = VERDICT_GROUPS.find(g => g.key === key)!;
                      const expanded = expandedSections[key] ?? meta.defaultExpanded;
                      return (
                        <div key={key}>
                          <button
                            className="flex items-center gap-2 w-full py-1.5 mb-2 group"
                            onClick={() => toggleSection(key)}
                          >
                            <span className={`text-sm font-semibold ${meta.colorClass}`}>{meta.label}</span>
                            <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded bg-secondary ${meta.colorClass}`}>
                              {groupProps.length}
                            </span>
                            <ChevronDown
                              className={`h-3.5 w-3.5 ml-auto text-muted-foreground transition-transform duration-150 ${
                                expanded ? "" : "-rotate-90"
                              }`}
                            />
                          </button>
                          {expanded && (
                            <div className="grid grid-cols-1 gap-3">
                              {groupProps.map(property => (
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
                      );
                    })}
                  </div>
                )}
              </div>
            ) : !showSearchPanel ? (
              /* Empty state — no campaign selected */
              <div className="flex flex-col items-center justify-center h-full py-24 text-center px-6">
                <div className="h-14 w-14 rounded-2xl bg-secondary flex items-center justify-center mb-5">
                  <Search className="h-6 w-6 text-muted-foreground opacity-60" />
                </div>
                <h2 className="text-base font-semibold text-foreground">Start your first search</h2>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-xs">
                  Enter a ZIP code or city to find distressed properties in any market.
                </p>
                <Button className="mt-5" onClick={() => setShowSearchPanel(true)}>
                  <Plus className="h-4 w-4 mr-2" />New Search
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DealSearch;
