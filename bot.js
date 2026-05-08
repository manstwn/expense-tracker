// bot.js
require("dotenv").config();
const axios = require("axios");
const TelegramBot = require("node-telegram-bot-api");

// Internal Modules
const { connectDB } = require("./lib/database");
const { parseTransaction, askAI } = require("./lib/ai");
const { generateReport, getTopTransactions } = require("./lib/reporter");
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
/top <number> - List top most expensive items (default 10)
/td <number> - Delete today's transaction by list number
/ask <question> - Ask AI about your expenses
/h or /help - Show this help message
            `;
            return bot.sendMessage(chatId, helpMessage, { parse_mode: "Markdown" });
        }

        // REPORT COMMAND
        if (text === "/r") {
            const report = await generateReport(userId, transactions);
            try {
                return await bot.sendMessage(chatId, report, { parse_mode: "Markdown" });
            } catch (err) {
                return await bot.sendMessage(chatId, report);
            }
        }

        // TOP ITEMS COMMAND
        if (text.startsWith("/top")) {
            const args = text.split(" ");
            const limit = parseInt(args[1]) || 10;
            const topReport = await getTopTransactions(userId, transactions, limit);
            return bot.sendMessage(chatId, topReport);
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
                    try {
                        await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
                    } catch (err) {
                        await bot.sendMessage(chatId, message);
                    }
                }
            }
            return;
        }

        // ASK COMMAND
        if (text && text.startsWith("/ask")) {
            const question = text.replace("/ask", "").trim();
            if (!question) return bot.sendMessage(chatId, "Please provide a question. Example: /ask how much did I spend on coffee?");

            let reportText = "Message Received";
            let statusMsg = await bot.sendMessage(chatId, reportText);
            
            let answer = null;
            let attempts = 0;
            const maxAttempts = 5;

            // Fetch last 30 days of transactions
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const recentTransactions = await transactions.find({ userId, createdAt: { $gte: thirtyDaysAgo } }).sort({ createdAt: -1 }).toArray();

            while (attempts < maxAttempts) {
                attempts++;
                reportText += `\nSending to AI #${attempts}`;
                await bot.editMessageText(reportText, {
                    chat_id: chatId,
                    message_id: statusMsg.message_id
                });

                try {
                    answer = await askAI(question, recentTransactions);
                    break; 
                } catch (err) {
                    console.error(`Attempt ${attempts} failed:`, err.message);
                    if (attempts === maxAttempts) {
                        await bot.editMessageText(reportText + `\nfail`, {
                            chat_id: chatId,
                            message_id: statusMsg.message_id
                        });
                        return;
                    }
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            }

            // Cleanup Markdown for Telegram V1
            const cleanedAnswer = answer.replace(/\*\*(.*?)\*\*/g, '*$1*');

            try {
                return await bot.sendMessage(chatId, cleanedAnswer, { parse_mode: "Markdown" });
            } catch (err) {
                console.error("Telegram Markdown Error:", err.message);
                return await bot.sendMessage(chatId, answer); // Fallback to raw answer without markdown
            }
        }

        // AI PARSE WITH RETRY & REPORTING
        let reportText = "Message Received";
        let statusMsg = await bot.sendMessage(chatId, reportText);
        
        let parsedItems = null;
        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts) {
            attempts++;
            reportText += `\nSending to AI #${attempts}`;
            await bot.editMessageText(reportText, {
                chat_id: chatId,
                message_id: statusMsg.message_id
            });

            try {
                parsedItems = await parseTransaction(text, audioBuffer);
                if (parsedItems && parsedItems.length > 0) {
                    break; // Success!
                } else {
                    // No transactions found
                    await bot.editMessageText(reportText + "\nNo transactions detected.", {
                        chat_id: chatId,
                        message_id: statusMsg.message_id
                    });
                    return;
                }
            } catch (err) {
                console.error(`Attempt ${attempts} failed:`, err.message);
                if (attempts === maxAttempts) {
                    await bot.editMessageText(reportText + `\nfail`, {
                        chat_id: chatId,
                        message_id: statusMsg.message_id
                    });
                    return;
                }
                // wait before retry
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
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