# Frontend Review

Scope: `public/index.html`, `public/pages/*.html`, `public/app.js`, `public/style.css`, `public/css/*.css`.

The UI is a single-page dashboard assembled from HTML partials, with Chart.js and Lucide loaded from CDNs. Most rendering uses `escapeHtml`, and the visual structure is consistent. The main problems are dead wiring left over from iterations, a few real data-loss bugs, and timezone inconsistencies.

---

## UI-01 — The user filter is broken because its DOM element no longer exists

**Severity:** High
**Location:** `public/app.js:88`, `public/app.js:1137-1150`, `public/pages/transactions.html`

`initElementsCache` does:

```js
el.txFilterUser = document.getElementById("tx-filter-user");
```

and `fetchUsers` does:

```js
el.txFilterUser.innerHTML = `<option value="">All Users</option>`;
```

But `public/pages/transactions.html` only contains `#tx-search-input`, `#tx-filter-date`, and `#tx-limit-select`. There is no `#tx-filter-user` element. `el.txFilterUser` is therefore `null`, and `fetchUsers()` throws on the first assignment. The error is caught by its own `catch`, so the app continues, but:

- `/api/users` is called and discarded on every dashboard load.
- `state.users` is never populated.
- There is no way to filter transactions by user.

**Fix**

Either restore the select or remove the dead code. If the multi-user filter is still wanted:

```html
<!-- public/pages/transactions.html -->
<div class="select-wrapper">
    <i data-lucide="users" class="select-icon"></i>
    <select id="tx-filter-user">
        <option value="">All Users</option>
    </select>
</div>
```

```js
async function fetchUsers() {
    if (!el.txFilterUser) return;
    try {
        const users = await apiCall("/api/users");
        state.users = users;
        el.txFilterUser.innerHTML = `<option value="">All Users</option>`;
        users.forEach((u) => {
            const label = u.username ? `@${u.username}` : `User (ID: ${u.userId})`;
            el.txFilterUser.insertAdjacentHTML(
                "beforeend",
                `<option value="${escapeHtml(String(u.userId))}">${escapeHtml(label)}</option>`
            );
        });
    } catch (err) {
        console.error("Failed to populate users dropdown:", err);
    }
}
```

If the app is intentionally single-owner, delete `fetchUsers`, the `state.users` field, and the server route instead of leaving a call that always fails.

---

## UI-02 — Pagination is dead code; "Show 10" is always the first 10 rows

**Severity:** Medium
**Location:** `public/app.js:93-94`, `public/app.js:1187-1202`, `public/app.js:1406-1431`, `public/pages/transactions.html`

Problems:

- `initPagination()` is defined but never called.
- `#pagination-prev` and `#pagination-next` do not exist in `transactions.html`.
- `updatePaginationControls()` is never called.
- `state.filters.skip` is initialized and reset but never used to slice data.
- `applyFiltersAndRender` always does `filtered.slice(0, limit)`, so the table shows the first N rows after filtering; there is no page 2.
- The footer says `Showing X of Y transactions`, which is accurate as a count but implies paginated browsing that does not exist.

If `initPagination` were ever called, `el.paginationPrev.addEventListener` would throw because the element is null.

**Fix**

Choose one behavior and make the UI match it.

Option A, real client-side pagination:

```js
function applyFiltersAndRender() {
    // ...build `filtered` and sort it...
    const limit = state.filters.limit || 10;
    const start = (state.filters.page - 1) * limit;
    state.transactions = filtered.slice(start, start + limit);
    state.filteredTotal = filtered.length;
    renderAllTransactionsTable();
    updatePaginationControls();
}
```

Add the two buttons back to `transactions.html` and call `initPagination()` during startup. Option B, remove the pagination state, buttons, and `initPagination`/`updatePaginationControls`, and relabel the control to "Show top N".

Server-side pagination is preferable for large histories; see API-04 and PERF-01.

---

