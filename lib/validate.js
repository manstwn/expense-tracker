const TYPES = new Set(["expense", "income"]);

function parseRequiredString(value, maxLength) {
    if (typeof value !== "string") return null;
    const text = value.trim();
    if (!text || text.length > maxLength) return null;
    return text;
}

function parseOptionalString(value, maxLength) {
    if (value === undefined || value === null || value === "") return "";
    if (typeof value !== "string") return null;
    const text = value.trim();
    if (text.length > maxLength) return null;
    return text;
}

function parseMoney(value) {
    if (value === undefined || value === null || value === "") return null;
    const amount = typeof value === "number" ? value : Number(String(value).trim());
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return Math.round(amount);
}

function parseDate(value, fallback = new Date()) {
    if (value === undefined || value === null || value === "") return fallback;

    const text = String(value);
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (dateOnly) {
        const range = parseDayRange(text);
        return range ? range.$gte : null;
    }

    const withTime = /^(\d{4})-(\d{2})-(\d{2})[T ]/.exec(text);
    if (withTime) {
        const year = Number(withTime[1]);
        const month = Number(withTime[2]);
        const day = Number(withTime[3]);
        const check = new Date(Date.UTC(year, month - 1, day));
        if (
            check.getUTCFullYear() !== year ||
            check.getUTCMonth() !== month - 1 ||
            check.getUTCDate() !== day
        ) {
            return null;
        }
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function parseDayRange(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

    const [year, month, day] = value.split("-").map(Number);
    const check = new Date(Date.UTC(year, month - 1, day));
    if (
        check.getUTCFullYear() !== year ||
        check.getUTCMonth() !== month - 1 ||
        check.getUTCDate() !== day
    ) {
        return null;
    }

    const start = new Date(`${value}T00:00:00+07:00`);
    return { $gte: start, $lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

function parseIntInRange(value, fallback, min, max) {
    if (value === undefined || value === null || value === "") return fallback;
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max) return null;
    return number;
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isType(value) {
    return TYPES.has(value);
}

module.exports = {
    TYPES,
    isType,
    parseRequiredString,
    parseOptionalString,
    parseMoney,
    parseDate,
    parseDayRange,
    parseIntInRange,
    escapeRegex
};
