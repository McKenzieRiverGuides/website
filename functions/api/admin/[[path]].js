// On-site editor API ("post from the page"). Cloudflare Pages Function at /api/admin/*.
//
// Who can use it: Cloudflare Access protects /admin/* and /api/admin/* (sign-in with an emailed code; the list of
// admin emails is kept in the Access policy in the Cloudflare dashboard). This function checks the Access sign-in
// token again itself, so it never trusts a request that didn't come through Access.
//
// What it does: reads and saves News & Stories posts and Events as the same Markdown files Pages CMS writes, by
// committing to the GitHub repo. Cloudflare Pages then rebuilds the site (live in about 3 minutes).
//
// Settings (Cloudflare Pages → Settings → Variables and secrets; never in this repo):
//   ACCESS_TEAM_DOMAIN  e.g. "mrga.cloudflareaccess.com"
//   ACCESS_AUD          the Access application's "Application Audience (AUD) tag"
//   GITHUB_TOKEN        fine-grained token owned by the association org, this repo only, Contents: read and write (secret)
//   GITHUB_REPO         "McKenzieRiverGuides/website"
//   GITHUB_BRANCH       "main" (optional)
//
// Routes:
//   GET  /api/admin/me                         → { email }
//   GET  /api/admin/item?type=posts&path=...   → { path, sha, fields, body }   (body = Markdown)
//   POST /api/admin/save   { type, path?, sha?, fields, body, uploads: [{ name, data }] } → { path, url }
//        New photos are written "upload:<name>" in the cover field and the story; the save puts them in the
//        item's image folder (src/images/posts/<slug>/) and fixes those addresses.
//   POST /api/admin/delete { type, path, sha } → { ok }
import { TYPES, isContentPath, isUploadName, placeUploads, parseFile, formValues, cleanFields, buildFile } from "../../../lib/admin-content.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const fail = (msg, status = 400) => json({ error: msg }, status);

export async function onRequest({ request, env, params }) {
  const user = await accessUser(request, env).catch(() => null);
  if (!user) return fail("Please sign in again.", 401);
  for (const k of ["GITHUB_TOKEN", "GITHUB_REPO"]) if (!env[k]) return fail(`The editor isn't set up yet (${k} is missing).`, 500);

  const route = (params.path || []).join("/");
  const gh = github(env);
  try {
    if (request.method === "GET" && route === "me") return json({ email: user.email });
    if (request.method === "GET" && route === "item") return json(await readItem(gh, new URL(request.url).searchParams));
    if (request.method === "POST" && route === "save") return json(await saveItem(gh, await request.json(), user));
    if (request.method === "POST" && route === "delete") return json(await deleteItem(gh, await request.json(), user));
    return fail("Not found.", 404);
  } catch (e) {
    return fail(e.userMessage || "Something went wrong saving to the website. Nothing was changed.", e.status || 500);
  }
}

const problem = (msg, status = 400) => Object.assign(new Error(msg), { userMessage: msg, status });

// ------------------------------------------------------------------ reading, saving, deleting

async function readItem(gh, q) {
  const type = q.get("type"), path = q.get("path");
  if (!isContentPath(type, path)) throw problem("That isn't a post or event the editor can open.");
  const file = await gh.getFile(path);
  if (!file) throw problem("That item isn't on the website any more. Reload the page.", 404);
  const { data, body } = parseFile(file.text);
  return { path, sha: file.sha, fields: formValues(type, data), body };
}

async function saveItem(gh, req, user) {
  const type = req.type;
  if (!TYPES[type]) throw problem("Unknown kind of item.");
  if (req.path && !isContentPath(type, req.path)) throw problem("That isn't a post or event the editor can change.");

  // The file name comes from the headline and date, so check those before anything else
  let { fields, error } = cleanFields(type, { ...req.fields, cover: "" });
  if (error) throw problem(error);

  let path = req.path, existing = {}, isNew = !path;
  if (isNew) {
    // New file: pick a free file name ("…-2.md" if the headline was used before)
    const base = `${TYPES[type].dir}/${TYPES[type].fileName(fields)}`;
    path = base;
    for (let n = 2; await gh.getFile(path); n++) path = base.replace(/\.md$/, `-${n}.md`);
  } else {
    const current = await gh.getFile(path);
    if (!current) throw problem("That item was deleted by someone else. Nothing was saved.", 409);
    if (req.sha && current.sha !== req.sha) throw problem("Someone else changed this item while you were editing. Copy your text, reload the page and try again.", 409);
    existing = parseFile(current.text).data;
  }

  // Now that the folder is known, put new photos' addresses in place and check all fields for real
  ({ fields, error } = cleanFields(type, { ...req.fields, cover: placeUploads(req.fields?.cover, type, path) }));
  if (error) throw problem(error);

  // New photos (already shrunk in the browser) go in the item's image folder
  const uploads = Array.isArray(req.uploads) ? req.uploads : [];
  if (uploads.length > 20) throw problem("Please add at most 20 photos at a time.");
  const dir = TYPES[type].imageDir(path);
  const files = [];
  for (const u of uploads) {
    if (!isUploadName(u.name)) throw problem("A photo had a name the website can't use.");
    if (typeof u.data !== "string" || u.data.length > 4_000_000) throw problem("A photo is too large. Try a smaller one.");
    files.push({ path: `${dir}/${u.name}`, base64: u.data });
  }
  const body = type === "posts" ? placeUploads(String(req.body || "").slice(0, 200_000), type, path) : "";
  files.push({ path, base64: b64(buildFile(type, fields, body, existing)) });

  const what = type === "posts" ? "post" : "event";
  await gh.commit(files, `${isNew ? "New" : "Update"} ${what}: ${fields.title} (via website editor)`);
  return { path, url: TYPES[type].url(path) };
}

