const { formatCurrency, formatItems, totalAmount, getJakartaNow, getStartOfJakartaDay } = require("./helpers");

async function generateReport(userId, transactions) {
    // TODAY (Jakarta)
    const today = getStartOfJakartaDay();
    const todayData = await transactions.find({ userId, type: "expense", createdAt: { $gte: today } }).toArray();

    // YESTERDAY
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayData = await transactions.find({
        userId,
        type: "expense",
        createdAt: { $gte: yesterday, $lt: today }
    }).toArray();

    // LAST 7D
    const last7 = new Date();
    last7.setDate(last7.getDate() - 7);
    const last7Data = await transactions.find({ userId, type: "expense", createdAt: { $gte: last7 } }).toArray();

    // LAST 14D
    const last14 = new Date();
    last14.setDate(last14.getDate() - 14);
    const last14Data = await transactions.find({ userId, type: "expense", createdAt: { $gte: last14 } }).toArray();

    // THIS MONTH (Jakarta)
    const jkt = getJakartaNow();
    const firstMonth = new Date(`${jkt.year}-${jkt.month}-01T00:00:00+07:00`);
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

module.exports = { generateReport };
