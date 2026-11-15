const express = require("express");
const path = require("path");
const { spawn } = require("child_process");

const { connectDB, closeDB } = require("./lib/database");
const { initWebServer } = require("./lib/server");
const { port, isProd, tunnelToken } = require("./lib/config");
const logger = require("./lib/logger");

let shuttingDown = false;

async function start() {
    logger.info("Starting application");

    await connectDB();
    logger.info("MongoDB connected");

    const app = express();
    initWebServer(app);

    const server = app.listen(port, () => {
        logger.info("Web dashboard listening", { port });
    });

    server.on("error", (err) => {
        logger.error("HTTP server failed", { error: err.message });
        process.exit(1);
    });

    let tunnel = null;
    if (isProd && tunnelToken) {
        const binary = path.join(
            __dirname,
            "node_modules",
            "cloudflared",
            "bin",
            `cloudflared${process.platform === "win32" ? ".exe" : ""}`
        );

        logger.info("Starting Cloudflare Tunnel");
        tunnel = spawn(binary, ["tunnel", "run", "--token", tunnelToken]);

        tunnel.stdout.on("data", (data) => logger.info("cloudflared", { output: String(data).trim() }));
        tunnel.stderr.on("data", (data) => logger.warn("cloudflared", { output: String(data).trim() }));

        tunnel.on("error", (err) => {
            logger.error("Failed to start Cloudflare Tunnel", { error: err.message });
            process.exit(1);
        });

        tunnel.on("exit", (code, signal) => {
            if (shuttingDown) return;
            logger.error("Cloudflare Tunnel exited", { code, signal });
            process.exit(code === 0 ? 1 : code || 1);
        });
    }

    async function shutdown(signal) {
        if (shuttingDown) return;
        shuttingDown = true;
        logger.info("Shutting down", { signal });

        if (tunnel) tunnel.kill();

        const forceExit = setTimeout(() => {
            logger.error("Shutdown timed out");
            process.exit(1);
        }, 10000);
        forceExit.unref();

        server.close(async () => {
            try {
                await closeDB();
            } catch (err) {
                logger.error("Failed to close MongoDB", { error: err.message });
            }
            clearTimeout(forceExit);
            process.exit(0);
        });
    }

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    logger.info("All services are running");
}

start().catch(async (err) => {
    logger.error("Startup failed", { error: err.message, stack: err.stack });
    try {
        await closeDB();
    } catch {
        // Ignore cleanup errors during startup failure.
    }
    process.exit(1);
});