async function deleteItem(gh, req, user) {
  const { type, path, sha } = req;
  if (!isContentPath(type, path)) throw problem("That isn't a post or event the editor can delete.");
  const current = await gh.getFile(path);
  if (!current) return { ok: true };
  if (sha && current.sha !== sha) throw problem("Someone else changed this item. Reload the page first.", 409);
  const title = parseFile(current.text).data.title || path;
  // Photos stay in the repo (other posts may use them; GitHub history keeps everything anyway)
  await gh.commit([{ path, delete: true }], `Delete ${type === "posts" ? "post" : "event"}: ${title} (via website editor)`);
  return { ok: true };
}

// Who saved is not written into the (public) commit history; Cloudflare Access logs record who signed in.

// ------------------------------------------------------------------ GitHub (one commit per save)

function github(env) {
  const repo = env.GITHUB_REPO, branch = env.GITHUB_BRANCH || "main";
  const api = async (path, opts = {}) => {
    const r = await fetch(`https://api.github.com/repos/${repo}${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json",
        "User-Agent": "mrga-website-editor", "X-GitHub-Api-Version": "2022-11-28",
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    if (r.status === 404 && opts.allow404) return null;
    if (!r.ok) throw Object.assign(new Error(`GitHub ${r.status} on ${path}`), { status: 502 });
    return r.json();
  };
  return {
    async getFile(path) {
      const f = await api(`/contents/${encodeURI(path)}?ref=${branch}`, { allow404: true });
      if (!f || Array.isArray(f)) return null;
      return { sha: f.sha, text: unb64(f.content) };
    },
    async commit(files, message) {
      const ref = await api(`/git/ref/heads/${branch}`);
      const parent = await api(`/git/commits/${ref.object.sha}`);
      const tree = [];
      for (const f of files) {
        if (f.delete) { tree.push({ path: f.path, mode: "100644", type: "blob", sha: null }); continue; }
        const blob = await api("/git/blobs", { method: "POST", body: JSON.stringify({ content: f.base64, encoding: "base64" }) });
        tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
      }
      const newTree = await api("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: parent.tree.sha, tree }) });
      const c = await api("/git/commits", { method: "POST", body: JSON.stringify({ message, tree: newTree.sha, parents: [ref.object.sha] }) });
      // Not forced: if someone else saved at the same moment this fails instead of overwriting their work
      await api(`/git/refs/heads/${branch}`, { method: "PATCH", body: JSON.stringify({ sha: c.sha, force: false }) });
    },
  };
}

function b64(text) {
  const bytes = new TextEncoder().encode(text);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function unb64(b) {
  const bin = atob(String(b).replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

// ------------------------------------------------------------------ Cloudflare Access sign-in check

let certCache = null;
async function accessUser(request, env) {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return null;
  const [h, p, s] = token.split(".");
  const bytes = (x) => Uint8Array.from(atob(x.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(x.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
  const dec = (x) => JSON.parse(new TextDecoder().decode(bytes(x)));
  const header = dec(h), payload = dec(p);
  const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
  if (header.alg !== "RS256" || payload.iss !== issuer) return null;
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(env.ACCESS_AUD) || !(payload.exp * 1000 > Date.now()) || !payload.email) return null;

  if (!certCache || certCache.at < Date.now() - 3600e3) {
    const r = await fetch(`${issuer}/cdn-cgi/access/certs`);
    certCache = { at: Date.now(), keys: (await r.json()).keys || [] };
  }
  const jwk = certCache.keys.find((k) => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const sig = bytes(s);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, sig, new TextEncoder().encode(`${h}.${p}`));
  return ok ? { email: String(payload.email).toLowerCase() } : null;
}
