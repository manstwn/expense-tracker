# Food Tracker PRD

**Status: Archived / superseded.**

This document originally described a unified architecture with two Telegram bots, MQTT, and `/api/money` + `/api/food` route prefixes. That architecture is no longer present. The application is now a single Express dashboard:

- `main.js` starts the web server and optional Cloudflare Tunnel.
- `lib/server.js` exposes `/api/*` routes and serves `public/`.
- Food intake is a manual form posting to `POST /api/food/logs`.
- Data is owner-scoped by `AUTHORIZED_USER_ID`.
- MQTT and the Telegram bots were removed; there is no `bot.js`, `lib/bots/`, `lib/mqtt.js`, or `lib/reporter.js`.

## Current food feature

| Area | Behavior |
| --- | --- |
| Storage | `food_logs` collection |
| Create | `POST /api/food/logs` with `foodName` and `category` |
| List | `GET /api/food/logs?page=&pageSize=` |
| UI | Food tab, `Log Food` modal, paginated table |
| AI | Not used for food categorization; `parseFoodTransaction` was removed |

See [README.md](../README.md) and [docs/api.md](../docs/api.md) for the current contract.

The historical implementation plan is retained only as context and must not be used as a current specification.
