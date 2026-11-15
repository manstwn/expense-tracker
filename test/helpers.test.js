const test = require("node:test");
const assert = require("node:assert/strict");

const {
    toJakartaDateStr,
    getStartOfJakartaDay,
    getStartOfJakartaDayAgo,
    parseJakartaDate
} = require("../lib/helpers");

test("toJakartaDateStr uses the WIB calendar date", () => {
    assert.equal(toJakartaDateStr(new Date("2026-11-14T17:30:00Z")), "2026-11-15");
    assert.equal(toJakartaDateStr(new Date("2026-11-14T16:59:59Z")), "2026-11-14");
});

test("getStartOfJakartaDay returns Jakarta midnight", () => {
    const start = getStartOfJakartaDay(new Date("2026-11-15T10:00:00Z"));
    assert.equal(start.toISOString(), "2026-11-14T17:00:00.000Z");
});

test("getStartOfJakartaDayAgo returns Jakarta midnight for the shifted day", () => {
    const start = getStartOfJakartaDayAgo(1);
    assert.equal(start.getUTCHours(), 17);
    assert.equal(start.getUTCMinutes(), 0);
});

test("parseJakartaDate validates real calendar dates", () => {
    assert.ok(parseJakartaDate("15/11/2026"));
    assert.equal(parseJakartaDate("31/02/2026"), null);
    assert.equal(parseJakartaDate("99/99/2026"), null);
    assert.equal(parseJakartaDate("2026-11-15"), null);
});
