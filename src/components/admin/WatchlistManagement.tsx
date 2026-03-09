import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Eye, Search, RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format } from "date-fns";

interface WatchlistItem {
  id: string;
  idea: string;
  user_id: string;
  current_score: number | null;
  previous_score: number | null;
  score_change: number | null;
  notes: string | null;
  created_at: string;
  last_analyzed_at: string | null;
}

interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
}

export const WatchlistManagement = () => {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [watchRes, profilesRes] = await Promise.all([
        supabase.from('watchlist').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, email, display_name'),
      ]);
      if (watchRes.data) setItems(watchRes.data);
      if (profilesRes.data) setProfiles(profilesRes.data);
    } catch (error) {
      toast.error('Failed to load watchlist data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const getUserLabel = (userId: string) => {
    const p = profiles.find(pr => pr.id === userId);
    return p?.display_name || p?.email?.split('@')[0] || userId.slice(0, 8);
  };

  const filtered = items.filter(i =>
    i.idea.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getUserLabel(i.user_id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getChangeIcon = (change: number | null) => {
    if (!change || change === 0) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-400" />;
    return <TrendingDown className="h-4 w-4 text-red-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Tracked</p>
            <p className="text-2xl font-bold text-foreground">{items.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Unique Users</p>
            <p className="text-2xl font-bold text-foreground">{new Set(items.map(i => i.user_id)).size}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Avg Score</p>
            <p className="text-2xl font-bold text-foreground">
              {items.filter(i => i.current_score).length > 0
                ? Math.round(items.reduce((s, i) => s + (i.current_score || 0), 0) / items.filter(i => i.current_score).length)
                : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            All Watchlist Items ({items.length})
          </CardTitle>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search ideas or users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Button variant="outline" size="icon" onClick={fetchData}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Idea</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium max-w-xs truncate">{item.idea}</TableCell>
                  <TableCell className="text-muted-foreground">{getUserLabel(item.user_id)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {item.current_score !== null ? `${item.current_score}/100` : '—'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {getChangeIcon(item.score_change)}
                      <span className={`text-sm font-medium ${
                        (item.score_change || 0) > 0 ? 'text-green-400' :
                        (item.score_change || 0) < 0 ? 'text-red-400' : 'text-muted-foreground'
                      }`}>
                        {item.score_change !== null && item.score_change !== 0 ? `${item.score_change > 0 ? '+' : ''}${item.score_change}` : '—'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate text-muted-foreground text-sm">
                    {item.notes || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(item.created_at), 'MMM d, yyyy')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No watchlist items found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
