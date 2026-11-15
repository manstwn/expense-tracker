# Tooling, Documentation, and Operations Review

Scope: `README.md`, `food-updates-PRD.md`, `package.json`, `package-lock.json`, `.env.example`, repository layout, and runtime/deployment assumptions.

The code runs, but the repository does not describe itself accurately. The docs still describe the previous Telegram/MQTT architecture, the test script intentionally fails, and the documented Node version is lower than what the dependencies require.

---

## OPS-01 — The README describes an application that no longer exists

**Severity:** High
**Location:** `README.md`

The README claims:

- A Telegram bot with commands `/h`, `/r`, `/t`, `/td`.
- MQTT integration for smart-home displays.
- Files `bot.js`, `lib/mqtt.js`, `lib/reporter.js`.
- Node.js v16+.
- MQTT environment variables.

The current repository has:

- `main.js`, `lib/server.js`, `lib/ai.js`, `lib/database.js`, `lib/helpers.js`.
- An Express dashboard under `public/`.
- Gemini AI parsing and story formatting.
- No Telegram bot, no MQTT, no `bot.js`, no `lib/mqtt.js`, no `lib/reporter.js`.
- `node-telegram-bot-api` removed from `package.json` in the working tree.

A new contributor following the README will look for files that do not exist, set environment variables that are unused, and skip the actual setup steps (`WEB_PIN`, `MONGODB_DB_NAME`).

**Fix**

Rewrite the README around the actual system. Suggested sections:

1. What the app is: personal finance dashboard with AI transaction parsing, food logs, and a diary.
2. Architecture: `main.js` -> Express -> MongoDB; Gemini for parsing/formatting; optional Cloudflare tunnel.
3. Requirements: Node `>=20.19`, MongoDB Atlas or local, Gemini API key.
4. Setup: `npm ci`, `.env` from `.env.example`, required variables table.
5. Run: `npm start`, open `http://localhost:3000`, enter `WEB_PIN`.
6. API overview: link to `docs/api.md` or an endpoint table.
7. Project structure: the files that actually exist.
8. Security notes: do not expose without setting a real PIN, token secret, and IoT token.
9. Deployment: Cloudflare tunnel or reverse proxy, backups.
10. Testing: `npm test`, lint, audit.

Remove the bot commands table and MQTT sections unless the feature is restored.

---

## OPS-02 — The PRD is stale and contradicts the code

**Severity:** Medium
**Location:** `food-updates-PRD.md`

The PRD describes:

- Two Telegram bots and an MQTT service.
- `/api/money` and `/api/food` route prefixes.
- `lib/bots/moneyBot.js` and `lib/bots/foodBot.js`.
- `TELEGRAM_MONEY_TOKEN` / `TELEGRAM_FOOD_TOKEN`.

None of those exist. The actual food feature is a manual modal posting to `/api/food/logs`. The document is still marked "Implementation Plan: Pending Final Approval", which makes it unclear whether it is history or a current spec.

**Fix**

- Move it to `docs/archive/food-updates-PRD.md` if it is kept for history.
- Or rewrite it as a current feature spec for the food tracker, with the implemented routes and UI flow.
- Add a one-line status header ("Superseded by the web dashboard implementation on <date>") to prevent confusion.
- Keep the delivery plan and decisions, but remove references to removed services.

---

## OPS-03 — There are no tests, and `npm test` always fails

**Severity:** High
**Location:** `package.json:8`

```json
"test": "echo \"Error: no test specified\" && exit 1"
```

There is no test runner, no test directory, and no CI configuration. Any pipeline that runs `npm test` fails by design. The highest-risk logic (token verification, date boundaries, input validation, timezone conversion) is untested.

**Fix**

Use the built-in `node:test` runner; no additional runtime dependency is needed.

```json
"scripts": {
    "start": "node main.js",
    "test": "node --test",
    "test:watch": "node --test --watch",
    "lint": "eslint ."
}
```

Example tests:

```js
// test/helpers.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { toJakartaDateStr, getStartOfJakartaDayAgo } = require("../lib/helpers");

test("toJakartaDateStr converts UTC to the Jakarta date", () => {
    assert.equal(toJakartaDateStr(new Date("2026-11-14T17:30:00Z")), "2026-11-15");
    assert.equal(toJakartaDateStr(new Date("2026-11-14T16:59:59Z")), "2026-11-14");
});

test("getStartOfJakartaDayAgo returns Jakarta midnight", () => {
    const start = getStartOfJakartaDayAgo(1);
    assert.equal(start.getUTCHours(), 17);
});
```

```js
// test/auth.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

// Extract generateToken/verifyToken into lib/auth.js so they are testable.
test("tokens expire", () => {
    // ...
});
```

For route tests, add `supertest` as a dev dependency and export the Express app separately from `listen`. Keep tests independent of a live MongoDB by injecting a fake collection or using an in-memory substitute; at minimum test pure validation and date helpers.

---

## OPS-04 — Documented Node version is lower than the dependencies require

**Severity:** High
**Location:** `README.md` ("Node.js v16+"), `package.json`, `package-lock.json`

