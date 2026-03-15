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
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Shield, Users, FileText, CreditCard, Flame,
  LayoutDashboard, Bell, Eye, Activity, DollarSign, Mail,
  ChevronLeft, ChevronRight, Pickaxe, MessageSquare, Star,
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
    ],
  },
];

const AdminPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
      default: return <AdminOverview />;
    }
  };

  const activeLabel = navSections
    .flatMap(s => s.items)
    .find(i => i.id === activeTab)?.label || "Overview";

  return (
    <AdminGuard>
      <div className="min-h-screen bg-background flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "sticky top-0 h-screen border-r border-border/50 bg-card/30 backdrop-blur-sm flex flex-col transition-all duration-200 shrink-0 z-40",
            sidebarCollapsed ? "w-16" : "w-60"
          )}
        >
          {/* Sidebar Header */}
          <div className="flex items-center gap-2 px-4 py-4 border-b border-border/50">
            <Shield className="h-5 w-5 text-primary shrink-0" />
            {!sidebarCollapsed && (
              <span className="font-bold text-sm text-foreground truncate">Admin Panel</span>
            )}
          </div>

          {/* Nav Items */}
          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
            {navSections.map((section) => (
              <div key={section.label}>
                {!sidebarCollapsed && (
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 mb-1.5">
                    {section.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        )}
                        title={sidebarCollapsed ? item.label : undefined}
                      >
                        <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
                        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Sidebar Footer */}
          <div className="border-t border-border/50 p-2 space-y-1">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
              title={sidebarCollapsed ? "Back to Dashboard" : undefined}
            >
              <Pickaxe className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span>Back to App</span>}
            </button>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4 shrink-0" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4 shrink-0" />
                  <span>Collapse</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {/* Top Bar */}
          <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-sm px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-foreground">{activeLabel}</h1>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span>System Online</span>
            </div>
          </header>

          {/* Content Area */}
          <div className="p-6 max-w-7xl">
            {renderContent()}
          </div>
        </main>
      </div>
    </AdminGuard>
  );
};

export default AdminPage;
