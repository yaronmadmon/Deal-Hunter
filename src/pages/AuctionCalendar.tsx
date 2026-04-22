import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Gavel, ExternalLink, Plus } from "lucide-react";
import { toast } from "sonner";

interface Auction {
  id: string;
  address?: string;
  auction_date?: string;
  starting_bid?: number;
  auction_type?: string;
  county?: string;
  source_url?: string;
  trustee?: string;
}

const AuctionCalendar = () => {
  const navigate = useNavigate();
  const { user, loading, profile } = useAuth();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loadingAuctions, setLoadingAuctions] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("live_feed_snapshots" as any)
      .select("*")
      .ilike("section_name", "auctions_%")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        const parsed: Auction[] = [];
        for (const row of data ?? []) {
          const items = row.data?.items ?? row.data ?? [];
          if (Array.isArray(items)) parsed.push(...items);
          else if (typeof items === "object") parsed.push(items);
        }
        setAuctions(parsed);
        setLoadingAuctions(false);
      });
  }, [user]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleAddToPipeline = async (auction: Auction) => {
    if (!user) return;
    const { error } = await supabase
      .from("properties" as any)
      .insert({
        user_id: user.id,
        address: auction.address ?? "Unknown address",
        city: auction.county ?? "",
        state: "",
        zip: "",
        distress_types: [auction.auction_type === "tax deed" ? "tax_lien" : "foreclosure"],
        status: "complete",
        deal_verdict: "Investigate",
        deal_score: 50,
      });
    if (error) { toast.error("Failed to add to pipeline."); return; }
    toast.success("Added to Deal Search.");
    navigate("/dashboard");
  };

  if (loading) return null;

  const grouped = auctions.reduce<Record<string, Auction[]>>((acc, a) => {
    const key = a.county ?? "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <AppNav credits={profile?.credits} onSignOut={handleSignOut} />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Gavel className="h-5 w-5 text-primary" />
            <h1 className="font-heading text-2xl font-bold text-foreground">Auction Calendar</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Upcoming foreclosure, sheriff sale, and tax deed auctions. Refreshed daily.
          </p>
        </div>

        {loadingAuctions ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse h-20" />
            ))}
          </div>
        ) : auctions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Gavel className="h-10 w-10 text-muted-foreground mb-4" />
            <h2 className="font-heading text-xl font-semibold text-foreground mb-2">No auctions loaded yet</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Auction data is refreshed daily. Check back soon, or contact support to add your target counties.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([county, items]) => (
              <div key={county}>
                <h2 className="font-semibold text-foreground mb-3 text-sm uppercase tracking-wider">{county}</h2>
                <div className="space-y-3">
                  {items.map((auction, i) => (
                    <div key={i} className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground text-sm">{auction.address ?? "Address TBD"}</p>
                          {auction.auction_type && (
                            <span className="text-xs rounded-full border border-border bg-secondary px-2 py-0.5 text-muted-foreground capitalize">
                              {auction.auction_type}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          {auction.auction_date && <span>Date: {new Date(auction.auction_date).toLocaleDateString()}</span>}
                          {auction.starting_bid && (
                            <span>Starting bid: <span className="text-foreground font-medium">${auction.starting_bid.toLocaleString()}</span></span>
                          )}
                          {auction.trustee && <span>Trustee: {auction.trustee}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {auction.source_url && (
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => window.open(auction.source_url, "_blank")}>
                            <ExternalLink className="h-3 w-3 mr-1" />Source
                          </Button>
                        )}
                        <Button size="sm" className="text-xs" onClick={() => handleAddToPipeline(auction)}>
                          <Plus className="h-3 w-3 mr-1" />Add Deal
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AuctionCalendar;