## UI-03 — Editing an AI-created transaction silently erases its category

**Severity:** High
**Location:** `public/app.js:1497-1520` (`openEditModal`), `public/pages/modals.html` (`#form-category`)

The category field is a `<select>` with a fixed list:

```html
<option value="food">Food & Drinks</option>
<option value="transport">Transport</option>
...
<option value="manual">Manual / Others</option>
```

`openEditModal` does:

```js
el.formCategory.value = tx.category || "manual";
```

If the transaction came from Quick AI Parse, its category is often Indonesian and not in the list, for example `Makanan Berat`, `Minuman`, `Camilan`, or `Buah`. Assigning an unknown value to a `<select>` sets it to `""`. On save, the form submits `category: ""`, and the API stores the empty string, overwriting the original category. The same class of bug applies if `type` is not `expense`/`income`.

**Fix**

Add the missing option dynamically before setting the value, and do the same for `type` if arbitrary values are allowed.

```js
function setSelectValue(select, value, fallback) {
    const next = value || fallback;
    if (!next) return;
    const exists = Array.from(select.options).some((option) => option.value === next);
    if (!exists) {
        select.add(new Option(capitalize(next), next));
    }
    select.value = next;
}

// openEditModal
setSelectValue(el.formCategory, tx.category, "manual");
setSelectValue(el.formType, tx.type, "expense");
```

Longer term, make the category a datalist/combobox backed by categories observed in the data, or normalize AI output to the fixed category set in `lib/ai.js`.

---

## UI-04 — `escapeHtml` throws on `null` / `undefined`, breaking table rendering

**Severity:** Medium
**Location:** `public/app.js:1721-1729`, `public/app.js:801-813` (`renderFoodLogsTable`), `public/app.js:1250-1268`, `public/app.js:1624-1633`

```js
function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         // ...
}
```

There is no null guard and no string coercion. Any optional field that is missing causes `TypeError: Cannot read properties of undefined (reading 'replace')`. Concrete paths:

- `escapeHtml(log.foodName)` / `escapeHtml(log.category)` after a food log is created with `{}` (allowed by API-02).
- `escapeHtml(t.item)` for legacy or AI-created transactions with a missing item.
- `escapeHtml(item.item)` in the AI preview when the model omits a name.

When this throws inside a render loop, the rest of the table is not rendered and the page looks empty.

**Fix**

```js
function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
        switch (char) {
            case "&": return "&amp;";
            case "<": return "&lt;";
            case ">": return "&gt;";
            case '"': return "&quot;";
            default: return "&#039;";
        }
    });
}
```

Also fix the write path (API-02, API-06) so malformed documents are rejected instead of relying on the renderer to survive them.

---

## UI-05 — Date filtering and the calendar use the browser timezone while the rest of the app uses Jakarta

**Severity:** Medium
**Location:** `public/app.js:1189-1202` (date filter), `public/app.js:2050-2060` (calendar month), `public/app.js:1960-1994` (story date formatting), `public/app.js:203-205` (calendar state)

The server stores UTC instants and the app consistently displays Jakarta time in tables via `toJakartaDateStrClient` and `formatTableDate`. Two places break that rule:

1. The transactions date filter builds the date key from the browser's local time:

```js
const d = new Date(t.createdAt);
const year = d.getFullYear();
const month = String(d.getMonth() + 1).padStart(2, "0");
const day = String(d.getDate()).padStart(2, "0");
```

For a user in UTC-5, a transaction at 01:00 WIB on the 15th is 13:00 local on the 14th, so filtering by the 15th excludes it even though the table shows it under the 15th.

2. The calendar derives its year/month from `state.calendarDate.getFullYear()` / `getMonth()`, which are browser-local, while transaction grouping uses Jakarta dates. Around month boundaries the calendar can show the wrong month for non-WIB users.

Story cards use `formatLocalIndonesianDate` (browser timezone), while the calendar groups stories by Jakarta date, so a story can appear on a different day in the two views.

