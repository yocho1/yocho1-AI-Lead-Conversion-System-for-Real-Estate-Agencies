const dayKeywords = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "today",
  "tomorrow",
];

export function extractPreferredVisitDay(message: string) {
  const lower = message.toLowerCase();
  const match = dayKeywords.find((day) => lower.includes(day));
  if (match) return match;

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
  const title = encodeURIComponent("Property Visit - Real Estate Agency");
  const details = encodeURIComponent(`Visit request in ${location}. Preferred: ${day}, ${period}.`);
  const dates = period === "morning" ? "20260420T090000Z/20260420T093000Z" : "20260420T140000Z/20260420T143000Z";

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${dates}`;
}
