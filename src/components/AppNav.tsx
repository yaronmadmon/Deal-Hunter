import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, Gavel, Shield, Menu, X, LayoutDashboard, Settings, Kanban, Phone, BellRing, ListTodo, Calendar, MessageSquare, Sun } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { useFollowUpCount } from "@/hooks/useFollowUpCount";
import { useMeetingCount } from "@/hooks/useMeetingCount";
import { useInboxCount } from "@/hooks/useInboxCount";
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
  const overdueCount = useFollowUpCount();
  const meetingCount = useMeetingCount();
  const inboxCount = useInboxCount();

  const navItems: { label: string; icon: React.ElementType; path: string; badge?: number }[] = [
    ...(location.pathname !== "/dashboard"
      ? [{ label: "Deal Search", icon: LayoutDashboard, path: "/dashboard" }]
      : []),
    { label: "Today", icon: Sun, path: "/today" },
    { label: "Pipeline", icon: Kanban, path: "/pipeline" },
    { label: "Inbox", icon: MessageSquare, path: "/inbox", badge: inboxCount },
    { label: "Follow-Up", icon: ListTodo, path: "/follow-up", badge: overdueCount },
    { label: "Meetings", icon: Calendar, path: "/meetings", badge: meetingCount },
    { label: "Monitoring", icon: BellRing, path: "/monitored-areas" },
    { label: "Auctions", icon: Gavel, path: "/auctions" },
    { label: "Settings", icon: Settings, path: "/settings" },
    ...(isAdmin ? [{ label: "Admin", icon: Shield, path: "/admin" }] : []),
  ];

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <nav className="relative z-50 mx-auto flex max-w-7xl items-center justify-between border-b border-border px-4 py-3 sm:px-6 sm:py-3.5">
      <button
        onClick={() => navigate("/dashboard")}
        className="flex items-center gap-2 font-heading text-sm font-bold tracking-[-0.02em] text-foreground sm:text-[15px]"
      >
        <Phone className="h-4 w-4 text-primary" />
        Deal Hunter
      </button>

      {/* Desktop nav */}
      <div className="hidden md:flex items-center gap-3">
        {showCredits && credits !== undefined && (
          <div className="flex items-center gap-1.5 bg-card border border-border rounded-full px-3 py-1.5 text-sm">
            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-semibold text-foreground">{credits}</span>
            <span className="text-muted-foreground">skip traces</span>
            {credits === 0 && (
              <button
                onClick={() => go("/buy-credits")}
                className="ml-0.5 text-primary font-bold hover:opacity-70 leading-none"
                title="Buy more skip traces"
              >+</button>
            )}
          </div>
        )}
        {navItems.map((item) => (
          <Button
            key={item.path}
            variant="ghost"
            size="sm"
            onClick={() => go(item.path)}
            className="relative text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <item.icon className="w-3.5 h-3.5 mr-1" /> {item.label}
            {(item.badge ?? 0) > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center font-bold px-0.5">
                {(item.badge ?? 0) > 9 ? "9+" : item.badge}
              </span>
            )}
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
            <Phone className="w-3 h-3 text-muted-foreground" />
            <span className="font-semibold text-foreground">{credits}</span>
            {credits === 0 && (
              <button onClick={() => go("/buy-credits")} className="text-primary font-bold hover:opacity-70 leading-none" title="Buy more">+</button>
            )}
          </div>
        )}
        <NotificationBell />
        <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {open && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          onClick={() => setOpen(false)}
        />
      )}

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
            className="relative justify-start h-11 text-base text-muted-foreground hover:text-foreground"
            style={{ animationDelay: `${i * 50}ms` }}
            onClick={() => go(item.path)}
          >
            <item.icon className="w-4 h-4 mr-3" /> {item.label}
            {(item.badge ?? 0) > 0 && (
              <span className="ml-auto min-w-[20px] h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold px-1">
                {(item.badge ?? 0) > 9 ? "9+" : item.badge}
              </span>
            )}
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
