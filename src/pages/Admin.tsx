import { AdminGuard } from "@/components/admin/AdminGuard";
import { UserManagement } from "@/components/admin/UserManagement";
import { AnalysisManagement } from "@/components/admin/AnalysisManagement";
import { CreditsManagement } from "@/components/admin/CreditsManagement";
import { LiveFeedControl } from "@/components/admin/LiveFeedControl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, Users, FileText, CreditCard, Flame } from "lucide-react";

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
          <Tabs defaultValue="users" className="space-y-6">
            <TabsList className="bg-muted/50 p-1">
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
              <TabsTrigger value="live-feed" className="flex items-center gap-2">
                <Flame className="h-4 w-4" />
                <span className="hidden sm:inline">Live Feed</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users">
              <UserManagement />
            </TabsContent>

            <TabsContent value="analyses">
              <AnalysisManagement />
            </TabsContent>

            <TabsContent value="credits">
              <CreditsManagement />
            </TabsContent>

            <TabsContent value="live-feed">
              <LiveFeedControl />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </AdminGuard>
  );
};

export default AdminPage;
