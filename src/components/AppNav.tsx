import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LogOut, Gavel, Shield, Menu, X, LayoutDashboard, Settings,
  Kanban, Phone, Coins, Flame, Bookmark,
} from "lucide-react";
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

const DEAL_HUNTER_PATHS = ["/deals", "/deal-batch", "/property", "/pipeline", "/auctions"];

function isDealHunterRoute(pathname: string) {
  return DEAL_HUNTER_PATHS.some((p) => pathname.startsWith(p));
}

export const AppNav = ({ credits, onSignOut, showCredits = true }: AppNavProps) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAdmin();

  const onDealHunter = isDealHunterRoute(location.pathname);

  const goldRushItems = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Live", icon: Flame, path: "/live" },
    { label: "Watchlist", icon: Bookmark, path: "/watchlist" },
  ];

  const dealHunterItems = [
    { label: "Deals", icon: Phone, path: "/deals" },
    { label: "Pipeline", icon: Kanban, path: "/pipeline" },
    { label: "Auctions", icon: Gavel, path: "/auctions" },
  ];

  const sharedItems = [
    { label: "Settings", icon: Settings, path: "/settings" },
    ...(isAdmin ? [{ label: "Admin", icon: Shield, path: "/admin" }] : []),
  ];

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const brand = onDealHunter
    ? { label: "Deal Hunter", icon: Phone, home: "/deals" }
    : { label: "Gold Rush", icon: Coins, home: "/dashboard" };

  const primaryItems = onDealHunter ? dealHunterItems : goldRushItems;
  const switchItem = onDealHunter
    ? { label: "Gold Rush", icon: Coins, path: "/dashboard" }
    : { label: "Deal Hunter", icon: Phone, path: "/deals" };

  return (
    <nav className="flex items-center justify-between px-6 py-3.5 max-w-7xl mx-auto border-b border-border relative z-50">
      {/* Brand */}
      <button
        onClick={() => navigate(brand.home)}
        className="flex items-center gap-2 font-heading text-[15px] font-bold tracking-[-0.02em] text-foreground"
      >
        <brand.icon className="h-4 w-4 text-primary" />
        {brand.label}
      </button>

      {/* Desktop nav */}
      <div className="hidden md:flex items-center gap-1">
        {showCredits && credits !== undefined && (
          <div className="flex items-center gap-1.5 bg-card border border-border rounded-full px-3 py-1.5 text-sm mr-2">
            <Coins className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-semibold text-foreground">{credits}</span>
            <span className="text-muted-foreground">{onDealHunter ? "skip traces" : "credits"}</span>
          </div>
        )}

        {primaryItems.map((item) => (
          <Button
            key={item.path}
            variant={location.pathname === item.path ? "secondary" : "ghost"}
            size="sm"
            onClick={() => go(item.path)}
            className="text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <item.icon className="w-3.5 h-3.5 mr-1" /> {item.label}
          </Button>
        ))}

        <div className="w-px h-4 bg-border mx-1" />

        {/* Switch to other app */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => go(switchItem.path)}
          className="text-muted-foreground hover:text-foreground hover:bg-secondary text-xs"
        >
          <switchItem.icon className="w-3.5 h-3.5 mr-1" />
          {switchItem.label}
        </Button>

        <div className="w-px h-4 bg-border mx-1" />

        {sharedItems.map((item) => (
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

      {/* Mobile */}
      <div className="flex md:hidden items-center gap-2">
        {showCredits && credits !== undefined && (
          <div className="flex items-center gap-1 bg-card border border-border rounded-full px-2.5 py-1 text-xs">
            <Coins className="w-3 h-3 text-muted-foreground" />
            <span className="font-semibold text-foreground">{credits}</span>
          </div>
        )}
        <NotificationBell />
        <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {open && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-72 bg-background border-l border-border z-50 p-6 flex flex-col gap-2 md:hidden transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="font-heading text-lg font-bold text-foreground">Menu</span>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
          {onDealHunter ? "Deal Hunter" : "Gold Rush"}
        </p>
        {primaryItems.map((item) => (
          <Button key={item.path} variant="ghost" className="justify-start h-10 text-muted-foreground hover:text-foreground" onClick={() => go(item.path)}>
            <item.icon className="w-4 h-4 mr-3" /> {item.label}
          </Button>
        ))}

        <div className="border-t border-border my-1" />
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
          Switch to
        </p>
        <Button variant="ghost" className="justify-start h-10 text-muted-foreground hover:text-foreground" onClick={() => go(switchItem.path)}>
          <switchItem.icon className="w-4 h-4 mr-3" /> {switchItem.label}
        </Button>

        <div className="border-t border-border my-1" />
        {sharedItems.map((item) => (
          <Button key={item.path} variant="ghost" className="justify-start h-10 text-muted-foreground hover:text-foreground" onClick={() => go(item.path)}>
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
