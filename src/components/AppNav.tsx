import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { Coins, LogOut, Flame, Shield, Bookmark, Menu, X, LayoutDashboard, Settings } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { ReviewDialog } from "@/components/ReviewDialog";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();

  const navItems = [
    ...(location.pathname !== "/dashboard"
      ? [{ label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" }]
      : []),
    { label: "Live", icon: Flame, path: "/live" },
    ...(location.pathname !== "/watchlist"
      ? [{ label: "Watchlist", icon: Bookmark, path: "/watchlist" }]
      : []),
    { label: "Settings", icon: Settings, path: "/settings" },
    ...(isAdmin
      ? [{ label: "Admin", icon: Shield, path: "/admin" }]
      : []),
  ];

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <nav className="flex items-center justify-between px-6 py-3.5 max-w-5xl mx-auto border-b border-border relative z-50">
      <span className="font-heading text-[15px] font-bold tracking-[-0.02em] text-foreground">Gold Rush</span>

      {/* Desktop nav */}
      <div className="hidden md:flex items-center gap-3">
        {showCredits && credits !== undefined && (
          <div className="flex items-center gap-1.5 bg-card border border-border rounded-full px-3 py-1.5 text-sm">
            <Coins className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-foreground">{credits}</span>
            <span className="text-muted-foreground">credits</span>
          </div>
        )}
        {navItems.map((item) => (
          <Button
            key={item.path}
            variant="ghost"
            size="sm"
            onClick={() => go(item.path)}
            className="text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <item.icon className="w-3.5 h-3.5 mr-1" /> {item.label}
          </Button>
        ))}
        <FeedbackDialog />
        <ReviewDialog />
        <NotificationBell />
        <ThemeToggle />
        {onSignOut && (
          <Button variant="ghost" size="icon" onClick={onSignOut} className="text-muted-foreground hover:text-foreground">
            <LogOut className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Mobile hamburger */}
      <div className="flex md:hidden items-center gap-2">
        {showCredits && credits !== undefined && (
          <div className="flex items-center gap-1 bg-card border border-border rounded-full px-2.5 py-1 text-xs">
            <Coins className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-semibold text-foreground">{credits}</span>
          </div>
        )}
        <NotificationBell />
        <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Backdrop overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile slide-in panel */}
      <div
        className={`fixed top-0 right-0 h-full w-72 bg-background border-l border-border z-50 p-6 flex flex-col gap-3 md:hidden transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="font-heading text-lg font-bold text-foreground">Menu</span>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {navItems.map((item, i) => (
          <Button
            key={item.path}
            variant="ghost"
            className="justify-start h-11 text-base text-muted-foreground hover:text-foreground"
            style={{ animationDelay: `${i * 50}ms` }}
            onClick={() => go(item.path)}
          >
            <item.icon className="w-4 h-4 mr-3" /> {item.label}
          </Button>
        ))}

        <div className="mt-auto flex items-center justify-between pt-4 border-t border-border">
          <ThemeToggle />
          {onSignOut && (
            <Button variant="ghost" size="sm" onClick={() => { onSignOut(); setOpen(false); }} className="text-muted-foreground">
              <LogOut className="w-4 h-4 mr-1" /> Sign Out
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
};
