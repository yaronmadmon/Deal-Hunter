import { useState } from "react";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { UserManagement } from "@/components/admin/UserManagement";
import { AnalysisManagement } from "@/components/admin/AnalysisManagement";
import { CreditsManagement } from "@/components/admin/CreditsManagement";
import { RevenueManagement } from "@/components/admin/RevenueManagement";
import { LiveFeedControl } from "@/components/admin/LiveFeedControl";
import { NotificationsManagement } from "@/components/admin/NotificationsManagement";
import { WatchlistManagement } from "@/components/admin/WatchlistManagement";
import { PipelineMetricsPanel } from "@/components/admin/PipelineMetrics";
import { DataSourceHealth } from "@/components/admin/DataSourceHealth";
import { EmailLogs } from "@/components/admin/EmailLogs";
import { FeedbackManagement } from "@/components/admin/FeedbackManagement";
import { ReviewsManagement } from "@/components/admin/ReviewsManagement";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Shield, Users, FileText, CreditCard, Flame,
  LayoutDashboard, Bell, Eye, Activity, DollarSign, Mail,
  ChevronLeft, ChevronRight, Pickaxe, MessageSquare, Star, HeartPulse,
  Menu, BarChart3,
} from "lucide-react";

const navSections = [
  {
    label: "General",
    items: [
      { id: "overview", label: "Overview", icon: LayoutDashboard },
      { id: "users", label: "Users", icon: Users },
      { id: "revenue", label: "Revenue", icon: DollarSign },
    ],
  },
  {
    label: "Content",
    items: [
      { id: "analyses", label: "Analyses", icon: FileText },
      { id: "credits", label: "Credits", icon: CreditCard },
      { id: "watchlist", label: "Watchlist", icon: Eye },
    ],
  },
  {
    label: "Communications",
    items: [
      { id: "notifications", label: "Notifications", icon: Bell },
      { id: "emails", label: "Email Logs", icon: Mail },
      { id: "feedback", label: "Feedback", icon: MessageSquare },
      { id: "reviews", label: "Reviews", icon: Star },
    ],
  },
  {
    label: "System",
    items: [
      { id: "live-feed", label: "Live Feed", icon: Flame },
      { id: "pipeline", label: "Pipeline", icon: Activity },
      { id: "data-health", label: "Data Sources", icon: HeartPulse },
    ],
  },
];

const AdminPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();

  const renderContent = () => {
    switch (activeTab) {
      case "overview": return <AdminOverview />;
      case "users": return <UserManagement />;
      case "revenue": return <RevenueManagement />;
      case "analyses": return <AnalysisManagement />;
      case "credits": return <CreditsManagement />;
      case "watchlist": return <WatchlistManagement />;
      case "notifications": return <NotificationsManagement />;
      case "emails": return <EmailLogs />;
      case "feedback": return <FeedbackManagement />;
      case "reviews": return <ReviewsManagement />;
      case "live-feed": return <LiveFeedControl />;
      case "pipeline": return <PipelineMetricsPanel />;
      case "data-health": return <DataSourceHealth />;
      default: return <AdminOverview />;
    }
  };

  const activeLabel = navSections
    .flatMap(s => s.items)
    .find(i => i.id === activeTab)?.label || "Overview";

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    if (isMobile) setMobileOpen(false);
  };

  const navContent = (
    <>
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border/50">
        <Shield className="h-5 w-5 text-primary shrink-0" />
        <span className="font-bold text-sm text-foreground truncate">Admin Panel</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 mb-1.5">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-border/50 p-2 space-y-1">
        <button
          onClick={() => navigate('/dashboard')}
          className="w-full flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
        >
          <Pickaxe className="h-4 w-4 shrink-0" />
          <span>Back to App</span>
        </button>
      </div>
    </>
  );

  return (
    <AdminGuard>
      <div className="min-h-screen bg-background flex">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <aside
            className={cn(
              "sticky top-0 h-screen border-r border-border/50 bg-card/30 backdrop-blur-sm flex flex-col transition-all duration-200 shrink-0 z-40",
              sidebarCollapsed ? "w-16" : "w-60"
            )}
          >
            {sidebarCollapsed ? (
              <>
                <div className="flex items-center justify-center px-2 py-4 border-b border-border/50">
                  <Shield className="h-5 w-5 text-primary shrink-0" />
                </div>
                <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
                  {navSections.map((section) => (
                    <div key={section.label} className="space-y-0.5">
                      {section.items.map((item) => {
                        const isActive = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={cn(
                              "w-full flex items-center justify-center rounded-md p-2 text-sm transition-colors",
                              isActive
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                            title={item.label}
                          >
                            <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </nav>
                <div className="border-t border-border/50 p-2 space-y-1">
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="w-full flex items-center justify-center rounded-md p-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                    title="Back to App"
                  >
                    <Pickaxe className="h-4 w-4 shrink-0" />
                  </button>
                  <button
                    onClick={() => setSidebarCollapsed(false)}
                    className="w-full flex items-center justify-center rounded-md p-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                  >
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  </button>
                </div>
              </>
            ) : (
              <>
                {navContent}
                <div className="border-t border-border/50 p-2">
                  <button
                    onClick={() => setSidebarCollapsed(true)}
                    className="w-full flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4 shrink-0" />
                    <span>Collapse</span>
                  </button>
                </div>
              </>
            )}
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {/* Top Bar */}
          <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-sm px-4 md:px-6 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {isMobile && (
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-64 p-0 flex flex-col">
                    {navContent}
                  </SheetContent>
                </Sheet>
              )}
              <h1 className="text-base md:text-lg font-semibold text-foreground truncate">{activeLabel}</h1>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="hidden sm:inline">System Online</span>
            </div>
          </header>

          {/* Content Area */}
          <div className="p-4 md:p-6 max-w-7xl">
            {renderContent()}
          </div>
        </main>
      </div>
    </AdminGuard>
  );
};

export default AdminPage;
