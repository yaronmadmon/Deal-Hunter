import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { trackEvent } from "@/lib/analytics";
import { getTierByPriceId, getTierByProductId, type SubscriptionTier } from "@/lib/subscriptionTiers";

export interface SubscriptionInfo {
  subscribed: boolean;
  tier: SubscriptionTier;
  subscriptionEnd: string | null;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionInfo>({
    subscribed: false,
    tier: "free",
    subscriptionEnd: null,
  });
  const [subLoading, setSubLoading] = useState(false);

  const checkSubscription = useCallback(async () => {
    try {
      setSubLoading(true);
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error || !data) return;
      setSubscription({
        subscribed: data.subscribed ?? false,
        tier: data.tier ?? (data.product_id ? getTierByProductId(data.product_id) : data.price_id ? getTierByPriceId(data.price_id) : "free"),
        subscriptionEnd: data.subscription_end ?? null,
      });
    } catch {
      // silent fail
    } finally {
      setSubLoading(false);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (event === "SIGNED_IN" && session?.user) {
          // Check subscription after sign in
          setTimeout(() => checkSubscription(), 500);

          const welcomeKey = `welcome_email_sent_${session.user.id}`;
          const createdAt = new Date(session.user.created_at).getTime();
          const now = Date.now();
          if (now - createdAt < 60_000 && !localStorage.getItem(welcomeKey)) {
            localStorage.setItem(welcomeKey, "true");
            trackEvent("user_signup", session.user.id, { email: session.user.email });
            supabase.functions.invoke("send-transactional-email", {
              body: {
                type: "welcome",
                to: session.user.email,
                data: { credits: 2, appUrl: window.location.origin },
              },
            }).catch(() => {});
          }
        }

        if (event === "SIGNED_OUT") {
          setSubscription({ subscribed: false, tier: "free", subscriptionEnd: null });
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        checkSubscription();
      }
    });

    return () => authSub.unsubscribe();
  }, [checkSubscription]);

  // Periodic refresh every 60s
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(checkSubscription, 60_000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    return { error, needsEmailConfirmation: !data.session };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, session, loading, signUp, signIn, signOut, subscription, subLoading, checkSubscription };
};
