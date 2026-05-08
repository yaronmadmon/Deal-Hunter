import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useInboxCount(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetch = async () => {
      const { count: c } = await (supabase as any)
        .from("sms_threads")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gt("unread_count", 0);
      setCount(c ?? 0);
    };

    fetch();

    const channel = (supabase as any)
      .channel("inbox-count")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "sms_threads",
        filter: `user_id=eq.${user.id}`,
      }, () => { fetch(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return count;
}
