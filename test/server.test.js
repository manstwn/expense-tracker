process.env.ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/test";
process.env.MONGODB_DB_NAME = "test";
process.env.GEMINI_API_KEY = "test-key";
process.env.WEB_PIN = "123456";
process.env.TOKEN_SECRET = "0123456789abcdef0123456789abcdef";
process.env.AUTHORIZED_USER_ID = "1";

const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");

const { initWebServer } = require("../lib/server");

function createApp() {
    const app = express();
    initWebServer(app);
    return app;
}

test("protected API routes reject requests without a session", async () => {
    const response = await request(createApp()).get("/api/transactions");
    assert.equal(response.status, 401);
    assert.equal(response.body.error, "Unauthorized");
});

test("unknown API routes return JSON", async () => {
    const response = await request(createApp()).get("/api/does-not-exist");
    assert.equal(response.status, 404);
    assert.equal(response.body.error, "Not found");
});

test("login rejects a missing PIN with JSON", async () => {
    const response = await request(createApp()).post("/api/login").send({});
    assert.equal(response.status, 400);
    assert.equal(response.body.error, "PIN is required");
});

test("security headers and a CSP are present", async () => {
    const response = await request(createApp()).get("/");
    assert.equal(response.status, 200);
    assert.ok(response.headers["content-security-policy"]);
    assert.equal(response.headers["x-content-type-options"], "nosniff");
});

test("health endpoint reports unavailable when the database is not connected", async () => {
    const response = await request(createApp()).get("/healthz");
    assert.equal(response.status, 503);
    assert.equal(response.body.ok, false);
});
