import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BellRing, Clock3, MapPinned, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_MONITOR_FREQUENCY_HOURS,
  formatMonitorFrequency,
  formatMonitorTime,
  getBrowserTimeZone,
  getNextRunLabel,
  normalizeMonitorTime,
} from "@/lib/monitoring";

type SavedSearchRow = {
  id: string;
  name: string;
  filters: { location?: string } | null;
  is_monitored?: boolean | null;
  monitor_frequency_hours?: number | null;
  monitor_run_time?: string | null;
  monitor_timezone?: string | null;
  last_monitored_at?: string | null;
};

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  saved_search_id?: string | null;
};

type DraftState = {
  is_monitored: boolean;
  monitor_frequency_hours: number;
  monitor_run_time: string;
  monitor_timezone: string;
};

const FREQUENCY_OPTIONS = [1, 6, 12, 24];

const buildDraft = (search: SavedSearchRow): DraftState => ({
  is_monitored: !!search.is_monitored,
  monitor_frequency_hours: search.monitor_frequency_hours ?? DEFAULT_MONITOR_FREQUENCY_HOURS,
  monitor_run_time: normalizeMonitorTime(search.monitor_run_time),
  monitor_timezone: search.monitor_timezone || getBrowserTimeZone(),
});

const MonitoredAreas = () => {
  const navigate = useNavigate();
  const { user, loading, profile } = useAuth();
  const [searches, setSearches] = useState<SavedSearchRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [loading, navigate, user]);

  useEffect(() => {
    if (!user) return;

    supabase
      .from("saved_searches" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          toast.error("Failed to load saved searches.");
          return;
        }

        const nextSearches = (data ?? []) as SavedSearchRow[];
        setSearches(nextSearches);
        setDrafts(Object.fromEntries(nextSearches.map((search) => [search.id, buildDraft(search)])));
      });

    supabase
      .from("notifications" as any)
      .select("*")
      .eq("user_id", user.id)
      .not("saved_search_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) {
          toast.error("Failed to load alert history.");
          return;
        }

        setNotifications((data ?? []) as NotificationRow[]);
      });
  }, [user]);

  const notificationsBySearch = useMemo(() => {
    return notifications.reduce<Record<string, NotificationRow[]>>((acc, notification) => {
      if (!notification.saved_search_id) return acc;
      acc[notification.saved_search_id] = [...(acc[notification.saved_search_id] ?? []), notification];
      return acc;
    }, {});
  }, [notifications]);

  const monitoredCount = searches.filter((search) => search.is_monitored).length;
  const alertsLast7Days = notifications.filter((notification) => {
    return Date.now() - new Date(notification.created_at).getTime() < 7 * 24 * 60 * 60 * 1000;
  }).length;

  const handleDraftChange = (id: string, updates: Partial<DraftState>) => {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? {
          is_monitored: false,
          monitor_frequency_hours: DEFAULT_MONITOR_FREQUENCY_HOURS,
          monitor_run_time: "",
          monitor_timezone: getBrowserTimeZone(),
        }),
        ...updates,
      },
    }));
  };

  const handleSave = async (search: SavedSearchRow) => {
    const draft = drafts[search.id];
    if (!draft) return;

    setSavingId(search.id);
    const payload = {
      is_monitored: draft.is_monitored,
      monitor_frequency_hours: draft.monitor_frequency_hours,
      monitor_run_time: draft.monitor_frequency_hours >= 24 && draft.monitor_run_time ? draft.monitor_run_time : null,
      monitor_timezone: draft.monitor_timezone || getBrowserTimeZone(),
    };

    const { data, error } = await supabase
      .from("saved_searches" as any)
      .update(payload)
      .eq("id", search.id)
      .select("*")
      .single();

    setSavingId(null);

    if (error) {
      toast.error("Failed to update monitoring settings.");
      return;
    }

    const updatedSearch = data as SavedSearchRow;
    setSearches((current) => current.map((item) => (item.id === search.id ? updatedSearch : item)));
    setDrafts((current) => ({ ...current, [search.id]: buildDraft(updatedSearch) }));
    toast.success("Monitoring settings updated.");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background">
      <AppNav credits={profile?.credits} onSignOut={handleSignOut} />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Monitoring</p>
            <h1 className="mt-1 font-heading text-3xl font-semibold text-foreground">Monitored Areas</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Control which saved searches run automatically, how often they run, and when daily checks should fire.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Back to Search
          </Button>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Saved Searches</CardDescription>
              <CardTitle>{searches.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Monitored Now</CardDescription>
              <CardTitle>{monitoredCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Alerts Last 7 Days</CardDescription>
              <CardTitle>{alertsLast7Days}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {searches.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-start gap-4 p-6">
              <div>
                <p className="text-lg font-semibold text-foreground">No saved searches yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Save a ZIP or property search from the dashboard first. Monitoring runs off saved searches.
                </p>
              </div>
              <Button onClick={() => navigate("/dashboard")}>Go to Search</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {searches.map((search) => {
              const draft = drafts[search.id] ?? buildDraft(search);
              const recentAlerts = notificationsBySearch[search.id] ?? [];
              const location = search.filters?.location || search.name;

              return (
                <Card key={search.id}>
                  <CardHeader className="gap-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <CardTitle className="flex items-center gap-2 text-xl">
                          <MapPinned className="h-4 w-4" />
                          <span className="truncate">{search.name}</span>
                        </CardTitle>
                        <CardDescription className="mt-1">{location}</CardDescription>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">Monitor</span>
                        <Switch
                          checked={draft.is_monitored}
                          onCheckedChange={(checked) => handleDraftChange(search.id, { is_monitored: checked })}
                        />
                        <Button
                          variant="outline"
                          onClick={() => navigate(`/dashboard?savedSearch=${search.id}`)}
                        >
                          Open Search
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Frequency</Label>
                          <Select
                            value={String(draft.monitor_frequency_hours)}
                            onValueChange={(value) =>
                              handleDraftChange(search.id, {
                                monitor_frequency_hours: Number(value),
                                monitor_run_time: Number(value) >= 24 ? draft.monitor_run_time : "",
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FREQUENCY_OPTIONS.map((hours) => (
                                <SelectItem key={hours} value={String(hours)}>
                                  {formatMonitorFrequency(hours)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Timezone</Label>
                          <Input
                            value={draft.monitor_timezone}
                            onChange={(event) => handleDraftChange(search.id, { monitor_timezone: event.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Daily Run Time</Label>
                          <Input
                            type="time"
                            value={draft.monitor_run_time}
                            disabled={draft.monitor_frequency_hours < 24}
                            onChange={(event) => handleDraftChange(search.id, { monitor_run_time: event.target.value })}
                          />
                          <p className="text-[11px] text-muted-foreground">
                            {draft.monitor_frequency_hours >= 24
                              ? "Used for daily monitoring."
                              : "Available when frequency is set to daily."}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Status</Label>
                          <div className="rounded-xl border border-border bg-secondary/20 px-3 py-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Clock3 className="h-4 w-4" />
                              <span>{getNextRunLabel({
                                is_monitored: draft.is_monitored,
                                monitor_frequency_hours: draft.monitor_frequency_hours,
                                monitor_run_time: draft.monitor_run_time,
                                monitor_timezone: draft.monitor_timezone,
                                last_monitored_at: search.last_monitored_at,
                              })}</span>
                            </div>
                            <div className="mt-2 text-[11px]">
                              {search.last_monitored_at
                                ? `Last checked ${new Date(search.last_monitored_at).toLocaleString()}`
                                : "No monitor run yet"}
                            </div>
                            {draft.monitor_frequency_hours >= 24 && draft.monitor_run_time && (
                              <div className="mt-1 text-[11px]">
                                Daily at {formatMonitorTime(draft.monitor_run_time)} ({draft.monitor_timezone})
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <BellRing className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-medium text-foreground">Alert History</p>
                        </div>

                        {recentAlerts.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
                            No alerts yet for this monitored area.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {recentAlerts.slice(0, 3).map((notification) => (
                              <div key={notification.id} className="rounded-xl border border-border/70 bg-background/80 p-3">
                                <p className="text-sm font-medium text-foreground">{notification.title}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{notification.message}</p>
                                <p className="mt-2 text-[11px] text-muted-foreground">
                                  {new Date(notification.created_at).toLocaleString()}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                      <div className="text-xs text-muted-foreground">
                        Automatic checks run every 15 minutes in the background and only execute when this search is due.
                      </div>
                      <Button onClick={() => handleSave(search)} disabled={savingId === search.id}>
                        {savingId === search.id ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Monitoring"
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default MonitoredAreas;
