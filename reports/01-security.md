# Security Review

Scope: `lib/server.js`, `lib/ai.js`, `public/app.js`, `main.js`, `.env.example`.

Threat model: the app is a personal finance dashboard intended to be exposed through a Cloudflare tunnel. The login page and `/iot` are reachable by anyone on the internet. The data includes spending history, diary entries, and food logs. A single shared PIN protects everything.

---

## SEC-01 — Default PIN doubles as the token signing secret

**Severity:** Critical
**Location:** `lib/server.js:11`, `lib/server.js:119`, `.env.example` (`WEB_PIN=1234`)

`const SECRET = process.env.WEB_PIN || "1234";` is used both as the login PIN and as the HMAC key for session tokens. `.env.example` also ships `WEB_PIN=1234`. If the variable is missing or the example is copied verbatim, an attacker knows both the password and the token-signing key.

Because token payloads are simply base64 JSON plus an HMAC, anyone with the PIN can mint a valid token without ever calling `/api/login`:

```js
const payloadJson = JSON.stringify({ expires: Date.now() + 1e12 });
const payload = Buffer.from(payloadJson).toString("base64");
const hmac = crypto.createHmac("sha256", "1234").update(payloadJson).digest("hex");
const token = payload + "." + hmac;
```

The exact forging script is trivial; the point is that the PIN has to be secret forever and is only four digits.

**Fix**

- Require `WEB_PIN` to be present and reject weak values at startup.
- Use a separate, high-entropy `TOKEN_SECRET` for HMAC signing; never derive it from the PIN.
- Rotate the token secret independently from the PIN.
- Remove the default from both code and `.env.example`.

```js
// lib/config.js
const required = ["MONGODB_URI", "MONGODB_DB_NAME", "GEMINI_API_KEY", "WEB_PIN", "TOKEN_SECRET"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
}
if (process.env.WEB_PIN.length < 6) {
    console.error("WEB_PIN must be at least 6 characters");
    process.exit(1);
}
if (process.env.TOKEN_SECRET.length < 32) {
    console.error("TOKEN_SECRET must be at least 32 characters");
    process.exit(1);
}

module.exports = {
    webPin: process.env.WEB_PIN,
    tokenSecret: process.env.TOKEN_SECRET,
    mongodbUri: process.env.MONGODB_URI,
    mongodbDbName: process.env.MONGODB_DB_NAME,
    geminiApiKey: process.env.GEMINI_API_KEY
};
```

```js
// lib/server.js
const { webPin, tokenSecret } = require("./config");
const crypto = require("crypto");

function generateToken() {
    const payload = JSON.stringify({ expires: Date.now() + 12 * 60 * 60 * 1000 });
    const hmac = crypto.createHmac("sha256", tokenSecret).update(payload).digest("hex");
    return Buffer.from(payload).toString("base64url") + "." + hmac;
}
```

---

## SEC-02 — No rate limit or lockout on the 4-digit PIN login

**Severity:** Critical
**Location:** `lib/server.js:112-127` (`POST /api/login`)

A four-digit PIN has 10,000 possible values. There is no delay, no failed-attempt counter, no IP throttle, and no account lockout. The endpoint is exposed through the tunnel, so a script can exhaust the keyspace quickly. The only side effect is a 401 response.

Related: the PIN is stored in plain text in the environment and compared directly; there is no password hashing or pepper.

**Fix**

- Add per-IP and per-session rate limiting on `/api/login` (for example `express-rate-limit`).
- Add progressive backoff or temporary lockout after repeated failures.
- Set `app.set("trust proxy", 1)` so Cloudflare's `CF-Connecting-IP` is honored instead of the proxy IP.
- Log failed attempts with IP, timestamp, and user agent (no PIN).
- Prefer a longer passphrase or TOTP/WebAuthn over a four-digit PIN.

```js
const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many login attempts. Try again later." }
});

router.post("/login", loginLimiter, (req, res) => {
    // ...
});
```

For a single-process deployment, an in-memory limiter is acceptable. If the app is ever scaled horizontally, move the counter to Redis or MongoDB.

---

## SEC-03 — Token and PIN comparisons are not timing-safe

**Severity:** High
**Location:** `lib/server.js:86` (`hmac !== expectedHmac`), `lib/server.js:119` (`pin.toString() === SECRET.toString()`)

String comparison exits at the first differing byte. In theory this leaks information about the correct HMAC or PIN through response timing. Network jitter makes a remote attack difficult, but the fix is cheap and should be applied to both checks.

**Fix**

```js
function timingSafeEqualString(a, b) {
    // Hashing first avoids leaking the length of the expected value.
    const left = crypto.createHash("sha256").update(String(a)).digest();
    const right = crypto.createHash("sha256").update(String(b)).digest();
    return crypto.timingSafeEqual(left, right);
}

// PIN check
if (!timingSafeEqualString(pin, webPin)) {
    return res.status(401).json({ error: "Invalid PIN" });
}
```

