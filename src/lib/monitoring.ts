export const DEFAULT_MONITOR_FREQUENCY_HOURS = 24;

type MonitorSchedule = {
  is_monitored?: boolean | null;
  monitor_frequency_hours?: number | null;
  monitor_run_time?: string | null;
  monitor_timezone?: string | null;
  last_monitored_at?: string | null;
};

const toZonedDate = (date: Date, timeZone: string) =>
  new Date(date.toLocaleString("en-US", { timeZone }));

const getDateKey = (date: Date) => date.toISOString().slice(0, 10);

export const getBrowserTimeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export const normalizeMonitorTime = (value?: string | null) => {
  if (!value) return "";
  const match = value.match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : "";
};

export const formatMonitorFrequency = (hours?: number | null) => {
  const value = hours ?? DEFAULT_MONITOR_FREQUENCY_HOURS;
  if (value === 1) return "Every hour";
  if (value < 24) return `Every ${value} hours`;
  if (value === 24) return "Daily";
  return `Every ${value} hours`;
};

export const formatMonitorTime = (value?: string | null) => {
  const normalized = normalizeMonitorTime(value);
  if (!normalized) return null;

  const [hours, minutes] = normalized.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

export const getNextRunLabel = (schedule: MonitorSchedule) => {
  if (!schedule.is_monitored) return "Monitoring off";

  const frequency = schedule.monitor_frequency_hours ?? DEFAULT_MONITOR_FREQUENCY_HOURS;
  const timeZone = schedule.monitor_timezone || getBrowserTimeZone();
  const normalizedTime = normalizeMonitorTime(schedule.monitor_run_time);

  if (frequency >= 24 && normalizedTime) {
    const now = new Date();
    const zonedNow = toZonedDate(now, timeZone);
    const [hours, minutes] = normalizedTime.split(":").map(Number);
    const scheduled = new Date(zonedNow);
    scheduled.setHours(hours, minutes, 0, 0);
    if (scheduled <= zonedNow) scheduled.setDate(scheduled.getDate() + 1);

    const dayLabel = getDateKey(scheduled) === getDateKey(zonedNow)
      ? "Today"
      : "Tomorrow";

    return `${dayLabel} at ${formatMonitorTime(normalizedTime)} (${timeZone})`;
  }

  if (!schedule.last_monitored_at) return "Next scheduler pass";

  const nextRun = new Date(schedule.last_monitored_at);
  nextRun.setHours(nextRun.getHours() + frequency);

  return nextRun.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};
