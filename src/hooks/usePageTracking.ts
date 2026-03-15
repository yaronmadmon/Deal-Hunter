import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";
import { trackEvent } from "@/lib/analytics";

/**
 * Auto-tracks page views on every route change.
 * Place once in App.tsx inside BrowserRouter.
 */
export const usePageTracking = () => {
  const location = useLocation();
  const { user } = useAuth();
  const prevPath = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // Avoid duplicate fires for the same path
    if (prevPath.current === location.pathname) return;
    prevPath.current = location.pathname;

    trackEvent("page_view", user.id, {
      page: location.pathname,
      search: location.search,
    });
  }, [location.pathname, location.search, user]);
};
