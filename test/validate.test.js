const test = require("node:test");
const assert = require("node:assert/strict");

const {
    isType,
    parseRequiredString,
    parseOptionalString,
    parseMoney,
    parseDate,
    parseDayRange,
    parseIntInRange,
    escapeRegex
} = require("../lib/validate");

test("parseMoney accepts positive finite values only", () => {
    assert.equal(parseMoney("25000"), 25000);
    assert.equal(parseMoney(25000.4), 25000);
    assert.equal(parseMoney(-1), null);
    assert.equal(parseMoney("Infinity"), null);
    assert.equal(parseMoney("abc"), null);
    assert.equal(parseMoney(""), null);
});

test("parseRequiredString trims and enforces a maximum", () => {
    assert.equal(parseRequiredString("  nasi  ", 20), "nasi");
    assert.equal(parseRequiredString("   ", 20), null);
    assert.equal(parseRequiredString("abcdef", 3), null);
    assert.equal(parseRequiredString(42, 20), null);
});

test("parseOptionalString allows empty values but rejects invalid types", () => {
    assert.equal(parseOptionalString("", 10), "");
    assert.equal(parseOptionalString(undefined, 10), "");
    assert.equal(parseOptionalString("manual", 10), "manual");
    assert.equal(parseOptionalString({}, 10), null);
});

test("parseDayRange builds a Jakarta day range", () => {
    const range = parseDayRange("2026-11-15");
    assert.ok(range);
    assert.equal(range.$gte.toISOString(), "2026-11-14T17:00:00.000Z");
    assert.equal(range.$lt.toISOString(), "2026-11-15T17:00:00.000Z");
    assert.equal(parseDayRange("15-11-2026"), null);
    assert.equal(parseDayRange("2026-02-31"), null);
    assert.equal(parseDayRange("2026-13-01"), null);
});

test("parseIntInRange validates integer bounds", () => {
    assert.equal(parseIntInRange("25", 10, 1, 100), 25);
    assert.equal(parseIntInRange(undefined, 10, 1, 100), 10);
    assert.equal(parseIntInRange("0", 10, 1, 100), null);
    assert.equal(parseIntInRange("1.5", 10, 1, 100), null);
    assert.equal(parseIntInRange("abc", 10, 1, 100), null);
});

test("isType accepts only the two transaction types", () => {
    assert.equal(isType("expense"), true);
    assert.equal(isType("income"), true);
    assert.equal(isType("EXPENSE"), false);
    assert.equal(isType("<script>"), false);
});

test("escapeRegex neutralizes regex metacharacters", () => {
    assert.equal(escapeRegex("a.b*c"), "a\\.b\\*c");
});

test("parseDate rejects invalid dates", () => {
    assert.ok(parseDate("2026-11-15T10:00:00Z"));
    assert.equal(parseDate("not-a-date"), null);
    assert.equal(parseDate("2026-02-31T10:00:00Z"), null);
    assert.equal(parseDate(undefined, null), null);
});
