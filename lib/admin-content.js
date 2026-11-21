// Shared rules for the on-site editor ("post from the page"): which files it may write, how a post or
// event file is put together, and how a file is read back for editing.
// Used by functions/api/admin/[[path]].js (the Cloudflare function that saves to GitHub).
// The fields match .pages.yml, so Pages CMS and the on-site editor write the same kind of file.
import yaml from "js-yaml";

// What each content type looks like. Fields not listed here (tags, imported_from, cover_alt …) are kept
// as they are when a file is edited.
export const TYPES = {
  posts: {
    dir: "src/posts",
    fields: {
      title: "string", date: "date", author: "string", cover: "image", summary: "text",
      categories: "list", draft: "boolean",
    },
    required: ["title", "date"],
    // File name: "2026-11-21-headline-words.md". Address on the site: /news/headline-words/
    fileName: (f) => `${f.date}-${slugify(f.title)}.md`,
    url: (path) => `/news/${path.split("/").pop().replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "")}/`,
    imageDir: (path) => `src/images/posts/${path.split("/").pop().replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "")}`,
  },
  events: {
    dir: "src/events",
    fields: {
      title: "string", event_date: "date", when: "string", time: "string", place: "string",
      members_only: "boolean", description: "text",
    },
    required: ["title"],
    fileName: (f) => `${slugify(f.title)}.md`,
    url: () => "/news/#events",
    imageDir: () => "src/images/events",
  },
};

// "The Secret to the McKenzie’s Steady Flow" → "the-secret-to-the-mckenzies-steady-flow"
export function slugify(s) {
  return String(s || "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/['’‘`]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 80).replace(/-+$/, "") || "untitled";
}

// Only plain .md files directly inside the type's folder, and only images inside the type's image folder.
export function isContentPath(type, path) {
  const t = TYPES[type];
  return !!t && new RegExp(`^${t.dir}/[a-z0-9][a-z0-9-]*\\.md$`).test(String(path || ""));
}
// New photos arrive with a plain file name ("photo-k3x9.jpg"); they're saved in the item's image folder.
export const isUploadName = (name) => /^[a-z0-9][a-z0-9-]{0,60}\.(jpe?g|png|webp)$/.test(String(name || ""));
// In the form, a new photo is written "upload:photo-k3x9.jpg" until the save puts it in its folder.
export function placeUploads(text, type, path) {
  const dir = TYPES[type].imageDir(path).replace(/^src/, "");
  return String(text || "").replace(/upload:([a-z0-9][a-z0-9-]{0,60}\.(?:jpe?g|png|webp))/g, `${dir}/$1`);
}

// Split a Markdown file into its front matter (as an object) and body.
export function parseFile(text) {
  const m = String(text || "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: String(text || "") };
  return { data: yaml.load(m[1]) || {}, body: m[2] };
}

// Dates come back from YAML as Date objects; the form wants "YYYY-MM-DD".
const dayOf = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v || "").slice(0, 10));

// Front matter → the values the form shows.
export function formValues(type, data) {
  const out = {};
  for (const [name, kind] of Object.entries(TYPES[type].fields)) {
    const v = data[name];
    if (kind === "date") out[name] = v ? dayOf(v) : "";
    else if (kind === "boolean") out[name] = !!v;
    else if (kind === "list") out[name] = Array.isArray(v) ? v.map(String) : v ? [String(v)] : [];
    else out[name] = v == null ? "" : String(v);
  }
  return out;
}

// Check and tidy what the form sent. Returns { fields } or { error }.
export function cleanFields(type, input) {
  const t = TYPES[type];
  const f = {};
  for (const [name, kind] of Object.entries(t.fields)) {
    const v = input?.[name];
    if (kind === "boolean") f[name] = v === true;
    else if (kind === "list") f[name] = (Array.isArray(v) ? v : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 12);
    else f[name] = String(v ?? "").trim().slice(0, kind === "text" ? 2000 : 300);
    if (kind === "date" && f[name] && !/^\d{4}-\d{2}-\d{2}$/.test(f[name])) return { error: `The ${name.replace("_", " ")} doesn't look like a date.` };
    if (kind === "image" && f[name] && !/^\/images\/[\w./-]+\.(jpe?g|png|webp|gif)$/i.test(f[name])) return { error: "That photo address isn't one the website can use." };
  }
  for (const r of t.required) if (!f[r]) return { error: `Please fill in the ${r === "title" ? "headline" : r}.` };
  return { fields: f };
}

// Put a file together: the existing front matter (so unknown fields survive) updated with the form's fields.
// An unchanged date keeps its original time of day.
export function buildFile(type, fields, body, existing = {}) {
  const data = { ...existing };
  for (const [name, kind] of Object.entries(TYPES[type].fields)) {
    const v = fields[name];
    if (kind === "date" && existing[name] && dayOf(existing[name]) === v) continue;
    // Leave optional fields out of new files when empty; on edits, clear them
    const empty = v === "" || v === false || (Array.isArray(v) && !v.length);
    if (empty && !(name in existing) && !(type === "posts" && name === "categories")) continue;
    data[name] = v;
  }
  let fm = yaml.dump(data, { lineWidth: -1, quotingType: '"', noRefs: true });
  // Plain dates read better unquoted (same as Pages CMS writes them)
  fm = fm.replace(/^(date|event_date): ["'](\d{4}-\d{2}-\d{2})["']$/gm, "$1: $2");
  const text = String(body || "").replace(/\r\n/g, "\n").trim();
  return `---\n${fm}---\n${text ? text + "\n" : ""}`;
}
