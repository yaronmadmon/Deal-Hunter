import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Flame, RefreshCw, Clock, Database, Zap } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface FeedSnapshot {
  id: string;
  section_name: string;
  data_payload: any;
  created_at: string;
}

export const LiveFeedControl = () => {
  const [snapshots, setSnapshots] = useState<FeedSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSnapshots = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('live_feed_snapshots')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setSnapshots(data);
    } catch (error) {
      console.error('Error fetching snapshots:', error);
      toast.error('Failed to load feed data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshots();
  }, []);

  const handleForceRefresh = async () => {
    setRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke('live-feed-refresh', {
        body: { force: true }
      });

      if (error) throw error;
      
      toast.success('Feed refresh triggered');
      setTimeout(fetchSnapshots, 3000); // Wait for refresh to complete
    } catch (error: any) {
      toast.error(error.message || 'Failed to refresh feeds');
    } finally {
      setRefreshing(false);
    }
  };

  const handleClearSection = async (sectionName: string) => {
    try {
      const { error } = await supabase
        .from('live_feed_snapshots')
        .delete()
        .eq('section_name', sectionName);

      if (error) throw error;
      
      toast.success(`Cleared ${sectionName} cache`);
      fetchSnapshots();
    } catch (error: any) {
      toast.error(error.message || 'Failed to clear cache');
    }
  };

  const getSectionIcon = (name: string) => {
    switch (name) {
      case 'trending_searches': return '🔥';
      case 'product_hunt': return '🚀';
      case 'reddit_problems': return '💬';
      case 'growing_niches': return '📈';
      case 'breakout_idea': return '⭐';
      default: return '📊';
    }
  };

  const formatSectionName = (name: string) => {
    return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getItemCount = (payload: any) => {
    if (Array.isArray(payload)) return payload.length;
    if (typeof payload === 'object' && payload !== null) return 1;
    return 0;
  };

  // Group by section
  const latestBySection = snapshots.reduce((acc, snap) => {
    if (!acc[snap.section_name] || new Date(snap.created_at) > new Date(acc[snap.section_name].created_at)) {
      acc[snap.section_name] = snap;
    }
    return acc;
  }, {} as Record<string, FeedSnapshot>);

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <Card className="border-gold/20 bg-gradient-to-br from-gold/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-gold" />
            Live Feed Control
          </CardTitle>
          <CardDescription>
            Manage cached market signals and trigger manual refreshes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button 
              onClick={handleForceRefresh}
              disabled={refreshing}
              className="bg-gold hover:bg-gold/90 text-black"
            >
              {refreshing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Force Refresh All Feeds
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Feed Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(latestBySection).map(([section, snapshot]) => (
          <Card key={section} className="border-border/50 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <span>{getSectionIcon(section)}</span>
                {formatSectionName(section)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  Updated {formatDistanceToNow(new Date(snapshot.created_at))} ago
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Database className="h-4 w-4" />
                <span>{getItemCount(snapshot.data_payload)} items cached</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {format(new Date(snapshot.created_at), 'MMM d, HH:mm')}
                </Badge>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => handleClearSection(section)}
              >
                Clear Cache
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {Object.keys(latestBySection).length === 0 && !loading && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No feed data cached yet</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={handleForceRefresh}
              disabled={refreshing}
            >
              Initialize Feeds
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
