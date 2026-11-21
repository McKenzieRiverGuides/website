// /admin/content.json: every post (drafts too) and event, for the on-site editor (assets/js/admin-editor.js).
// The editor uses it to list drafts and to fill the form in the local preview. On the live site, editing an item
// always loads the fresh file from GitHub instead. Everything here is already public in the repository.
const POST_FIELDS = ["title", "date", "author", "cover", "summary", "categories", "draft"];
const EVENT_FIELDS = ["title", "event_date", "when", "time", "place", "members_only", "description"];

const pick = (data, names) => Object.fromEntries(names.map((n) => [n, data[n] instanceof Date ? data[n].toISOString().slice(0, 10) : data[n] ?? ""]));
const body = (raw) => String(raw || "").replace(/^---[\s\S]*?\n---\r?\n?/, "");

export default class {
  data() {
    return { permalink: "/admin/content.json", eleventyExcludeFromCollections: true, layout: false };
  }
  render({ collections }) {
    const all = collections.all;
    const of = (dir) => all.filter((p) => p.inputPath.startsWith(`./src/${dir}/`) && p.inputPath.endsWith(".md"));
    const path = (p) => p.inputPath.replace(/^\.\//, "");
    return JSON.stringify({
      posts: of("posts").map((p) => ({ path: path(p), url: p.url, fields: pick(p.data, POST_FIELDS), body: body(p.rawInput) }))
        .sort((a, b) => String(b.fields.date).localeCompare(String(a.fields.date))),
      events: of("events").map((e) => ({ path: path(e), url: "/news/#events", fields: pick(e.data, EVENT_FIELDS) })),
    });
  }
}
