import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
  </svg>
);

const Auth = () => {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);
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

  const handleOAuth = async (provider: "google" | "github") => {
    setOauthLoading(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      toast.error(error.message);
      setOauthLoading(null);
    }
  };

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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="font-heading text-2xl font-bold text-foreground cursor-pointer" onClick={() => navigate("/")}>
            Gold Rush
          </span>
          <p className="text-muted-foreground mt-2">
            {mode === "login" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset your password"}
          </p>
        </div>

        {mode !== "forgot" && (
          <>
            {/* OAuth buttons */}
            <div className="space-y-2 mb-4">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                disabled={oauthLoading !== null}
                onClick={() => handleOAuth("google")}
              >
                <GoogleIcon />
                {oauthLoading === "google" ? "Redirecting…" : "Continue with Google"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                disabled={oauthLoading !== null}
                onClick={() => handleOAuth("github")}
              >
                <GitHubIcon />
                {oauthLoading === "github" ? "Redirecting…" : "Continue with GitHub"}
              </Button>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>

            {/* Mode tabs */}
            <div className="flex mb-4 rounded-lg overflow-hidden border border-border">
              <button
                type="button"
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  mode === "login" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setMode("login")}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  mode === "signup" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setMode("signup")}
              >
                Sign Up
              </button>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="bg-card border rounded-xl p-6 space-y-4">
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
          <Button type="submit" className="w-full text-base py-5" variant="default" disabled={submitting}>
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
