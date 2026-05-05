// bot.js
require("dotenv").config();
const axios = require("axios");
const TelegramBot = require("node-telegram-bot-api");

// Internal Modules
const { connectDB } = require("./lib/database");
const { parseTransaction } = require("./lib/ai");
const { generateReport } = require("./lib/reporter");
const { formatCurrency, totalAmount, getStartOfJakartaDay, getStartOfJakartaDayAgo } = require("./lib/helpers");
const { initMQTT } = require("./lib/mqtt");

// ======================================================
// INITIALIZATION
// ======================================================
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
let transactions;

// ======================================================
// MESSAGE HANDLER
// ======================================================
bot.on("message", async (msg) => {
    try {
        let text = msg.text;
        let audioBuffer = null;
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        // AUTHORIZATION CHECK
        if (process.env.AUTHORIZED_USER_ID && userId.toString() !== process.env.AUTHORIZED_USER_ID.toString()) {
            return bot.sendMessage(chatId, "Unauthorized user.");
        }

        // VOICE NOTE HANDLING
        if (msg.voice) {
            bot.sendChatAction(chatId, "typing");
            const fileLink = await bot.getFileLink(msg.voice.file_id);
            const response = await axios.get(fileLink, { responseType: "arraybuffer" });
            audioBuffer = Buffer.from(response.data);
            if (!text) text = "Voice note transaction";
        }

        if (!text && !audioBuffer) return;

        // HELP COMMAND
        if (text === "/h" || text === "/help") {
            const helpMessage = `
💰 *Money Tracker Bot*

Available Commands:
/r - Generate spending report
/t or /today - List today's transactions
/l or /list - List transactions for the last 7 days
/td <number> - Delete today's transaction by list number
/h or /help - Show this help message
            `;
            return bot.sendMessage(chatId, helpMessage, { parse_mode: "Markdown" });
        }

        // REPORT COMMAND
        if (text === "/r") {
            const report = await generateReport(userId, transactions);
            return bot.sendMessage(chatId, report, { parse_mode: "Markdown" });
        }

        // TODAY LIST COMMAND (Jakarta)
        if (text === "/t" || text === "/today") {
            const today = getStartOfJakartaDay();
            const todayData = await transactions.find({ userId, createdAt: { $gte: today } }).sort({ createdAt: 1 }).toArray();
            if (!todayData.length) return bot.sendMessage(chatId, "No transactions today.");
            const list = todayData.map((x, i) => `${i + 1}. ${x.item} (Rp${formatCurrency(x.amount)})`).join("\n");
            return bot.sendMessage(chatId, `Today's Transactions:\n\n${list}\n\nUse /td <number> to delete.`);
        }

        // DELETE TODAY COMMAND (Jakarta)
        if (text.startsWith("/td ")) {
            const index = parseInt(text.split(" ")[1]) - 1;
            if (isNaN(index)) return bot.sendMessage(chatId, "Please provide a number. Example: /td 1");
            const today = getStartOfJakartaDay();
            const todayData = await transactions.find({ userId, createdAt: { $gte: today } }).sort({ createdAt: 1 }).toArray();
            if (index < 0 || index >= todayData.length) return bot.sendMessage(chatId, "Invalid index.");
            const target = todayData[index];
            await transactions.deleteOne({ _id: target._id });
            return bot.sendMessage(chatId, `Deleted 🗑️\n\n${target.item}: Rp${formatCurrency(target.amount)}`);
        }

        // LIST 7 DAYS COMMAND
        if (text === "/l" || text === "/list") {
            // Loop from today (0) back to 6 days ago (6)
            for (let i = 0; i < 7; i++) {
                const startDate = getStartOfJakartaDayAgo(i);
                const endDate = getStartOfJakartaDayAgo(i - 1); // Start of next day
                
                const dayData = await transactions.find({ 
                    userId, 
                    createdAt: { $gte: startDate, $lt: endDate } 
                }).sort({ createdAt: 1 }).toArray();

                if (dayData.length > 0) {
                    const dateStr = startDate.toLocaleDateString("id-ID", { 
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Jakarta' 
                    });
                    const total = totalAmount(dayData);
                    const items = dayData.map(x => `- ${x.item} (Rp${formatCurrency(x.amount)})`).join("\n");
                    
                    const message = `*${dateStr}*\n(Total: Rp${formatCurrency(total)})\n${items}`;
                    await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
                }
            }
            return;
        }

        // AI PARSE
        const parsedItems = await parseTransaction(text, audioBuffer);

        if (!parsedItems || parsedItems.length === 0) {
            return bot.sendMessage(chatId, "No transactions detected.");
        }

        // SAVE ALL ITEMS
        const savePromises = parsedItems.map(item => {
            return transactions.insertOne({
                userId,
                username: msg.from.username || "",
                type: item.type,
                item: item.item,
                amount: item.amount,
                category: item.category,
                createdAt: new Date()
            });
        });

        await Promise.all(savePromises);

        // RESPONSE
        const itemsText = parsedItems.map(x => `${x.item}: Rp${formatCurrency(x.amount)}`).join("\n");
        bot.sendMessage(chatId, `Saved ✅\n\n${itemsText}`);

    } catch (err) {
        console.error(err);
        bot.sendMessage(msg.chat.id, "Failed to record transaction");
    }
});

// ======================================================
// START
// ======================================================
async function start() {
    try {
        console.log("Starting DB Connection Check...");
        const dbInfo = await connectDB();
        transactions = dbInfo.transactions;
        console.log("✅ MongoDB Connected & Reachable");

        // MQTT INIT
        initMQTT(transactions);

        console.log("🚀 Bot is now running and ready");
    } catch (err) {
        console.error("❌ Startup Failed:");
        console.error(err);
        process.exit(1);
    }
}

start();