# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Workflow — MANDATORY

**Always push changes to `staging` first, then ask the user if they want to merge to `main`.**

```bash
git checkout staging
git add <files>
git commit -m "..."
git push origin staging
# Then ask: "רוצה שאמזג ל-main?"
```

Never push directly to `main` unless the user explicitly says so. The staging workflow auto-merges to main via GitHub Actions after Netlify deploy.

## Local Development

```bash
python -m http.server 3000
# or
npx http-server -p 3000
```

Open `http://localhost:3000`. No build step — pure static files.

## Architecture

Vanilla JS with no bundler. Every module is an IIFE that exposes a single global object. **Script load order in `index.html` is the dependency order** — do not reorder.

### Boot sequence
1. `config.js` → `supabase-client.js` → `auth.js` initialize globals
2. `App.init()` (called on `DOMContentLoaded`) calls `Auth.init(callback)`
3. Supabase fires `INITIAL_SESSION` event → `_onAuthChange` in `app.js`
4. Depending on role: admin routes or viewer routes are registered, then `Router.init()` dispatches the current hash

### Routing
Hash-based (`#/`, `#/person/:id`, etc.). `Router` in `router.js` matches patterns and calls view handlers. `Router.clear()` must be called before re-registering routes on auth change.

### Data layer (`storage.js`)
Three-tier cache: memory (90s TTL) → Supabase network → localforage (IndexedDB offline fallback). All Supabase calls go through `_query(key, fn)`. Cache is invalidated with `_mClear(prefix)` before writes.

### Auth roles
- `admin` → sees PeopleView → ProjectsView → ReportsView → ReportView
- `viewer` → sees ViewerReportsView (only permitted reports) → ReportView (read-only)

Role is stored in `profiles.role` in Supabase. `Auth.isAdmin()` reads `_currentProfile.role`.

### PDF Export (`pdfExport.js`)
Libraries (html2canvas, jsPDF, QRCode) are loaded lazily on first use. Flow: `buildHtml()` → `_showPreviewOverlay()` → user clicks download → `generate()` slices canvas into A4 pages.

### PDF Markup (`pdfMarkup.js`)
PDF.js is loaded lazily. Supports two modes: plan annotation (`openForNote`) and image annotation (`openForImage`). Undo stack is per-page in `_pageStates`. Canvas events are bound to the draw canvas; `document` keydown for Ctrl+Z.

## CI/CD

| Branch | Trigger | Action |
|--------|---------|--------|
| `staging` | push | Deploy to Netlify, then auto-merge into `main` |
| `main` | push (from staging merge) | Deploy to GitHub Pages |

Netlify site ID: `7c8b79f8-f272-438e-b964-35033fa17bc7`

## Service Worker cache

Cache name is `dit-vN` in `sw.js`. **Bump N whenever shipping JS/CSS changes** so the SW installs fresh. Shell files list must match actual file paths.

## Script versioning

`index.html` loads scripts with `?v=4.0`. Bump this version when shipping changes that need to bypass browser cache (independent of SW cache).

## Supabase schema (key tables)

`people` → `projects` → `reports` → `notes` (with `media_items[]` and `plan_markups[]` as JSON columns) + `plans` (PDF/image data) + `profiles` (auth roles) + `report_permissions` (viewer access control)
