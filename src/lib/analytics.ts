import { supabase } from "@/integrations/supabase/client";

// Generate a session ID that persists for the browser tab session
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem("analytics_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem("analytics_session_id", sessionId);
  }
  return sessionId;
};

/**
 * Log an analytics event. Fire-and-forget — never blocks UI.
 */
export const trackEvent = (
  eventName: string,
  userId?: string | null,
  metadata?: Record<string, any>
) => {
  if (!userId) return;
  const enriched = {
    ...(metadata ?? {}),
    session_id: getSessionId(),
    url: window.location.pathname,
    referrer: document.referrer || null,
    screen_width: window.innerWidth,
    user_agent: navigator.userAgent,
    timestamp: new Date().toISOString(),
  };
  supabase
    .from("analytics_events" as any)
    .insert({ event_name: eventName, user_id: userId, metadata: enriched })
    .then(({ error }) => {
      if (error) console.warn("[analytics]", error.message);
    });
};
