// Eleventy config for the MRGA website. See AGENTS.md for the project rules.
import { existsSync } from "node:fs";
import { googleLink } from "./lib/calendar.js";

export default function (eleventyConfig) {
  // Files copied as-is
  eleventyConfig.addPassthroughCopy({ "src/images": "images" });
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/_redirects": "_redirects" });
  eleventyConfig.addPassthroughCopy({ "src/_headers": "_headers" });
  eleventyConfig.ignores.add("src/**/README.md");

  eleventyConfig.addGlobalData("layout", "layouts/base.njk");

  // Content collections (Pages CMS writes these folders)
  const byDateDesc = (a, b) => b.date - a.date;
  eleventyConfig.addCollection("posts", (api) =>
    api.getFilteredByGlob("src/posts/*.md").filter((p) => !p.data.draft).sort(byDateDesc));
  eleventyConfig.addCollection("newsletters", (api) =>
    api.getFilteredByGlob("src/newsletters/*.md").filter((p) => !p.data.draft).sort(byDateDesc));
  // Events: dated ones first (soonest first), then undated ("date to come")
  eleventyConfig.addCollection("events", (api) =>
    api.getFilteredByGlob("src/events/*.md").sort((a, b) => {
      const da = a.data.event_date ? new Date(a.data.event_date) : null;
      const db = b.data.event_date ? new Date(b.data.event_date) : null;
      if (da && db) return da - db;
      return da ? -1 : db ? 1 : (a.data.order || 0) - (b.data.order || 0);
    }));

  // Dates. Front-matter dates are read as UTC, so format in UTC to avoid off-by-one days.
  const fmt = (d, opts) => new Date(d).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
  eleventyConfig.addFilter("monthYear", (d) => fmt(d, { month: "long", year: "numeric" }));
  eleventyConfig.addFilter("longDate", (d) => fmt(d, { weekday: "long", month: "long", day: "numeric", year: "numeric" }));
  eleventyConfig.addFilter("year", (d) => fmt(d, { year: "numeric" }));
  eleventyConfig.addFilter("monShort", (d) => fmt(d, { month: "short" }));
  eleventyConfig.addFilter("dayNum", (d) => fmt(d, { day: "numeric" }));
  eleventyConfig.addFilter("googleCal", (data) => googleLink(data));
  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString().slice(0, 10));

  // Plain text from the editor → paragraphs (blank line = new paragraph, single line break kept)
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  eleventyConfig.addFilter("paras", (text, cls) => {
    if (!text) return "";
    return String(text).trim().split(/\n\s*\n/).map((p) =>
      `<p${cls ? ` class="${cls}"` : ""}>${esc(p.trim()).replace(/\n/g, "<br>")}</p>`).join("\n");
  });
  // Guide directory helpers (same rules as the browser refresh in assets/js/site.js)
  eleventyConfig.addFilter("specs", (s) => String(s || "").split(/[,;]/).map((x) => x.trim()).filter(Boolean));
  // A Phone cell can hold more than one number ("541-726-7234 / 541-912-8899"): split into a list.
  // Keep in step with phones() in assets/js/find-a-guide.js.
  const splitPhones = (s) => String(s || "").split(/\s*(?:\/|,|;|\bor\b|&)\s*/i).map((x) => x.trim()).filter((x) => /\d{3}.*\d{4}/.test(x));
  eleventyConfig.addFilter("phones", splitPhones);
  // The number to text: the first one that isn't toll-free (800, 888, 877 … can't receive texts)
  eleventyConfig.addFilter("textPhone", (s) => splitPhones(s).find((p) => !/^\D*1?\D*8(00|33|44|55|66|77|88)\D/.test(p)) || "");
  eleventyConfig.addFilter("telHref", (s) => String(s || "").replace(/[^\d+]/g, ""));
  eleventyConfig.addFilter("linkHref", (u) => (/^https?:/i.test(u) ? u : "https://" + u));
  eleventyConfig.addFilter("linkHost", (u) => {
    try { return new URL(/^https?:/i.test(u) ? u : "https://" + u).hostname.replace(/^www\./, ""); }
    catch { return "Website"; }
  });
  eleventyConfig.addFilter("allSpecs", (guides) =>
    [...new Set((guides || []).flatMap((g) => String(g.Specialty || "").split(/[,;]/).map((x) => x.trim()).filter(Boolean)))].sort());
  // A guide's business name, unless it just repeats their own name (then it isn't shown twice)
  eleventyConfig.addFilter("bizName", (g) => {
    const name = `${g["First Name"] || ""} ${g["Last Name"] || ""}`.trim().toLowerCase();
    return (g.Business || "").trim().toLowerCase() === name ? "" : (g.Business || "").trim();
  });
  // A guide's photo (sheet column "Photo"): a file name in src/images/guides/ ("leah-helfrich.jpg", uploaded in
  // Pages CMS) or a full https:// address. Returns "" (→ photo placeholder) if the file isn't there.
  eleventyConfig.addFilter("guidePhoto", (v) => {
    v = String(v || "").trim();
    if (/^https:\/\/\S+$/i.test(v)) return v;
    const name = v.split("/").pop();
    return name && /^[\w.-]+\.(jpe?g|png|webp)$/i.test(name) && existsSync(`src/images/guides/${name}`) ? `/images/guides/${name}` : "";
  });
  eleventyConfig.addFilter("head", (arr, n) => (arr || []).slice(0, n));
  eleventyConfig.addFilter("yes", (v) => /^y/i.test(v || ""));
  eleventyConfig.addFilter("json", (v) => JSON.stringify(v).replace(/</g, "\\u003c"));
  eleventyConfig.addFilter("uniqueCats", (posts) => [...new Set(posts.flatMap((p) => p.data.categories || []))].sort());
  // Members & supporters (same output as assets/js/members.js)
  const yes = (v) => /^y/i.test(v || "");
  eleventyConfig.addFilter("memberGroup", (ms, which) =>
    (ms || []).filter((m) => yes(m["Retired Guide"]) === (which === "retired")));
  eleventyConfig.addFilter("nameList", (ms, letters) => {
    let html = "", last = "";
    // "Last, First" → "First Last". Couples: "Jones, Gene & Mandy" → "Gene & Mandy Jones";
    // different last names: "Thompson, Devin & Ferguson, Brandi" → "Devin Thompson & Brandi Ferguson".
    const flip = (n) => { const p = n.split(","); return p.length > 1 ? p.slice(1).join(",").trim() + " " + p[0].trim() : n.trim(); };
    const display = (n) => { const parts = n.split("&"); return parts.length > 1 && parts.every((x) => x.includes(",")) ? parts.map(flip).join(" & ") : flip(n); };
    (ms || []).forEach((m) => {
      const L = m.Name.charAt(0).toUpperCase();
      if (letters && L !== last) { html += `<li class="letter" aria-hidden="true">${esc(L)}</li>`; last = L; }
      const tags = [yes(m["Life Member"]) && "Life", yes(m["Honorary Member"]) && "Honorary"].filter(Boolean);
      html += `<li>${esc(display(m.Name))}${tags.map((t) => `<span class="tag">${t}</span>`).join("")}</li>`;
    });
    return `<ul class="names">${html}</ul>`;
  });
  // Group board members by the year their term ends
  eleventyConfig.addFilter("byTerm", (board) => {
    const g = {};
    (board || []).forEach((m) => { (g[m.term_ends] = g[m.term_ends] || []).push(m.name); });
    return Object.keys(g).sort().map((y) => ({ year: y, names: g[y] }));
  });

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    markdownTemplateEngine: false,
    htmlTemplateEngine: "njk",
  };
}
