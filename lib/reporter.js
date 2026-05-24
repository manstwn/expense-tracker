const { formatCurrency, formatItems, totalAmount, getStartOfJakartaDay, getStartOfJakartaDayAgo } = require("./helpers");

async function generateReport(userId, transactions) {
    // TODAY (Jakarta timezone)
    const today = getStartOfJakartaDay();
    const todayData = await transactions.find({ userId, type: "expense", createdAt: { $gte: today } }).toArray();

    // YESTERDAY (Jakarta timezone)
    const yesterday = getStartOfJakartaDayAgo(1);
    const yesterdayData = await transactions.find({
        userId,
        type: "expense",
        createdAt: { $gte: yesterday, $lt: today }
    }).toArray();

    // LAST 7D (Jakarta timezone)
    const last7 = getStartOfJakartaDayAgo(7);
    const last7Data = await transactions.find({ userId, type: "expense", createdAt: { $gte: last7 } }).toArray();

    // LAST 14D (Jakarta timezone)
    const last14 = getStartOfJakartaDayAgo(14);
    const last14Data = await transactions.find({ userId, type: "expense", createdAt: { $gte: last14 } }).toArray();

    // THIS MONTH (Jakarta timezone - first day of month at Jakarta midnight)
    const now = new Date();
    const jakartaYear = parseInt(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric" }).format(now));
    const jakartaMonth = parseInt(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", month: "2-digit" }).format(now));
    const firstMonth = new Date(`${jakartaYear}-${String(jakartaMonth).padStart(2, '0')}-01T00:00:00+07:00`);
    const monthData = await transactions.find({ userId, type: "expense", createdAt: { $gte: firstMonth } }).toArray();

    // TOP 5 GLOBAL
    const top5 = await transactions.aggregate([
        { $match: { userId, type: "expense" } },
        { $group: { _id: "$item", total: { $sum: "$amount" } } },
        { $sort: { total: -1 } },
        { $limit: 5 }
    ]).toArray();

    const topText = top5.length ? top5.map(x => `- ${x._id} (Rp${formatCurrency(x.total)})`).join("\n") : "-";

    return `📊 Spend Report
    
Today (*Rp${formatCurrency(totalAmount(todayData))}*)
${formatItems(todayData)}

Yesterday (*Rp${formatCurrency(totalAmount(yesterdayData))}*)
${formatItems(yesterdayData)}

Last 7D (*Rp${formatCurrency(totalAmount(last7Data))}*)
Last 14D (*Rp${formatCurrency(totalAmount(last14Data))}*)
This Month (*Rp${formatCurrency(totalAmount(monthData))}*)

🔥 Top 5 Most Expensive (All Time):

${topText}`;
}

async function getTopTransactions(userId, transactions, limit = 10) {
    const top = await transactions.aggregate([
        { $match: { userId, type: "expense" } },
        { $group: { _id: "$item", total: { $sum: "$amount" } } },
        { $sort: { total: -1 } },
        { $limit: limit }
    ]).toArray();

    if (!top.length) return "No transactions found.";

    const list = top.map((x, i) => `${i + 1}. ${x._id} (Rp${formatCurrency(x.total)})`).join("\n");
    return `🔥 Top ${top.length} Most Expensive Items:\n\n${list}`;
}

module.exports = { generateReport, getTopTransactions };

