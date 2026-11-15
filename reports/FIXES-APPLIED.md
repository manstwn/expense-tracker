# Fixes Applied

This file records the implementation work for the 59 findings in this report set.

## Status

| Report | Findings | Status |
| --- | ---: | --- |
| [Security](./01-security.md) | 9 | Addressed |
| [Backend and API](./02-backend-api.md) | 15 | Addressed |
| [Frontend](./03-frontend.md) | 17 | Addressed |
| [Data and performance](./04-data-performance.md) | 7 | Addressed |
| [Tooling and docs](./05-tooling-docs.md) | 11 | Addressed |
| **Total** | **59** | |

## Security

- Added `lib/config.js` with fail-fast validation. `WEB_PIN` has no default, must be at least 6 characters, and rejects the example value.
- Added a separate 32-character minimum `TOKEN_SECRET`. Production requires it; development generates an ephemeral secret and warns.
- Added `helmet` with CSP, `compression`, and pinned CDN assets with SRI.
- Replaced the shared bearer token with an HttpOnly `SameSite=Strict` session cookie, a MongoDB `sessions` collection, 12-hour expiry, revocation on logout, and a TTL index.
- Added timing-safe PIN and HMAC comparisons in `lib/auth.js`.
- Added login, API, AI, and IoT rate limits. `ENV=prod` enables `trust proxy` and secure cookies.
- Protected `/iot` with `IOT_TOKEN`; the endpoint returns `503` when no token is configured.
- Removed client-supplied ownership. All queries and writes are scoped to `AUTHORIZED_USER_ID`.
- Allowlisted transaction `type` and normalized all rendered values. `escapeHtml` now handles null/undefined.
- Removed provider error details from client responses. Errors log with a request ID.

## Backend and API

- Added `lib/validate.js` and validated transaction, food, story, date, amount, ID, and pagination inputs.
- Added server-side pagination, search, date filtering, and sorting for transactions, food logs, and stories.
- Bounded page sizes to 200 and AI input/story lengths.
- Reworked `/api/stats` into one `$facet` aggregation with explicit day/month upper bounds and owner scoping.
- Added `/api/calendar` for month totals, day items, and stories.
- Added `POST /api/transactions/bulk`; the Quick AI save path now uses one request.
- Added unique/normalizing ownership behavior and `scripts/normalize-owner.js` for existing rows.
- Added JSON 404/error handling, including 400 invalid JSON and 413 payload handling.
- Added graceful shutdown, Mongo close, server error handling, and Cloudflare Tunnel `error`/`exit` handlers.
- Removed unused AI models, `parseFoodTransaction`, the audio branch, and unused imports.
- Added per-route body limits: 32 KB normally, 256 KB for stories.

## Frontend

- Removed the broken user filter and its `/api/users` dependency.
- Implemented real prev/next pagination for transactions, food logs, and stories.
- Fixed editing of AI-created categories by adding unknown options before assigning the value.
- Made `escapeHtml` null-safe and used it for types, categories, moods, and story titles.
- Unified finance and story dates on Jakarta time, including the form and calendar.
- Fixed calendar month rollover by using numeric year/month state.
- Fixed the item chart to sort by amount before selecting top N.
- Moved average transaction value to the server for a stable denominator.
- Hardened `apiCall` with content-type checks, a 15-second timeout, stale-response guards, and single-toast handling.
- Guarded initialization so a failed partial does not leave the app stuck on login.
- Fixed food log timestamps by using `toLocaleString` with Jakarta time.
- Added day-group CSS and switched both tables to one color scheme.
- Passed the full story queue from the grid, cleared the toast timer, and guarded relative dates.
- Added 30-second stats caching and request IDs to avoid stale/duplicate responses.
- Refreshed derived views after writes and deletes.
- Added ARIA labels, dialog roles, toast live region, Escape handling, focus trap, and focus restoration.
- Batched table/card rendering with `DocumentFragment` and reused charts when data is unchanged.

## Mobile performance pass

The phone lag was caused by GPU-heavy styling and unnecessary DOM work, not by the API:

- `backdrop-filter: blur(...)` on nearly every `.glass` surface (cards, tables, calendar, modals, bottom nav, toast).
- Three large background circles with `filter: blur(100px)` and `mix-blend-mode: screen`.
- Infinite marquee and logo animations.
- A 7-column calendar rendering every expense row and story marquee on a narrow screen.
- `lucide.createIcons()` scanning the whole document after every table, calendar, story, modal, and toast render.
- Chart.js animations and point rendering on mobile.

Changes:

