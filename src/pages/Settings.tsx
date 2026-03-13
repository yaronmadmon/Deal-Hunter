import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import {
  User, Lock, Bell, Palette, CreditCard, Coins, Trash2,
  Eye, EyeOff, Check, AlertTriangle
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Profile {
  display_name: string | null;
  email: string | null;
  credits: number;
  created_at: string;
}

interface Subscription {
  plan: string | null;
  status: string | null;
  current_period_end: string | null;
}

interface CreditLogEntry {
  id: string;
  amount: number;
  reason: string;
  created_at: string;
}

const Settings = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();

  // Profile state
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Notification prefs (loaded from DB, fallback to localStorage)
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [watchlistAlerts, setWatchlistAlerts] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Billing
  const [creditLog, setCreditLog] = useState<CreditLogEntry[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name, email, credits, created_at").eq("id", user.id).single()
      .then(({ data }) => {
        if (data) {
          setProfile(data);
          setDisplayName(data.display_name ?? "");
        }
      });
    supabase.from("credits_log").select("id, amount, reason, created_at").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => { if (data) setCreditLog(data); });
    supabase.from("subscriptions").select("plan, status, current_period_end").eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setSubscription(data); });
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
    setSavingProfile(false);
    if (error) { toast.error("Failed to update profile"); return; }
    setProfile(p => p ? { ...p, display_name: displayName } : p);
    toast.success("Profile updated");
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords don't match"); return; }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) { toast.error(error.message); return; }
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    toast.success("Password updated successfully");
  };

  const handleDeleteAccount = async () => {
    toast.info("Please contact support to delete your account.");
  };

  const savePref = (key: string, value: boolean) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading…</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <AppNav credits={profile?.credits} onSignOut={() => { signOut(); navigate("/"); }} />

      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="font-heading text-3xl font-bold text-foreground mb-1">Settings</h1>
        <p className="text-muted-foreground mb-8">Manage your account, preferences, and billing.</p>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile" className="gap-1.5"><User className="w-4 h-4" /> Profile</TabsTrigger>
            <TabsTrigger value="preferences" className="gap-1.5"><Palette className="w-4 h-4" /> Preferences</TabsTrigger>
            <TabsTrigger value="billing" className="gap-1.5"><CreditCard className="w-4 h-4" /> Billing</TabsTrigger>
          </TabsList>

          {/* ── Profile ── */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Profile Information</CardTitle>
                <CardDescription>Update your display name and view account details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={user?.email ?? ""} disabled className="bg-muted/50" />
                  <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input id="displayName" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />
                </div>
                <div className="space-y-2">
                  <Label>Member Since</Label>
                  <p className="text-sm text-muted-foreground">
                    {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"}
                  </p>
                </div>
                <Button onClick={handleSaveProfile} disabled={savingProfile || displayName === (profile?.display_name ?? "")}>
                  {savingProfile ? "Saving…" : "Save Changes"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Lock className="w-4 h-4" /> Change Password</CardTitle>
                <CardDescription>Update your account password.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={6}
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowNewPassword(!showNewPassword)}>
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-destructive">Passwords don't match</p>
                  )}
                </div>
                <Button onClick={handleChangePassword} disabled={changingPassword || !newPassword || newPassword !== confirmPassword}>
                  {changingPassword ? "Updating…" : "Update Password"}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="text-lg text-destructive flex items-center gap-2"><Trash2 className="w-4 h-4" /> Danger Zone</CardTitle>
                <CardDescription>Permanently delete your account and all data.</CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm"><Trash2 className="w-3.5 h-3.5 mr-1" /> Delete Account</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" /> Delete Account?</AlertDialogTitle>
                      <AlertDialogDescription>This action cannot be undone. All your analyses, credits, and data will be permanently removed.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Preferences ── */}
          <TabsContent value="preferences" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Appearance</CardTitle>
                <CardDescription>Customize the look of Gold Rush.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-foreground">Dark Mode</p>
                    <p className="text-xs text-muted-foreground">Toggle between light and dark themes.</p>
                  </div>
                  <ThemeToggle />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Bell className="w-4 h-4" /> Notifications</CardTitle>
                <CardDescription>Choose what notifications you receive.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-foreground">Email Notifications</p>
                    <p className="text-xs text-muted-foreground">Receive analysis completion emails.</p>
                  </div>
                  <Switch checked={emailNotifs} onCheckedChange={v => { setEmailNotifs(v); savePref("pref_email_notifs", v); }} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-foreground">Watchlist Alerts</p>
                    <p className="text-xs text-muted-foreground">Get notified when tracked ideas change score.</p>
                  </div>
                  <Switch checked={watchlistAlerts} onCheckedChange={v => { setWatchlistAlerts(v); savePref("pref_watchlist_alerts", v); }} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-foreground">Weekly Digest</p>
                    <p className="text-xs text-muted-foreground">A summary of trending ideas every Monday.</p>
                  </div>
                  <Switch checked={weeklyDigest} onCheckedChange={v => { setWeeklyDigest(v); savePref("pref_weekly_digest", v); }} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Billing ── */}
          <TabsContent value="billing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Current Plan</CardTitle>
                <CardDescription>Your subscription and credit balance.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
                  <div>
                    <p className="font-heading font-semibold text-foreground">
                      {subscription?.status === "active"
                        ? `${(subscription.plan || "Pro").charAt(0).toUpperCase() + (subscription.plan || "pro").slice(1)} Plan`
                        : "Free Plan"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {subscription?.status === "active" && subscription.current_period_end
                        ? `Renews ${new Date(subscription.current_period_end).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
                        : subscription?.status === "past_due"
                          ? "Payment past due — please update billing"
                          : subscription?.status === "canceled"
                            ? "Canceled — access until period end"
                            : "Basic access with limited credits"}
                    </p>
                  </div>
                  <Badge variant={subscription?.status === "active" ? "default" : subscription?.status === "past_due" ? "destructive" : "secondary"}>
                    {subscription?.status === "active" ? "Active" : subscription?.status === "past_due" ? "Past Due" : subscription?.status === "canceled" ? "Canceled" : "Free"}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <Coins className="w-6 h-6 text-primary" />
                  <div>
                    <p className="font-heading text-2xl font-bold text-foreground">{profile?.credits ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Credits remaining</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  {(!subscription || subscription.status !== "active") && (
                    <Button onClick={() => navigate("/pricing")}>Upgrade Plan</Button>
                  )}
                  <Button variant="outline" onClick={() => navigate("/buy-credits")}>Buy Credits</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Credit History</CardTitle>
                <CardDescription>Recent credit transactions.</CardDescription>
              </CardHeader>
              <CardContent>
                {creditLog.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No transactions yet.</p>
                ) : (
                  <div className="space-y-2">
                    {creditLog.map(entry => (
                      <div key={entry.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                        <div>
                          <p className="text-sm text-foreground">{entry.reason}</p>
                          <p className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                        </div>
                        <span className={`font-mono text-sm font-semibold ${entry.amount < 0 ? "text-destructive" : "text-success"}`}>
                          {entry.amount > 0 ? "+" : ""}{entry.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Settings;
