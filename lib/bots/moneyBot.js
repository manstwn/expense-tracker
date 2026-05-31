const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const { parseTransaction, askAI } = require("../ai");
const { generateReport, getTopTransactions } = require("../reporter");
const { formatCurrency, totalAmount, getStartOfJakartaDay, getStartOfJakartaDayAgo, parseJakartaDate, toJakartaDateRef } = require("../helpers");

function initMoneyBot(transactions) {
    const bot = new TelegramBot(process.env.TELEGRAM_MONEY_TOKEN, { polling: true });

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

*Basic Commands:*
/t or /today - List today's transactions
/r - Generate spending report
/l or /list - List summary for last 7 days
/top <num> - List top expensive items
/ask <question> - Ask AI about expenses

*Edit & Delete (Old Data):*
/l <n> - List items from n days ago (e.g., /l 1 for yesterday)
/ln DD/MM/YYYY <val> <name> - New entry on date
/ld DD/MM/YYYY <num> - Delete item #num on date
/lev DD/MM/YYYY <num> <value> - Edit item #num VALUE on date
/len DD/MM/YYYY <num> <name> - Edit item #num NAME on date

*Today's Shortcuts:*
/td <num> - Delete today's item #num
/te <num> <info> - Edit today's item #num (AI)

_Examples:_
- \`/ln 03/05/2026 25000 Bakso\` (Add item to May 3rd)
- \`/ld 09/05/2026 1\` (Delete item 1 on May 9)
- \`/lev 09/05/2026 2 25000\` (Update amount of item 2)
- \`/len 09/05/2026 3 Coffee\` (Update name of item 3)
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
                return bot.sendMessage(chatId, `Today's Transactions:\n\n${list}\n\nUse /td <num> to delete or /te <num> <info> to edit.`);
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

            // EDIT TODAY COMMAND (Jakarta)
            if (text.startsWith("/te")) {
                const parts = text.split(" ");
                if (parts.length < 3) return bot.sendMessage(chatId, "Usage: /te <number> <new info>\nExample: /te 1 coffee 15k");
                
                const index = parseInt(parts[1]) - 1;
                const newInfo = parts.slice(2).join(" ");
                
                const today = getStartOfJakartaDay();
                const todayData = await transactions.find({ userId, createdAt: { $gte: today } }).sort({ createdAt: 1 }).toArray();
                
                if (index < 0 || index >= todayData.length) return bot.sendMessage(chatId, "Invalid index.");
                const target = todayData[index];

                bot.sendChatAction(chatId, "typing");
                try {
                    const parsed = await parseTransaction(newInfo);
                    if (!parsed || parsed.length === 0) return bot.sendMessage(chatId, "Could not parse new info.");
                    
                    const update = parsed[0];
                    await transactions.updateOne(
                        { _id: target._id },
                        { $set: { item: update.item, amount: update.amount, category: update.category, type: update.type } }
                    );
                    return bot.sendMessage(chatId, `Updated ✅\n\nOld: ${target.item} (Rp${formatCurrency(target.amount)})\nNew: ${update.item} (Rp${formatCurrency(update.amount)})`);
                } catch (err) {
                    return bot.sendMessage(chatId, "Failed to update transaction.");
                }
            }

            // LIST COMMAND (Support /l and /l <n>)
            if (text === "/l" || text === "/list" || (text && text.startsWith("/l "))) {
                const parts = text.split(" ");
                const daysAgo = parts.length > 1 ? parseInt(parts[1]) : null;

                if (daysAgo !== null && !isNaN(daysAgo)) {
                    // List specific day
                    const startDate = getStartOfJakartaDayAgo(daysAgo);
                    const endDate = getStartOfJakartaDayAgo(daysAgo - 1);
                    
                    const dayData = await transactions.find({ 
                        userId, 
                        createdAt: { $gte: startDate, $lt: endDate } 
                    }).sort({ createdAt: 1 }).toArray();

                    if (!dayData.length) return bot.sendMessage(chatId, `No transactions found for ${daysAgo} days ago.`);
                    
                    const dateStr = startDate.toLocaleDateString("id-ID", { 
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Jakarta' 
                    });
                    const dateRef = toJakartaDateRef(startDate);
                    
                    const total = totalAmount(dayData);
                    const list = dayData.map((x, i) => `${i + 1}. ${x.item} (Rp${formatCurrency(x.amount)})`).join("\n");
                    
                    return bot.sendMessage(chatId, `*${dateStr}*\nDate Ref: \`${dateRef}\`\nTotal: Rp${formatCurrency(total)}\n\n${list}\n\nUsage:\n/ld ${dateRef} <num> - Delete\n/lev ${dateRef} <num> <val> - Edit Val\n/len ${dateRef} <num> <name> - Edit Name`, { parse_mode: "Markdown" });
                }

                // Default: List 7 days summary
                for (let i = 0; i < 7; i++) {
                    const startDate = getStartOfJakartaDayAgo(i);
                    const endDate = getStartOfJakartaDayAgo(i - 1);
                    
                    const dayData = await transactions.find({ 
                        userId, 
                        createdAt: { $gte: startDate, $lt: endDate } 
                    }).sort({ createdAt: 1 }).toArray();

                    if (dayData.length > 0) {
                        const dateStr = startDate.toLocaleDateString("id-ID", { 
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Jakarta' 
                        });
                        const dateRef = toJakartaDateRef(startDate);
                        const total = totalAmount(dayData);
                        const items = dayData.map((x, i) => `${i + 1}. ${x.item} (Rp${formatCurrency(x.amount)})`).join("\n");
                        
                        const message = `*${dateStr}* (\`${dateRef}\`)\n(Total: Rp${formatCurrency(total)})\n${items}`;
                        try {
                            await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
                        } catch (err) {
                            await bot.sendMessage(chatId, message);
                        }
                    }
                }
                return;
            }

            // DELETE OLD COMMAND (Date Based)
            if (text && text.startsWith("/ld")) {
                const parts = text.split(" ");
                if (parts.length < 3) return bot.sendMessage(chatId, "Usage: /ld DD/MM/YYYY <number>\nExample: /ld 09/05/2026 1");
                
                const dateStr = parts[1];
                const index = parseInt(parts[2]) - 1;

                const startDate = parseJakartaDate(dateStr);
                if (!startDate) return bot.sendMessage(chatId, "Invalid date format. Use DD/MM/YYYY");
                
                const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

                const dayData = await transactions.find({ 
                    userId, 
                    createdAt: { $gte: startDate, $lt: endDate } 
                }).sort({ createdAt: 1 }).toArray();

                if (index < 0 || index >= dayData.length) return bot.sendMessage(chatId, "Invalid index.");
                const target = dayData[index];

                await transactions.deleteOne({ _id: target._id });
                return bot.sendMessage(chatId, `Deleted 🗑️\n\n[${dateStr}] ${target.item}: Rp${formatCurrency(target.amount)}`);
            }

            // EDIT VALUE COMMAND
            if (text && text.startsWith("/lev")) {
                const parts = text.split(" ");
                if (parts.length < 4) return bot.sendMessage(chatId, "Usage: /lev DD/MM/YYYY <number> <value>\nExample: /lev 09/05/2026 1 25000");

                const dateStr = parts[1];
                const index = parseInt(parts[2]) - 1;
                const newValue = parseInt(parts[3].replace(/[^0-9]/g, ""));

                const startDate = parseJakartaDate(dateStr);
                if (!startDate) return bot.sendMessage(chatId, "Invalid date format. Use DD/MM/YYYY");
                
                const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

                const dayData = await transactions.find({ 
                    userId, 
                    createdAt: { $gte: startDate, $lt: endDate } 
                }).sort({ createdAt: 1 }).toArray();

                if (index < 0 || index >= dayData.length) return bot.sendMessage(chatId, "Invalid index.");
                if (isNaN(newValue)) return bot.sendMessage(chatId, "Invalid value.");
                
                const target = dayData[index];
                await transactions.updateOne({ _id: target._id }, { $set: { amount: newValue } });
                
                return bot.sendMessage(chatId, `Updated Value ✅\n\n${target.item}: Rp${formatCurrency(target.amount)} -> Rp${formatCurrency(newValue)}`);
            }

            // EDIT NAME COMMAND
            if (text && text.startsWith("/len")) {
                const parts = text.split(" ");
                if (parts.length < 4) return bot.sendMessage(chatId, "Usage: /len DD/MM/YYYY <number> <new_name>\nExample: /len 09/05/2026 1 Coffee");

                const dateStr = parts[1];
                const index = parseInt(parts[2]) - 1;
                const newName = parts.slice(3).join(" ");

                const startDate = parseJakartaDate(dateStr);
                if (!startDate) return bot.sendMessage(chatId, "Invalid date format. Use DD/MM/YYYY");
                
                const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

                const dayData = await transactions.find({ 
                    userId, 
                    createdAt: { $gte: startDate, $lt: endDate } 
                }).sort({ createdAt: 1 }).toArray();

                if (index < 0 || index >= dayData.length) return bot.sendMessage(chatId, "Invalid index.");
                
                const target = dayData[index];
                await transactions.updateOne({ _id: target._id }, { $set: { item: newName } });
                
                return bot.sendMessage(chatId, `Updated Name ✅\n\nOld: ${target.item}\nNew: ${newName}`);
            }

            // NEW ENTRY ON SPECIFIC DATE
            if (text && text.startsWith("/ln")) {
                const parts = text.split(" ");
                if (parts.length < 4) return bot.sendMessage(chatId, "Usage: /ln DD/MM/YYYY <value> <name>\nExample: /ln 03/05/2026 25000 Bakso");

                const dateStr = parts[1];
                const amount = parseInt(parts[2].replace(/[^0-9]/g, ""));
                const itemName = parts.slice(3).join(" ");

                const date = parseJakartaDate(dateStr);
                if (!date) return bot.sendMessage(chatId, "Invalid date format. Use DD/MM/YYYY");
                if (isNaN(amount)) return bot.sendMessage(chatId, "Invalid amount.");

                await transactions.insertOne({
                    userId,
                    username: msg.from.username || (userId.toString() === "1828479746" ? "imanstwn" : ""),
                    type: "expense",
                    item: itemName,
                    amount: amount,
                    category: "manual",
                    createdAt: date
                });

                return bot.sendMessage(chatId, `Saved to ${dateStr} ✅\n\n${itemName}: Rp${formatCurrency(amount)}`);
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
                    username: msg.from.username || (userId.toString() === "1828479746" ? "imanstwn" : ""),
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
}

module.exports = { initMoneyBot };
