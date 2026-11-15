# Remediation Plan

This plan orders the findings by risk and dependency. It assumes the app may be exposed through a Cloudflare tunnel, so anything reachable without authentication is treated as public.

Complexity is a rough implementation size, not a time estimate.

---

## Phase 0 — Do not expose publicly until these are fixed

These are the blockers. They are all small, local changes except the IoT decision.

| ID | Finding | Action | Complexity | Files |
| --- | --- | --- | --- | --- |
| SEC-01 | Default PIN is the signing secret | Require `WEB_PIN`; add separate `TOKEN_SECRET`; fail fast | Low | `lib/server.js`, new `lib/config.js`, `.env.example` |
| SEC-02 | No login rate limit | Add `express-rate-limit`, `trust proxy`, lockout/backoff | Low | `lib/server.js`, `main.js` |
| SEC-04 | `/iot` leaks spending | Require `IOT_TOKEN` or remove `expenses` from the payload | Low | `lib/server.js` |
| SEC-06 | Stored XSS via `type` | Allowlist `expense`/`income` on write; escape/normalize on render | Low | `lib/server.js`, `public/app.js` |
| API-01 | Transaction payload validation | Validate type, amount, item, date, category; return 400 | Medium | `lib/server.js`, new `lib/validate.js` |
| OPS-06 | No env validation | Add `lib/config.js`; validate Mongo DB name and owner ID | Low | new `lib/config.js`, `main.js`, `lib/database.js`, `lib/ai.js` |

**Exit criteria**

- Starting without `WEB_PIN`, `TOKEN_SECRET`, `MONGODB_URI`, `MONGODB_DB_NAME`, `GEMINI_API_KEY`, or `AUTHORIZED_USER_ID` exits with a clear message.
- A token forged with the old default secret is rejected.
- Eleven failed logins from one IP are throttled.
- `POST /api/transactions` with `type: "<img src=x onerror=alert(1)>"` returns 400.
- `/iot` without a valid device token returns 401, or no longer contains `expenses`.
- All dynamic values in table/AI/calendar rows are escaped.

Do not deploy a "temporary" exception to these.

---

## Phase 1 — Authentication, ownership, and data integrity

| ID | Finding | Action | Complexity | Files |
| --- | --- | --- | --- | --- |
| SEC-03 | Timing-unsafe comparisons | Use `crypto.timingSafeEqual` for HMAC and PIN | Low | `lib/server.js` |
| SEC-05 | One token, no ownership checks | Decide single-owner vs multi-user; derive owner server-side; scope writes | Medium | `lib/server.js`, `public/app.js` |
| SEC-07 | Weak session design | HttpOnly cookie session or separate secret + shorter TTL + logout/revocation | Medium | `lib/server.js`, `public/app.js` |
| SEC-08 | No headers/CSP; unpinned CDN | Add `helmet`, CSP, pin versions/SRI | Low | `main.js`, `public/index.html` |
| SEC-09 | Provider errors leaked | Generic client message + request ID; log internally | Low | `lib/server.js` |
| API-02 | Food logs unvalidated | Require name/category; derive `userId` | Low | `lib/server.js` |
| API-03 | Stats bounds and scope | Add `$lt` bounds; one `$facet`; choose owner scope | Medium | `lib/server.js` |
| API-05 | Query params unvalidated | Strict date regex, integer/cap validation | Low | `lib/server.js` |
| API-10 | No shutdown/tunnel supervision | Capture server, handle signals, close Mongo, tunnel handlers | Medium | `main.js`, `lib/database.js` |
| API-11 | HTML error responses | JSON 404 + centralized error middleware | Low | `lib/server.js` |
| UI-01 | User filter null deref | Restore select or remove filter code | Low | `public/app.js`, `public/pages/transactions.html` |
| UI-03 | Edit erases category | Add missing option before assigning value | Low | `public/app.js` |
| UI-04 | `escapeHtml` crashes | Coerce and null-guard input | Low | `public/app.js` |
| UI-10 | Init crashes on partial load | Guard optional elements; show load failure | Low | `public/app.js` |
| OPS-04 | Node version mismatch | `engines`, `.nvmrc`, README, CI | Low | `package.json`, `README.md` |
| OPS-03 | No tests | Add `node:test`; make `npm test` pass | Medium | `package.json`, `test/` |

**Owner-model decision (do this first in the phase)**

Pick one and apply it everywhere:

- Single-owner: `AUTHORIZED_USER_ID` is the only owner. Remove the users filter and `/api/users`, remove client-supplied `userId`/`username`, and scope stats/IoT/list queries to the owner.
- Multi-user: add a `users` collection, put `sub` and `role` in the session, and scope every query with the authenticated user. The current "everyone sees everything" state is not acceptable for multi-user.

Whichever is chosen, normalize the stored `userId` type and backfill existing documents. Do not leave a mix of number, string, `0`, and `NaN`.

---

## Phase 2 — Correctness and scale

| ID | Finding | Action | Complexity | Files |
| --- | --- | --- | --- | --- |
| API-04 | Unbounded lists | Add `page`/`pageSize`, caps, server-side filters | Medium | `lib/server.js` |
| API-06 | AI output trusted | Normalize/filter model output; validate on save; cap input | Medium | `lib/ai.js`, `lib/server.js`, `public/app.js` |
| API-07 | Story length/prompt/413 | Max length, mood allowlist, delimiters, JSON 413, AI rate limit | Medium | `lib/ai.js`, `lib/server.js` |
| API-08 | IoT timestamp/NaN | Fix format, `hourCycle: "h23"`, finite checks, cache | Low | `lib/server.js`, `lib/helpers.js` |
| API-09 | Inconsistent user IDs | One owner helper; backfill; single BSON type | Medium | `lib/server.js`, migration script |
| API-12 | `parseInt`/date helpers | `Number()` + validation; rename ambiguous helpers | Low | `lib/server.js`, `lib/helpers.js` |
| API-13 | Dead AI/routes/imports | Remove unused models, imports, audio branch | Low | `lib/ai.js`, `lib/server.js` |
| API-14 | Hardcoded owner identity | Env/config; remove literals from server and client | Low | `lib/server.js`, `public/app.js` |
| API-15 | Uniform body limit | Per-route limits | Low | `lib/server.js` |
| UI-02 | Dead pagination | Implement real pagination or remove it | Medium | `public/app.js`, `public/pages/transactions.html` |
| UI-05 | Timezone mismatch | Use Jakarta date keys for filter/calendar; document story timezone | Medium | `public/app.js` |
| UI-06 | Month rollover | Normalize to first of month | Low | `public/app.js` |
| UI-07 | "Top N" is latest N | Sort by amount before slicing; preferably server-side | Low | `public/app.js` |
| UI-08 | Avg tx metric unstable | Compute from a fixed denominator/window | Low | `public/app.js`, `lib/server.js` |
| UI-09 | `apiCall` JSON/timeout | Content-type check, timeout, single error path | Low | `public/app.js` |
| UI-14 | Redundant fetches/races | TTL cache, abort/versioning, tab-specific fetch | Medium | `public/app.js` |
| PERF-01 | Full dump on the client | Server-side paging/filter/sort | Medium | `lib/server.js`, `public/app.js` |
| PERF-02 | Stats triple read | Single `$facet`; top-N items | Medium | `lib/server.js` |
| PERF-03 | Indexes mismatch | Add compound indexes; verify with `explain` | Low | `lib/database.js` |
| PERF-04 | Unbounded history views | Paginate food/stories; month aggregate for calendar | Medium | `lib/server.js`, `public/app.js` |
| PERF-05 | Sequential AI saves | Bulk endpoint with `insertMany` | Medium | `lib/server.js`, `public/app.js` |

**Sequencing note**

PERF-01 and UI-02 should be one change: once the API paginates, the client pagination controls can be wired to real pages. Doing client pagination first on top of a full dump is wasted work.

Similarly, API-03 and UI-08 should be one change: put the average transaction value in the stats response so the Insights page does not depend on the current table page.

---

## Phase 3 — Polish, documentation, and maintenance

| ID | Finding | Action | Complexity |
| --- | --- | --- | --- |
| UI-12 | Day-group CSS missing | Define one scheme or remove the classes | Low |
| UI-13 | Story queue/toast/relative time | Pass queue, clear toast timer, validate dates, unify language | Low |
| UI-15 | Stale views after delete | Update state and re-render derived views | Low |
| UI-16 | Dead state/helpers | Delete unused pagination/user state and DOM refs | Low |
| UI-17 | Accessibility gaps | `aria-label`, toast `role=status`, Escape/focus handling | Low |
| PERF-06 | No compression/cache | Add `compression`, static cache headers, `/iot` cache | Low |
| PERF-07 | Chart/DOM churn | Skip unchanged chart rebuilds; use fragments | Low |
| OPS-01 | README stale | Rewrite for the current architecture | Low |
| OPS-02 | PRD stale | Archive or rewrite | Low |
| OPS-05 | Duplicate AI SDK | Remove `@google/genai`; add required deps | Low |
| OPS-07 | No lint/CI | ESLint, Prettier, CI workflow | Medium |
| OPS-08 | License mismatch | Add LICENSE; align metadata | Low |
| OPS-09 | No health/logging/deploy | `/healthz`, structured logs, service unit | Medium |
| OPS-10 | No API docs | `docs/api.md` or OpenAPI | Low |
| OPS-11 | Asset versioning | One version/hash for all assets; pin CDN | Low |

