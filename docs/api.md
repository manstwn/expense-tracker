# API Reference

Base URL: `http://localhost:3000`

All `/api` routes except `POST /api/login` require a session. Authentication uses an HttpOnly `session` cookie. Non-browser clients should persist and send that cookie; the login response does not expose the token to JavaScript.

Errors are JSON:

```json
{ "error": "Invalid transaction payload" }
```

Unexpected server errors include a `requestId` that matches the server log.

---

## Authentication

### POST `/api/login`

Body: `{ "pin": "123456" }`

Sets the `session` cookie and returns:

```json
{ "success": true, "expiresAt": "2026-11-16T02:00:00.000Z" }
```

- `400` when the PIN is missing.
- `401` for a wrong PIN.
- Throttled after repeated failures.

### POST `/api/logout`

Revokes the current session, clears the cookie, and returns `{ "success": true }`.

### GET `/api/verify`

Returns `{ "valid": true, "expiresAt": "..." }` when the session is valid, otherwise `401`.

---

## Transactions

### GET `/api/transactions`

Query parameters:

| Name | Type | Default | Notes |
| --- | --- | --- | --- |
| `page` | integer | `1` | 1-based |
| `pageSize` | integer | `25` | Maximum `200` |
| `search` | string | | Matches `item` or `category`, case-insensitive |
| `date` | `YYYY-MM-DD` | | One Jakarta day |
| `sort` | string | `createdAt` | `createdAt`, `amount`, `item`, `category`, `type` |
| `order` | string | `desc` | `asc` or `desc` |

Response:

```json
{
  "transactions": [],
  "page": 1,
  "pageSize": 25,
  "total": 0,
  "totalPages": 0
}
```

### GET `/api/transactions/top`

Query: `limit` (1-100, default 20). Returns the owner's largest expenses:

```json
{ "transactions": [] }
```

### POST `/api/transactions`

Body:

```json
{
  "type": "expense",
  "item": "Nasi Padang",
  "amount": 25000,
  "category": "food",
  "createdAt": "2026-11-15T04:00:00.000Z"
}
```

- `type` must be `expense` or `income`.
- `amount` must be a positive finite number.
- `item` is required, maximum 120 characters.
- `createdAt` is optional and defaults to now.
- `userId` and `username` are ignored; ownership comes from the server.

Returns `201` with `{ "success": true, "transaction": { ... } }`.

### POST `/api/transactions/bulk`

Body: `{ "transactions": [ ... ] }`, 1-100 items. Valid items are inserted; invalid items are returned in `failed`.

```json
{ "success": true, "inserted": 2, "failed": [{ "index": 2, "error": "Invalid transaction" }] }
```

### POST `/api/transactions/parse`

Body: `{ "text": "bakso 25k, grab 15k" }` (maximum 2,000 characters).

Returns `{ "parsed": [{ "type": "expense", "item": "bakso", "amount": 25000, "category": "food", "date": "2026-11-15" }] }`.

- `422` when no valid transaction is detected.
- `502` when the AI provider fails.

### PUT `/api/transactions/:id`

Accepts any subset of `type`, `item`, `amount`, `category`, `createdAt`. Ownership and IDs cannot be changed.

### DELETE `/api/transactions/:id`

Deletes one owner-scoped transaction.

---

## Statistics

### GET `/api/stats`

Returns:

```json
{
  "kpi": {
    "todayExpense": 0,
    "thisMonthExpense": 0,
    "thisMonthIncome": 0,
    "totalTransactions": 0,
    "activeUsers": 1,
    "avgExpenseTransaction": 0
  },
  "dailyStats": [{ "date": "2026-11-15", "expense": 0, "income": 0 }],
  "categoryStats": [{ "category": "food", "amount": 0 }],
  "itemStats": [{ "item": "Nasi Padang", "amount": 25000, "date": "..." }]
}
```

`dailyStats` always covers 30 Jakarta days. `itemStats` contains the top 50 expenses by amount over the same window.

### GET `/api/calendar`

Query: `year` (2000-2100), `month` (1-12), `detail` (optional; `0` omits per-day item arrays for lighter mobile payloads).

```json
{
  "days": [{ "date": "2026-11-15", "total": 25000, "items": [] }],
  "stories": { "2026-11-15": [] },
  "monthTotal": 25000
}
```

---

## Food logs

### GET `/api/food/logs`

Query: `page` (default 1), `pageSize` (default 25, maximum 200).

Response: `{ "logs": [], "page": 1, "pageSize": 25, "total": 0, "totalPages": 0 }`.

### POST `/api/food/logs`

Body: `{ "foodName": "Nasi Padang", "category": "Makanan Berat" }`. Both fields are required.

---

## Stories

### GET `/api/stories`

Query: `page` (default 1), `pageSize` (default 24, maximum 200).

Response: `{ "stories": [], "page": 1, "pageSize": 24, "total": 0, "totalPages": 0 }`.

### POST `/api/stories`

Body:

```json
{
  "title": "Hari yang indah",
  "content": "Cerita asli...",
  "aiContent": "Versi rapi...",
  "mood": "😊",
  "createdAt": "2026-11-15T04:00:00.000Z"
}
```

`content` is required and limited to 20,000 characters. `mood` must be one of `""`, `😊`, `😌`, `😢`, `😴`, `🔥`, `🤯`.

### PUT `/api/stories/:id`

Accepts any subset of `title`, `content`, `aiContent`, `mood`, `createdAt`.

### DELETE `/api/stories/:id`

Deletes one owner-scoped story.

### POST `/api/stories/prettify`

Body: `{ "content": "..." }` (maximum 20,000 characters).

Returns `{ "success": true, "prettified": { "title": "...", "content": "...", "mood": "" } }`.

---

## IoT

### GET `/iot`

Requires `x-iot-token: <IOT_TOKEN>` or `?token=<IOT_TOKEN>`. Returns `503` when `IOT_TOKEN` is not configured.

```json
{
  "btc": "97,123",
  "idr": "15,800",
  "datetime": "15.11 09.45",
  "expenses": "125,000",
  "display": ["97,123", "15,800", "15.11 09.45", "125,000"]
}
```

Responses are cached for 30 seconds and limited to 120 requests per minute per IP.

---

## Health

### GET `/healthz`

Returns `{ "ok": true, "uptime": 123.45 }` when MongoDB responds, otherwise `503` with `{ "ok": false }`.
