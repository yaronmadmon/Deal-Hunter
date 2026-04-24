import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { SearchFilters, Filters } from "@/components/deal/SearchFilters";
import { PropertyCard } from "@/components/deal/PropertyCard";
import { toast } from "sonner";
import { Search } from "lucide-react";

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
  const [ownerContacts, setOwnerContacts] = useState<Record<string, any>>({});
  const [loadingProps, setLoadingProps] = useState(true);
  const [searching, setSearching] = useState(false);
  const [savedSearches, setSavedSearches] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  // Load existing properties + bulk-fetch owner contacts
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
        const props = data ?? [];
        setProperties(props);
        setLoadingProps(false);

        const ids = props.map((p: any) => p.id);
        if (ids.length > 0) {
          supabase
            .from("owner_contacts" as any)
            .select("property_id, owner_name, phones, emails, traced_at")
            .eq("user_id", user.id)
            .in("property_id", ids)
            .then(({ data: contacts }) => {
              setOwnerContacts(
                Object.fromEntries((contacts ?? []).map((c: any) => [c.property_id, c]))
              );
            });
        }
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

  // Realtime: watch for new/updated properties for this user
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
          setProperties((prev) =>
            prev.map((p) => (p.id === (payload.new as any).id ? payload.new : p))
          );
          if ((payload.new as any).status === "complete") {
            const propId = (payload.new as any).id;
            supabase
              .from("owner_contacts" as any)
              .select("property_id, owner_name, phones, emails, traced_at")
              .eq("user_id", user.id)
              .eq("property_id", propId)
              .maybeSingle()
              .then(({ data: contact }) => {
                if (contact) {
                  setOwnerContacts((prev) => ({ ...prev, [propId]: contact }));
                }
              });
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleSearch = async () => {
    if (!filters.location.trim()) {
      toast.error("Enter a location to search.");
      return;
    }
    if (filters.distressTypes.length === 0) {
      toast.error("Select at least one distress type.");
      return;
    }
    setSearching(true);
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
      if (error || !data?.searchBatchId) {
        toast.error("Search failed. Please try again.");
        return;
      }
      navigate(`/processing/${data.searchBatchId}`);
    } catch {
      toast.error("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleSaveSearch = async () => {
    if (!user || !filters.location) {
      toast.error("Set a location before saving.");
      return;
    }
    const name = `${filters.location} — ${filters.distressTypes.join(", ") || "All"}`;
    const { data, error } = await supabase
      .from("saved_searches" as any)
      .insert({ user_id: user.id, name, filters })
      .select()
      .single();
    if (error) { toast.error("Failed to save search."); return; }
    setSavedSearches((prev) => [data, ...prev]);
    toast.success("Search saved!");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) return null;

  const pendingCount = properties.filter((p) => p.status === "searching" || p.status === "scoring").length;

  return (
    <div className="min-h-screen bg-background">
      <AppNav credits={profile?.credits} onSignOut={handleSignOut} />

      <div className="flex max-w-7xl mx-auto px-4 py-6 gap-6">
        {/* Left sidebar */}
        <aside className="w-72 shrink-0">
          <div className="sticky top-[72px] rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-5">
              <Search className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-foreground">Find Deals</h2>
            </div>
            <SearchFilters
              filters={filters}
              onChange={setFilters}
              onSearch={handleSearch}
              searching={searching}
              savedSearches={savedSearches}
              onSaveSearch={handleSaveSearch}
              onLoadSavedSearch={(f) => setFilters(f)}
              onSearchesChange={setSavedSearches}
            />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-heading text-xl font-bold text-foreground">
              {properties.length > 0 ? `${properties.length} Properties` : "Deal Search"}
            </h1>
            {pendingCount > 0 && (
              <span className="text-xs rounded-full border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 px-3 py-1">
                {pendingCount} analyzing…
              </span>
            )}
          </div>

          {loadingProps ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3 animate-pulse">
                  <div className="h-4 bg-secondary rounded w-3/4" />
                  <div className="h-3 bg-secondary rounded w-1/2" />
                  <div className="h-8 bg-secondary rounded" />
                </div>
              ))}
            </div>
          ) : properties.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Search className="h-10 w-10 text-muted-foreground mb-4" />
              <h2 className="font-heading text-xl font-semibold text-foreground mb-2">No deals yet</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Enter a location, select distress types, and hit Search to find your first deals.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {properties.map((p) => (
                <PropertyCard key={p.id} property={p} ownerContact={ownerContacts[p.id] ?? null} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default DealSearch;
