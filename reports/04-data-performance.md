# Data and Performance Review

Scope: Mongo schema/indexes in `lib/database.js`, query patterns in `lib/server.js`, and client-side data handling in `public/app.js`.

The dataset is small today, so most of these issues are not visible yet. They become user-facing as soon as the history reaches a few thousand transactions or stories: slow first load, large JSON payloads, mobile memory pressure, and chart re-renders.

---

## PERF-01 — The client downloads the entire history and filters/sorts it in the browser

**Severity:** Medium
**Location:** `public/app.js:1153-1175` (`fetchTransactions`), `public/app.js:1177-1225` (`applyFiltersAndRender`), `lib/server.js:158-210` (`GET /api/transactions`)

`fetchTransactions` calls `/api/transactions` with no parameters and stores the full response:

```js
const data = await apiCall(`/api/transactions`);
state.allTransactions = data.transactions;
```

Search, user filter, date filter, sorting, and "Show N" all run over that array in the browser. The same pattern exists for stories and food logs.

Consequences:

- Every dashboard load transfers the entire transaction history, even if the user only looks at today.
- A few thousand transactions can exceed 1 MB of JSON; several years can reach tens of MB.
- The browser keeps a second copy in memory while sorting (`[...state.allTransactions]`) and creates DOM for hundreds of rows.
- Any new client (mobile, slow connection) pays the full cost.
- Results are only as fresh as the last full dump; there is no incremental fetch.

**Fix**

Push filtering, sorting, and paging to Mongo and return one page at a time. The dashboard summary can use a separate small aggregate endpoint.

```js
// GET /api/transactions?page=1&pageSize=25&search=...&from=...&to=...&sort=createdAt:desc
const query = {};
if (search) query.$or = [
    { item: { $regex: escapeRegex(search), $options: "i" } },
    { category: { $regex: escapeRegex(search), $options: "i" } }
];
if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = from;
    if (to) query.createdAt.$lte = to;
}

const sort = { [sortField]: sortDir };
const [items, total] = await Promise.all([
    transactions.find(query).sort(sort).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    transactions.countDocuments(query)
]);
```

Always escape user input before building a `$regex`, or use a text index. The current client-side search does substring matching on two fields; a compound text index is an alternative.

---

## PERF-02 — Stats reads overlapping data three times and ships every item row

**Severity:** Medium
**Location:** `lib/server.js:214-307`

For a single `/api/stats` request, the server performs:

1. `recentData`: all transactions in the last 30 days.
2. `todayData`: all transactions since midnight.
3. `thisMonthData`: all transactions since the first of the month.
4. `countDocuments()`: all-time count.
5. `distinct("userId")`: all-time distinct users.

The first result already contains the second and third. The server also builds `itemStats` from every expense in `recentData` and sends the full list, even though the UI only displays the top 10-20.

The dashboard calls this endpoint on login, on Overview, on Insights, and after some writes.

**Fix**

- Use one aggregation with `$facet` (see API-03) and let Mongo compute totals, daily buckets, categories, and top items.
- Add `$limit` to `topItems` (for example 50) and let the UI select 5/10/15/20 from that list.
- Cache the response for a short period or invalidate on write, since the dashboard is read-heavy.
- If the collection grows large, maintain a daily summary collection updated on write, and read that for charts.

Approximate shape:

```js
const [result] = await transactions.aggregate([
    { $facet: {
        today: [{ $match: { createdAt: { $gte: startOfToday, $lt: startOfTomorrow } } }, { $group: { _id: "$type", total: { $sum: "$amount" } } }],
        month: [{ $match: { createdAt: { $gte: firstOfMonth, $lt: firstOfNextMonth } } }, { $group: { _id: "$type", total: { $sum: "$amount" } } }],
        daily: [{ $match: { createdAt: { $gte: thirtyDaysAgo } } }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Jakarta" } }, expense: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] } }, income: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] } } } }],
        categories: [{ $match: { createdAt: { $gte: thirtyDaysAgo }, type: "expense" } }, { $group: { _id: "$category", amount: { $sum: "$amount" } } }, { $sort: { amount: -1 } }],
        topItems: [{ $match: { createdAt: { $gte: thirtyDaysAgo }, type: "expense" } }, { $sort: { amount: -1 } }, { $limit: 50 }, { $project: { _id: 0, item: 1, amount: 1, date: "$createdAt" } }]
    } }
]).toArray();
```

---

## PERF-03 — Indexes do not match the queries being run

**Severity:** Medium
**Location:** `lib/database.js:17-28`

Only single-field indexes exist:

```js
await transactions.createIndex({ userId: 1 });
await transactions.createIndex({ createdAt: 1 });
await foodLogs.createIndex({ userId: 1 });
await foodLogs.createIndex({ createdAt: 1 });
await stories.createIndex({ userId: 1 });
await stories.createIndex({ createdAt: 1 });
```

Real queries use combinations:

- `/iot` and owner-scoped stats: `{ userId, createdAt: { $gte } }`.
- Lists: `{ createdAt: -1 }` with a limit; a descending index serves the sort.
- Top expenses: `{ type, amount: -1 }`.
- Category breakdown: `{ createdAt: { $gte }, type }`, then grouping by category.

With single-field indexes, Mongo may choose one index and filter the rest in memory, or perform a collection scan for the sort.

**Fix**

Add compound indexes that match the access patterns, and drop redundant single-field indexes where the compound prefix covers them.

```js
await transactions.createIndex({ userId: 1, createdAt: -1 });
await transactions.createIndex({ type: 1, amount: -1 });
await transactions.createIndex({ createdAt: -1 });
await foodLogs.createIndex({ userId: 1, createdAt: -1 });
await stories.createIndex({ userId: 1, createdAt: -1 });
```