**Fix**

Pick one policy. For a Jakarta-centric finance app, use Jakarta everywhere for transactions:

```js
if (state.filters.date) {
    filtered = filtered.filter((t) => {
        if (!t.createdAt) return false;
        return toJakartaDateStrClient(new Date(t.createdAt)) === state.filters.date;
    });
}
```

For the calendar month, derive the Jakarta year/month explicitly:

```js
function getJakartaYearMonth(date = new Date()) {
    const [year, month] = toJakartaDateStrClient(date).split("-").map(Number);
    return { year, month: month - 1 };
}
```

Then advance using the first day of the month (see UI-06). If stories are intentionally displayed in the viewer's timezone, document that decision and avoid using them in the Jakarta-grouped calendar, or add a timezone toggle.

---

## UI-06 — Month navigation can skip a month

**Severity:** Medium
**Location:** `public/app.js:2029-2040`

```js
state.calendarDate.setMonth(state.calendarDate.getMonth() - 1);
```

If the current date is 31 March, `setMonth(1)` produces 31 February, which rolls over to 3 March. Pressing "previous" once can appear to do nothing or skip a month, depending on the day of the month.

**Fix**

Normalize to the first of the month before adding or subtracting.

```js
function shiftCalendarMonth(delta) {
    const { year, month } = getJakartaYearMonth(state.calendarDate);
    state.calendarDate = new Date(year, month + delta, 1);
    renderExpenseCalendar();
}
```

---

## UI-07 — "By Item / Top N" shows the N most recent items, not the N largest

**Severity:** Medium
**Location:** `public/app.js:847-865`, `lib/server.js:284-293`

The server builds `itemStats` already sorted by date descending:

```js
const itemStats = recentData
    .filter(t => t.type === "expense" && t.createdAt)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    ...
```

The client then does:

```js
displayData = displayData.slice(0, state.chartMaxItems);
displayData.reverse();
```

So selecting "Top 10" actually shows the 10 most recent expenses, while the selector and chart heading imply the 10 largest. The `reverse()` makes the oldest of those 10 appear on the left, which is correct for a time series but misleading for a ranking.

**Fix**

Sort by amount before slicing. Preferably do it on the server and return only the top N.

```js
if (state.chartMode === "item") {
    displayData = [...chartData]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, state.chartMaxItems)
        .reverse();
}
```

If the intent really is "recent items", rename the control to "Latest N" and remove the "Top" wording.

---

## UI-08 — "Avg Tx Value" is computed from the current page, or from mismatched windows

**Severity:** Medium
**Location:** `public/app.js:1008-1015`

```js
const expensesList = state.transactions.filter(t => t.type === "expense");
const avgTxVal = expensesList.length
    ? (expensesList.reduce((sum, t) => sum + t.amount, 0) / expensesList.length)
    : (totalExpense / (state.stats?.kpi.totalTransactions || 1));
```

`state.transactions` is only the current filtered slice on the transactions tab. It is empty on first load and changes when the user changes "Show 10" or a filter. The fallback divides a 30-day expense total (`totalExpense` comes from `categoryStats`) by an all-time transaction count (`kpi.totalTransactions`). The KPI therefore changes when the page size changes and is not comparable across tabs.

**Fix**

Compute the metric from a stable dataset. Either have the server return `avgExpenseTransaction` in `/api/stats`, or use all transactions within the same 30-day window:

```js
const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
const expenses = (state.allTransactions || []).filter(
    (t) => t.type === "expense" && new Date(t.createdAt).getTime() >= cutoff
);
const avgTxVal = expenses.length
    ? expenses.reduce((sum, t) => sum + t.amount, 0) / expenses.length
    : 0;
```

The server-side version is better because the client will not always have all history once pagination is added.

---

## UI-09 — `apiCall` assumes every response is JSON and has no timeout

