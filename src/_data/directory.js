// Guide and member directories, read at build time from the PUBLIC Google Sheet
// "MRGA Directory – Public (website)" (gviz CSV), so the lists are in the page from the first paint.
// The browser then refreshes them quietly from the live sheet (assets/js/site.js), so a sheet edit
// shows up right away even before the next site build.
// Never add private columns (email, address, town) here: the public sheet only has public columns.
import config from "./config.json" with { type: "json" };

function parseCsv(csv) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (q) { if (c === '"' && csv[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const head = (rows.shift() || []).map((h) => h.trim());
  return rows.map((r) => {
    const o = {}; head.forEach((h, j) => { if (h) o[h] = (r[j] || "").trim(); }); return o;
  }).filter((o) => Object.values(o).some(Boolean));
}

async function tab(name) {
  const url = `https://docs.google.com/spreadsheets/d/${config.public_sheet_id}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(name)}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return parseCsv(await r.text());
}

// "Email" is the guide's PUBLIC email (Master column K "Public Email"), filled in by the guide; never the private roster email.
const GUIDE_COLS = ["First Name", "Last Name", "Business", "Link", "Phone", "Email", "Life Member", "Specialty"];
const MEMBER_COLS = ["Name", "Retired Guide", "Life Member", "Honorary Member"];
const pick = (o, cols) => Object.fromEntries(cols.map((c) => [c, o[c] || ""]));

// Each guide's page address: /guides/<first-last>/ ("jose-nunez" for "José Núñez"). Two guides with the same
// name get "-2", "-3" in list order. Keep in step with slugs() in assets/js/find-a-guide.js.
const slugify = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function addSlugs(guides) {
  const seen = {};
  return guides.map((g) => {
    const base = slugify(`${g["First Name"]} ${g["Last Name"]}`) || "guide";
    seen[base] = (seen[base] || 0) + 1;
    return { ...g, slug: seen[base] > 1 ? `${base}-${seen[base]}` : base };
  });
}

export default async function () {
  try {
    const [g, m] = await Promise.all([tab("Guides"), tab("Members")]);
    const guides = g.filter((x) => x["First Name"] || x["Last Name"]).map((x) => pick(x, GUIDE_COLS))
      .sort((a, b) => (a["Last Name"] + a["First Name"]).localeCompare(b["Last Name"] + b["First Name"]));
    const guidesWithSlugs = addSlugs(guides);
    const members = m.filter((x) => x.Name).map((x) => pick(x, MEMBER_COLS))
      .sort((a, b) => a.Name.localeCompare(b.Name));
    console.log(`[directory] ${guides.length} guides, ${members.length} members from the public sheet`);
    return { ok: true, guides: guidesWithSlugs, members };
  } catch (e) {
    // On Cloudflare, stop the build instead: publishing without the sheet would remove every guide page.
    // The site that is already live stays up, and the next build tries again.
    if (process.env.CF_PAGES) throw new Error(`[directory] could not read the public sheet (${e.message}); build stopped so guide pages are not removed`);
    // Local preview: build still succeeds; the pages then load the lists in the browser.
    console.warn(`[directory] could not read the public sheet (${e.message}); lists will load in the browser`);
    return { ok: false, guides: [], members: [] };
  }
}
