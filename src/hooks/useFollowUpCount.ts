import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const useFollowUpCount = (): number => {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!user) { setCount(0); return; }
    const { count: n } = await (supabase as any)
      .from("pipeline_deals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("stage", ["contacted", "follow_up", "negotiating"])
      .lt("follow_up_at", new Date().toISOString())
      .not("follow_up_at", "is", null);
    setCount(n ?? 0);
  }, [user]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    if (!user) return;
    const channel = (supabase as any)
      .channel("followup-badge-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pipeline_deals", filter: `user_id=eq.${user.id}` },
        () => fetchCount()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchCount]);

  return count;
};
