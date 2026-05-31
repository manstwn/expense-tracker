require("dotenv").config();
const express = require("express");
const { connectDB } = require("./lib/database");
const { initMoneyBot } = require("./lib/bots/moneyBot");
const { initFoodBot } = require("./lib/bots/foodBot");
const { initWebServer } = require("./lib/server");
const { initMQTT } = require("./lib/mqtt");

async function start() {
    try {
        console.log("Starting Unified Application...");
        const { transactions, foodLogs } = await connectDB();
        console.log("✅ MongoDB Connected");

        // 1. Initialize Web Server
        const app = express();
        initWebServer(app);
        const port = process.env.PORT || 3000;
        app.listen(port, () => {
            console.log(`🌐 Web Dashboard server running at http://localhost:${port}`);
        });

        // 2. Initialize MQTT
        if (process.env.MQTT_ENABLED === "true") {
            initMQTT(transactions);
            console.log("✅ MQTT Enabled");
        }

        // 3. Initialize Money Bot
        initMoneyBot(transactions);
        console.log("✅ Money Bot Initialized");

        // 4. Initialize Food Bot
        initFoodBot(foodLogs);
        console.log("✅ Food Bot Initialized");

        // 5. Cloudflare Tunnel
        if (process.env.ENV === "prod" && process.env.CL_TUNNEL_TOKEN) {
            const { spawn } = require("child_process");
            const path = require("path");
            console.log("🚀 Starting Cloudflare Tunnel...");
            
            const cloudflaredBin = path.join(__dirname, "node_modules", "cloudflared", "bin", "cloudflared" + (process.platform === "win32" ? ".exe" : ""));
            const tunnel = spawn(cloudflaredBin, ["tunnel", "run", "--token", process.env.CL_TUNNEL_TOKEN]);
            
            tunnel.stdout.on("data", (data) => console.log(`[CF Tunnel]: ${data}`));
            tunnel.stderr.on("data", (data) => console.error(`[CF Tunnel]: ${data}`));
        }

        console.log("🚀 All services are running");
    } catch (err) {
        console.error("❌ Startup Failed:");
        console.error(err);
        process.exit(1);
    }
}

start();
