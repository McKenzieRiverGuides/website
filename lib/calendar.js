// "Add to calendar" helpers for events (src/events/*.md). Used by eleventy.config.js (Google link filter)
// and src/calendar.11ty.js (one .ics file per dated event at /calendar/<event>.ics).
// Events are all-day unless the optional Time field reads like "6 PM", "6:30 pm" or "18:00"; then they
// run two hours in the visitor's local time (fine for events on the McKenzie).

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate());

function parseTime(t) {
  const m = String(t || "").trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/);
  if (!m) return null;
  let h = +m[1];
  const min = +(m[2] || 0);
  if (m[3] && m[3][0] === "p" && h < 12) h += 12;
  if (m[3] && m[3][0] === "a" && h === 12) h = 0;
  if (!m[3] && !m[2]) return null; // a bare number isn't clearly a time
  return h < 24 && min < 60 ? { h, min } : null;
}

// Start/end in calendar format: all-day "20270109" / "20270110", or timed "20270109T180000" / "...T200000"
export function eventTimes(data) {
  const day = new Date(data.event_date);
  const next = new Date(day.getTime() + 864e5);
  const t = parseTime(data.time);
  if (!t) return { allDay: true, start: ymd(day), end: ymd(next) };
  const endH = t.h + 2;
  const endDay = endH >= 24 ? next : day;
  return { allDay: false, start: `${ymd(day)}T${pad(t.h)}${pad(t.min)}00`, end: `${ymd(endDay)}T${pad(endH % 24)}${pad(t.min)}00` };
}

const details = (data) => [data.description, "McKenzie River Guides Association · mckenzieguides.com"].filter(Boolean).join("\n\n");

export function googleLink(data) {
  const { start, end } = eventTimes(data);
  const q = new URLSearchParams({ action: "TEMPLATE", text: data.title, dates: `${start}/${end}`, details: details(data) });
  if (data.place) q.set("location", data.place);
  return "https://calendar.google.com/calendar/render?" + q.toString();
}

const icsText = (s) => String(s).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

export function icsFile(data, slug) {
  const { allDay, start, end } = eventTimes(data);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//McKenzie River Guides Association//Events//EN", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${slug}-${start.slice(0, 8)}@mckenzieguides.com`,
    `DTSTAMP:${stamp}`,
    allDay ? `DTSTART;VALUE=DATE:${start}` : `DTSTART:${start}`,
    allDay ? `DTEND;VALUE=DATE:${end}` : `DTEND:${end}`,
    `SUMMARY:${icsText(data.title)}`,
    data.place ? `LOCATION:${icsText(data.place)}` : null,
    `DESCRIPTION:${icsText(details(data))}`,
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean);
  // Calendar lines longer than 75 characters are folded (continued on the next line after a space).
  const fold = (l) => (l.length <= 74 ? l : l.match(/.{1,74}/gu).join("\r\n "));
  return lines.map(fold).join("\r\n") + "\r\n";
}
