import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";
import { trackEvent, trackSessionEnd, incrementPageCount } from "@/lib/analytics";

/**
 * Auto-tracks page views on every route change.
 * Also tracks session duration via beforeunload.
 * Place once in App.tsx inside BrowserRouter.
 */
export const usePageTracking = () => {
  const location = useLocation();
  const { user } = useAuth();
  const prevPath = useRef<string | null>(null);
  const userRef = useRef(user);
  userRef.current = user;

  // Track page views
  useEffect(() => {
    if (!user) return;
    if (prevPath.current === location.pathname) return;
    prevPath.current = location.pathname;

    incrementPageCount();
    trackEvent("page_view", user.id, {
      page: location.pathname,
      search: location.search,
    });
  }, [location.pathname, location.search, user]);

  // Track session end on tab close / navigate away
  useEffect(() => {
    const handleUnload = () => {
      if (userRef.current) {
        trackSessionEnd(userRef.current.id);
      }
    };

    // visibilitychange is more reliable on mobile
    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && userRef.current) {
        trackSessionEnd(userRef.current.id);
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);
};
