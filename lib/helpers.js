function formatCurrency(value) {
    return new Intl.NumberFormat("id-ID").format(value);
}

function formatItems(arr) {
    if (!arr.length) return "-";
    return arr.map(x => `- ${x.item} (Rp${formatCurrency(x.amount)})`).join("\n");
}

function totalAmount(arr) {
    return arr.reduce((sum, x) => sum + x.amount, 0);
}

/**
 * Returns an object with Jakarta time components (needed for MQTT display).
 */
function getJakartaNow() {
    const now = new Date();
    const options = {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    };
    const parts = new Intl.DateTimeFormat("en-US", options).formatToParts(now);
    const map = {};
    parts.forEach(({ type, value }) => (map[type] = value));
    return map;
}

/**
 * Returns a UTC Date object representing the START of the current day in Jakarta timezone (WIB, UTC+7).
 * e.g., May 24 00:00 WIB = May 23 17:00 UTC
 */
function getStartOfJakartaDay() {
    const now = new Date();
    const jakartaStr = toJakartaDateStr(now); // YYYY-MM-DD in Jakarta
    return new Date(`${jakartaStr}T00:00:00+07:00`); // Midnight Jakarta as UTC Date
}

/**
 * Returns a UTC Date object representing the START of a day N days ago in Jakarta timezone.
 */
function getStartOfJakartaDayAgo(daysAgo = 0) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const jakartaStr = toJakartaDateStr(d);
    return new Date(`${jakartaStr}T00:00:00+07:00`);
}

/**
 * Formats a Date to DD/MM/YYYY in Jakarta timezone (for bot date references).
 */
function toJakartaDateRef(date) {
    const str = toJakartaDateStr(date); // YYYY-MM-DD
    const [y, m, d] = str.split('-');
    return `${d}/${m}/${y}`;
}

/**
 * Returns the old UTC start-of-day (kept for backward compat where truly UTC is needed).
 */
function getStartOfUTCDay() {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

/**
 * Parses DD/MM/YYYY string into a Jakarta midnight Date.
 */
function parseUTCDate(dateStr) {
    const parts = dateStr.split("/");
    if (parts.length !== 3) return null;
    const [day, month, year] = parts.map(Number);
    // Parse as Jakarta midnight (+07:00)
    const paddedMonth = String(month).padStart(2, '0');
    const paddedDay = String(day).padStart(2, '0');
    const date = new Date(`${year}-${paddedMonth}-${paddedDay}T00:00:00+07:00`);
    return isNaN(date.getTime()) ? null : date;
}

/**
 * Converts a Date object to a YYYY-MM-DD string in Jakarta timezone (WIB, UTC+7).
 * Used for consistent date grouping across the dashboard.
 */
function toJakartaDateStr(date) {
    const d = date instanceof Date ? date : new Date(date);
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(d);
    const map = {};
    parts.forEach(({ type, value }) => (map[type] = value));
    return `${map.year}-${map.month}-${map.day}`;
}

module.exports = { 
    formatCurrency, 
    formatItems, 
    totalAmount,
    getJakartaNow,
    getStartOfUTCDay,
    getStartOfJakartaDay,
    getStartOfJakartaDayAgo,
    parseUTCDate,
    toJakartaDateStr,
    toJakartaDateRef,
    // Keep backward-compatible aliases
    getStartOfUTCDayAgo: getStartOfJakartaDayAgo,
    parseJakartaDate: parseUTCDate
};
