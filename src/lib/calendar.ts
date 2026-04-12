export function createGoogleCalendarLink(location: string) {
  const title = encodeURIComponent("Property Visit - Real Estate Agency");
  const details = encodeURIComponent(`Property visit request for ${location}`);
  const dates = "20260413T100000Z/20260413T103000Z";

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${dates}`;
}
