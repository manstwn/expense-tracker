const JAKARTA_TIME_ZONE = "Asia/Jakarta";

function formatCurrency(value) {
    return new Intl.NumberFormat("id-ID").format(value);
}

function totalAmount(items) {
    return items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function getJakartaNow(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: JAKARTA_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
    }).formatToParts(date);

    const map = {};
    for (const part of parts) {
        map[part.type] = part.value;
    }
    return map;
}

function toJakartaDateStr(date) {
    const value = date instanceof Date ? date : new Date(date);
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: JAKARTA_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(value);

    const map = {};
    for (const part of parts) {
        map[part.type] = part.value;
    }
    return `${map.year}-${map.month}-${map.day}`;
}

function getStartOfJakartaDay(date = new Date()) {
    return new Date(`${toJakartaDateStr(date)}T00:00:00+07:00`);
}

function getStartOfJakartaDayAgo(daysAgo = 0) {
    const shifted = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    return getStartOfJakartaDay(shifted);
}

function getJakartaYearMonth(date = new Date()) {
    const dateStr = toJakartaDateStr(date);
    return {
        year: Number(dateStr.slice(0, 4)),
        month: Number(dateStr.slice(5, 7))
    };
}

function getStartOfJakartaMonth(date = new Date()) {
    const { year, month } = getJakartaYearMonth(date);
    return new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+07:00`);
}

function getStartOfNextJakartaMonth(date = new Date()) {
    const { year, month } = getJakartaYearMonth(date);
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    return new Date(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+07:00`);
}

function parseJakartaDate(value) {
    if (typeof value !== "string") return null;
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
    if (!match) return null;

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);

    const check = new Date(Date.UTC(year, month - 1, day));
    if (
        check.getUTCFullYear() !== year ||
        check.getUTCMonth() !== month - 1 ||
        check.getUTCDate() !== day
    ) {
        return null;
    }

    return new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+07:00`);
}

module.exports = {
    JAKARTA_TIME_ZONE,
    formatCurrency,
    totalAmount,
    getJakartaNow,
    toJakartaDateStr,
    getStartOfJakartaDay,
    getStartOfJakartaDayAgo,
    getJakartaYearMonth,
    getStartOfJakartaMonth,
    getStartOfNextJakartaMonth,
    parseJakartaDate
};
