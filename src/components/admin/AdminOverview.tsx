import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Users, FileText, CreditCard, Eye, TrendingUp, Activity, BarChart3, RefreshCw } from "lucide-react";
import { format, formatDistanceToNow, subDays } from "date-fns";

interface Stats {
  totalUsers: number;
  totalAnalyses: number;
  completedAnalyses: number;
  failedAnalyses: number;
  pendingAnalyses: number;
  totalCreditsIssued: number;
  totalCreditsUsed: number;
  totalWatchlistItems: number;
  newUsersToday: number;
  analysesToday: number;
}

interface RecentActivity {
  type: 'user' | 'analysis' | 'credit' | 'watchlist';
  description: string;
  time: string;
}

export const AdminOverview = () => {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0, totalAnalyses: 0, completedAnalyses: 0, failedAnalyses: 0,
    pendingAnalyses: 0, totalCreditsIssued: 0, totalCreditsUsed: 0,
    totalWatchlistItems: 0, newUsersToday: 0, analysesToday: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const today = subDays(new Date(), 1).toISOString();

      const [profilesRes, analysesRes, creditsRes, watchlistRes, newUsersRes, todayAnalysesRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('analyses').select('status'),
        supabase.from('credits_log').select('amount'),
        supabase.from('watchlist').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', today),
        supabase.from('analyses').select('id', { count: 'exact', head: true }).gte('created_at', today),
      ]);

      const analyses = analysesRes.data || [];
      const credits = creditsRes.data || [];

      setStats({
        totalUsers: profilesRes.count || 0,
        totalAnalyses: analyses.length,
        completedAnalyses: analyses.filter(a => a.status === 'completed').length,
        failedAnalyses: analyses.filter(a => a.status === 'failed').length,
        pendingAnalyses: analyses.filter(a => a.status === 'pending' || a.status === 'processing').length,
        totalCreditsIssued: credits.filter(c => c.amount > 0).reduce((s, c) => s + c.amount, 0),
        totalCreditsUsed: credits.filter(c => c.amount < 0).reduce((s, c) => s + Math.abs(c.amount), 0),
        totalWatchlistItems: watchlistRes.count || 0,
        newUsersToday: newUsersRes.count || 0,
        analysesToday: todayAnalysesRes.count || 0,
      });

      // Recent activity from multiple sources
      const [recentAnalyses, recentUsers, recentCredits] = await Promise.all([
        supabase.from('analyses').select('idea, status, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('profiles').select('display_name, email, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('credits_log').select('amount, reason, created_at').order('created_at', { ascending: false }).limit(5),
      ]);

      const activities: RecentActivity[] = [
        ...(recentAnalyses.data || []).map(a => ({
          type: 'analysis' as const,
          description: `Analysis "${a.idea.slice(0, 40)}..." → ${a.status}`,
          time: a.created_at,
        })),
        ...(recentUsers.data || []).map(u => ({
          type: 'user' as const,
          description: `${u.display_name || u.email || 'User'} signed up`,
          time: u.created_at,
        })),
        ...(recentCredits.data || []).map(c => ({
          type: 'credit' as const,
          description: `${c.amount > 0 ? '+' : ''}${c.amount} credits — ${c.reason}`,
          time: c.created_at,
        })),
      ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 15);

      setRecentActivity(activities);
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error('Failed to load overview data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, accent: 'text-blue-400', sub: `+${stats.newUsersToday} today` },
    { label: 'Analyses', value: stats.totalAnalyses, icon: FileText, accent: 'text-purple-400', sub: `+${stats.analysesToday} today` },
    { label: 'Completed', value: stats.completedAnalyses, icon: Activity, accent: 'text-green-400', sub: `${stats.failedAnalyses} failed` },
    { label: 'Credits Issued', value: stats.totalCreditsIssued, icon: TrendingUp, accent: 'text-emerald-400', sub: `${stats.totalCreditsUsed} used` },
    { label: 'Watchlist Items', value: stats.totalWatchlistItems, icon: Eye, accent: 'text-amber-400', sub: 'active monitors' },
    { label: 'Pending', value: stats.pendingAnalyses, icon: BarChart3, accent: 'text-yellow-400', sub: 'in queue' },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user': return '👤';
      case 'analysis': return '📊';
      case 'credit': return '💳';
      case 'watchlist': return '👁️';
      default: return '📌';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Platform Overview</h2>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card) => (
          <Card key={card.label} className="border-border/50 bg-card/50">
            <CardContent className="pt-5 pb-4 px-4">
              <div className="flex items-center gap-2 mb-2">
                <card.icon className={`h-4 w-4 ${card.accent}`} />
                <span className="text-xs text-muted-foreground">{card.label}</span>
              </div>
              <p className={`text-2xl font-bold ${card.accent}`}>{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Analyses Breakdown & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Analysis Status Breakdown */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-base">Analysis Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Completed', count: stats.completedAnalyses, total: stats.totalAnalyses, color: 'bg-green-500' },
              { label: 'Failed', count: stats.failedAnalyses, total: stats.totalAnalyses, color: 'bg-red-500' },
              { label: 'Pending/Processing', count: stats.pendingAnalyses, total: stats.totalAnalyses, color: 'bg-yellow-500' },
            ].map((bar) => (
              <div key={bar.label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{bar.label}</span>
                  <span className="font-medium text-foreground">{bar.count}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${bar.color} rounded-full transition-all duration-500`}
                    style={{ width: `${bar.total > 0 ? (bar.count / bar.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity Feed */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {recentActivity.map((activity, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5">{getActivityIcon(activity.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground truncate">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.time))} ago
                    </p>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <p className="text-muted-foreground text-center py-6">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
