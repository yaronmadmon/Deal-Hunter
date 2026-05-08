import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const useMeetingCount = (): number => {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!user) { setCount(0); return; }
    const { count: n } = await (supabase as any)
      .from("meetings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "pending");
    setCount(n ?? 0);
  }, [user]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    if (!user) return;
    const channel = (supabase as any)
      .channel("meeting-badge-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meetings", filter: `user_id=eq.${user.id}` },
        () => fetchCount()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchCount]);

  return count;
};