The lockfile shows:

- `mongodb@7.2.0`: `engines.node >= 20.19.0`.
- `bson@7.2.0`: `engines.node >= 20.19.0`.
- `@google/genai@1.51.0`: `engines.node >= 20.0.0`.
- `express@5.2.1`: `engines.node >= 18`.

Following the README on Node 16 or 18 will fail at install or runtime. Node 20.19 is the real minimum.

**Fix**

- Add `"engines": { "node": ">=20.19.0" }` to `package.json`.
- Add `.nvmrc` with `20` (or `22`) and mention it in the README.
- Update the prerequisites section.
- Use the same version in CI.

```json
"engines": {
    "node": ">=20.19.0"
}
```

---

## OPS-05 — Unused and duplicate dependencies

**Severity:** Medium
**Location:** `package.json:15-17`, `lib/ai.js:1`

Two Google SDKs are installed:

```json
"@google/genai": "^1.51.0",
"@google/generative-ai": "^0.24.1",
```

Only `@google/generative-ai` is required, in `lib/ai.js`:

```js
const { GoogleGenerativeAI } = require("@google/generative-ai");
```

`@google/genai` is never imported. It also pulls in `google-auth-library`, `protobufjs`, `ws`, and an optional MCP peer, and has an install script. This is unnecessary attack surface and install time.

`node-telegram-bot-api` was removed in the working tree, which is correct, but the lockfile diff is large; confirm `npm ci` still works from a clean checkout.

**Fix**

```bash
npm uninstall @google/genai
npm audit
```

Then verify there are no remaining imports and that the lockfile is regenerated consistently. If the intent is to migrate to the newer SDK, do it as one change and remove the old one; do not keep both.

Also add dependencies that the recommendations require, if adopted:

```bash
npm install helmet compression express-rate-limit
npm install --save-dev eslint prettier supertest
```

---

## OPS-06 — No startup environment validation; some defaults point at the wrong database

**Severity:** Medium
**Location:** `main.js:1-4`, `lib/database.js:11-13`, `lib/ai.js:4`, `lib/server.js:11`, `.env.example`

Failure modes when variables are missing:

| Missing variable | Current behavior |
| --- | --- |
| `GEMINI_API_KEY` | `new GoogleGenerativeAI(undefined)` throws during module load, before a useful message |
| `MONGODB_URI` | `MongoClient` throws with a driver error |
| `MONGODB_DB_NAME` | `client.db(undefined)` silently uses the `test` database |
| `WEB_PIN` | Falls back to `"1234"` |
| `AUTHORIZED_USER_ID` | `NaN` in food logs, `0` in transactions/stories |
| `GEMINI_MODEL` | Falls back to a hardcoded model, which may be retired |

`.env.example` does not include `TOKEN_SECRET` or `IOT_TOKEN`, so a correct deployment cannot be produced from it.

**Fix**

- Add `lib/config.js` that validates all required variables once and exports typed values.
- Fail fast with a message that names the missing variables but never prints their values.
- Use `MONGODB_DB_NAME` explicitly; never accept the driver's `test` default.
- Update `.env.example` with every variable and a comment describing it.

```js
// lib/config.js
const REQUIRED = [
    "MONGODB_URI",
    "MONGODB_DB_NAME",
    "GEMINI_API_KEY",
    "WEB_PIN",
    "TOKEN_SECRET",
    "AUTHORIZED_USER_ID"
];

function loadConfig() {
    const missing = REQUIRED.filter((key) => !process.env[key]);
    if (missing.length) {
        console.error(`Missing required environment variables: ${missing.join(", ")}`);
        process.exit(1);
    }

    const ownerId = Number(process.env.AUTHORIZED_USER_ID);
    if (!Number.isInteger(ownerId)) {
        console.error("AUTHORIZED_USER_ID must be an integer");
        process.exit(1);
    }

    return {
        mongodbUri: process.env.MONGODB_URI,
        mongodbDbName: process.env.MONGODB_DB_NAME,
        geminiApiKey: process.env.GEMINI_API_KEY,
        geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash",
        webPin: process.env.WEB_PIN,
        tokenSecret: process.env.TOKEN_SECRET,
        ownerId
    };
}

module.exports = loadConfig();
```

Validate length/entropy separately (see SEC-01).

---

## OPS-07 — No lint, formatter, or CI configuration

**Severity:** Medium
**Location:** repository root

There is no `.eslintrc*`, `eslint.config.*`, `.prettierrc*`, or `.github/workflows/` directory. The code mixes styles (4-space indentation in most files, inline styles in HTML, long lines in `app.js`), and there is no automated check for unused imports, accidental globals, or syntax errors before deploy.

**Fix**

- Add ESLint with a minimal Node/browser split: one config for `lib/` and `main.js` (CommonJS, Node globals), one for `public/app.js` (browser globals).
- Add Prettier with a single config; run it once over the codebase in a dedicated commit to avoid mixing formatting with logic changes.
- Add a CI workflow that runs `npm ci`, `npm run lint`, `npm test`, and `npm audit --omit=dev`.
- Add a `prestart` or CI syntax check (`node --check`) for the server files.

