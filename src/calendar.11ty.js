// One calendar file per dated event: /calendar/<event file name>.ics ("Add to calendar" links).
// Events without a date yet ("date to come") get no file and no calendar links.
import { icsFile } from "../lib/calendar.js";

export default class {
  data() {
    return {
      layout: null,
      eleventyExcludeFromCollections: true,
      pagination: { data: "collections.events", size: 1, alias: "ev", before: (evs) => evs.filter((e) => e.data.event_date) },
      permalink: (data) => `/calendar/${data.ev.page.fileSlug}.ics`,
    };
  }
  render({ ev }) {
    return icsFile(ev.data, ev.page.fileSlug);
  }
}
