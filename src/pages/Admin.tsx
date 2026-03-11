import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { UserManagement } from "@/components/admin/UserManagement";
import { AnalysisManagement } from "@/components/admin/AnalysisManagement";
import { CreditsManagement } from "@/components/admin/CreditsManagement";
import { LiveFeedControl } from "@/components/admin/LiveFeedControl";
import { NotificationsManagement } from "@/components/admin/NotificationsManagement";
import { WatchlistManagement } from "@/components/admin/WatchlistManagement";
import { PipelineMetricsPanel } from "@/components/admin/PipelineMetrics";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, Users, FileText, CreditCard, Flame, LayoutDashboard, Bell, Eye, Activity } from "lucide-react";

const AdminPage = () => {
  const navigate = useNavigate();

  return (
    <AdminGuard>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Shield className="h-6 w-6 text-gold" />
                <h1 className="text-xl font-bold">Admin Dashboard</h1>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="container mx-auto px-4 py-8">
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-muted/50 p-1 flex-wrap h-auto gap-1">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Users</span>
              </TabsTrigger>
              <TabsTrigger value="analyses" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Analyses</span>
              </TabsTrigger>
              <TabsTrigger value="credits" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline">Credits</span>
              </TabsTrigger>
              <TabsTrigger value="watchlist" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span className="hidden sm:inline">Watchlist</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <span className="hidden sm:inline">Notifications</span>
              </TabsTrigger>
              <TabsTrigger value="live-feed" className="flex items-center gap-2">
                <Flame className="h-4 w-4" />
                <span className="hidden sm:inline">Live Feed</span>
              </TabsTrigger>
              <TabsTrigger value="pipeline" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">Pipeline</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <AdminOverview />
            </TabsContent>

            <TabsContent value="users">
              <UserManagement />
            </TabsContent>

            <TabsContent value="analyses">
              <AnalysisManagement />
            </TabsContent>

            <TabsContent value="credits">
              <CreditsManagement />
            </TabsContent>

            <TabsContent value="watchlist">
              <WatchlistManagement />
            </TabsContent>

            <TabsContent value="notifications">
              <NotificationsManagement />
            </TabsContent>

            <TabsContent value="live-feed">
              <LiveFeedControl />
            </TabsContent>

            <TabsContent value="pipeline">
              <PipelineMetricsPanel />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </AdminGuard>
  );
};

export default AdminPage;