**Severity:** Medium
**Location:** `public/app.js:434-460`, `lib/server.js` (default Express error pages)

```js
const response = await fetch(endpoint, config);
if (response.status === 401) {
    logout();
    throw new Error("Unauthorized");
}
const data = await response.json();
```

If the server returns an HTML 404/413/500 page, or the tunnel returns a Cloudflare error page, `response.json()` throws a `SyntaxError`, hiding the real status. There is no `AbortController`, so a stalled request can leave the UI in a loading state indefinitely. On 401, `logout()` shows a toast, and the caller usually shows another toast, producing duplicates.

**Fix**

```js
async function apiCall(endpoint, method = "GET", body = null) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const headers = { "Content-Type": "application/json" };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;

    try {
        const response = await fetch(endpoint, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal
        });

        const contentType = response.headers.get("content-type") || "";
        const data = contentType.includes("application/json")
            ? await response.json()
            : { error: await response.text() };

        if (response.status === 401) {
            logout(true);
            throw new Error("Session expired");
        }
        if (!response.ok) {
            throw new Error(data.error || `Request failed (${response.status})`);
        }
        return data;
    } finally {
        clearTimeout(timeout);
    }
}
```

Pass a flag to `logout` so it does not show a success toast when the session expired.

---

## UI-10 — A failed partial fetch leaves the app permanently stuck on the login screen

**Severity:** Medium
**Location:** `public/app.js:37-61` (`loadDedicatedPages`), `public/app.js:196-227` (startup), `public/app.js:232-244`, `public/app.js:1390-1400`, `public/app.js:1557-1570`

`loadDedicatedPages` swallows fetch failures:

```js
try {
    const res = await fetch(item.file);
    if (res.ok) container.innerHTML = await res.text();
} catch (err) {
    console.error(`Failed to load ${item.file}:`, err);
}
```

Initialization then assumes every element exists:

- `initKeypad()` calls `document.getElementById("key-clear").addEventListener(...)`.
- `initStoryModal()` calls `storyForm.addEventListener(...)`.
- `initAIParser()` calls `el.aiParseBtn.addEventListener(...)`.

A single failed partial raises a `TypeError`, aborting the rest of the `DOMContentLoaded` handler before the auto-login check runs. The login screen stays visible but the keypad handlers may already be attached or not, depending on where it failed, and the user cannot recover without a reload.

**Fix**

- Track load failures and show an explicit error state instead of continuing.
- Guard optional sections before binding, or return a rejected promise and surface it.
- Split initialization so one missing feature does not block login.

```js
const results = await Promise.allSettled(pageMap.map(async (item) => {
    const container = document.getElementById(item.id);
    if (!container) return;
    const res = await fetch(item.file);
    if (!res.ok) throw new Error(`${item.file}: HTTP ${res.status}`);
    container.innerHTML = await res.text();
}));

const failed = results.filter((r) => r.status === "rejected");
if (failed.length > 0) {
    console.error("Some dashboard sections failed to load", failed);
    showToast("Some sections failed to load. Reload the page.", "error");
}
```

```js
function initKeypad() {
    const clearButton = document.getElementById("key-clear");
    const backspaceButton = document.getElementById("key-backspace");
    if (!clearButton || !backspaceButton) return;
    // ...
}
```

The auto-login check should run regardless of section failures.

---

## UI-11 — Food log timestamps never show the time

**Severity:** Medium
**Location:** `public/app.js:797-804`

```js
const dateStr = d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
});
```

`Date.prototype.toLocaleDateString` only applies date options; `hour` and `minute` are ignored. The Food Tracker table therefore shows a date with no time, even though the request clearly intends to display both. It also bypasses the Jakarta formatting used elsewhere and shows the browser's local date.

**Fix**

```js
const dateStr = d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
});
```

---

## UI-12 — Day-group colors are never defined in CSS

