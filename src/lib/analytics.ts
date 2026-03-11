import { supabase } from "@/integrations/supabase/client";

/**
 * Log an analytics event. Fire-and-forget — never blocks UI.
 */
export const trackEvent = (
  eventName: string,
  userId?: string | null,
  metadata?: Record<string, any>
) => {
  if (!userId) return;
  supabase
    .from("analytics_events" as any)
    .insert({ event_name: eventName, user_id: userId, metadata: metadata ?? {} })
    .then(({ error }) => {
      if (error) console.warn("[analytics]", error.message);
    });
};
