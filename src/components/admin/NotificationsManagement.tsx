import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Bell, Send, RefreshCw, Trash2, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
}

export const NotificationsManagement = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [targetUser, setTargetUser] = useState("all");
  const [sending, setSending] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [notifRes, profilesRes] = await Promise.all([
        supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('profiles').select('id, email, display_name'),
      ]);
      if (notifRes.data) setNotifications(notifRes.data);
      if (profilesRes.data) setProfiles(profilesRes.data);
    } catch (error) {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSendNotification = async () => {
    if (!newTitle.trim() || !newMessage.trim()) {
      toast.error('Title and message are required');
      return;
    }

    setSending(true);
    try {
      const targetProfiles = targetUser === 'all' ? profiles : profiles.filter(p => p.id === targetUser);

      const inserts = targetProfiles.map(p => ({
        user_id: p.id,
        title: newTitle.trim(),
        message: newMessage.trim(),
      }));

      const { error } = await supabase.from('notifications').insert(inserts);
      if (error) throw error;

      toast.success(`Notification sent to ${targetProfiles.length} user(s)`);
      setNewTitle("");
      setNewMessage("");
      setSendDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) throw error;
      toast.success('Notification deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete');
    }
  };

  const getUserLabel = (userId: string) => {
    const p = profiles.find(pr => pr.id === userId);
    return p?.display_name || p?.email?.split('@')[0] || userId.slice(0, 8);
  };

  const readCount = notifications.filter(n => n.read).length;
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Sent</p>
                <p className="text-2xl font-bold text-foreground">{notifications.length}</p>
              </div>
              <Bell className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Read</p>
                <p className="text-2xl font-bold text-green-400">{readCount}</p>
              </div>
              <Eye className="h-8 w-8 text-green-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unread</p>
                <p className="text-2xl font-bold text-amber-400">{unreadCount}</p>
              </div>
              <EyeOff className="h-8 w-8 text-amber-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Send Notification */}
      <Card className="border-primary/20 bg-card/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send Notification
            </CardTitle>
            <CardDescription>Broadcast or send targeted notifications</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={targetUser} onValueChange={setTargetUser}>
            <SelectTrigger className="w-full md:w-80">
              <SelectValue placeholder="Select recipient" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">📢 All Users ({profiles.length})</SelectItem>
              {profiles.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.display_name || p.email || p.id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Notification title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <Textarea
            placeholder="Notification message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            rows={3}
          />
          <Button onClick={handleSendNotification} disabled={sending} className="bg-primary hover:bg-primary/90">
            <Send className="h-4 w-4 mr-2" />
            {sending ? 'Sending...' : 'Send Notification'}
          </Button>
        </CardContent>
      </Card>

      {/* Notifications List */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification History
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
                <TableHead>Title</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications.map((notif) => (
                <TableRow key={notif.id}>
                  <TableCell className="font-medium">{getUserLabel(notif.user_id)}</TableCell>
                  <TableCell className="font-medium">{notif.title}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">{notif.message}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={notif.read
                      ? 'bg-green-500/20 text-green-400 border-green-500/30'
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    }>
                      {notif.read ? 'Read' : 'Unread'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(notif.created_at), 'MMM d, HH:mm')}
                  </TableCell>
                  <TableCell>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(notif.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {notifications.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No notifications sent yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