**Severity:** Low
**Location:** `public/app.js:32`, `public/app.js:1254-1262`, `public/app.js:1272-1290`, `public/app.js:1736-1756`

Two different class schemes are applied to table rows:

```js
const DAY_COLOR_CLASSES = ["day-group-purple", "day-group-pink", "day-group-cyan", "day-group-amber"];
```

```js
let dayGroupClass = "day-group-1";
// toggles between day-group-1 and day-group-2
```

A search across `public/style.css` and `public/css/*.css` finds no `day-group` rules. The classes do nothing. The recent/top tables use one scheme; the full transactions table uses another.

**Fix**

Define one scheme once and use it everywhere.

```css
/* public/css/transactions.css */
.day-group-purple { box-shadow: inset 3px 0 0 #8b5cf6; }
.day-group-pink   { box-shadow: inset 3px 0 0 #ec4899; }
.day-group-cyan   { box-shadow: inset 3px 0 0 #3b82f6; }
.day-group-amber  { box-shadow: inset 3px 0 0 #f59e0b; }
```

Then replace `day-group-1` / `day-group-2` in `renderAllTransactionsTable` with the same `DAY_COLOR_CLASSES` cycling index. If the coloring is no longer wanted, remove the constants and class assignments.

---

## UI-13 — Story navigation, toast timing, and relative dates need polish

**Severity:** Low
**Location:** `public/app.js:330-350` (card click), `public/app.js:491-507` (`openStoryView`), `public/app.js:1708-1716` (`showToast`), `public/app.js:1908-1922` (`getRelativeTimeString`)

- Opening a story from the Stories grid calls `openStoryView(story)` without a queue. `storyViewQueue` becomes `[story]`, so the previous/next buttons are hidden even though `state.allStories` contains other entries. Only the calendar passes a queue.
- `showToast` starts a new `setTimeout` on every call without clearing the previous one. A long message followed quickly by a short one can have the first timer hide the second toast early.
- `getRelativeTimeString` does no validity check. An invalid `createdAt` yields `NaN` and the UI renders `NaN days ago`.

**Fix**

```js
// Grid card
card.addEventListener("click", (e) => {
    if (e.target.closest(".action-btn")) return;
    openStoryView(story, state.allStories);
});
```

```js
let toastTimer = null;

function showToast(message, type = "success") {
    clearTimeout(toastTimer);
    // ...
    toastTimer = setTimeout(() => el.toast.classList.remove("show"), 3000);
}
```

```js
function getRelativeTimeString(date) {
    const timestamp = new Date(date).getTime();
    if (Number.isNaN(timestamp)) return "";
    // ...
}
```

While here, the overview switches to English strings ("Today's Transactions", "Today", "Selected Day") while the HTML and calendar use Indonesian ("Transaksi Hari Ini", "Hari Ini"). Pick one language per surface.

---

## UI-14 — Redundant refetches and race conditions

**Severity:** Medium
**Location:** `public/app.js:647-680` (`loadDashboardData`, `switchTab`), `public/app.js:1133-1145`, `public/app.js:1153-1175`, `public/app.js:983-1040`

One dashboard load triggers:

```js
fetchStats();
fetchUsers();
await Promise.all([fetchTransactions(), loadStoriesData()]);
```

Switching to Overview triggers `fetchStats()` and `loadStoriesData()` again. Switching to Transactions or Insights triggers `fetchStats()` or `fetchTransactions()` again. Nothing is cached, and there is no request versioning or abort. If a slow response resolves after a newer one, it overwrites fresher state. Chart objects are destroyed and recreated on every stats response, which also resets hover/zoom state.

**Fix**

- Cache each dataset with a short TTL (for example 30 seconds) and invalidate it after writes.
- Use `AbortController` per request or a monotonically increasing request ID; ignore stale responses.
- Fetch only what the active tab needs.
- Do not recreate the chart if the data has not changed.

