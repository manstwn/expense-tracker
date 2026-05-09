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
 * Returns an object with Jakarta time components.
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
 * Returns a UTC Date object representing the START of the current day (00:00:00) in Jakarta.
 */
function getStartOfJakartaDay() {
    const now = new Date();
    const options = { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" };
    const formatter = new Intl.DateTimeFormat("en-CA", options); // en-CA gives YYYY-MM-DD
    const dateStr = formatter.format(now);
    return new Date(`${dateStr}T00:00:00+07:00`);
}

/**
 * Returns a UTC Date object representing the START of a day N days ago in Jakarta.
 */
function getStartOfJakartaDayAgo(daysAgo = 0) {
    const startOfToday = getStartOfJakartaDay();
    const target = new Date(startOfToday);
    target.setDate(target.getDate() - daysAgo);
    return target;
}

/**
 * Parses DD/MM/YYYY string into a Jakarta start-of-day Date.
 */
function parseJakartaDate(dateStr) {
    const parts = dateStr.split("/");
    if (parts.length !== 3) return null;
    const [day, month, year] = parts;
    const date = new Date(`${year}-${month}-${day}T00:00:00+07:00`);
    return isNaN(date.getTime()) ? null : date;
}

module.exports = { 
    formatCurrency, 
    formatItems, 
    totalAmount,
    getJakartaNow,
    getStartOfJakartaDay,
    getStartOfJakartaDayAgo,
    parseJakartaDate
};
