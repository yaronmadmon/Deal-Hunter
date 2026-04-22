import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Kanban, Search, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface PipelineDeal {
  id: string;
  stage: string;
  priority: string;
  user_id: string;
  created_at: string;
  properties: {
    address: string;
    city: string;
    state: string;
    deal_score: number | null;
    deal_verdict: string | null;
  } | null;
}

interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
}

const STAGE_COLORS: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  contacted: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  follow_up: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  negotiating: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  under_contract: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  won: "bg-green-500/20 text-green-400 border-green-500/30",
  dead: "bg-red-500/20 text-red-400 border-red-500/30",
};

const stageLabel = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const WatchlistManagement = () => {
  const [deals, setDeals] = useState<PipelineDeal[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dealsRes, profilesRes] = await Promise.all([
        supabase.from("pipeline_deals" as any).select("*, properties(address, city, state, deal_score, deal_verdict)").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, email, display_name"),
      ]);
      setDeals((dealsRes as any).data ?? []);
      setProfiles(profilesRes.data ?? []);
    } catch {
      toast.error("Failed to load pipeline data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const getUserLabel = (userId: string) => {
    const p = profiles.find((pr) => pr.id === userId);
    return p?.display_name || p?.email?.split("@")[0] || userId.slice(0, 8);
  };

  const filtered = deals.filter((d) =>
    d.properties?.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getUserLabel(d.user_id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stageBreakdown = deals.reduce<Record<string, number>>((acc, d) => {
    acc[d.stage] = (acc[d.stage] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Pipeline Deals</p>
            <p className="text-2xl font-bold text-foreground">{deals.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Won Deals</p>
            <p className="text-2xl font-bold text-green-400">{stageBreakdown["won"] ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Under Contract</p>
            <p className="text-2xl font-bold text-cyan-400">{stageBreakdown["under_contract"] ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Kanban className="h-5 w-5" />
            All Pipeline Deals ({deals.length})
          </CardTitle>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search address or user..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Button variant="outline" size="icon" onClick={fetchData}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Property</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Verdict</TableHead>
                <TableHead>Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((deal) => (
                <TableRow key={deal.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium truncate max-w-xs">{deal.properties?.address ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{deal.properties?.city}, {deal.properties?.state}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{getUserLabel(deal.user_id)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STAGE_COLORS[deal.stage] ?? "bg-muted text-muted-foreground"}>
                      {stageLabel(deal.stage)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`font-bold ${deal.properties?.deal_score !== null && deal.properties?.deal_score !== undefined ? (deal.properties.deal_score >= 70 ? "text-green-400" : deal.properties.deal_score >= 40 ? "text-yellow-400" : "text-red-400") : "text-muted-foreground"}`}>
                      {deal.properties?.deal_score ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{deal.properties?.deal_verdict ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(deal.created_at), "MMM d, yyyy")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No pipeline deals found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
