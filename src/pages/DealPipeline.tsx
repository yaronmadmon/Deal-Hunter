import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { KanbanColumn } from "@/components/deal/KanbanColumn";
import { toast } from "sonner";

const KANBAN_COLUMNS = [
  { stage: "new", title: "New Lead" },
  { stage: "contacted", title: "Contacted" },
  { stage: "follow_up", title: "Follow-up" },
  { stage: "negotiating", title: "Negotiating" },
  { stage: "under_contract", title: "Under Contract" },
  { stage: "won", title: "Won" },
  { stage: "dead", title: "Dead" },
];

const DealPipeline = () => {
  const navigate = useNavigate();
  const { user, loading, profile } = useAuth();
  const [deals, setDeals] = useState<any[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("pipeline_deals" as any)
      .select("*, properties(id, address, city, state, deal_score, deal_verdict, distress_types)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error("Error loading pipeline:", error);
        setDeals(data ?? []);
        setLoadingDeals(false);
      });
  }, [user]);

  const handleStageChange = async (dealId: string, stage: string) => {
    const prevDeals = deals;
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage } : d)));
    const { error } = await supabase
      .from("pipeline_deals" as any)
      .update({ stage })
      .eq("id", dealId);
    if (error) {
      setDeals(prevDeals);
      toast.error("Failed to update stage.");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background">
      <AppNav credits={profile?.credits} onSignOut={handleSignOut} />

      <main className="px-4 py-6">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold text-foreground">Deal Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {deals.length} deal{deals.length !== 1 ? "s" : ""} tracked
          </p>
        </div>

        {loadingDeals ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {KANBAN_COLUMNS.map((col) => (
              <div key={col.stage} className="min-w-[240px] w-60 rounded-xl border border-border bg-card p-4 space-y-3 animate-pulse">
                <div className="h-4 bg-secondary rounded w-24" />
                <div className="h-24 bg-secondary rounded-xl" />
              </div>
            ))}
          </div>
        ) : deals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-muted-foreground text-sm">No deals in your pipeline yet.</p>
            <button className="mt-4 text-sm text-primary underline" onClick={() => navigate("/dashboard")}>
              Find deals to add
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {KANBAN_COLUMNS.map((col) => (
                <KanbanColumn
                  key={col.stage}
                  title={col.title}
                  stage={col.stage}
                  deals={deals.filter((d) => d.stage === col.stage)}
                  onStageChange={handleStageChange}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DealPipeline;
