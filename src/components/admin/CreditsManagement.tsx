import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CreditCard, TrendingUp, TrendingDown, RefreshCw, DollarSign } from "lucide-react";
import { format } from "date-fns";

interface CreditLog {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  analysis_id: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
}

interface CreditStats {
  totalCreditsGiven: number;
  totalCreditsUsed: number;
  totalTransactions: number;
}

export const CreditsManagement = () => {
  const [creditLogs, setCreditLogs] = useState<CreditLog[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CreditStats>({
    totalCreditsGiven: 0,
    totalCreditsUsed: 0,
    totalTransactions: 0
  });

  const fetchCreditLogs = async () => {
    setLoading(true);
    try {
      const [logsRes, profilesRes] = await Promise.all([
        supabase.from('credits_log').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('profiles').select('id, email, display_name'),
      ]);

      if (logsRes.error) throw logsRes.error;
      
      const data = logsRes.data || [];
      setCreditLogs(data);
      if (profilesRes.data) setProfiles(profilesRes.data);
        
      const given = data.filter(l => l.amount > 0).reduce((sum, l) => sum + l.amount, 0);
      const used = data.filter(l => l.amount < 0).reduce((sum, l) => sum + Math.abs(l.amount), 0);
        
      setStats({
        totalCreditsGiven: given,
        totalCreditsUsed: used,
        totalTransactions: data.length
      });
    } catch (error) {
      console.error('Error fetching credit logs:', error);
      toast.error('Failed to load credit logs');
    } finally {
      setLoading(false);
    }
  };

  const getUserLabel = (userId: string) => {
    const p = profiles.find(pr => pr.id === userId);
    return p?.display_name || p?.email?.split('@')[0] || userId.slice(0, 8);
  };

  useEffect(() => {
    fetchCreditLogs();
  }, []);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Credits Given</p>
                <p className="text-2xl font-bold text-green-400">+{stats.totalCreditsGiven}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-400 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Credits Used</p>
                <p className="text-2xl font-bold text-red-400">-{stats.totalCreditsUsed}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-400 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Transactions</p>
                <p className="text-2xl font-bold text-blue-400">{stats.totalTransactions}</p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Log */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Recent Transactions
          </CardTitle>
          <Button variant="outline" size="icon" onClick={fetchCreditLogs}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>User ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(log.created_at), 'MMM d, HH:mm')}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={log.amount > 0 
                        ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                      }
                    >
                      {log.amount > 0 ? '+' : ''}{log.amount}
                    </Badge>
                  </TableCell>
                  <TableCell>{log.reason}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {log.user_id.slice(0, 8)}...
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {creditLogs.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No transactions yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