- Mobile `.glass` surfaces are opaque with no backdrop filter, and background blur circles are hidden.
- Removed the 100 px background `filter` and blend mode.
- Disabled marquee, logo, and modal animations on mobile; added a `prefers-reduced-motion` fallback.
- Mobile calendar requests `detail=0`, skips item rows and story titles, and fetches day details only when a day is tapped.
- Calendar cells are shorter on mobile and heavy shadows are removed.
- Lucide work is coalesced into one animation frame and skipped when no `[data-lucide]` placeholder exists.
- Trend/doughnut chart animations are disabled on mobile, with smaller points and borders.
- The calendar API accepts `detail=0` to omit per-day item arrays.

## Mobile UI pass

- Added `public/css/mobile.css`, loaded after the main stylesheet so mobile rules win cleanly.
- The header is now sticky on phones, the subtitle is hidden, and the title truncates instead of wrapping.
- **Quick AI Parse is the top-right header action** (`AI Parse` pill on phones).
- Add Transaction moved to a floating action button above the bottom navigation.
- Bottom navigation accounts for iOS safe areas, uses tighter spacing, and keeps all six destinations usable.
- KPI cards use two columns on wider phones and one column below 520 px.
- Transaction filters stack full-width; the transactions table scrolls horizontally with a sticky first column.
- Pagination and action buttons have 40-44 px touch targets.
- Calendar cells are shorter on mobile, item rows are hidden, and day details are fetched only when tapped.
- Modals are bottom sheets with scrollable content, sticky form actions, 16 px inputs to prevent iOS zoom, and safe-area padding.
- Story cards use a single column; the reader panes use the available height.
- Toasts sit above the FAB/navigation, and body scrolling is locked while a modal is open.
- Tab switches update the header title (`Transactions`, `Food Tracker`, `Insights`, `Stories`).
- Added viewport width constraints (`min-width: 0`, `max-width: 100%`) to flex/grid dashboard containers so wide tables or canvases cannot clip cards.
- KPI amounts no longer use `nowrap` + ellipsis; they scale with `clamp()` and wrap if needed.
- Added a small-phone calendar layout: shorter cells, compact badges, and smaller story markers.
- Bumped asset versions to `2.5.0`.

## Data and performance

- Added compound indexes:
  - `transactions: { userId: 1, createdAt: -1 }`
  - `transactions: { type: 1, amount: -1 }`
  - `transactions: { createdAt: -1 }`
  - `food_logs: { userId: 1, createdAt: -1 }`
  - `stories: { userId: 1, createdAt: -1 }`
  - `sessions: { sid: 1 }` unique, `{ expiresAt: 1 }` TTL
- Replaced full-history downloads with server-side pages and a month-scoped calendar endpoint.
- Reduced `/api/stats` from three overlapping reads plus extra counts to one aggregation.
- Added compression, static cache headers, HTML no-cache, and a 30-second `/iot` cache.
- Added bulk transaction inserts and client-side `DocumentFragment` rendering.
- Added chart key checks to avoid destroying/recreating unchanged charts.

## Tooling and docs

- Rewrote `README.md` for the current architecture and added `docs/api.md` and `docs/deployment.md`.
- Marked `food-updates-PRD.md` as archived and removed the obsolete Telegram/MQTT specification.
- Added `node:test` suites for helpers, validation, auth tokens, and API middleware.
- Added ESLint, Prettier, `.nvmrc`, and `.github/workflows/ci.yml`.
- Added `engines.node >= 20.19.0`, a proper package name/description/author, and an MIT `LICENSE`.
- Removed the unused `@google/genai` dependency. `npm audit --omit=dev` reports 0 vulnerabilities.
- Added structured JSON request/error logging and `/healthz`.
- Added `Dockerfile`, `.dockerignore`, and a systemd/Docker deployment guide.
- Unified asset versions at `2.5.0` and pinned Chart.js/Lucide with SRI.

## Required manual steps

These are environment/data actions that cannot be done safely from code alone:

1. **Update `.env`.** The app will refuse to start if the existing `WEB_PIN` is `1234` or shorter than 6 characters. Set `TOKEN_SECRET` (required in production) and, optionally, `IOT_TOKEN` and `OWNER_USERNAME`.
2. **Back up MongoDB, then normalize ownership** if old rows use a string ID, `0`, `NaN`, or no `userId`:

   ```bash
   npm run migrate:owner
   node scripts/normalize-owner.js --apply
   ```

3. **Set `IOT_TOKEN`** if a device uses `/iot`; otherwise the endpoint intentionally returns `503`.
4. **Expect existing sessions to be invalid** after the cookie/session change; log in again.
5. **Run `npm ci`** so the lockfile and dependencies match.

## Verification performed

- `npm ci` succeeds from the lockfile.
- `npm run lint` passes with no warnings.
- `npm test` passes: 21 tests.
- `npm audit --omit=dev` reports 0 vulnerabilities.
- All application JavaScript files pass `node --check`.
- DOM ids referenced by `public/app.js` all exist in the HTML partials.
- Inline event handlers were removed so the CSP can block script attributes.
- No server, database, or tunnel was started, per the project preference for static/code verification.
