import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Auth = () => {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { signIn, signUp, user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  if (user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      } else {
        const { error } = await signUp(email, password);
        if (error) { toast.error(error.message); return; }
        toast.success("Account created! You're signed in.");
      }
      navigate("/dashboard");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="font-heading text-2xl font-bold text-foreground cursor-pointer" onClick={() => navigate("/")}>⛏️ Gold Rush</span>
          <p className="text-muted-foreground mt-2">
            {mode === "login" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset your password"}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="bg-card border rounded-xl p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" required />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>
          )}
          <Button type="submit" className="w-full" variant="default" disabled={submitting}>
            {submitting ? "Please wait…" : mode === "login" ? "Sign In" : mode === "signup" ? "Sign Up" : "Send Reset Link"}
          </Button>
          {mode === "login" && (
            <button type="button" className="text-xs text-muted-foreground hover:text-primary w-full text-center" onClick={() => setMode("forgot")}>
              Forgot password?
            </button>
          )}
          <p className="text-center text-sm text-muted-foreground">
            {mode === "login" ? "Don't have an account?" : mode === "signup" ? "Already have an account?" : "Remember your password?"}{" "}
            <button type="button" className="text-primary font-medium hover:underline" onClick={() => setMode(mode === "signup" ? "login" : mode === "forgot" ? "login" : "signup")}>
              {mode === "signup" ? "Sign In" : mode === "forgot" ? "Sign In" : "Sign Up"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Auth;
