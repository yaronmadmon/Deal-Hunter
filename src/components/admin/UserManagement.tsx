import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Plus, Minus, Users, Crown, RefreshCw, Ban, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  credits: number;
  created_at: string;
  suspended?: boolean;
}

interface AdminEmail {
  id: string;
  email: string;
  created_at: string;
}

export const UserManagement = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [adminEmails, setAdminEmails] = useState<AdminEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [creditAmount, setCreditAmount] = useState<number>(10);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profilesRes, adminsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('admin_emails').select('*').order('created_at', { ascending: false })
      ]);

      if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
      if (adminsRes.data) setAdminEmails(adminsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredProfiles = profiles.filter(p => 
    p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isAdminUser = (email: string | null) => {
    return email && adminEmails.some(ae => ae.email.toLowerCase() === email.toLowerCase());
  };

  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim()) return;
    
    try {
      const { error } = await supabase.from('admin_emails').insert({ email: newAdminEmail.trim().toLowerCase() });
      if (error) throw error;
      
      toast.success(`${newAdminEmail} added as admin`);
      setNewAdminEmail("");
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add admin');
    }
  };

  const handleRemoveAdmin = async (id: string, email: string) => {
    try {
      const { error } = await supabase.from('admin_emails').delete().eq('id', id);
      if (error) throw error;
      
      toast.success(`${email} removed from admins`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove admin');
    }
  };

  const handleModifyCredits = async (add: boolean) => {
    if (!selectedUser) return;
    
    const newCredits = add 
      ? selectedUser.credits + creditAmount 
      : Math.max(0, selectedUser.credits - creditAmount);
    
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ credits: newCredits })
        .eq('id', selectedUser.id);
      
      if (profileError) throw profileError;

      const { error: logError } = await supabase.from('credits_log').insert({
        user_id: selectedUser.id,
        amount: add ? creditAmount : -creditAmount,
        reason: `Admin ${add ? 'added' : 'removed'} credits`
      });

      if (logError) console.error('Failed to log credit change:', logError);

      toast.success(`${add ? 'Added' : 'Removed'} ${creditAmount} credits`);
      setCreditDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to modify credits');
    }
  };

  const handleToggleSuspension = async (profile: Profile) => {
    const newSuspended = !profile.suspended;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ suspended: newSuspended } as any)
        .eq('id', profile.id);
      
      if (error) throw error;
      toast.success(`User ${newSuspended ? 'suspended' : 'reactivated'}`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update suspension status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin Emails Management */}
      <Card className="border-gold/20 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-gold" />
            Admin Whitelist
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="admin@example.com"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              className="max-w-sm"
            />
            <Button onClick={handleAddAdmin} className="bg-gold hover:bg-gold/90 text-black">
              <Plus className="h-4 w-4 mr-1" /> Add Admin
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {adminEmails.map((admin) => (
              <Badge 
                key={admin.id} 
                variant="secondary"
                className="flex items-center gap-2 px-3 py-1.5"
              >
                {admin.email}
                <button 
                  onClick={() => handleRemoveAdmin(admin.id, admin.email)}
                  className="hover:text-destructive transition-colors"
                >
                  ×
                </button>
              </Badge>
            ))}
            {adminEmails.length === 0 && (
              <p className="text-muted-foreground text-sm">No admin emails configured yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* User List */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Users ({profiles.length})
          </CardTitle>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
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
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProfiles.map((profile) => (
                <TableRow key={profile.id} className={profile.suspended ? "opacity-60" : ""}>
                  <TableCell className="font-medium">{profile.display_name || 'Unknown'}</TableCell>
                  <TableCell>{profile.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {profile.credits}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(profile.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    {profile.suspended ? (
                      <Badge variant="destructive">Suspended</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-green-500/10 text-green-400 border-green-500/20">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {isAdminUser(profile.email) ? (
                      <Badge className="bg-gold text-black">Admin</Badge>
                    ) : (
                      <Badge variant="secondary">User</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Dialog open={creditDialogOpen && selectedUser?.id === profile.id} onOpenChange={setCreditDialogOpen}>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedUser(profile)}
                          >
                            Credits
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Manage Credits for {profile.display_name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <p className="text-muted-foreground">
                              Current balance: <span className="font-bold text-foreground">{profile.credits} credits</span>
                            </p>
                            <div className="flex items-center gap-4">
                              <Input
                                type="number"
                                min={1}
                                value={creditAmount}
                                onChange={(e) => setCreditAmount(parseInt(e.target.value) || 0)}
                                className="w-24"
                              />
                              <span className="text-muted-foreground">credits</span>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                onClick={() => handleModifyCredits(true)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Plus className="h-4 w-4 mr-1" /> Add
                              </Button>
                              <Button 
                                onClick={() => handleModifyCredits(false)}
                                variant="destructive"
                              >
                                <Minus className="h-4 w-4 mr-1" /> Remove
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      {!isAdminUser(profile.email) && (
                        <Button
                          variant={profile.suspended ? "outline" : "destructive"}
                          size="sm"
                          onClick={() => handleToggleSuspension(profile)}
                        >
                          {profile.suspended ? (
                            <><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Reactivate</>
                          ) : (
                            <><Ban className="h-3.5 w-3.5 mr-1" /> Suspend</>
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
