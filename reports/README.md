# Code Review Report — Expense Tracker

**Date:** 2026-11-15
**Branch:** `main` (working tree includes uncommitted removal of the Telegram bots and MQTT integration)
**Scope:** `main.js`, `lib/*.js`, `public/**`, `package.json`, `package-lock.json`, `.env.example`, `README.md`, `food-updates-PRD.md`
**Method:** static review, syntax check of all application JavaScript, dependency/runtime compatibility check, and cross-file call tracing. No server or database was started, so no runtime behavior was verified.

> **Implementation status:** all 59 findings have been addressed in the working tree. See [FIXES-APPLIED.md](./FIXES-APPLIED.md) for the change map and the remaining environment/data steps. The findings below are retained as the review record.

---

## Verdict

The application is coherent for its size: a single Express process serves a dashboard, stores transactions/food logs/stories in MongoDB, and uses Gemini for parsing and story formatting. The frontend is organized into page partials and page-specific CSS, and most rendering paths already escape user data.

It is **not safe to expose to the internet as it stands**. There are two critical issues (a default PIN that is also the token-signing key, and an unthrottled four-digit login), a public endpoint that leaks daily spending, a stored-XSS path through the unvalidated `type` field, and no per-user authorization despite a multi-user data model.

The documentation and test setup are also out of date: the README still describes the Telegram/MQTT application, `npm test` is designed to fail, and the documented Node version is lower than the one required by `mongodb@7`.

### Scorecard

| Area | Rating | Summary |
| --- | --- | --- |
| Authentication and authorization | **Critical** | Default PIN/secret, no rate limit, one global token, no ownership checks |
| Input validation and data integrity | **Poor** | Types, amounts, dates, and IDs are not validated; AI output is trusted |
| Frontend correctness | **Needs work** | Broken user filter, dead pagination, category data loss, timezone mismatches |
| Performance and scalability | **Fair** | Fine for small data; full-history dumps and repeated stats queries will not scale |
| Documentation | **Poor** | README and PRD describe removed services; no API docs |
| Testing and CI | **Missing** | No tests, no lint, no CI; `npm test` exits 1 |
| Code organization | **Good** | Small modules, clear route grouping, parameterized Mongo queries |
| Operational readiness | **Weak** | No health check, no graceful shutdown, no tunnel supervision, no env validation |

### Findings at a glance

| Report | Findings | Critical | High | Medium | Low |
| --- | ---: | ---: | ---: | ---: | ---: |
| [Security](./01-security.md) | 9 | 2 | 4 | 3 | 0 |
| [Backend and API](./02-backend-api.md) | 15 | 0 | 3 | 7 | 5 |
| [Frontend](./03-frontend.md) | 17 | 0 | 2 | 10 | 5 |
| [Data and performance](./04-data-performance.md) | 7 | 0 | 0 | 4 | 3 |
| [Tooling and docs](./05-tooling-docs.md) | 11 | 0 | 3 | 5 | 3 |
| **Total** | **59** | **2** | **12** | **29** | **16** |

---

## Reports

1. [Security](./01-security.md) — secrets, login, authorization, XSS, session design, headers, error leakage. Includes a deployment checklist.
2. [Backend and API](./02-backend-api.md) — validation, stats correctness, ownership, AI output handling, lifecycle, error responses, dead code.
3. [Frontend](./03-frontend.md) — broken filter, pagination, category select, escaping, timezone, calendar, chart, API client, initialization, accessibility.
4. [Data and performance](./04-data-performance.md) — query patterns, indexes, unbounded payloads, aggregation, bulk saves, caching, client rendering.
5. [Tooling and docs](./05-tooling-docs.md) — stale README/PRD, tests, Node compatibility, dependencies, env validation, lint/CI, license, health/observability, API docs.
6. [Remediation plan](./06-remediation-plan.md) — phased fixes, dependency order, PR sequence, verification plan, risks.

Every finding has the same structure: severity, exact location, what is wrong, why it matters, and a concrete fix or code sketch. Cross-references use IDs such as `SEC-06` or `API-03`.

---

## Fix these first

| Order | ID | Issue | Why first |
| ---: | --- | --- | --- |
| 1 | SEC-01 | `WEB_PIN` defaults to `1234` and signs tokens | Anyone who guesses/knows the PIN can mint a valid token |
| 2 | SEC-02 | Login has no rate limit or lockout | 10,000 PIN combinations can be brute-forced |
| 3 | SEC-04 | Public `/iot` returns today's spending | Unauthenticated financial disclosure |
| 4 | SEC-06 | `type` is unvalidated and rendered unescaped | Stored XSS can steal the session token |
| 5 | SEC-05 | One token, no ownership checks, client-supplied `userId` | Any token holder can read/alter any record |
| 6 | API-01 | Transactions accept invalid types/amounts/dates | Blocks the XSS fix and corrupts stats |
| 7 | API-02 | Food logs accept empty bodies and store `NaN` | Crashes the food table and breaks grouping |
| 8 | API-03 | Stats have no upper date bound and no owner scope | KPIs can be wrong and disagree with `/iot` |
| 9 | OPS-06 | No env validation; missing DB name falls back to `test` | Silent misconfiguration and data loss risk |
| 10 | UI-03 | Editing an AI-created row erases its category | Visible data loss on a normal workflow |

The full ordering, with acceptance criteria, is in [06-remediation-plan.md](./06-remediation-plan.md).

---

## What works well

- The server, database, AI, helper, and web layers are separated into small modules. `main.js` is short and readable.
- Mongo queries are parameterized, `ObjectId` inputs are validated, and there is no obvious query/operator injection.
- Jakarta date helpers exist on both server and client, and the main transaction tables display Jakarta time consistently.
- Most user-controlled strings go through `escapeHtml`; the remaining gaps are localized and fixable.
- External HTTP calls to Coinbase, Binance, and the exchange-rate API have timeouts and a cached fallback.
- `.env` is ignored by git; `node_modules` and logs are ignored as well.
- The UI has a consistent visual language, page-specific CSS, and mobile navigation already in place.
- Removing the Telegram/MQTT code from `main.js` and `package.json` is the right direction; the remaining work is to finish that cleanup in the docs and unused AI code.

---

## Important context

- **Working tree, not just HEAD.** `main.js`, `lib/ai.js`, `.env.example`, `package.json`, `package-lock.json`, and `public/pages/modals.html` have uncommitted changes. The review reflects the working tree, including the bot removal.
- **Single-owner vs multi-user is undecided.** The code exposes a user filter and aggregates distinct `userId` values, but uses one shared token and no ownership checks. Several findings (SEC-05, API-03, API-09, API-14, UI-01) depend on which model is intended. Decide this before implementing fixes.
- **No runtime verification.** Per project preference, no dev server, database, or tunnel was started. Syntax was checked with Node's VM parser, and dependency requirements were read from `package-lock.json`.
- **Not covered.** Visual design review, real-browser behavior, mobile device testing, live Mongo query plans, Cloudflare configuration, backup/restore drills, and legal/privacy review. The performance findings are based on code paths and data shape, not measured load tests.

---

## Suggested next step

Start with Phase 0 in [06-remediation-plan.md](./06-remediation-plan.md): fail-fast configuration, a separate token secret, login throttling, a decision on the public IoT endpoint, server-side `type` validation, and basic payload validation. Those changes remove the two critical issues and close the most direct data-leak and XSS paths without requiring a schema migration.

After that, resolve the owner model and add a real test suite before touching pagination or performance work.
