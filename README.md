# Expense Tracker

A personal finance dashboard with AI-assisted transaction parsing, food logs, and a diary. One Express process serves the dashboard, stores data in MongoDB, and uses Google Gemini for text extraction and story formatting.

## Features

- Dashboard with today/month KPIs, a 30-day trend chart, category breakdown, and a spending calendar.
- Manual transaction CRUD with Jakarta-timezone dates and pagination.
- Quick AI Parse: natural-language transactions, previewed before a bulk save.
- Food intake log with pagination.
- Diary/story entries with original and AI-formatted versions.
- Optional public `/iot` endpoint for a microcontroller display, protected by a device token.

## Requirements

- Node.js **>= 20.19.0** (required by `mongodb@7` and `bson@7`)
- MongoDB (local or Atlas)
- A Google Gemini API key

`.nvmrc` is included. Use `nvm use` if you use nvm.

## Setup

```bash
npm ci
cp .env.example .env
```

Fill in `.env`:

| Variable | Required | Description |
| --- | --- | --- |
| `ENV` | No | `dev` (default) or `prod` |
| `PORT` | No | HTTP port, default `3000` |
| `GEMINI_API_KEY` | Yes | Google AI Studio key |
| `GEMINI_MODEL` | No | Defaults to `gemini-2.0-flash` |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `MONGODB_DB_NAME` | Yes | Explicit database name; never defaults to `test` |
| `WEB_PIN` | Yes | Login PIN, at least 6 characters |
| `TOKEN_SECRET` | Prod | At least 32 random characters; signs session tokens |
| `AUTHORIZED_USER_ID` | Yes | Integer owner ID used to scope all records |
| `OWNER_USERNAME` | No | Label stored on new records, default `owner` |
| `IOT_TOKEN` | No | Device token for `/iot`; the endpoint is disabled when empty |
| `CL_TUNNEL_TOKEN` | No | Cloudflare Tunnel token, used when `ENV=prod` |

Generate a token secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Run

```bash
npm start
```

Open `http://localhost:3000` and enter `WEB_PIN`.

## Scripts

| Script | Description |
| --- | --- |
| `npm start` | Start the web server (and tunnel in production) |
| `npm test` | Run `node:test` tests |
| `npm run test:watch` | Watch mode |
| `npm run lint` | Run ESLint |
| `npm run format` | Run Prettier on server/test code |
| `npm run migrate:owner` | Dry-run owner normalization for existing rows |

## Architecture

```text
main.js                 startup, graceful shutdown, Cloudflare Tunnel
lib/config.js           environment validation and typed config
lib/database.js         Mongo client, collections, indexes, close
lib/server.js           Express routes, auth, validation, pagination
lib/auth.js             session token signing and timing-safe helpers
lib/validate.js         input validation helpers
lib/ai.js               Gemini transaction parsing and story formatting
lib/helpers.js          Jakarta date/time helpers
public/                 dashboard HTML partials, CSS, client JS
test/                   node:test suites
docs/api.md             API reference
```

## API

All `/api` routes except `POST /api/login` require a valid session cookie. A bearer token is also accepted for non-browser clients. See [docs/api.md](docs/api.md) for request/response details.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/login` | Log in with the PIN |
| POST | `/api/logout` | Revoke the session |
| GET | `/api/verify` | Check the session |
| GET | `/api/transactions` | Paged, searchable, sortable list |
| GET | `/api/transactions/top` | Top expenses by amount |
| POST | `/api/transactions` | Create one transaction |
| POST | `/api/transactions/bulk` | Create up to 100 transactions |
| POST | `/api/transactions/parse` | Parse natural language with Gemini |
| PUT | `/api/transactions/:id` | Update a transaction |
| DELETE | `/api/transactions/:id` | Delete a transaction |
| GET | `/api/stats` | KPI, daily, category, and top-item data |
| GET | `/api/calendar` | Month totals, items, and stories |
| GET/POST | `/api/food/logs` | List or create food logs |
| GET/POST | `/api/stories` | List or create stories |
| PUT/DELETE | `/api/stories/:id` | Update or delete a story |
| POST | `/api/stories/prettify` | Format a story with Gemini |
| GET | `/iot` | Device display payload, `x-iot-token` required |
| GET | `/healthz` | Liveness/readiness check |

## Security notes

- `WEB_PIN` has no default. Startup fails if it is missing, shorter than 6 characters, or equal to `1234`.
- Session tokens are signed with a separate `TOKEN_SECRET`, stored in an HttpOnly `SameSite=Strict` cookie, and backed by a revocable MongoDB session record.
- Login, API, AI, and IoT routes are rate-limited.
- All records are scoped to `AUTHORIZED_USER_ID`. The client cannot set `userId` or `username`.
- Transaction `type`, amounts, dates, categories, story content, and pagination parameters are validated server-side.
- Helmet, CSP, compression, and pinned CDN assets with SRI are enabled.
- `/iot` returns `503` unless `IOT_TOKEN` is set, and requires the token via `x-iot-token` or `?token=`.

## Existing data

All reads and writes use the integer `AUTHORIZED_USER_ID`. If an older database has rows with a string ID, `0`, `NaN`, or no `userId`, they will not appear until normalized. Run the dry run first:

```bash
npm run migrate:owner
# then apply
node scripts/normalize-owner.js --apply
```

Take a database backup before applying the migration.

## Deployment

- Set `ENV=prod` to enable secure cookies and trust the first proxy (Cloudflare).
- Set `TOKEN_SECRET`; it is required in production.
- Keep `.env` out of version control.
- Put MongoDB behind network restrictions and back it up.
- The app expects one process. Use a service manager or container with a restart policy.
- `GET /healthz` checks MongoDB connectivity and returns `503` when unavailable.

## License

MIT. See [LICENSE](LICENSE).