```js
let statsFetchedAt = 0;

async function fetchStats(force = false) {
    if (!force && Date.now() - statsFetchedAt < 30000) return;
    const data = await apiCall("/api/stats");
    statsFetchedAt = Date.now();
    // ...
}
```

---

## UI-15 — Derived views go stale after deletes, and "recent" has two different lengths

**Severity:** Low
**Location:** `public/app.js:1318-1330` (`deleteTransaction`), `public/app.js:531-540` (`deleteStory`), `public/app.js:760`, `public/app.js:1166`

- Deleting a transaction calls `fetchTransactions()` only. The KPIs, top expenses, current-day panel, and calendar keep showing the deleted row until the user switches tabs or reloads.
- Deleting a story calls `fetchStories()` only; the calendar's story indicators stay stale.
- `fetchTransactions` renders 20 recent rows on the overview path, but `switchTab("overview")` renders `state.allTransactions.slice(0, 10)`. The "Recent Transactions" table changes size depending on how the user got there.

**Fix**

After a successful delete, update local state and re-render all derived views, or call `loadDashboardData()` once. Use a single constant for the recent-list size.

```js
const RECENT_LIMIT = 20;

async function deleteTransaction(id) {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    await apiCall(`/api/transactions/${id}`, "DELETE");
    state.allTransactions = state.allTransactions.filter((t) => t._id !== id);
    await loadDashboardData();
    showToast("Transaction deleted successfully", "success");
}
```

---

## UI-16 — Unused state, unused DOM references, and dead helpers

**Severity:** Low
**Location:** `public/app.js:16-34`, `public/app.js:186-190`, `public/app.js:1422-1430`, `public/app.js:1557`, `public/app.js:2110-2120`

After the pagination and user-filter work stalled, several pieces are orphaned:

- `state.users` is written but never read.
- `state.filters.skip` is reset but never used for slicing.
- `el.paginationPrev`, `el.paginationNext`, `updatePaginationControls`, and `initPagination` are dead.
- `el.storyViewAiPane` is cached but never used.
- `state.totalTransactions` is used only by the dead pagination helpers.
- `formatJakartaIndonesianDate` and `toJakartaDateStrClient` overlap; the latter is the clearer name for the date-key use case.

**Fix**

Delete the dead code rather than leaving it for a future feature. If pagination is implemented (UI-02), keep the fields and wire them; otherwise remove the references so null checks and dead branches do not accumulate.

---

## UI-17 — Accessibility gaps in interactive controls

**Severity:** Low
**Location:** `public/pages/login.html`, `public/pages/modals.html`, `public/pages/stories.html`, `public/app.js` (modals)

- Icon-only buttons (modal close, table edit/delete, keypad clear/backspace) rely on `title` or nothing; screen readers get no accessible name. Add `aria-label`.
- Modals do not close on `Escape`, do not trap focus, and do not restore focus to the trigger.
- The toast has no `role="status"` / `aria-live`, so success and error messages are silent to assistive technology.
- Mood buttons are emoji-only; add an accessible label per mood.
- Error states (for example the login error) are visual only; add `role="alert"`.
- Color is used as the only signal for expense/income in some places; add a text label or icon.

**Fix**

Start with the highest-value items: `aria-label` on icon buttons, `role="status"` on the toast, and `Escape` handling plus focus restoration for modals.

```html
<button class="modal-close" id="modal-close-btn" aria-label="Close dialog">
    <i data-lucide="x"></i>
</button>
```

```html
<div id="toast" class="toast glass" role="status" aria-live="polite">
```

```js
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && el.modal.classList.contains("active")) {
        closeModal();
    }
});
```

---

## Cross-references

- Stored XSS through `type`: SEC-06.
- Validation that would prevent the malformed documents referenced above: API-01, API-02, API-06.
- Server-side pagination and filtering: API-04, PERF-01.
- CDN pinning and CSP: SEC-08.
- Env/owner values hardcoded in the client: API-14.
