const crypto = require("crypto");
const { tokenSecret, webPin, sessionTtlMs } = require("./config");

function hash(value) {
    return crypto.createHash("sha256").update(String(value)).digest();
}

function safeEqualString(a, b) {
    return crypto.timingSafeEqual(hash(a), hash(b));
}

function safeEqualHex(a, b) {
    if (typeof a !== "string" || typeof b !== "string") return false;
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");
    if (left.length !== right.length || left.length === 0) return false;
    return crypto.timingSafeEqual(left, right);
}

function verifyPin(input) {
    if (input === undefined || input === null) return false;
    return safeEqualString(input, webPin);
}

function createSessionToken(sessionId) {
    const payload = JSON.stringify({
        sid: sessionId,
        expires: Date.now() + sessionTtlMs
    });
    const hmac = crypto.createHmac("sha256", tokenSecret).update(payload).digest("hex");
    return Buffer.from(payload).toString("base64url") + "." + hmac;
}

function verifySessionToken(token) {
    if (typeof token !== "string") return null;
    const separator = token.lastIndexOf(".");
    if (separator <= 0) return null;

    const encodedPayload = token.slice(0, separator);
    const hmac = token.slice(separator + 1);

    try {
        const payloadStr = Buffer.from(encodedPayload, "base64url").toString("utf8");
        const expected = crypto.createHmac("sha256", tokenSecret).update(payloadStr).digest("hex");
        if (!safeEqualHex(hmac, expected)) return null;

        const payload = JSON.parse(payloadStr);
        if (typeof payload.sid !== "string" || typeof payload.expires !== "number") return null;
        if (payload.expires <= Date.now()) return null;

        return payload;
    } catch {
        return null;
    }
}

module.exports = {
    SESSION_TTL_MS: sessionTtlMs,
    safeEqualString,
    verifyPin,
    createSessionToken,
    verifySessionToken
};
