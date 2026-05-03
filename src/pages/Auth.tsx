import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";

const Auth = () => {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { signIn, signUp, user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) { toast.error(error.message); return; }
        toast.success("Check your email for a reset link.");
        setMode("login");
        return;
      }
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (error) { toast.error(error.message); return; }
        const { data: { user: loggedInUser } } = await supabase.auth.getUser();
        if (loggedInUser) trackEvent("login", loggedInUser.id);
        navigate("/dashboard");
      } else {
        const { error, needsEmailConfirmation } = await signUp(email, password);
        if (error) { toast.error(error.message); return; }
        trackEvent("signup", null, { email });
        if (needsEmailConfirmation) {
          toast.success("Account created! Check your email to confirm your account.");
          setMode("login");
          return;
        }
        toast.success("Account created! You're signed in.");
        navigate("/dashboard");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <button onClick={() => navigate("/")} className="font-heading text-xl font-bold text-foreground tracking-[-0.02em] hover:text-muted-foreground transition-colors">
            Deal Hunter
          </button>
          <p className="text-sm text-muted-foreground mt-2">
            {mode === "login" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset your password"}
          </p>
        </div>

        {mode !== "forgot" && (
          <>
            {/* Mode tabs */}
            <div className="flex mb-4 rounded-lg overflow-hidden border border-border bg-secondary/50">
              <button
                type="button"
                className={`flex-1 py-2.5 text-sm font-medium transition-all rounded-md ${
                  mode === "login" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setMode("login")}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`flex-1 py-2.5 text-sm font-medium transition-all rounded-md ${
                  mode === "signup" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setMode("signup")}
              >
                Sign Up
              </button>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" required autoComplete="email" />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
            </div>
          )}
          <Button type="submit" className="w-full py-5 font-semibold shadow-sm shadow-primary/20" variant="default" disabled={submitting}>
            {submitting ? "Please wait…" : mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Reset Link"}
          </Button>
          {mode === "login" && (
            <button type="button" className="text-xs text-muted-foreground hover:text-primary w-full text-center" onClick={() => setMode("forgot")}>
              Forgot password?
            </button>
          )}
          {mode === "forgot" && (
            <p className="text-center text-sm text-muted-foreground">
              Remember your password?{" "}
              <button type="button" className="text-primary font-medium hover:underline" onClick={() => setMode("login")}>
                Sign In
              </button>
            </p>
          )}
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By continuing you agree to our{" "}
          <a href="/terms" className="underline hover:text-foreground">Terms</a>{" "}
          and{" "}
          <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
};

export default Auth;