Notes:

- `{ userId: 1, createdAt: -1 }` also serves queries on `userId` alone, so the separate `{ userId: 1 }` index is redundant.
- `{ createdAt: -1 }` and `{ createdAt: 1 }` are equivalent for equality/range use; choose one direction that matches the default sort. Mongo can traverse an index backwards.
- Confirm with `explain("executionStats")` before and after; do not add indexes speculatively.
- Index creation on an existing production collection should be planned; it adds write cost and build time.

---

## PERF-04 — History endpoints and views grow without bound

**Severity:** Medium
**Location:** `lib/server.js:436-450`, `lib/server.js:471-501`, `public/app.js:302-350` (`renderStoriesList`), `public/app.js:2040-2090` (`renderExpenseCalendar`)

- `GET /api/food/logs` always returns every log.
- `GET /api/stories` returns every story by default.
- The Stories page renders every story card into the DOM.
- The calendar scans every transaction and every story to build a month map, on each render. It runs on login, on Overview, and on calendar navigation.

Even with pagination on transactions, these two lists will eventually cause slow page loads and a long DOM.

**Fix**

- Add `page`/`pageSize` to food logs and stories.
- Default the Stories page to the latest 20-50 entries with a "Load more" control.
- For the calendar, ask the server for a single month's aggregate instead of scanning all history:

```js
// GET /api/calendar?year=2026&month=11
// returns [{ date: "2026-11-01", total: 120000, items: [...] }, ...]
```

- If the calendar needs item details, return them only for the visible month, capped per day.
- Consider a TTL/archive policy for food logs and old stories if they are no longer needed; at minimum document retention and back up.

---

## PERF-05 — Quick AI save performs one request per item, sequentially

**Severity:** Low
**Location:** `public/app.js:1648-1682` (`saveAIQuickParseItems`)

```js
for (const item of state.tempParsedItems) {
    try {
        await apiCall("/api/transactions", "POST", { ... });
        successCount++;
    } catch (err) {
        console.error("Failed to quick save item:", item);
    }
}
```

For ten parsed items this is ten sequential round trips. The toast always says "Saved N transactions successfully" even when `successCount` is 0, and the user has no list of which items failed.

**Fix**

- Add `POST /api/transactions/bulk` that validates all items and uses `insertMany` with `ordered: false`.
- Return `{ inserted, failed: [{ index, reason }] }`.
- On the client, report partial failures and keep failed items in the preview for retry.

```js
const result = await apiCall("/api/transactions/bulk", "POST", { transactions: items });
showToast(`Saved ${result.inserted} of ${items.length} transactions`, result.failed.length ? "error" : "success");
```

If a bulk endpoint is not desired, at least use `Promise.allSettled` and a correct toast.

---

## PERF-06 — No compression or cache headers

**Severity:** Low
**Location:** `lib/server.js:638-650`, `public/index.html:16`, `public/index.html:112`

- No `compression` middleware. JSON responses and `app.js` are sent uncompressed by the Node process. Cloudflare may compress in production, but local and direct deployments do not.
- Static files are served with Express defaults (ETag/Last-Modified, but no long-lived `Cache-Control`).
- The `?v=2.1.0` cache-busting query is used for `app.js` and `style.css`, but the imported CSS files (`css/*.css`) have no version, so updating them can serve stale styles.
- `/iot` has no `Cache-Control`, even though its data changes slowly.

**Fix**

```js
const compression = require("compression");
app.use(compression());
```

```js
app.use(express.static(path.join(__dirname, "../public"), {
    maxAge: "1h",
    setHeaders(res, filePath) {
        if (/(app\.js|style\.css)$/.test(filePath)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
    }
}));
```

```js
function handleIotRequest(req, res) {
    res.setHeader("Cache-Control", "public, max-age=30");
    // ...
}
```

Use a build hash or a single version variable for all assets, including the imported CSS files.

---

## PERF-07 — Client rendering re-creates DOM and charts on every update

**Severity:** Low
**Location:** `public/app.js:1250-1315` (`renderRecentTransactionsMiniTable`, `renderAllTransactionsTable`), `public/app.js:1888-1900` (`renderCurrentDayTable`), `public/app.js:838-950` (`renderTrendChart`), `public/app.js:2040-2090` (`renderExpenseCalendar`)

- Tables build HTML strings in a loop and assign them one row at a time; a `DocumentFragment` or a single `innerHTML` assignment would reduce layout work.
- The trend chart is destroyed and recreated on every stats fetch, even if the data is identical. Hover state and animations reset.
- The calendar rebuilds all 35-42 cells and re-runs the story marquee setup on every navigation.
- Search input triggers a full filter/sort/render after a 400 ms debounce. That is acceptable for the current data size but will jank when pagination is removed and all history is loaded.

**Fix**

- Cache the last rendered data hash and skip chart recreation when unchanged.
- Build rows into a `DocumentFragment`, then append once.
- Render only the active tab; do not re-render hidden sections.
- When server-side pagination lands, most of this pressure disappears. Add virtualization only if a single page still needs hundreds of rows.

---

## Data model notes

These are not bugs today, but they constrain future work:

- `transactions`, `food_logs`, and `stories` share no common `users` collection. Usernames live denormalized on each document, so renaming a user requires a bulk update and historical records can disagree.
- `category` is a free-form string. Charts group by exact string, so `Food`, `food`, and `Makanan` are separate categories. Normalize at write time or store a `categoryId`.
- `type` is a free-form string today. It should be an enum at the database boundary as well as the API boundary.
- There is no schema validation (Mongo JSON Schema or application-level). Old documents with string amounts or missing fields can break aggregation and rendering.
- Backups and retention are not documented. For a finance app, define a backup schedule and test restores.
