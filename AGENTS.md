# MRGA website: rules for admins and AI tools

The website of the **McKenzie River Guides Association** (MRGA), founded 1931. This file is the single
source of truth for how the site is built and the rules it follows. It is written for any admin or AI
coding tool (Claude, Gemini/Antigravity, Copilot, Cursor, …). `CLAUDE.md` only points here; if you add
a file for another tool, make it point here too instead of copying rules.

Nothing private ever goes in this repository. It may be public and it is exactly what gets published.

## How it works

- **Eleventy 3** static site → `_site/`, hosted on **Cloudflare Pages** (build command `npm run build`,
  output folder `_site`, Node 20+). Every push to `main` deploys; other branches get preview links.
- **Pages CMS** (app.pagescms.org) is the editor for the secretary (Leah Helfrich) and other
  non-technical editors. Its configuration is `.pages.yml`. Every save is a commit → automatic rebuild.
- **Guide and member directories** are NOT in this repo. They live in Google Sheets owned by
  mckenzieguides@gmail.com (private "MRGA Roster – Master" → public "MRGA Directory – Public (website)",
  which has public columns only). The build reads the public sheet (gviz CSV) and bakes the lists into
  the pages; the browser then refreshes them quietly from the live sheet.
- **Guides edit their own card** through `/edit-listing/`, which talks to the "MRGA Guide Editor"
  Apps Script web app (in mckenzieguides@gmail.com). Changes go live right away; admins monitor.
- All accounts (GitHub organization, Cloudflare, Google, email tool) belong to the association
  (master login mckenzieguides@gmail.com) with at least two people who can get in. People use their own
  logins as invited members. Never put passwords, API keys or tokens in this repo.

## Commands

```bash
npm install        # once
npm run dev        # local preview with live reload at http://localhost:8768
npm run build      # build into _site/
```

## Folder map

| Path | What it is |
|---|---|
| `src/*.njk` | One file per page: `index` (homepage), `about`, `leadership`, `find-a-guide`, `members`, `join`, `news`, `river-conditions`, `contact`, `edit-listing`, `404` |
| `src/_includes/layouts/` | `base.njk` (all inner pages), `home.njk` (homepage), `post.njk` (posts and newsletter issues) |
| `src/_includes/partials/` | Shared header + phone menu, footer, `<head>`, guide card, Foundation link |
| `src/posts/` | News & Stories, one Markdown file per post (`YYYY-MM-DD-slug.md`). Address `/news/<slug>/` |
| `src/events/` | Events (annual meeting, annual dinner, Wooden Boat Festival). Shown under "Coming up" on News |
| `src/newsletters/` | Newsletter archive issues (empty until the first issue) |
| `src/_data/` | `settings.json` (email, Facebook, Foundation URL, address), `festival.json` (homepage festival block), `leadership.json` (officers + board), `text/*.json` (editable page text), `config.json` (technical: sheet ID, editor API; not in Pages CMS), `directory.js` (reads the public sheet at build), `build.js` (cache-busting version) |
| `src/assets/css/` | `inner.css` (all inner pages), `home.css` (homepage), `river.css` (River page only) |
| `src/assets/js/` | `site.js` (menu, sheet reader; every page), plus one script per page that needs one |
| `src/images/` | All images. Pages CMS uploads land here (`/images/...`). `posts/<slug>/` for post photos |
| `src/_redirects`, `src/_headers` | Cloudflare Pages redirects (old WordPress post URLs → new) and cache headers |

## Content rules

- **Use real facts only.** Never invent officers, addresses, dues, dates, flow ranges or history. Where
  content is missing, keep a clearly labeled placeholder (grey `placeholder-text` or a `sample` tag).
  Editable text fields in `src/_data/text/*.json` show the placeholder while empty.
- Confirmed: founded **1931** for conservation, stewardship and river access. "McKenzie, birthplace of
  the drift boat" is board-approved wording. Say **"professional guides"**, not "licensed guides"
  (exception: the guide membership requirement is a current **Oregon Marine Board license**).
- MRGA is a **501(c)(4)**: dues and payments are never tax-deductible. Tax-deductible giving goes to the
  separate **McKenzie Guides Foundation**, a 501(c)(3). Its URL goes in Site settings (`foundation_url`);
  until then "Support the river" goes to the top of Join and Foundation links go to `/join/#give`.