---

## Suggested pull-request sequence

Keep each PR focused so behavior changes are reviewable and revertible.

1. **config-and-secrets**: `lib/config.js`, `.env.example`, startup validation, separate `TOKEN_SECRET`.
2. **auth-hardening**: timing-safe comparisons, login limiter, trust proxy, token TTL/revocation design.
3. **input-validation**: `lib/validate.js`, transaction/food/story validation, type allowlist, date/limit validation.
4. **render-safety**: escape/normalize all dynamic HTML, fix `escapeHtml`, category select, init guards.
5. **stats-owner-scope**: single aggregation, upper bounds, owner decision, avg transaction metric.
6. **pagination**: server-side paging/filter/sort, client pagination, remove full-dump assumptions.
7. **iot-endpoint**: device token, timestamp format, finite price checks, caching.
8. **docs-and-tests**: README/PRD, `node:test`, CI, lint, license.
9. **cleanup**: dead AI models/routes/imports, unused client state, dependency removal, asset versioning.

PR 1-4 can land before the app is exposed. PR 5-9 follow.

---

## Verification plan

Automated:

- [ ] Unit tests for `toJakartaDateStr`, `parseJakartaDate`, `getStartOfJakartaDayAgo`, and the date range used by `/api/stats`.
- [ ] Unit tests for token generation/verification, including expiry, tampering, and the wrong secret.
- [ ] Unit tests for `parseMoney`, `parseDate`, type allowlist, and story length limits.
- [ ] Route tests with `supertest`: 401 without token, 400 for invalid payloads, 404 JSON for unknown API routes, 413 JSON for oversized bodies.
- [ ] A regression test that a transaction with a malicious `type` is rejected and never rendered unescaped.
- [ ] `npm audit --omit=dev` and `npm run lint` pass in CI.

Manual:

- [ ] Log in, open every tab, confirm no console errors and no failed partial loads.
- [ ] Create/edit/delete a transaction; confirm KPIs, top expenses, current-day panel, and calendar update.
- [ ] Create a transaction through Quick AI Parse with an Indonesian category, then edit it; confirm the category is preserved.
- [ ] Change the system timezone to a non-WIB zone and confirm the date filter, calendar month, and story dates agree.
- [ ] Set "Show" to different values and page through results; confirm the count and rows match.
- [ ] Stop MongoDB; confirm `/healthz` reports unavailable and the app returns JSON errors rather than hanging.
- [ ] Kill the Cloudflare tunnel; confirm the app logs it and a supervisor restarts it.
- [ ] Restart the app under `SIGTERM`; confirm the server closes cleanly and Mongo disconnects.

---

## Definition of done for the security work

- No default credentials or secrets in code or examples.
- Login is rate-limited and timing-safe.
- No endpoint returns financial data without authentication unless explicitly designed and documented.
- Ownership is derived on the server; the client cannot reassign records.
- `type`, `category`, amounts, dates, and story content are validated on write.
- All user-controlled strings are escaped or inserted with `textContent`.
- Security headers and CSP are enabled; CDN assets are pinned.
- `npm audit` has no unresolved high/critical findings.
- Tests cover auth, validation, and escaping.

---

## Risks to manage during remediation

- **Session change logs everyone out.** Expected when the secret/session format changes; communicate it.
- **Owner scoping changes visible totals.** If the dashboard currently shows all users, switching to owner-only will change numbers. Decide intentionally and document it.
- **`userId` backfill.** Normalizing types can be irreversible without a backup. Take a dump first and dry-run the migration.
- **Index builds.** Adding compound indexes on a large collection increases write cost and may take time; build during a low-traffic window.
- **Pagination changes the UI contract.** Update the client and the API in the same PR; do not leave the old `transactions` array shape half-supported.
- **AI normalization can drop items.** Log rejected items and surface a count to the user instead of silently discarding them.
- **CSP can break inline handlers.** The overview page uses `onclick="switchTab(...)"`; replace it with `addEventListener` before enforcing a strict `script-src`.
