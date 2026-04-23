import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { SearchFilters, Filters } from "@/components/deal/SearchFilters";
import { PropertyCard } from "@/components/deal/PropertyCard";
import { toast } from "sonner";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DEFAULT_FILTERS: Filters = {
  location: "",
  distressTypes: [],
  propertyTypes: [],
};

const DealSearch = () => {
  const navigate = useNavigate();
  const { user, loading, profile } = useAuth();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [properties, setProperties] = useState<any[]>([]);
  const [loadingProps, setLoadingProps] = useState(true);
  const [searching, setSearching] = useState(false);
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) console.error("Error loading properties:", error);
        setProperties(data ?? []);
        setLoadingProps(false);
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
    const channel = supabase
      .channel("properties-user")
      .on("postgres_changes", { event: "*", schema: "public", table: "properties", filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          setProperties(prev => [payload.new as any, ...prev]);
        } else if (payload.eventType === "UPDATE") {
          setProperties(prev => prev.map(p => p.id === (payload.new as any).id ? payload.new : p));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleSearch = async () => {
    if (!filters.location.trim()) { toast.error("Enter a location to search."); return; }
    if (filters.distressTypes.length === 0) { toast.error("Select at least one distress type."); return; }
    setSearching(true);
    setSidebarOpen(false);
    try {
      const { data, error } = await supabase.functions.invoke("start-property-search", {
        body: {
          location: filters.location,
          distressTypes: filters.distressTypes,
          priceMin: filters.priceMin,
          priceMax: filters.priceMax,
          propertyTypes: filters.propertyTypes.length > 0 ? filters.propertyTypes : undefined,
          equityMin: filters.equityMin,
        },
      });
      if (error || !data?.searchBatchId) { toast.error("Search failed. Please try again."); return; }
      navigate(`/processing/${data.searchBatchId}`);
    } catch {
      toast.error("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleSaveSearch = async () => {
    if (!user || !filters.location) { toast.error("Set a location before saving."); return; }
    const name = `${filters.location} — ${filters.distressTypes.join(", ") || "All"}`;
    const { data, error } = await supabase
      .from("saved_searches" as any)
      .insert({ user_id: user.id, name, filters })
      .select()
      .single();
    if (error) { toast.error("Failed to save search."); return; }
    setSavedSearches(prev => [data, ...prev]);
    toast.success("Search saved!");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) return null;

  const pendingCount = properties.filter(p => p.status === "searching" || p.status === "scoring").length;

  return (
    <div className="min-h-screen bg-background">
      <AppNav credits={profile?.credits} onSignOut={handleSignOut} />

      {/* Mobile filter overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Mobile filter drawer */}
      <div className={`fixed top-0 left-0 z-50 h-full w-80 border-r border-border bg-background p-5 transition-transform duration-300 lg:hidden overflow-y-auto ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-heading font-semibold text-foreground">Find Deals</h2>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <SearchFilters
          filters={filters}
          onChange={setFilters}
          onSearch={handleSearch}
          searching={searching}
          savedSearches={savedSearches}
          onSaveSearch={handleSaveSearch}
          onLoadSavedSearch={f => { setFilters(f); setSidebarOpen(false); }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <div className="flex gap-6">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block w-64 xl:w-72 shrink-0">
            <div className="sticky top-[61px] rounded-xl border border-border bg-card p-5">
              <h2 className="font-heading text-sm font-semibold text-foreground mb-4">Find Deals</h2>
              <SearchFilters
                filters={filters}
                onChange={setFilters}
                onSearch={handleSearch}
                searching={searching}
                savedSearches={savedSearches}
                onSaveSearch={handleSaveSearch}
                onLoadSavedSearch={setFilters}
              />
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-5 gap-3">
              <div>
                <h1 className="font-heading text-lg font-bold text-foreground">
                  {properties.length > 0 ? `${properties.length} Properties` : "Deal Search"}
                </h1>
                {pendingCount > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{pendingCount} analyzing…</p>
                )}
              </div>
              {/* Mobile filter button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden gap-1.5 shrink-0"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
              </Button>
            </div>

            {/* States */}
            {loadingProps ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card overflow-hidden animate-pulse">
                    <div className="p-4 space-y-3">
                      <div className="flex justify-between gap-3">
                        <div className="space-y-1.5 flex-1">
                          <div className="h-4 bg-secondary rounded w-3/4" />
                          <div className="h-3 bg-secondary rounded w-1/2" />
                        </div>
                        <div className="h-10 w-12 bg-secondary rounded-lg" />
                      </div>
                      <div className="flex gap-1.5">
                        <div className="h-5 w-16 bg-secondary rounded-full" />
                        <div className="h-5 w-20 bg-secondary rounded-full" />
                      </div>
                      <div className="h-2 bg-secondary rounded-full w-full" />
                    </div>
                    <div className="border-t border-border h-10 bg-secondary/30" />
                  </div>
                ))}
              </div>
            ) : properties.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card">
                  <Search className="h-7 w-7 text-muted-foreground" />
                </div>
                <h2 className="font-heading text-xl font-semibold text-foreground mb-2">No deals yet</h2>
                <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                  Enter a location, pick your distress types, and search to find your first deals.
                </p>
                <Button className="mt-6 gap-2" onClick={() => setSidebarOpen(true)}>
                  <Search className="h-4 w-4" /> Start Searching
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {properties.map(p => <PropertyCard key={p.id} property={p} />)}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default DealSearch;
