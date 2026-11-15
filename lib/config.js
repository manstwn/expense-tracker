require("dotenv").config({ quiet: true });

const crypto = require("crypto");

const env = process.env.ENV || "dev";
const isProd = env === "prod";

function fail(message) {
    console.error(`Configuration error: ${message}`);
    process.exit(1);
}

const required = [
    "MONGODB_URI",
    "MONGODB_DB_NAME",
    "GEMINI_API_KEY",
    "WEB_PIN",
    "AUTHORIZED_USER_ID"
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
    fail(`missing required environment variables: ${missing.join(", ")}`);
}

const webPin = String(process.env.WEB_PIN);
if (
    webPin.length < 6 ||
    webPin === "1234" ||
    webPin === "choose-a-pin-of-at-least-6-characters"
) {
    fail("WEB_PIN must be at least 6 characters and must not be an example value");
}

let tokenSecret = process.env.TOKEN_SECRET;
if (!tokenSecret) {
    if (isProd) {
        fail("TOKEN_SECRET is required when ENV=prod");
    }
    tokenSecret = crypto.randomBytes(32).toString("hex");
    console.warn("TOKEN_SECRET is not set; using an ephemeral development secret. Sessions will not survive a restart.");
}
if (tokenSecret.length < 32 || tokenSecret === "replace-with-at-least-32-random-characters") {
    fail("TOKEN_SECRET must be at least 32 characters and must not be an example value");
}

const ownerId = Number(process.env.AUTHORIZED_USER_ID);
if (!Number.isInteger(ownerId)) {
    fail("AUTHORIZED_USER_ID must be an integer");
}

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail("PORT must be an integer between 1 and 65535");
}

module.exports = Object.freeze({
    env,
    isProd,
    port,
    mongodbUri: process.env.MONGODB_URI,
    mongodbDbName: process.env.MONGODB_DB_NAME,
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    webPin,
    tokenSecret,
    ownerId,
    ownerUsername: process.env.OWNER_USERNAME || "owner",
    iotToken: process.env.IOT_TOKEN === "replace-with-a-device-token"
        ? ""
        : process.env.IOT_TOKEN || "",
    tunnelToken: process.env.CL_TUNNEL_TOKEN || "",
    sessionTtlMs: 12 * 60 * 60 * 1000
});