```js
// HMAC check
const provided = Buffer.from(hmac, "hex");
const expected = Buffer.from(expectedHmac, "hex");
if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return false;
}
```

Also use base64url for the payload so tokens are safe to place in headers and URLs.

---

## SEC-04 — Public `/iot` endpoint leaks financial data

**Severity:** High
**Location:** `lib/server.js:44-66` (`getIotData`), `lib/server.js:635` (`router.get("/iot")`), `lib/server.js:643` (`app.get("/iot")`)

The endpoint is explicitly public for microcontrollers and returns today's total expenses:

```js
return {
    btc: iotCache.btc,
    idr: iotCache.idr,
    datetime: dateTimeFormatted,
    expenses: expensesFormatted,
    display: [iotCache.btc, iotCache.idr, dateTimeFormatted, expensesFormatted]
};
```

Anyone who discovers `https://<domain>/iot` can poll a household's daily spending. The response also discloses the configured owner's spending even though the rest of the API requires auth. There is no rate limit, so the endpoint can also be used to trigger the external price API calls and a MongoDB read on every request.

**Fix**

- Require a device token for the endpoint, or split it into a public prices/time endpoint and a private spending endpoint.
- If the device only needs BTC, IDR, and time, remove `expenses` entirely.
- Add a short response cache and rate limit.
- Compare the device token with `crypto.timingSafeEqual`.

```js
router.get("/iot", (req, res, next) => {
    const token = req.get("x-iot-token");
    const expected = process.env.IOT_TOKEN;
    if (!expected || !token || !timingSafeEqualString(token, expected)) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
}, handleIotRequest);
```

Also remove the duplicate registration in `initWebServer` so there is one documented route.

---

## SEC-05 — One global token grants access to every record; ownership is taken from the request body

**Severity:** High
**Location:** `lib/server.js:97-107` (`authMiddleware`), `lib/server.js:337-344` (`POST /api/transactions`), `lib/server.js:453-466` (`POST /api/food/logs`), `lib/server.js:519-527` (`POST /api/stories`)

The token payload only contains `expires`. There is no user identity, role, or scope. Every authenticated request can:

- Read all transactions for all users, all food logs, all stories.
- Update or delete any transaction or story by `_id` without an ownership check.
- Set `userId` and `username` freely in the body, attributing entries to another person.

The dashboard even exposes a user filter and aggregates distinct `userId` values, so the data model is multi-user while the authorization model is "single shared secret".

**Fix**

- Decide whether this is a single-owner app or a multi-user app.
- Single-owner: derive `userId` from configuration on the server, reject/ignore client-supplied `userId` and `username`.
- Multi-user: add a users collection, per-user credentials or tokens, put `sub` and `role` in the token, and scope every query/mutation with `{ userId: req.user.id }`.
- Never accept ownership fields from the client for create/update.

```js
// Single-owner mode
function getOwnerId() {
    const id = Number(process.env.AUTHORIZED_USER_ID);
    if (!Number.isInteger(id)) {
        throw new Error("AUTHORIZED_USER_ID must be an integer");
    }
    return id;
}

const newDoc = {
    userId: getOwnerId(),
    username: process.env.OWNER_USERNAME || "owner",
    // ...validated fields only
};
```

For updates, do `updateOne({ _id, userId: getOwnerId() }, ...)` rather than `{ _id }` alone, even in single-owner mode, so a leaked ID from another dataset cannot be edited.

---

## SEC-06 — Stored XSS through the unvalidated `type` field

**Severity:** High
**Location:** `lib/server.js:331-345` (no `type` allowlist), `public/app.js:1292-1294`, `public/app.js:1630-1631`, `public/app.js:2274-2275`

The API accepts any string as `type`:

```js
const { item, amount, category, type = "expense", ... } = req.body;
// ...
type,
```

The client then interpolates it into HTML without escaping:

```js
<td><span class="tx-amount ${t.type}">Rp${formatCurrency(t.amount)}</span></td>
<td><span class="tx-badge ${t.type}">${escapeHtml(t.category)}</span></td>
<td style="text-transform: capitalize;">${t.type}</td>
```

```js
<span class="tx-amount ${item.type}">Rp${formatCurrency(item.amount)}</span>
<span class="item-type ${item.type}">${item.type}</span>
```

A transaction with `type` set to `"><img src=x onerror=...>` executes script when the transactions table, AI preview, calendar-day modal, or insight list renders. Because the session token lives in `localStorage`, the payload can exfiltrate it.

The same pattern exists for `category` only where it is not escaped (most places do escape it), and AI output is inserted into the DOM with only partial escaping.

