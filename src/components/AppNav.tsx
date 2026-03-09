import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { Coins, LogOut, Flame, Shield, Bookmark, Menu, X, LayoutDashboard } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
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
    { label: "Live", icon: Flame, path: "/live", className: "text-orange-500" },
    ...(location.pathname !== "/watchlist"
      ? [{ label: "Watchlist", icon: Bookmark, path: "/watchlist" }]
      : []),
    ...(isAdmin
      ? [{ label: "Admin", icon: Shield, path: "/admin", className: "text-gold" }]
      : []),
  ];

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto border-b border-border/50 relative">
      <span className="font-heading text-xl font-bold text-foreground">⛏️ Gold Rush</span>

      {/* Desktop nav */}
      <div className="hidden md:flex items-center gap-3">
        {showCredits && credits !== undefined && (
          <div className="flex items-center gap-1.5 bg-card border rounded-full px-3 py-1.5 text-sm">
            <Coins className="w-4 h-4 text-primary" />
            <span className="font-semibold text-foreground">{credits}</span>
            <span className="text-muted-foreground">credits</span>
          </div>
        )}
        {navItems.map((item) => (
          <Button
            key={item.path}
            variant="outline"
            size="sm"
            onClick={() => go(item.path)}
            className={item.className}
          >
            <item.icon className="w-3.5 h-3.5 mr-1" /> {item.label}
          </Button>
        ))}
        <NotificationBell />
        <ThemeToggle />
        {onSignOut && (
          <Button variant="ghost" size="icon" onClick={onSignOut}>
            <LogOut className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Mobile hamburger */}
      <div className="flex md:hidden items-center gap-2">
        {showCredits && credits !== undefined && (
          <div className="flex items-center gap-1 bg-card border rounded-full px-2.5 py-1 text-xs">
            <Coins className="w-3.5 h-3.5 text-primary" />
            <span className="font-semibold text-foreground">{credits}</span>
          </div>
        )}
        <NotificationBell />
        <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 bg-background border-b border-border z-50 p-4 flex flex-col gap-2 md:hidden animate-in slide-in-from-top-2 duration-200">
          {navItems.map((item) => (
            <Button
              key={item.path}
              variant="ghost"
              className={`justify-start ${item.className ?? ""}`}
              onClick={() => go(item.path)}
            >
              <item.icon className="w-4 h-4 mr-2" /> {item.label}
            </Button>
          ))}
          <div className="flex items-center justify-between pt-2 border-t border-border mt-1">
            <ThemeToggle />
            {onSignOut && (
              <Button variant="ghost" size="sm" onClick={onSignOut} className="text-muted-foreground">
                <LogOut className="w-4 h-4 mr-1" /> Sign Out
              </Button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};
