const dayAliases: Record<string, string> = {
  monday: "monday",
  tuesday: "tuesday",
  wednesday: "wednesday",
  thursday: "thursday",
  friday: "friday",
  saturday: "saturday",
  sunday: "sunday",
  today: "today",
  tomorrow: "tomorrow",
  tomorow: "tomorrow",
  "next day": "tomorrow",
  "this day": "today",
};

export function extractPreferredVisitDay(message: string) {
  const lower = message.toLowerCase();
  if (/\bnext\s+day\b/i.test(lower)) return "tomorrow";
  if (/\bthis\s+day\b/i.test(lower)) return "today";
  const match = Object.keys(dayAliases).find((key) => new RegExp(`\\b${key}\\b`, "i").test(lower));
  if (match) return dayAliases[match];

  const thisWeekMatch = lower.match(/this\s+week/i);
  if (thisWeekMatch) return "this week";

  return null;
}

export function extractPreferredVisitPeriod(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("morning")) return "morning";
  if (lower.includes("afternoon")) return "afternoon";
  if (lower.includes("evening")) return "afternoon";
  return null;
}

export function buildDynamicCalendarLink(day: string, period: string, location: string) {
  const safeDay = sanitizeCalendarDay(day);
  const safePeriod = sanitizeCalendarPeriod(period);
  const safeLocation = sanitizeCalendarLocation(location);
  const slot = resolveVisitSlot(safeDay, safePeriod);
  const title = encodeURIComponent("Property Visit - Real Estate Agency");
  const details = encodeURIComponent(`Visit request in ${safeLocation}. Slot: ${slot.displayLabel}.`);
  const startIso = toUtcCompact(slot.start);
  const endIso = toUtcCompact(slot.end);
  const dates = `${startIso}/${endIso}`;

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${dates}`;
}

export function resolveVisitSlot(day: string, period: string, now = new Date()) {
  const safeDay = sanitizeCalendarDay(day);
  const safePeriod = sanitizeCalendarPeriod(period);
  const base = new Date(now);
  base.setSeconds(0, 0);

  const target = new Date(base);

  if (safeDay === "today") {
    // Keep today.
  } else if (safeDay === "tomorrow") {
    target.setDate(target.getDate() + 1);
  } else if (safeDay === "this week") {
    const diff = (1 + 7 - target.getDay()) % 7 || 7;
    target.setDate(target.getDate() + diff);
  } else {
    const weekdayMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    const desired = weekdayMap[safeDay] ?? 1;
    const delta = (desired + 7 - target.getDay()) % 7 || 7;
    target.setDate(target.getDate() + delta);
  }

  if (safePeriod === "morning") {
    target.setHours(10, 0, 0, 0);
  } else {
    target.setHours(14, 0, 0, 0);
  }

  const end = new Date(target);
  end.setMinutes(end.getMinutes() + 45);

  const displayLabel = target.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return {
    start: target,
    end,
    displayLabel,
  };
}

function sanitizeCalendarDay(day: string) {
  const normalized = day.trim().toLowerCase();
  const allowed = new Set(["today", "tomorrow", "this week", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
  return allowed.has(normalized) ? normalized : "this week";
}

function sanitizeCalendarPeriod(period: string) {
  const normalized = period.trim().toLowerCase();
  return normalized === "morning" ? "morning" : "afternoon";
}

function sanitizeCalendarLocation(location: string) {
  const cleaned = location
    .trim()
    .replace(/[^a-zA-Z\s-]/g, "")
    .replace(/\s+/g, " ");

  return cleaned || "your preferred location";
}

function toUtcCompact(value: Date) {
  const yyyy = value.getUTCFullYear();
  const mm = String(value.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(value.getUTCDate()).padStart(2, "0");
  const hh = String(value.getUTCHours()).padStart(2, "0");
  const mi = String(value.getUTCMinutes()).padStart(2, "0");
  const ss = String(value.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}
