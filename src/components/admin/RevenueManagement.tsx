import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DollarSign, Users, TrendingUp, RefreshCw, CreditCard, Crown } from "lucide-react";
import { format } from "date-fns";

interface Subscription {
  id: string;
  user_id: string;
  plan: string | null;
  status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  created_at: string | null;
}

interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
}

export const RevenueManagement = () => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subRes, profilesRes] = await Promise.all([
        supabase.from('subscriptions').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, email, display_name'),
      ]);
      if (subRes.data) setSubscriptions(subRes.data);
      if (profilesRes.data) setProfiles(profilesRes.data);
    } catch (error) {
      toast.error('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const getUserLabel = (userId: string) => {
    const p = profiles.find(pr => pr.id === userId);
    return p?.display_name || p?.email?.split('@')[0] || userId.slice(0, 8);
  };

  const getUserEmail = (userId: string) => {
    const p = profiles.find(pr => pr.id === userId);
    return p?.email || '—';
  };

  const activeSubs = subscriptions.filter(s => s.status === 'active');
  const paidSubs = activeSubs.filter(s => s.plan && s.plan !== 'free');
  const planCounts = subscriptions.reduce((acc, s) => {
    const plan = s.plan || 'free';
    acc[plan] = (acc[plan] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const PLAN_PRICES: Record<string, number> = {
    starter: 9,
    pro: 29,
    agency: 79,
  };

  const estimatedMRR = paidSubs.reduce((sum, s) => {
    return sum + (PLAN_PRICES[s.plan || ''] || 0);
  }, 0);

  const getPlanBadge = (plan: string | null) => {
    const p = plan || 'free';
    const colors: Record<string, string> = {
      free: 'bg-muted text-muted-foreground',
      starter: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      pro: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      agency: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    };
    return (
      <Badge variant="outline" className={colors[p] || colors.free}>
        {p.charAt(0).toUpperCase() + p.slice(1)}
      </Badge>
    );
  };

  const getStatusBadge = (status: string | null) => {
    const s = status || 'unknown';
    if (s === 'active') return <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>;
    if (s === 'canceled') return <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">Canceled</Badge>;
    if (s === 'past_due') return <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30">Past Due</Badge>;
    return <Badge variant="outline">{s}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Revenue KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="pt-5 pb-4 px-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-green-400" />
              <span className="text-xs text-muted-foreground">Est. MRR</span>
            </div>
            <p className="text-2xl font-bold text-green-400">${estimatedMRR}</p>
            <p className="text-xs text-muted-foreground mt-1">{paidSubs.length} paid subscribers</p>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-5 pb-4 px-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-muted-foreground">Total Subscribers</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">{subscriptions.length}</p>
            <p className="text-xs text-muted-foreground mt-1">{activeSubs.length} active</p>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardContent className="pt-5 pb-4 px-4">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="h-4 w-4 text-purple-400" />
              <span className="text-xs text-muted-foreground">Pro+ Users</span>
            </div>
            <p className="text-2xl font-bold text-purple-400">
              {(planCounts['pro'] || 0) + (planCounts['agency'] || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {planCounts['pro'] || 0} pro, {planCounts['agency'] || 0} agency
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="pt-5 pb-4 px-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-muted-foreground">Conversion Rate</span>
            </div>
            <p className="text-2xl font-bold text-amber-400">
              {profiles.length > 0 ? Math.round((paidSubs.length / profiles.length) * 100) : 0}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">free → paid</p>
          </CardContent>
        </Card>
      </div>

      {/* Plan Distribution */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-base">Plan Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['free', 'starter', 'pro', 'agency'].map(plan => {
              const count = planCounts[plan] || 0;
              const total = subscriptions.length || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={plan} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize text-foreground font-medium">{plan}</span>
                    <span className="text-muted-foreground">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Subscriptions Table */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            All Subscriptions ({subscriptions.length})
          </CardTitle>
          <Button variant="outline" size="icon" onClick={fetchData}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Period End</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-medium">{getUserLabel(sub.user_id)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{getUserEmail(sub.user_id)}</TableCell>
                  <TableCell>{getPlanBadge(sub.plan)}</TableCell>
                  <TableCell>{getStatusBadge(sub.status)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {sub.current_period_end
                      ? format(new Date(sub.current_period_end), 'MMM d, yyyy')
                      : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {sub.created_at
                      ? format(new Date(sub.created_at), 'MMM d, yyyy')
                      : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {subscriptions.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No subscriptions yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
