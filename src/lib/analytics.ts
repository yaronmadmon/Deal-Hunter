import { supabase } from "@/integrations/supabase/client";

// Generate a session ID that persists for the browser tab session
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem("analytics_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem("analytics_session_id", sessionId);
    sessionStorage.setItem("analytics_session_start", Date.now().toString());
    sessionStorage.setItem("analytics_page_count", "0");
  }
  return sessionId;
};

/** Get session start timestamp */
const getSessionStart = (): number => {
  const raw = sessionStorage.getItem("analytics_session_start");
  return raw ? parseInt(raw, 10) : Date.now();
};

/** Increment and return page count for this session */
export const incrementPageCount = (): number => {
  const count = parseInt(sessionStorage.getItem("analytics_page_count") || "0", 10) + 1;
  sessionStorage.setItem("analytics_page_count", count.toString());
  return count;
};

/** Get current session duration in seconds */
export const getSessionDuration = (): number => {
  return Math.round((Date.now() - getSessionStart()) / 1000);
};

/** Get page count */
export const getPageCount = (): number => {
  return parseInt(sessionStorage.getItem("analytics_page_count") || "0", 10);
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

/**
 * Send a session_end event. Uses fetch with keepalive for reliability on page unload.
 */
export const trackSessionEnd = (userId: string) => {
  const sessionId = sessionStorage.getItem("analytics_session_id");
  if (!sessionId) return;
  
  // Prevent duplicate session_end for the same session
  const endKey = `session_end_${sessionId}`;
  if (sessionStorage.getItem(endKey)) return;
  sessionStorage.setItem(endKey, "1");

  const duration = getSessionDuration();
  const pages = getPageCount();

  const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/analytics_events`;
  const payload = JSON.stringify({
    event_name: "session_end",
    user_id: userId,
    metadata: {
      session_id: sessionId,
      duration_seconds: duration,
      pages_viewed: pages,
      url: window.location.pathname,
      timestamp: new Date().toISOString(),
    },
  });

  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      Prefer: "return=minimal",
    },
    body: payload,
    keepalive: true,
  }).catch(() => {});
};
