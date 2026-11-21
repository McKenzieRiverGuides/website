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
- **On-site editor** ("post from the page"): admins sign in at `/admin/` (Cloudflare Access, emailed one-time PIN;
  the admin email list lives in the Access policy, not in code). Signed-in admins get New post / New event / Edit /
  Delete on News & Stories, post pages and event cards (`assets/js/admin.js` loader on every page →
  `admin-editor.js` + `admin.css` only for admins; visitors load nothing else). Saves go to the Pages Function
  `functions/api/admin/[[path]].js`, which checks the Access token and commits the same Markdown files Pages CMS
  writes (rules shared in `lib/admin-content.js`; keep its fields in step with `.pages.yml`). Photos are shrunk in
  the browser (1600 px JPEG) and saved in `src/images/posts/<slug>/`. On localhost the editor runs in a pretend
  preview mode (any email/code; nothing saved). Settings in Cloudflare Pages: `GITHUB_TOKEN` (secret),
  `GITHUB_REPO`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`. `/admin/content.json` lists all posts (drafts too) and events.
- **Guide and member directories** are NOT in this repo. They live in Google Sheets owned by
  the association Google account (private "MRGA Roster – Master" → public "MRGA Directory – Public (website)",
  which has public columns only). The build reads the public sheet (gviz CSV) and bakes the lists into
  the pages; the browser then refreshes them quietly from the live sheet.
- **Guides edit their own card** through `/edit-listing/`, which talks to the "MRGA Guide Editor"
  Apps Script web app (in the association Google account). Changes go live right away; admins monitor.
- All accounts (GitHub organization, Cloudflare, Google, email tool) belong to the association
  (master login: the association Google account) with at least two people who can get in. People use their own
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
| `src/*.njk` | One file per page (`guide.njk` makes one page per guide): `index` (homepage), `about`, `leadership`, `find-a-guide`, `members`, `join`, `news`, `river-conditions`, `contact`, `edit-listing`, `404` |
| `src/_includes/layouts/` | `base.njk` (all inner pages), `home.njk` (homepage), `post.njk` (posts and newsletter issues) |
| `src/_includes/partials/` | Shared header + phone menu, footer, `<head>`, guide card, Foundation link |
| `src/posts/` | News & Stories, one Markdown file per post (`YYYY-MM-DD-slug.md`). Address `/news/<slug>/` |
| `src/events/` | Events (annual meeting, annual dinner & auction, Wooden Boat Festival). Shown under "Coming up" on the homepage and News |
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
- **Membership** (user, 2026-11-20): people who share the association's conservation philosophy are invited
  to join. Every applicant (associate or guide) sends a letter or email asking to join (no official form) and
  needs two sponsors who are ANY current MRGA members; each sponsor sends a letter of recommendation to the
  secretary or another officer. Guides also need a current Oregon State Marine Board guide license (any licensed guide may apply, not only
  McKenzie guides; never write "guides on the McKenzie" as a requirement). Every new
  member is voted on at the next annual meeting and told the result afterwards; nobody is listed before the
  vote. Associate members are voting members, can hold office and take part in all activities. Each Join card
  must stand on its own (no "same as associates"). Never write copy implying instant membership or listing.
- **Annual meeting:** second Saturday of January (officers elected there for two-year terms, every other
  year). **Annual dinner & auction:** April, members only, ticketed
  (members who attend buy a ticket; space for about 100). Never present it as open to the public.
- **Wooden Boat Festival** is owned and organized by the nonprofit Oregon's Boat; MRGA sponsors it.
  Oregon's Boat **sells the poster**: the site shows only a low-res preview (max 400px wide), labeled
  "Poster © Oregon's Boat", with a "Buy the poster" link, no download and no full-size link. Never put a
  full-resolution poster in this repo. The current preview is a stand-in (2019 poster) until the new one.
- **Guide pages** (`src/guide.njk`, styles `assets/css/guide.css`): one page per active guide at `/guides/<first-last>/`,
  built automatically from the public sheet (address rule in `src/_data/directory.js` and `find-a-guide.js`, kept in
  step). Each Find a Guide card opens its guide's page; the page ends in Call / Text (phones only) / Website or
  Facebook buttons. The green band says "Find a guide"; on the beige a vertical (3:4) photo space sits
  beside the name, business and "About <first>" bio (photo and bio are placeholders until guides can add them).
  Rivers & trips pills sit in the Contact card. A "Send an email" button shows only when the guide has a
  PUBLIC email (Master column K "Public Email" → public sheet column "Email", set by the guide in Edit my listing;
  never the private column F roster email).
  Bio = Master column L → public "Bio" (guides edit it in Edit my listing, 900 characters, blank line = new
  paragraph). Photo = Master column M → public "Photo": a file name in `src/images/guides/` (upload it there in
  Pages CMS, e.g. `leah-helfrich.jpg`) or an https address; shown in the 3:4 frame (`guidePhoto` filter falls back
  to the placeholder if the file is missing). Only use photos the guide has agreed to. No "Professional guide" tag and no "About the association" text
  (user, 2026-11-20). Same layout for every guide, no ranking, never town. Only sheet data, never copied from Facebook
  or guide websites. A business name that repeats the guide's own name isn't shown twice (`bizName` filter).
  On Cloudflare the build stops if the sheet can't be read (so guide pages are never wiped); the live site stays up.
  `.github/workflows/sheet-sync.yml` checks the public sheet every hour; when it changed, it updates
  `.github/sheet-stamp.txt` and pushes, which makes Cloudflare rebuild. No secrets needed. Sheet edits (new guides,
  bios, photos) show on the site within about an hour.
- **Directories:** Find a Guide lists active guides only. **Never show or search by town.** Rivers a guide
  fishes go in Specialty ("National Forest McKenzie", "McKenzie River", "Willamette"; trip types "Drift boat",
  "Fly fishing", "Scenic tours", "White water rafting"). National Forest McKenzie means the guide holds the
  Willamette National Forest permit; never call it "upper" vs "lower". Members & supporters lists retired
  guides first, then associate members.
- **Newsletter:** members only by email (no public sign-up). Every newsletter mention ("Past newsletters"
  links, the archive panel, "and the newsletter" on Join) appears automatically once at least one issue is
  in `src/newsletters/`; until then it is hidden. Private member emails are archived in a private Drive
  folder, never here.
- **Events** (`src/events/`): shown as date cards (`partials/event-cards.njk`, styles `assets/css/events.css`) in a
  "Coming up" band on the homepage (next three, under the numbers strip) and at the top of News (`/news/#events`).
  Each dated event gets "Add to calendar" (`/calendar/<file>.ics`, built by `src/calendar.11ty.js` with
  `lib/calendar.js`) and a Google Calendar link; all-day unless Time reads like "6 PM". Past events hide themselves.
  **No separate page per event and no Events page/menu item** (user, 2026-11-20); events stay as cards only.
- **News & Stories:** few posts a year; newest first, month + year dates. River-hazard notices and stories
  are mixed by date. Imported posts keep their original text, authors and categories.

## Design rules

- Fonts: headings **Libre Caslon Text** (400/400i/700), body **Public Sans**. One Google Fonts link (in
  `partials/head.njk`).
- Only the homepage (historic photo slideshow, "old film" look) and About (photo hero) have the large title
  area. Every other page uses `.page-hero.compact` and its first section has `class="tight"`.
- Top nav (set 2026-11-20, same on phone and desktop): Find a Guide, River Conditions, News, About, Contact,
  Join button. No "Home" link: the logo goes home. Leadership, Members & supporters, the festival and "edit my
  listing" are in the footer (Visit / The Association / Contact) and linked from About and Join. The News page
  itself keeps its title "News & Stories". Conservation and Drift Boat pages are deferred (do not add them unless
  asked). Meeting minutes page was cut.
- Accessibility: every page has a "Skip to content" link (header partial → `<main id="main">`), and Esc closes
  the phone menu.
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
- Guides can change only business, website, phone, public email and Specialty. Name, email, membership status stay with
  the secretary in the Master sheet.

## Working on the site

- Admins work on a branch → Cloudflare Pages preview link → merge to `main`. `main` is protected.
- Content edits normally go through Pages CMS, not code changes.
- Pre-launch: re-import any WordPress posts newer than 2026-11-13 (keep the poster rule and remove leftover
  WordPress captions "default" / "Screenshot"), then point mckenzieguides.com at Cloudflare Pages only
  after the info@ mailbox has moved off the old host.