**Fix**

1. Validate `type` server-side against `expense` and `income`.
2. Treat every interpolated value as untrusted. Prefer `textContent` or a small `escapeHtml` wrapper on all dynamic values, including class names.
3. Never build class names directly from user data. Normalize first.

```js
const ALLOWED_TYPES = new Set(["expense", "income"]);
if (!ALLOWED_TYPES.has(type)) {
    return res.status(400).json({ error: "type must be expense or income" });
}
```

```js
const safeType = t.type === "income" ? "income" : "expense";
tr.innerHTML = `
    <td><span class="tx-amount ${safeType}">Rp${formatCurrency(t.amount)}</span></td>
    <td><span class="tx-badge ${safeType}">${escapeHtml(t.category)}</span></td>
    <td>${escapeHtml(safeType)}</td>
`;
```

Add a Content-Security-Policy as defense in depth (see SEC-08).

---

## SEC-07 — Session design is weak for a financial app

**Severity:** Medium
**Location:** `lib/server.js:70-95`, `public/app.js:434-448`, `public/app.js:50`

Current behavior:

- Token stored in `localStorage`, readable by any XSS.
- Fixed 7-day expiry, no refresh, no revocation, no logout endpoint.
- Token payload has no user, device, or version.
- Logout only deletes the browser copy; a stolen token remains valid for seven days.
- Token HMAC key is the low-entropy PIN.

**Fix**

- Prefer an `HttpOnly`, `Secure`, `SameSite=Strict` cookie session with server-side storage (collection or signed session ID) and a CSRF token for state-changing requests.
- Shorten access lifetime and add rotation on login.
- Add `POST /api/logout` that revokes the session server-side.
- Store `{ sid, userId, createdAt, expiresAt, revokedAt }`; check `revokedAt` in the middleware.
- If the bearer-token design is kept, at minimum use a separate high-entropy secret and a shorter TTL.

Also return `Cache-Control: no-store` on authenticated responses so intermediaries do not cache financial data.

---

## SEC-08 — No security headers, CSP, or pinned frontend dependencies

**Severity:** Medium
**Location:** `public/index.html:10-15`, `lib/server.js:638-650`

`index.html` loads Chart.js and Lucide from third-party CDNs. Lucide is pinned to `@latest`, which can change without notice; neither script uses Subresource Integrity. There is no `helmet`, no CSP, no `X-Content-Type-Options`, no `Referrer-Policy`, and no frame protection. A compromised CDN or a typo-squatted package would run with full access to the dashboard and its token.

**Fix**

- Add `helmet` with a restrictive CSP.
- Pin CDN versions and add SRI hashes, or self-host the two libraries.
- Add `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, and `Permissions-Policy` for unused features.
- Consider `Cross-Origin-Opener-Policy: same-origin`.

```js
const helmet = require("helmet");

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            frameAncestors: ["'none'"]
        }
    }
}));
```

If the inline `onclick="switchTab('transactions')"` in `public/pages/overview.html` is kept, `scriptSrc` must allow it; better to replace it with an event listener and remove `'unsafe-inline'`.

Note: `helmet` is not currently a dependency. Add it with `npm install helmet compression`.

---

## SEC-09 — Provider error messages are returned to the client

**Severity:** Medium
**Location:** `lib/server.js:608-619` (`POST /api/stories/prettify`)

```js
} catch (err) {
    console.error("Failed to prettify story via AI:", err);
    return res.status(500).json({ error: err.message || "Failed to format story via AI" });
}
```

`err.message` can contain Gemini API details such as quota information, project identifiers, model names, or request IDs. The same pattern should be avoided for Mongo errors. Detailed errors belong in server logs, not responses.

**Fix**

- Log the full error with a generated request ID on the server.
- Return a stable, generic message and the request ID to the client.
- Add a centralized error handler so individual routes cannot leak internals.

```js
const requestId = crypto.randomUUID();
console.error(`[${requestId}] Story prettify failed`, err);
return res.status(502).json({ error: "AI formatting failed", requestId });
```

---

## Security checklist for deployment

- [ ] `WEB_PIN` is at least 6 characters and is not `1234` or the example value.
- [ ] `TOKEN_SECRET` is at least 32 random bytes and is not the PIN.
- [ ] `IOT_TOKEN` is set or the spending field is removed from `/iot`.
- [ ] Login rate limiting is enabled and `trust proxy` is configured for Cloudflare.
- [ ] `type` is allowlisted and all dynamic HTML is escaped.
- [ ] CSP and security headers are enabled.
- [ ] MongoDB network access is restricted to the application host.
- [ ] `.env` is not committed and backups are encrypted.
- [ ] Dependencies are audited (`npm audit`) and CDN assets are pinned.
