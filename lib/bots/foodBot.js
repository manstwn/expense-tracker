const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const { parseFoodTransaction } = require("../ai"); 
const { formatCurrency, getStartOfJakartaDayAgo } = require("../helpers");

function initFoodBot(foodLogs) {
    const bot = new TelegramBot(process.env.TELEGRAM_FOOD_TOKEN, { polling: true });

    bot.on("message", async (msg) => {
        try {
            let text = msg.text;
            const chatId = msg.chat.id;
            const userId = msg.from.id;

            // AUTHORIZATION CHECK
            if (process.env.AUTHORIZED_USER_ID && userId.toString() !== process.env.AUTHORIZED_USER_ID.toString()) {
                return bot.sendMessage(chatId, "Unauthorized user.");
            }

            if (!text) return;

            // HELP COMMAND
            if (text === "/h" || text === "/help") {
                return bot.sendMessage(chatId, "🍎 *Food Tracker Bot*\n\n/l - List last 7 days of food intake\n/l <n> - List intake from n days ago\n\nSimply send me what you ate!");
            }

            // LIST COMMAND
            if (text === "/l" || (text && text.startsWith("/l "))) {
                const parts = text.split(" ");
                const daysAgo = parts.length > 1 ? parseInt(parts[1]) : null;

                if (daysAgo !== null && !isNaN(daysAgo)) {
                    // List specific day
                    const startDate = getStartOfJakartaDayAgo(daysAgo);
                    const endDate = getStartOfJakartaDayAgo(daysAgo - 1);
                    
                    const dayData = await foodLogs.find({ 
                        userId, 
                        createdAt: { $gte: startDate, $lt: endDate } 
                    }).sort({ createdAt: 1 }).toArray();

                    if (!dayData.length) return bot.sendMessage(chatId, `No food logged for ${daysAgo} days ago.`);
                    
                    const dateStr = startDate.toLocaleDateString("id-ID", { 
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Jakarta' 
                    });
                    
                    const list = dayData.map((x, i) => `${i + 1}. ${x.foodName} (${x.category})`).join("\n");
                    
                    return bot.sendMessage(chatId, `*${dateStr}*\n\n${list}`, { parse_mode: "Markdown" });
                }

                // Default: List 7 days summary
                let message = "🍎 *Recent Food Intake (Last 7 Days)*\n\n";
                for (let i = 0; i < 7; i++) {
                    const startDate = getStartOfJakartaDayAgo(i);
                    const endDate = getStartOfJakartaDayAgo(i - 1);
                    
                    const dayData = await foodLogs.find({ 
                        userId, 
                        createdAt: { $gte: startDate, $lt: endDate } 
                    }).sort({ createdAt: 1 }).toArray();

                    if (dayData.length > 0) {
                        const dateStr = startDate.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
                        message += `*${dateStr}*: ${dayData.map(x => x.foodName).join(", ")}\n`;
                    }
                }
                return bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
            }

            // AI PARSE FOOD
            bot.sendChatAction(chatId, "typing");
            const parsedFood = await parseFoodTransaction(text);
            
            if (!parsedFood) {
                return bot.sendMessage(chatId, "Could not parse food information.");
            }

            // SAVE ITEM
            await foodLogs.insertOne({
                userId,
                username: msg.from.username || "",
                foodName: parsedFood.foodName,
                category: parsedFood.category,
                createdAt: new Date()
            });

            bot.sendMessage(chatId, `Logged ✅\n\n${parsedFood.foodName} (${parsedFood.category})`);

        } catch (err) {
            console.error(err);
            bot.sendMessage(msg.chat.id, "Failed to log food");
        }
    });
}

module.exports = { initFoodBot };
