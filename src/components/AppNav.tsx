import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, Gavel, Shield, Menu, X, LayoutDashboard, Settings, Kanban, Target, Zap } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { ReviewDialog } from "@/components/ReviewDialog";

interface AppNavProps {
  credits?: number;
  onSignOut?: () => void;
  showCredits?: boolean;
}

export const AppNav = ({ credits, onSignOut, showCredits = true }: AppNavProps) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAdmin();

  const navItems = [
    { label: "Search", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Pipeline", icon: Kanban, path: "/pipeline" },
    { label: "Auctions", icon: Gavel, path: "/auctions" },
    { label: "Settings", icon: Settings, path: "/settings" },
    ...(isAdmin ? [{ label: "Admin", icon: Shield, path: "/admin" }] : []),
  ];

  const isActive = (path: string) => location.pathname === path;

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          {/* Logo */}
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Target className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-heading text-sm font-bold tracking-tight text-foreground hidden sm:block">Deal Hunter</span>
          </button>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(item => (
              <button
                key={item.path}
                onClick={() => go(item.path)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive(item.path)
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {showCredits && credits !== undefined && (
              <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs">
                <Zap className="h-3 w-3 text-primary" />
                <span className="font-semibold text-foreground">{credits}</span>
                <span className="text-muted-foreground hidden md:inline">traces</span>
              </div>
            )}
            <div className="hidden md:flex items-center gap-1">
              <FeedbackDialog />
              <ReviewDialog />
              <NotificationBell />
              <ThemeToggle />
              {onSignOut && (
                <Button variant="ghost" size="icon" onClick={onSignOut} className="text-muted-foreground hover:text-foreground h-8 w-8">
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {/* Mobile: credits pill + bell + hamburger */}
            <div className="flex md:hidden items-center gap-2">
              {showCredits && credits !== undefined && (
                <div className="flex items-center gap-1 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-xs">
                  <Zap className="h-3 w-3 text-primary" />
                  <span className="font-semibold text-foreground">{credits}</span>
                </div>
              )}
              <NotificationBell />
              <Button variant="ghost" size="icon" onClick={() => setOpen(!open)} className="h-8 w-8">
                {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile drawer overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Mobile drawer */}
      <div className={`fixed top-0 right-0 z-50 h-full w-72 border-l border-border bg-background flex flex-col md:hidden transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Target className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-heading font-bold text-foreground">Deal Hunter</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-1 p-3 flex-1">
          {navItems.map((item, i) => (
            <button
              key={item.path}
              onClick={() => go(item.path)}
              style={{ animationDelay: `${i * 40}ms` }}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                isActive(item.path)
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>

        <div className="border-t border-border p-4 flex items-center justify-between">
          <ThemeToggle />
          {onSignOut && (
            <Button variant="ghost" size="sm" onClick={() => { onSignOut(); setOpen(false); }} className="text-muted-foreground gap-1.5">
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </Button>
          )}
        </div>
      </div>
    </>
  );
};
