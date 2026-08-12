const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { ObjectId } = require("mongodb");
const { getTransactions, getFoodLogs, getStories } = require("./database");
const { parseTransaction, parseFoodTransaction } = require("./ai");
const { getStartOfUTCDay, parseUTCDate, toJakartaDateStr } = require("./helpers");

const router = express.Router();
const SECRET = process.env.WEB_PIN || "1234";

// Token generation helper
function generateToken() {
    const expires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days validity
    const payload = JSON.stringify({ expires });
    const hmac = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
    return Buffer.from(payload).toString("base64") + "." + hmac;
}

// Token verification helper
function verifyToken(token) {
    if (!token) return false;
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    try {
        const payloadStr = Buffer.from(parts[0], "base64").toString("utf8");
        const hmac = parts[1];
        const expectedHmac = crypto.createHmac("sha256", SECRET).update(payloadStr).digest("hex");
        if (hmac !== expectedHmac) return false;
        
        const payload = JSON.parse(payloadStr);
        if (payload.expires < Date.now()) return false;
        return true;
    } catch (e) {
        return false;
    }
}

// Middleware for Auth
function authMiddleware(req, res, next) {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: Missing token" });
    }
    const token = authHeader.split(" ")[1];
    if (!verifyToken(token)) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
    }
    next();
}

// ==========================================
// Money Routes (All Data Dump)
// ==========================================

// 1. PIN Login
router.post("/login", (req, res) => {
    const { pin } = req.body;
    if (!pin) {
        return res.status(400).json({ error: "PIN is required" });
    }
    if (pin.toString() === SECRET.toString()) {
        const token = generateToken();
        return res.json({ success: true, token });
    } else {
        return res.status(401).json({ error: "Invalid PIN" });
    }
});

// 2. Verify Session
router.get("/verify", authMiddleware, (req, res) => {
    return res.json({ valid: true });
});

