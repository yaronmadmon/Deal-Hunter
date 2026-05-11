import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.583c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.583 9 3.583z" fill="#EA4335"/>
  </svg>
);

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

  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
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
          {mode !== "forgot" && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary/60 transition-colors"
              >
                <GoogleIcon />
                Continue with Google
              </button>
            </>
          )}
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
