import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Search, FileText, Trash2, Eye, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface Analysis {
  id: string;
  idea: string;
  status: string;
  overall_score: number | null;
  signal_strength: string | null;
  created_at: string;
  user_id: string;
}

interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
}

export const AnalysisManagement = () => {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  const fetchAnalyses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('analyses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setAnalyses(data);
    } catch (error) {
      console.error('Error fetching analyses:', error);
      toast.error('Failed to load analyses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyses();
  }, []);

  const filteredAnalyses = analyses.filter(a => 
    a.idea.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('analyses').delete().eq('id', id);
      if (error) throw error;
      
      toast.success('Analysis deleted');
      fetchAnalyses();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete analysis');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'processing': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'failed': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 70) return 'text-green-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          All Analyses ({analyses.length})
        </CardTitle>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ideas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <Button variant="outline" size="icon" onClick={fetchAnalyses}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Idea</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Signal</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAnalyses.map((analysis) => (
              <TableRow key={analysis.id}>
                <TableCell className="font-medium max-w-xs truncate">
                  {analysis.idea}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={getStatusColor(analysis.status)}>
                    {analysis.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className={`font-bold ${getScoreColor(analysis.overall_score)}`}>
                    {analysis.overall_score !== null ? `${analysis.overall_score}/100` : '—'}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="capitalize text-muted-foreground">
                    {analysis.signal_strength || '—'}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(analysis.created_at), 'MMM d, HH:mm')}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {analysis.status === 'completed' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/report/${analysis.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" /> View
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Analysis?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this analysis and all associated data.
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(analysis.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredAnalyses.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No analyses found</p>
        )}
      </CardContent>
    </Card>
  );
};