// 3. Get unique users/usernames
router.get("/users", authMiddleware, async (req, res) => {
    try {
        const transactions = getTransactions();
        const users = await transactions.aggregate([
            {
                $group: {
                    _id: "$userId",
                    username: { $first: "$username" }
                }
            },
            {
                $project: {
                    userId: "$_id",
                    username: { $ifNull: ["$username", ""] },
                    _id: 0
                }
            },
            { $sort: { username: 1 } }
        ]).toArray();

        const mappedUsers = users.map(u => {
            if (!u.username && u.userId && u.userId.toString() === "1828479746") {
                u.username = "imanstwn";
            }
            return u;
        });

        return res.json(mappedUsers);
    } catch (err) {
        console.error("Failed to fetch users:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// 4. Get all transactions (with optional date filter)
router.get("/transactions", authMiddleware, async (req, res) => {
    try {
        const transactions = getTransactions();
        const { date, limit } = req.query;
        
        let query = {};
        
        // Filter by specific date (Jakarta timezone) if provided
        if (date) {
            // date is expected as YYYY-MM-DD
            const startOfDay = new Date(`${date}T00:00:00+07:00`);
            const endOfDay = new Date(`${date}T23:59:59.999+07:00`);
            query.createdAt = { $gte: startOfDay, $lte: endOfDay };
        }
        
        let cursor = transactions.find(query).sort({ createdAt: -1 });
        
        // Apply limit if provided
        if (limit) {
            const parsedLimit = parseInt(limit);
            if (!isNaN(parsedLimit) && parsedLimit > 0) {
                cursor = cursor.limit(parsedLimit);
            }
        }
        
        const results = await cursor.toArray();

        // Fallback mapping for username
        const mappedResults = results.map(t => {
            if (!t.username && t.userId && t.userId.toString() === "1828479746") {
                t.username = "imanstwn";
            }
            return t;
        });

        return res.json({
            transactions: mappedResults,
            total: mappedResults.length
        });
    } catch (err) {
        console.error("Failed to fetch transactions:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// 5. Get statistics for dashboard and charts
router.get("/stats", authMiddleware, async (req, res) => {
    try {
        const transactions = getTransactions();
        
        // Calculate dates (last 30 days in Jakarta timezone)
        const now = new Date();
        const { getStartOfJakartaDay: getJakartaToday, getStartOfJakartaDayAgo } = require("./helpers");
        const thirtyDaysAgo = getStartOfJakartaDayAgo(30);
        
        // Today and start of month in Jakarta timezone
        const startOfToday = getJakartaToday();
        const jakartaYear = parseInt(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric" }).format(now));
        const jakartaMonth = parseInt(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", month: "2-digit" }).format(now));
        const firstOfMonth = new Date(`${jakartaYear}-${String(jakartaMonth).padStart(2, '0')}-01T00:00:00+07:00`);

        // Fetch recent transactions (last 30 days)
        const recentData = await transactions.find({
            createdAt: { $gte: thirtyDaysAgo }
        }).toArray();

        // Calculate KPI values
        const todayData = await transactions.find({ createdAt: { $gte: startOfToday } }).toArray();
        const thisMonthData = await transactions.find({ createdAt: { $gte: firstOfMonth } }).toArray();

        const todayExpense = todayData.filter(t => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
        const thisMonthExpense = thisMonthData.filter(t => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
        const thisMonthIncome = thisMonthData.filter(t => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
        
        // Calculate total transactions & active users
        const totalTxCount = await transactions.countDocuments();
        const uniqueUsersList = await transactions.distinct("userId");

        // Calculate daily expenses & income for graph (last 30 days) using Jakarta dates
        const dailyMap = {};
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setUTCDate(d.getUTCDate() - i);
            const dateStr = toJakartaDateStr(d); // YYYY-MM-DD in Jakarta time
            dailyMap[dateStr] = { date: dateStr, expense: 0, income: 0 };
        }

        recentData.forEach(t => {
            if (!t.createdAt) return;
            const dateStr = toJakartaDateStr(new Date(t.createdAt));
            if (dailyMap[dateStr]) {
                if (t.type === "expense") {
                    dailyMap[dateStr].expense += t.amount;
                } else if (t.type === "income") {
                    dailyMap[dateStr].income += t.amount;
                }
            }
        });

        const dailyStats = Object.values(dailyMap);

        // Calculate category breakdown
        const categoryMap = {};
        recentData.forEach(t => {
            if (t.type === "expense") {
                const cat = t.category || "other";
                categoryMap[cat] = (categoryMap[cat] || 0) + t.amount;
            }
        });

        const categoryStats = Object.keys(categoryMap).map(cat => ({
            category: cat,
            amount: categoryMap[cat]
        })).sort((a, b) => b.amount - a.amount);

        // Get recent individual expense items ordered by date descending (last 30 days)
        const itemStats = recentData
            .filter(t => t.type === "expense" && t.createdAt)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map(t => ({
                item: t.item || "Unknown",
                amount: t.amount,
                date: t.createdAt
            }));

        return res.json({
            kpi: {
                todayExpense,
                thisMonthExpense,
                thisMonthIncome,
                totalTransactions: totalTxCount,
                activeUsers: uniqueUsersList.length
            },
            dailyStats,
            categoryStats,
            itemStats
        });
    } catch (err) {
        console.error("Failed to calculate stats:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// 6. Quick AI Parser Endpoint
router.post("/transactions/parse", authMiddleware, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: "Text is required" });
        }
        
        const parsed = await parseTransaction(text);
        return res.json({ parsed });
    } catch (err) {
        console.error("AI parse failed:", err);
        return res.status(500).json({ error: "Failed to parse text via Gemini AI" });
    }
});

// 7. Add new transaction
router.post("/transactions", authMiddleware, async (req, res) => {
    try {
        const transactions = getTransactions();
        const { item, amount, category, type = "expense", createdAt, userId, username } = req.body;

        if (!item || isNaN(parseFloat(amount))) {
            return res.status(400).json({ error: "Item name and valid amount are required" });
        }

        const newDoc = {
            userId: userId ? parseInt(userId) : (process.env.AUTHORIZED_USER_ID ? parseInt(process.env.AUTHORIZED_USER_ID) : 0),
            username: username || "imanstwn",
            type,
            item,
            amount: parseFloat(amount),
            category: category || "manual",
            createdAt: createdAt ? new Date(createdAt) : new Date()
        };

        const result = await transactions.insertOne(newDoc);
        return res.status(201).json({ success: true, transaction: { ...newDoc, _id: result.insertedId } });
    } catch (err) {
        console.error("Failed to create transaction:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// 8. Update transaction
router.put("/transactions/:id", authMiddleware, async (req, res) => {
    try {
        const transactions = getTransactions();
        const { id } = req.params;
        const { item, amount, category, type, createdAt, userId, username } = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid transaction ID" });
        }

        const updateData = {};
        if (item !== undefined) updateData.item = item;
        if (amount !== undefined) updateData.amount = parseFloat(amount) || 0;
        if (category !== undefined) updateData.category = category;
        if (type !== undefined) updateData.type = type;
        if (createdAt !== undefined) updateData.createdAt = new Date(createdAt);
        if (userId !== undefined) updateData.userId = parseInt(userId) || 0;
        if (username !== undefined) updateData.username = username;

        const result = await transactions.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: "Transaction not found" });
        }

        return res.json({ success: true });
    } catch (err) {
        console.error("Failed to update transaction:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// 9. Delete transaction
router.delete("/transactions/:id", authMiddleware, async (req, res) => {
    try {
        const transactions = getTransactions();
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid transaction ID" });
        }

        const result = await transactions.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Transaction not found" });
        }

        return res.json({ success: true });
    } catch (err) {
        console.error("Failed to delete transaction:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// 10. Get top 10 most expensive transactions
router.get("/transactions/top", authMiddleware, async (req, res) => {
    try {
        const transactions = getTransactions();
        const query = { type: "expense" };
        if (process.env.AUTHORIZED_USER_ID) {
            const parsedId = parseInt(process.env.AUTHORIZED_USER_ID);
            if (!isNaN(parsedId)) {
                query.$or = [{ userId: parsedId }, { userId: process.env.AUTHORIZED_USER_ID }];
            } else {
                query.userId = process.env.AUTHORIZED_USER_ID;
            }
        }
        const topExpenses = await transactions.find(query)
            .sort({ amount: -1 })
            .limit(10)
            .toArray();
        return res.json(topExpenses);
    } catch (err) {
        console.error("Failed to fetch top transactions:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// ==========================================
// Food Routes (All Data Dump)
// ==========================================

router.get("/food/logs", authMiddleware, async (req, res) => {
    try {
        const foodLogs = getFoodLogs();
        // Return all logs
        const logs = await foodLogs.find({}).sort({ createdAt: -1 }).toArray();
        return res.json(logs);
    } catch (err) {
        console.error("Failed to fetch all food logs:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post("/food/logs", authMiddleware, async (req, res) => {
    try {
        const foodLogs = getFoodLogs();
        const { foodName, category, userId } = req.body;
        
        const newLog = {
            userId: userId || parseInt(process.env.AUTHORIZED_USER_ID),
            foodName,
            category,
            createdAt: new Date()
        };
        
        await foodLogs.insertOne(newLog);
        return res.status(201).json({ success: true });
    } catch (err) {
        console.error("Failed to add food log:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// ==========================================
// Stories Routes (Diary Entries)
// ==========================================

// 1. List all stories (newest first)
router.get("/stories", authMiddleware, async (req, res) => {
    try {
        const stories = getStories();
        const { limit } = req.query;

        let cursor = stories.find({}).sort({ createdAt: -1 });

        if (limit) {
            const parsedLimit = parseInt(limit);
            if (!isNaN(parsedLimit) && parsedLimit > 0) {
                cursor = cursor.limit(parsedLimit);
            }
        }

        const results = await cursor.toArray();

        const mappedResults = results.map(s => {
            if (!s.username && s.userId && s.userId.toString() === process.env.AUTHORIZED_USER_ID) {
                s.username = "imanstwn";
            }
            return s;
        });

        return res.json({ stories: mappedResults, total: mappedResults.length });
    } catch (err) {
        console.error("Failed to fetch stories:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// 2. Add new story
router.post("/stories", authMiddleware, async (req, res) => {
    try {
        const stories = getStories();
        const { title, content, aiContent, mood, userId, username, createdAt } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ error: "Story content is required" });
        }

        const newStory = {
            userId: userId ? parseInt(userId) : (process.env.AUTHORIZED_USER_ID ? parseInt(process.env.AUTHORIZED_USER_ID) : 0),
            username: username || "imanstwn",
            title: title ? String(title).trim() : "",
            content: String(content).trim(),
            aiContent: aiContent ? String(aiContent).trim() : "",
            mood: mood || "",
            createdAt: createdAt ? new Date(createdAt) : new Date()
        };

        if (isNaN(newStory.createdAt.getTime())) {
            newStory.createdAt = new Date();
        }

        const result = await stories.insertOne(newStory);
        return res.status(201).json({ success: true, story: { ...newStory, _id: result.insertedId } });
    } catch (err) {
        console.error("Failed to create story:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// 3. Update story
router.put("/stories/:id", authMiddleware, async (req, res) => {
    try {
        const stories = getStories();
        const { id } = req.params;
        const { title, content, aiContent, mood, createdAt } = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid story ID" });
        }

        const updateData = {};
        if (title !== undefined) updateData.title = String(title).trim();
        if (content !== undefined) updateData.content = String(content).trim();
        if (aiContent !== undefined) updateData.aiContent = String(aiContent).trim();
        if (mood !== undefined) updateData.mood = mood;
        if (createdAt !== undefined) {
            const parsedDate = new Date(createdAt);
            if (!isNaN(parsedDate.getTime())) {
                updateData.createdAt = parsedDate;
            }
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: "No fields to update" });
        }

        const result = await stories.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: "Story not found" });
        }

        return res.json({ success: true });
    } catch (err) {
        console.error("Failed to update story:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// 4. Delete story
router.delete("/stories/:id", authMiddleware, async (req, res) => {
    try {
        const stories = getStories();
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid story ID" });
        }

        const result = await stories.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Story not found" });
        }

        return res.json({ success: true });
    } catch (err) {
        console.error("Failed to delete story:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// 5. AI Prettify / Format Story
router.post("/stories/prettify", authMiddleware, async (req, res) => {
    try {
        const { content } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({ error: "Story content is required" });
        }

        const { prettifyStory } = require("./ai");
        const prettified = await prettifyStory(content);
        return res.json({ success: true, prettified });
    } catch (err) {
        console.error("Failed to prettify story via AI:", err);
        return res.status(500).json({ error: "Failed to format story via AI" });
    }
});

// Setup function to initialize Express server
function initWebServer(app) {
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Serve static files from public directory
    app.use(express.static(path.join(__dirname, "../public")));
    
    // API Router
    app.use("/api", router);
}

module.exports = { initWebServer };