```yaml
# .github/workflows/ci.yml
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm audit --omit=dev
```

Keep the CI minimal; it should be fast enough to run on every push.

---

## OPS-08 — License and package metadata are inconsistent

**Severity:** Low
**Location:** `package.json:2-11`, `README.md` (License section)

- `package.json` says `"license": "ISC"`.
- The README says the project is MIT.
- There is no `LICENSE` file at the repository root.

For a personal project this is minor, but it is ambiguous for anyone reusing the code.

**Fix**

- Choose one license, add the `LICENSE` file, and make `package.json` and the README match.
- Fill in `description` and `author`, and consider renaming the package from `"money"` to something descriptive such as `"expense-tracker-dashboard"`.
- Keep `"private": true` if the package is not meant to be published.

---

## OPS-09 — No health endpoint, structured logging, or deployment definition

**Severity:** Medium
**Location:** `main.js`, `lib/server.js`, repository root

Operational gaps:

- No `/healthz` or readiness endpoint, so a tunnel, uptime monitor, or process manager cannot tell whether Mongo is reachable.
- Logs are `console.log`/`console.error` with no request ID, timestamp format, or redaction. AI and Mongo errors are printed in full.
- No `Dockerfile`, `compose.yaml`, `pm2` ecosystem file, systemd unit, or deployment notes.
- Cloudflare tunnel supervision is missing (API-10).
- No rate limiting or `trust proxy` configuration for running behind Cloudflare (SEC-02).

**Fix**

Add a lightweight health route that checks Mongo with a short timeout:

```js
app.get("/healthz", async (req, res) => {
    try {
        await db.command({ ping: 1 });
        res.json({ ok: true, uptime: process.uptime() });
    } catch (err) {
        res.status(503).json({ ok: false, error: "database unavailable" });
    }
});
```

Add structured logging (for example `pino` and `pino-http`) with a request ID, and redact authorization headers and request bodies for `/api/login`. Document one deployment method and include a restart policy. If the app stays on a single host, a systemd unit or `pm2` file is enough; a container is optional.

```ini
# expense-tracker.service (sketch)
[Service]
WorkingDirectory=/opt/expense-tracker
ExecStart=/usr/bin/node main.js
Restart=always
EnvironmentFile=/opt/expense-tracker/.env
```

---

## OPS-10 — No API documentation

**Severity:** Low
**Location:** repository root

The API exists only in `lib/server.js`. There is no contract document, so client changes and server changes can drift (several already have: `/iot`, `/transactions/top`, the removed user filter).

**Fix**

Add `docs/api.md` with a table per route:

| Method | Path | Auth | Body / query | Response |
| --- | --- | --- | --- | --- |
| POST | `/api/login` | none | `{ pin }` | `{ success, token }` |
| GET | `/api/transactions` | Bearer | `date`, `limit` (to become `page`, `pageSize`, `search`) | `{ transactions, total }` |
| POST | `/api/transactions` | Bearer | `{ item, amount, category, type, createdAt }` | `{ success, transaction }` |
| GET | `/api/stats` | Bearer | none | KPI/chart payload |
| GET | `/iot` | none (to change) | none | prices/time/expenses |

Document error shapes and status codes (`400`, `401`, `404`, `413`, `500`). If the API grows, generate an OpenAPI file and validate requests against it.

---

## OPS-11 — Asset versioning is inconsistent

**Severity:** Low
**Location:** `public/index.html:16`, `public/index.html:112`, `public/style.css:2-10`

`index.html` versions only the top-level assets:

```html
<link rel="stylesheet" href="style.css?v=2.1.0">
<script src="app.js?v=2.1.0"></script>
```

The nine CSS files imported by `style.css` are unversioned, so a change to `overview.css` or `modals.css` may be served from cache after a deploy. CDN scripts are unversioned (`lucide@latest`) or unpinned (Chart.js), which is also a security issue (SEC-08).

**Fix**

- Use one version token for every asset, or a build step that emits content hashes.
- If keeping query strings, append the same `?v=` to each `@import` URL.
- Pin CDN versions and add SRI, or vendor the libraries into `public/vendor/`.

```css
@import url('css/variables.css?v=2.1.0');
@import url('css/layout.css?v=2.1.0');
/* ... */
```

---

## Documentation and operations checklist

- [ ] README matches the current Express/Mongo/Gemini architecture.
- [ ] PRD is archived or rewritten with a status header.
- [ ] `npm test` runs real tests and exits 0.
- [ ] `engines.node` is `>=20.19.0`; `.nvmrc` and README agree.
- [ ] `@google/genai` is removed if unused; `npm audit` is clean.
- [ ] `lib/config.js` validates all required environment variables.
- [ ] `.env.example` includes `TOKEN_SECRET`, `IOT_TOKEN`, and `OWNER_USERNAME` if used.
- [ ] ESLint/Prettier and a CI workflow exist.
- [ ] License file and `package.json` agree.
- [ ] `/healthz`, structured logs, and a restart policy exist.
- [ ] API routes are documented.
- [ ] All asset references share a version or content hash.
