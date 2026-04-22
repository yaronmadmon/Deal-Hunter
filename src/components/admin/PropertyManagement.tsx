import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Home, RefreshCw, Eye } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  deal_score: number | null;
  deal_verdict: string | null;
  distress_types: string[] | null;
  equity_pct: number | null;
  status: string;
  user_id: string;
  created_at: string;
}

interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "complete": return "bg-green-500/20 text-green-400 border-green-500/30";
    case "scoring": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "searching": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "failed": return "bg-red-500/20 text-red-400 border-red-500/30";
    default: return "bg-muted text-muted-foreground";
  }
};

const getVerdictColor = (verdict: string | null) => {
  if (!verdict) return "text-muted-foreground";
  if (verdict === "Strong Deal") return "text-green-400";
  if (verdict === "Investigate") return "text-yellow-400";
  return "text-red-400";
};

export const PropertyManagement = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [propsRes, profilesRes] = await Promise.all([
        supabase.from("properties" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, email, display_name"),
      ]);
      setProperties((propsRes as any).data ?? []);
      setProfiles(profilesRes.data ?? []);
    } catch {
      toast.error("Failed to load properties");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const getUserLabel = (userId: string) => {
    const p = profiles.find((pr) => pr.id === userId);
    return p?.display_name || p?.email?.split("@")[0] || userId.slice(0, 8);
  };

  const filtered = properties.filter(
    (p) =>
      p.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getUserLabel(p.user_id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Home className="h-5 w-5" />
          All Properties ({properties.length})
        </CardTitle>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search address, city, user..."
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
              <TableHead className="w-[30%]">Address</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Verdict</TableHead>
              <TableHead>Equity</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((property) => (
              <TableRow key={property.id}>
                <TableCell className="font-medium">
                  <div>
                    <p className="truncate max-w-xs">{property.address}</p>
                    <p className="text-xs text-muted-foreground">{property.city}, {property.state}</p>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{getUserLabel(property.user_id)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={getStatusColor(property.status)}>
                    {property.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className={`font-bold ${property.deal_score !== null ? (property.deal_score >= 70 ? "text-green-400" : property.deal_score >= 40 ? "text-yellow-400" : "text-red-400") : "text-muted-foreground"}`}>
                    {property.deal_score !== null ? `${property.deal_score}` : "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={`text-sm font-medium ${getVerdictColor(property.deal_verdict)}`}>
                    {property.deal_verdict || "—"}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {property.equity_pct !== null ? `${Math.round(property.equity_pct)}%` : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(property.created_at), "MMM d, HH:mm")}
                </TableCell>
                <TableCell>
                  {property.status === "complete" && (
                    <Button variant="outline" size="sm" onClick={() => navigate(`/property/${property.id}`)}>
                      <Eye className="h-4 w-4 mr-1" />View
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No properties found</p>
        )}
      </CardContent>
    </Card>
  );
};
