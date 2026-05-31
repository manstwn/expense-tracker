const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
// Assuming we'll have a food-specific parser
const { parseFoodTransaction } = require("../ai"); 
const { formatCurrency } = require("../helpers");

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
                return bot.sendMessage(chatId, "🍎 *Food Tracker Bot*\n\nSimply send me what you ate, and I will categorize it for you!");
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
