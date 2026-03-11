import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { trackEvent } from "@/lib/analytics";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Fire-and-forget: track signup + send welcome email
        if (event === "SIGNED_IN" && session?.user) {
          // Check if this is a brand new user (created within last 60s)
          const createdAt = new Date(session.user.created_at).getTime();
          const now = Date.now();
          if (now - createdAt < 60_000) {
            trackEvent("user_signup", session.user.id, { email: session.user.email });
            // Send welcome email (fire-and-forget)
            supabase.functions.invoke("send-transactional-email", {
              body: {
                type: "welcome",
                to: session.user.email,
                data: { credits: 2, appUrl: window.location.origin },
              },
            }).catch(() => {});
          }
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, session, loading, signUp, signIn, signOut };
};
