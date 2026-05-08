import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Calendar, ExternalLink, Loader2, PhoneCall, CalendarPlus, Check } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Meeting {
  id: string;
  property_id: string;
  homeowner_phone: string;
  homeowner_name: string | null;
  scheduled_at: string | null;
  scheduled_at_raw: string | null;
  status: string;
  created_at: string;
  properties?: { address: string; city: string; state: string } | null;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400",
  confirmed: "bg-emerald-500/15 text-emerald-400",
  cancelled: "bg-secondary text-muted-foreground",
};

const formatPhone = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d.startsWith("1")) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return phone;
};

const buildGoogleCalendarUrl = (meeting: Meeting): string => {
  const prop = meeting.properties;
  const title = encodeURIComponent(`Call: ${prop?.address ?? meeting.homeowner_phone}`);
  const details = encodeURIComponent(
    `Homeowner: ${meeting.homeowner_name ?? formatPhone(meeting.homeowner_phone)}\nPhone: ${formatPhone(meeting.homeowner_phone)}\n${prop ? `Property: ${prop.address}, ${prop.city}, ${prop.state}` : ""}`
  );

  if (meeting.scheduled_at) {
    const start = new Date(meeting.scheduled_at);
    const end = new Date(start.getTime() + 15 * 60000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${details}`;
  }
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}`;
};

const downloadICS = (meeting: Meeting) => {
  const prop = meeting.properties;
  const title = `Call: ${prop?.address ?? meeting.homeowner_phone}`;
  const description = `Homeowner: ${meeting.homeowner_name ?? formatPhone(meeting.homeowner_phone)}\\nPhone: ${formatPhone(meeting.homeowner_phone)}`;

  let dtStart = "";
  let dtEnd = "";

  if (meeting.scheduled_at) {
    const start = new Date(meeting.scheduled_at);
    const end = new Date(start.getTime() + 15 * 60000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    dtStart = `DTSTART:${fmt(start)}`;
    dtEnd = `DTEND:${fmt(end)}`;
  } else {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    dtStart = `DTSTART:${fmt(now)}`;
    dtEnd = `DTEND:${fmt(new Date(now.getTime() + 15 * 60000))}`;
  }

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Deal Hunter//EN",
    "BEGIN:VEVENT",
    `UID:${meeting.id}@deal-hunter`,
    dtStart,
    dtEnd,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `meeting-${meeting.id.slice(0, 8)}.ics`;
  a.click();
  URL.revokeObjectURL(url);
};

const Meetings = () => {
  const navigate = useNavigate();
  const { user, loading, profile } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(true);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleStatusChange = async (id: string, status: string) => {
    await (supabase as any).from("meetings").update({ status }).eq("id", id);
    setMeetings((prev) => prev.map((m) => m.id === id ? { ...m, status } : m));
  };

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .from("meetings")
      .select("*, properties(address, city, state)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }: { data: Meeting[] | null }) => {
        setMeetings(data ?? []);
        setLoadingMeetings(false);
      });
  }, [user]);

  if (loading) return null;

  const pending = meetings.filter((m) => m.status === "pending").length;
  const confirmed = meetings.filter((m) => m.status === "confirmed").length;

  return (
    <div className="min-h-screen bg-background">
      <AppNav credits={profile?.credits} onSignOut={handleSignOut} />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold text-foreground">Meetings</h1>
          </div>
          {meetings.length > 0 && (
            <div className="flex gap-3 text-xs text-muted-foreground">
              {pending > 0 && <span className="px-2 py-1 rounded-full bg-amber-500/10 text-amber-400">{pending} pending</span>}
              {confirmed > 0 && <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400">{confirmed} confirmed</span>}
            </div>
          )}
        </div>

        {loadingMeetings ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">Loading meetings...</span>
          </div>
        ) : meetings.length === 0 ? (
          <Card className="border-border/80 bg-card/90">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <PhoneCall className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">No meetings yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Meetings booked via SMS conversations will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/80 bg-card/90">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-normal">
                {meetings.length} meeting{meetings.length !== 1 ? "s" : ""} booked
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {meetings.map((meeting) => (
                  <div key={meeting.id} className="flex items-start justify-between gap-4 px-6 py-4">
                    <div className="min-w-0 space-y-1.5 flex-1">
                      {meeting.properties && (
                        <Link
                          to={`/property/${meeting.property_id}`}
                          className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:underline"
                        >
                          {meeting.properties.address}, {meeting.properties.city}, {meeting.properties.state}
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </Link>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {meeting.homeowner_name && <span className="font-medium text-foreground">{meeting.homeowner_name}</span>}
                        <span>{formatPhone(meeting.homeowner_phone)}</span>
                        {meeting.scheduled_at_raw && (
                          <span className="font-medium text-foreground">{meeting.scheduled_at_raw}</span>
                        )}
                      </div>

                      {/* Calendar actions */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <a
                          href={buildGoogleCalendarUrl(meeting)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                        >
                          <CalendarPlus className="h-3 w-3" />
                          Add to Google Calendar
                        </a>
                        <button
                          onClick={() => { downloadICS(meeting); toast.success("Calendar file downloaded."); }}
                          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          <CalendarPlus className="h-3 w-3" />
                          Download .ics
                        </button>
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-2 pt-0.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_STYLES[meeting.status] ?? STATUS_STYLES.pending}`}>
                        {meeting.status}
                      </span>
                      {meeting.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2"
                          onClick={() => handleStatusChange(meeting.id, "confirmed")}
                        >
                          <Check className="h-2.5 w-2.5 mr-1" />Confirm
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Meetings;
