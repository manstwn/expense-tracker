process.env.ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/test";
process.env.MONGODB_DB_NAME = "test";
process.env.GEMINI_API_KEY = "test-key";
process.env.WEB_PIN = "123456";
process.env.TOKEN_SECRET = "0123456789abcdef0123456789abcdef";
process.env.AUTHORIZED_USER_ID = "1";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    safeEqualString,
    verifyPin,
    createSessionToken,
    verifySessionToken
} = require("../lib/auth");

test("verifyPin compares against the configured PIN", () => {
    assert.equal(verifyPin("123456"), true);
    assert.equal(verifyPin("654321"), false);
    assert.equal(verifyPin(""), false);
});

test("safeEqualString compares equal values", () => {
    assert.equal(safeEqualString("abc", "abc"), true);
    assert.equal(safeEqualString("abc", "abd"), false);
});

test("session tokens round-trip and reject tampering", () => {
    const token = createSessionToken("session-1");
    const payload = verifySessionToken(token);

    assert.ok(payload);
    assert.equal(payload.sid, "session-1");

    const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    assert.equal(verifySessionToken(tampered), null);
});

test("expired session tokens are rejected", () => {
    const token = createSessionToken("session-2");
    const originalNow = Date.now;

    try {
        Date.now = () => originalNow() + 13 * 60 * 60 * 1000;
        assert.equal(verifySessionToken(token), null);
    } finally {
        Date.now = originalNow;
    }
});