- **Membership:** every new member (associate or guide) is voted in at the annual meeting. Guides need two
  sponsors who are active guides plus a current Oregon Marine Board license. Nobody is listed before the
  vote. Never write copy implying instant membership or listing.
- **Annual meeting:** second Saturday of January (officers elected there for two-year terms, every other
  year). **Annual dinner:** April.
- **Wooden Boat Festival** is owned and organized by the nonprofit Oregon's Boat; MRGA sponsors it.
  Oregon's Boat **sells the poster**: the site shows only a low-res preview (max 400px wide), labeled
  "Poster © Oregon's Boat", with a "Buy the poster" link, no download and no full-size link. Never put a
  full-resolution poster in this repo. The current preview is a stand-in (2019 poster) until the new one.
- **Directories:** Find a Guide lists active guides only. **Never show or search by town.** Rivers a guide
  fishes go in Specialty ("National Forest McKenzie", "McKenzie River", "Willamette"; trip types "Drift boat",
  "Fly fishing", "Scenic tours", "White water rafting"). National Forest McKenzie means the guide holds the
  Willamette National Forest permit; never call it "upper" vs "lower". Members & supporters lists retired
  guides first, then associate members.
- **Newsletter:** members only by email (no public sign-up). Every newsletter mention ("Past newsletters"
  links, the archive panel, "and the newsletter" on Join) appears automatically once at least one issue is
  in `src/newsletters/`; until then it is hidden. Private member emails are archived in a private Drive
  folder, never here.
- **News & Stories:** few posts a year; newest first, month + year dates. River-hazard notices and stories
  are mixed by date. Imported posts keep their original text, authors and categories.

## Design rules

- Fonts: headings **Libre Caslon Text** (400/400i/700), body **Public Sans**. One Google Fonts link (in
  `partials/head.njk`).
- Only the homepage (historic photo slideshow, "old film" look) and About (photo hero) have the large title
  area. Every other page uses `.page-hero.compact` and its first section has `class="tight"`.
- Top nav: Home (inner pages only; the homepage has none), Leadership, Find a Guide, News & Stories, River,
  Join button. Conservation and Drift Boat pages are deferred (do not add them unless asked). Meeting
  minutes page was cut.
- Logo: 95th-anniversary badge through 2026; the round "Organized 1931" logo switches on automatically from
  2027 (`?year=2027` previews it).
- Officers show photo, role, name, email and phone (as on the old site). Board grouped by term-end year.
- CSS/JS links carry `?v={{ build.version }}` so browsers pick up changes after each build.
- Check every change at desktop and phone width: no horizontal scrolling, no console errors.

## River data

- Live numbers come from the **USGS Water Data OGC API** (`api.waterdata.usgs.gov/ogcapi/v0/collections/`,
  fast, CORS open), not the slow legacy `waterservices.usgs.gov`. Forecasts come from **NOAA NWPS**
  (`api.water.noaa.gov/nwps/v1/gauges/<LID>/stageflow`). Homepage card: gauge 14162500 (Vida).
- River page gauge cards show only the gauges NOAA forecasts: 14158850 Trail Bridge Dam (TRBO3),
  14162500 Vida (VIDO3), 14163900 Walterville (MCZO3). "Reading the numbers" is for the guides to write.

## Guide self-edit (`/edit-listing/`)

- The page posts to the Apps Script web app (URL in `src/assets/js/edit-listing.js` and `src/_data/config.json`).
- The emailed sign-in link goes back to the page that asked for it **only if that page address is in the
  script's `EDIT_PAGES` allowlist**. When the site address changes (pages.dev, mckenzieguides.com), add
  the new `/edit-listing/` address to `EDIT_PAGES` in the Apps Script project and redeploy it as a new
  version of the same deployment (keeps the URL).
- Guides can change only business, website, phone and Specialty. Name, email, membership status stay with
  the secretary in the Master sheet.

## Working on the site

- Admins work on a branch → Cloudflare Pages preview link → merge to `main`. `main` is protected.
- Content edits normally go through Pages CMS, not code changes.
- Pre-launch: re-import any WordPress posts newer than 2026-11-13 (keep the poster rule and remove leftover
  WordPress captions "default" / "Screenshot"), then point mckenzieguides.com at Cloudflare Pages only
  after the info@ mailbox has moved off the old host.
