const express = require("express");
const path = require("path");
const crypto = require("crypto");
const axios = require("axios");
const { ObjectId } = require("mongodb");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const { rateLimit } = require("express-rate-limit");

const {
    getDb,
    getTransactions,
    getFoodLogs,
    getStories,
    getSessions
} = require("./database");
const { parseTransaction, prettifyStory } = require("./ai");
const {
    totalAmount,
    getJakartaNow,
    toJakartaDateStr,
    getStartOfJakartaDay,
    getStartOfJakartaDayAgo,
    getStartOfJakartaMonth,
    getStartOfNextJakartaMonth
} = require("./helpers");
const {
    isProd,
    ownerId,
    ownerUsername,
    iotToken
} = require("./config");
const {
    SESSION_TTL_MS,
    safeEqualString,
    verifyPin,
    createSessionToken,
    verifySessionToken
} = require("./auth");
const {
    isType,
    parseRequiredString,
    parseOptionalString,
    parseMoney,
    parseDate,
    parseDayRange,
    parseIntInRange,
    escapeRegex
} = require("./validate");
const logger = require("./logger");

const router = express.Router();

const SESSION_COOKIE = "session";
const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 25;
const MAX_STORY_LENGTH = 20000;
const MAX_STORIES_PER_DAY = 30;
const IOT_DATA_TTL = 30000;
const PRICE_TTL = 60000;

const AMOUNT = {
    $convert: { input: "$amount", to: "double", onError: 0, onNull: 0 }
};

const cookieOptions = {
    httpOnly: true,
    sameSite: "strict",
    secure: isProd,
    maxAge: SESSION_TTL_MS,
    path: "/"
};

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: "Too many login attempts. Try again later." }
});

const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many AI requests. Try again later." }
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many requests. Try again later." }
});

const iotLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many IoT requests. Try again later." }
});

function checkOrigin(req, res, next) {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

    const origin = req.get("origin");
    if (!origin) return next();

    try {
        if (new URL(origin).host === req.get("host")) return next();
    } catch {
        // Invalid Origin falls through to the rejection below.
    }

    return res.status(403).json({ error: "Invalid request origin" });
}

async function authMiddleware(req, res, next) {
    try {
        const bearer = req.get("authorization");
        const token = req.cookies?.[SESSION_COOKIE]
            || (bearer && bearer.startsWith("Bearer ") ? bearer.slice(7) : null);

        const payload = verifySessionToken(token);
        if (!payload) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const session = await getSessions().findOne({
            sid: payload.sid,
            revokedAt: null,
            expiresAt: { $gt: new Date() }
        });

        if (!session) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        req.session = session;
        return next();
    } catch (err) {
        return next(err);
    }
}

function buildTransaction(raw) {
    if (!raw || typeof raw !== "object") return null;

    const item = parseRequiredString(raw.item, 120);
    const amount = parseMoney(raw.amount);
    const type = raw.type === undefined ? "expense" : raw.type;
    const category = raw.category === undefined || raw.category === ""
        ? "manual"
        : parseOptionalString(raw.category, 60);
    const createdAt = parseDate(raw.createdAt);

    if (!item || amount === null || !isType(type) || category === null || !createdAt) {
        return null;
    }

    return {
        userId: ownerId,
        username: ownerUsername,
        type,
        item,
        amount,
        category,
        createdAt
    };
}

function totalForType(rows, type) {
    return rows
        .filter((row) => row._id === type)
        .reduce((sum, row) => sum + Number(row.total || 0), 0);
}

function paginate(total, page, pageSize) {
    return {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize)
    };
}

// ==========================================
// Authentication
// ==========================================

router.post("/login", loginLimiter, async (req, res, next) => {
    try {
        const { pin } = req.body || {};
        if (pin === undefined || pin === null || pin === "") {
            return res.status(400).json({ error: "PIN is required" });
        }
        if (!verifyPin(pin)) {
            return res.status(401).json({ error: "Invalid PIN" });
        }

        const sid = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

        await getSessions().insertOne({
            sid,
            createdAt: new Date(),
            expiresAt,
            revokedAt: null
        });

        res.cookie(SESSION_COOKIE, createSessionToken(sid), cookieOptions);
        return res.json({ success: true, expiresAt });
    } catch (err) {
        return next(err);
    }
});

router.post("/logout", async (req, res, next) => {
    try {
        const token = req.cookies?.[SESSION_COOKIE];
        const payload = verifySessionToken(token);

        if (payload) {
            await getSessions().updateOne(
                { sid: payload.sid },
                { $set: { revokedAt: new Date() } }
            );
        }

        res.clearCookie(SESSION_COOKIE, { path: "/" });
        return res.json({ success: true });
    } catch (err) {
        return next(err);
    }
});

router.get("/verify", authMiddleware, (req, res) => {
    return res.json({ valid: true, expiresAt: req.session.expiresAt });
});

// ==========================================
// Transactions
// ==========================================

router.get("/transactions", authMiddleware, async (req, res, next) => {
    try {
        const page = parseIntInRange(req.query.page, 1, 1, 1000000);
        const pageSize = parseIntInRange(req.query.pageSize, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
        if (page === null || pageSize === null) {
            return res.status(400).json({ error: "Invalid pagination parameters" });
        }

        const search = parseOptionalString(req.query.search, 120);
        if (search === null) {
            return res.status(400).json({ error: "Invalid search value" });
        }

        const query = { userId: ownerId };

        if (search) {
            const pattern = escapeRegex(search);
            query.$or = [
                { item: { $regex: pattern, $options: "i" } },
                { category: { $regex: pattern, $options: "i" } }
            ];
        }

        if (req.query.date) {
            const range = parseDayRange(req.query.date);
            if (!range) {
                return res.status(400).json({ error: "date must be YYYY-MM-DD" });
            }
            query.createdAt = range;
        }

        const sortField = ["createdAt", "amount", "item", "category", "type"].includes(req.query.sort)
            ? req.query.sort
            : "createdAt";
        const sortOrder = req.query.order === "asc" ? 1 : -1;

        const collection = getTransactions();
        const [transactions, total] = await Promise.all([
            collection.find(query)
                .sort({ [sortField]: sortOrder })
                .skip((page - 1) * pageSize)
                .limit(pageSize)
                .toArray(),
            collection.countDocuments(query)
        ]);

        return res.json({
            transactions,
            ...paginate(total, page, pageSize)
        });
    } catch (err) {
        return next(err);
    }
});

router.get("/transactions/top", authMiddleware, async (req, res, next) => {
    try {
        const limit = parseIntInRange(req.query.limit, 20, 1, 100);
        if (limit === null) {
            return res.status(400).json({ error: "Invalid limit" });
        }

        const topExpenses = await getTransactions()
            .find({ userId: ownerId, type: "expense" })
            .sort({ amount: -1 })
            .limit(limit)
            .toArray();

        return res.json({ transactions: topExpenses });
    } catch (err) {
        return next(err);
    }
});

router.post("/transactions/parse", authMiddleware, aiLimiter, async (req, res) => {
    try {
        const text = parseRequiredString(req.body?.text, 2000);
        if (!text) {
            return res.status(400).json({ error: "Text is required (max 2,000 characters)" });
        }

        const parsed = await parseTransaction(text);
        if (parsed.length === 0) {
            return res.status(422).json({ error: "No transactions detected" });
        }

        return res.json({ parsed });
    } catch (err) {
        logger.error("AI parse failed", { requestId: req.id, error: err.message });
        return res.status(502).json({ error: "Failed to parse text via AI", requestId: req.id });
    }
});

router.post("/transactions/bulk", authMiddleware, async (req, res, next) => {
    try {
        const input = req.body?.transactions;
        if (!Array.isArray(input) || input.length === 0 || input.length > 100) {
            return res.status(400).json({ error: "transactions must be an array of 1-100 items" });
        }

        const valid = [];
        const failed = [];
        input.forEach((item, index) => {
            const transaction = buildTransaction(item);
            if (transaction) valid.push(transaction);
            else failed.push({ index, error: "Invalid transaction" });
        });

        if (valid.length === 0) {
            return res.status(400).json({ error: "No valid transactions", failed });
        }

        const result = await getTransactions().insertMany(valid, { ordered: false });
        return res.status(201).json({
            success: true,
            inserted: result.insertedCount,
            failed
        });
    } catch (err) {
        return next(err);
    }
});

router.post("/transactions", authMiddleware, async (req, res, next) => {
    try {
        const transaction = buildTransaction(req.body);
        if (!transaction) {
            return res.status(400).json({ error: "Invalid transaction payload" });
        }

        const result = await getTransactions().insertOne(transaction);
        return res.status(201).json({
            success: true,
            transaction: { ...transaction, _id: result.insertedId }
        });
    } catch (err) {
        return next(err);
    }
});

router.put("/transactions/:id", authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid transaction ID" });
        }

        const body = req.body || {};
        const updateData = {};

        if (body.item !== undefined) {
            const item = parseRequiredString(body.item, 120);
            if (!item) return res.status(400).json({ error: "Invalid item" });
            updateData.item = item;
        }

        if (body.amount !== undefined) {
            const amount = parseMoney(body.amount);
            if (amount === null) return res.status(400).json({ error: "Invalid amount" });
            updateData.amount = amount;
        }

        if (body.category !== undefined) {
            const category = body.category === ""
                ? "manual"
                : parseOptionalString(body.category, 60);
            if (category === null) return res.status(400).json({ error: "Invalid category" });
            updateData.category = category;
        }

        if (body.type !== undefined) {
            if (!isType(body.type)) return res.status(400).json({ error: "Invalid type" });
            updateData.type = body.type;
        }

        if (body.createdAt !== undefined) {
            const createdAt = parseDate(body.createdAt, null);
            if (!createdAt) return res.status(400).json({ error: "Invalid date" });
            updateData.createdAt = createdAt;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: "No fields to update" });
        }

        const result = await getTransactions().updateOne(
            { _id: new ObjectId(id), userId: ownerId },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: "Transaction not found" });
        }

        return res.json({ success: true });
    } catch (err) {
        return next(err);
    }
});

router.delete("/transactions/:id", authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid transaction ID" });
        }

        const result = await getTransactions().deleteOne({
            _id: new ObjectId(id),
            userId: ownerId
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Transaction not found" });
        }

        return res.json({ success: true });
    } catch (err) {
        return next(err);
    }
});

// ==========================================
// Statistics and calendar
// ==========================================

router.get("/stats", authMiddleware, async (req, res, next) => {
    try {
        const startOfToday = getStartOfJakartaDay();
        const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
        const startOfMonth = getStartOfJakartaMonth();
        const startOfNextMonth = getStartOfNextJakartaMonth();
        const thirtyDaysAgo = getStartOfJakartaDayAgo(29);

        const [result] = await getTransactions().aggregate([
            { $match: { userId: ownerId } },
            {
                $facet: {
                    today: [
                        { $match: { createdAt: { $gte: startOfToday, $lt: startOfTomorrow } } },
                        { $group: { _id: "$type", total: { $sum: AMOUNT } } }
                    ],
                    month: [
                        { $match: { createdAt: { $gte: startOfMonth, $lt: startOfNextMonth } } },
                        { $group: { _id: "$type", total: { $sum: AMOUNT } } }
                    ],
                    daily: [
                        { $match: { createdAt: { $gte: thirtyDaysAgo, $lt: startOfTomorrow } } },
                        {
                            $group: {
                                _id: {
                                    $dateToString: {
                                        format: "%Y-%m-%d",
                                        date: "$createdAt",
                                        timezone: "Asia/Jakarta"
                                    }
                                },
                                expense: {
                                    $sum: {
                                        $cond: [{ $eq: ["$type", "expense"] }, AMOUNT, 0]
                                    }
                                },
                                income: {
                                    $sum: {
                                        $cond: [{ $eq: ["$type", "income"] }, AMOUNT, 0]
                                    }
                                }
                            }
                        }
                    ],
                    categories: [
                        {
                            $match: {
                                createdAt: { $gte: thirtyDaysAgo, $lt: startOfTomorrow },
                                type: "expense"
                            }
                        },
                        {
                            $group: {
                                _id: { $ifNull: ["$category", "other"] },
                                amount: { $sum: AMOUNT }
                            }
                        },
                        { $sort: { amount: -1 } }
                    ],
                    topItems: [
                        {
                            $match: {
                                createdAt: { $gte: thirtyDaysAgo, $lt: startOfTomorrow },
                                type: "expense"
                            }
                        },
                        { $addFields: { amountValue: AMOUNT } },
                        { $sort: { amountValue: -1 } },
                        { $limit: 50 },
                        {
                            $project: {
                                _id: 0,
                                item: 1,
                                amount: "$amountValue",
                                date: "$createdAt"
                            }
                        }
                    ],
                    expense30d: [
                        {
                            $match: {
                                createdAt: { $gte: thirtyDaysAgo, $lt: startOfTomorrow },
                                type: "expense"
                            }
                        },
                        { $group: { _id: null, total: { $sum: AMOUNT }, count: { $sum: 1 } } }
                    ],
                    total: [{ $count: "count" }]
                }
            }
        ]).toArray();

        const dailyMap = {};
        for (let i = 29; i >= 0; i -= 1) {
            const dateStr = toJakartaDateStr(new Date(Date.now() - i * 24 * 60 * 60 * 1000));
            dailyMap[dateStr] = { date: dateStr, expense: 0, income: 0 };
        }
        for (const row of result.daily || []) {
            if (dailyMap[row._id]) {
                dailyMap[row._id].expense = Number(row.expense || 0);
                dailyMap[row._id].income = Number(row.income || 0);
            }
        }

        const expense30d = (result.expense30d || [])[0] || { total: 0, count: 0 };
        const avgExpenseTransaction = expense30d.count > 0
            ? Math.round(Number(expense30d.total) / expense30d.count)
            : 0;

        return res.json({
            kpi: {
                todayExpense: totalForType(result.today || [], "expense"),
                thisMonthExpense: totalForType(result.month || [], "expense"),
                thisMonthIncome: totalForType(result.month || [], "income"),
                totalTransactions: (result.total || [])[0]?.count || 0,
                activeUsers: 1,
                avgExpenseTransaction
            },
            dailyStats: Object.values(dailyMap),
            categoryStats: (result.categories || []).map((row) => ({
                category: row._id,
                amount: Number(row.amount || 0)
            })),
            itemStats: result.topItems || []
        });
    } catch (err) {
        return next(err);
    }
});

router.get("/calendar", authMiddleware, async (req, res, next) => {
    try {
        const year = Number(req.query.year);
        const month = Number(req.query.month);
        if (!Number.isInteger(year) || year < 2000 || year > 2100
            || !Number.isInteger(month) || month < 1 || month > 12) {
            return res.status(400).json({ error: "year and month are required" });
        }

        const pad = (value) => String(value).padStart(2, "0");
        const start = new Date(`${year}-${pad(month)}-01T00:00:00+07:00`);
        const nextYear = month === 12 ? year + 1 : year;
        const nextMonth = month === 12 ? 1 : month + 1;
        const end = new Date(`${nextYear}-${pad(nextMonth)}-01T00:00:00+07:00`);

        const includeDetail = req.query.detail !== "0";

        const dayGroup = {
            _id: {
                $dateToString: {
                    format: "%Y-%m-%d",
                    date: "$createdAt",
                    timezone: "Asia/Jakarta"
                }
            },
            total: { $sum: AMOUNT }
        };

        const dayProject = {
            _id: 0,
            date: "$_id",
            total: 1
        };

        if (includeDetail) {
            dayGroup.items = {
                $push: {
                    item: "$item",
                    amount: AMOUNT,
                    category: "$category",
                    type: "$type",
                    createdAt: "$createdAt"
                }
            };
            dayProject.items = { $slice: ["$items", 100] };
        }

        const [days, storyRows] = await Promise.all([
            getTransactions().aggregate([
                {
                    $match: {
                        userId: ownerId,
                        type: "expense",
                        createdAt: { $gte: start, $lt: end }
                    }
                },
                { $group: dayGroup },
                { $project: dayProject }
            ]).toArray(),
            getStories().aggregate([
                { $match: { userId: ownerId, createdAt: { $gte: start, $lt: end } } },
                { $sort: { createdAt: -1 } },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: "%Y-%m-%d",
                                date: "$createdAt",
                                timezone: "Asia/Jakarta"
                            }
                        },
                        stories: {
                            $push: {
                                _id: "$_id",
                                title: "$title",
                                mood: "$mood",
                                content: "$content",
                                aiContent: "$aiContent",
                                createdAt: "$createdAt"
                            }
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        date: "$_id",
                        stories: { $slice: ["$stories", MAX_STORIES_PER_DAY] }
                    }
                }
            ]).toArray()
        ]);

        const storyMap = {};
        for (const row of storyRows) {
            storyMap[row.date] = row.stories;
        }

        return res.json({
            days,
            stories: storyMap,
            monthTotal: days.reduce((sum, day) => sum + Number(day.total || 0), 0)
        });
    } catch (err) {
        return next(err);
    }
});

// ==========================================
// Food logs
// ==========================================

router.get("/food/logs", authMiddleware, async (req, res, next) => {
    try {
        const page = parseIntInRange(req.query.page, 1, 1, 1000000);
        const pageSize = parseIntInRange(req.query.pageSize, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
        if (page === null || pageSize === null) {
            return res.status(400).json({ error: "Invalid pagination parameters" });
        }

        const collection = getFoodLogs();
        const query = { userId: ownerId };
        const [logs, total] = await Promise.all([
            collection.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * pageSize)
                .limit(pageSize)
                .toArray(),
            collection.countDocuments(query)
        ]);

        return res.json({
            logs,
            ...paginate(total, page, pageSize)
        });
    } catch (err) {
        return next(err);
    }
});

router.post("/food/logs", authMiddleware, async (req, res, next) => {
    try {
        const foodName = parseRequiredString(req.body?.foodName, 120);
        const category = parseRequiredString(req.body?.category, 60);
        if (!foodName || !category) {
            return res.status(400).json({ error: "foodName and category are required" });
        }

        await getFoodLogs().insertOne({
            userId: ownerId,
            username: ownerUsername,
            foodName,
            category,
            createdAt: new Date()
        });

        return res.status(201).json({ success: true });
    } catch (err) {
        return next(err);
    }
});

// ==========================================
// Stories
// ==========================================

const MOODS = new Set(["", "😊", "😌", "😢", "😴", "🔥", "🤯"]);

router.get("/stories", authMiddleware, async (req, res, next) => {
    try {
        const page = parseIntInRange(req.query.page, 1, 1, 1000000);
        const pageSize = parseIntInRange(req.query.pageSize, 24, 1, MAX_PAGE_SIZE);
        if (page === null || pageSize === null) {
            return res.status(400).json({ error: "Invalid pagination parameters" });
        }

        const collection = getStories();
        const query = { userId: ownerId };
        const [stories, total] = await Promise.all([
            collection.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * pageSize)
                .limit(pageSize)
                .toArray(),
            collection.countDocuments(query)
        ]);

        return res.json({
            stories,
            ...paginate(total, page, pageSize)
        });
    } catch (err) {
        return next(err);
    }
});

router.post("/stories", authMiddleware, async (req, res, next) => {
    try {
        const title = parseOptionalString(req.body?.title, 200);
        const content = parseRequiredString(req.body?.content, MAX_STORY_LENGTH);
        const aiContent = parseOptionalString(req.body?.aiContent, MAX_STORY_LENGTH);
        const mood = parseOptionalString(req.body?.mood, 8);
        const createdAt = parseDate(req.body?.createdAt);

        if (title === null || !content || aiContent === null || mood === null
            || !MOODS.has(mood) || !createdAt) {
            return res.status(400).json({ error: "Invalid story payload" });
        }

        const newStory = {
            userId: ownerId,
            username: ownerUsername,
            title,
            content,
            aiContent,
            mood,
            createdAt
        };

        const result = await getStories().insertOne(newStory);
        return res.status(201).json({
            success: true,
            story: { ...newStory, _id: result.insertedId }
        });
    } catch (err) {
        return next(err);
    }
});

router.put("/stories/:id", authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid story ID" });
        }

        const body = req.body || {};
        const updateData = {};

        if (body.title !== undefined) {
            const title = parseOptionalString(body.title, 200);
            if (title === null) return res.status(400).json({ error: "Invalid title" });
            updateData.title = title;
        }

        if (body.content !== undefined) {
            const content = parseRequiredString(body.content, MAX_STORY_LENGTH);
            if (!content) return res.status(400).json({ error: "Invalid content" });
            updateData.content = content;
        }

        if (body.aiContent !== undefined) {
            const aiContent = parseOptionalString(body.aiContent, MAX_STORY_LENGTH);
            if (aiContent === null) return res.status(400).json({ error: "Invalid AI content" });
            updateData.aiContent = aiContent;
        }

        if (body.mood !== undefined) {
            const mood = parseOptionalString(body.mood, 8);
            if (mood === null || !MOODS.has(mood)) {
                return res.status(400).json({ error: "Invalid mood" });
            }
            updateData.mood = mood;
        }

        if (body.createdAt !== undefined) {
            const createdAt = parseDate(body.createdAt, null);
            if (!createdAt) return res.status(400).json({ error: "Invalid date" });
            updateData.createdAt = createdAt;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: "No fields to update" });
        }

        const result = await getStories().updateOne(
            { _id: new ObjectId(id), userId: ownerId },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: "Story not found" });
        }

        return res.json({ success: true });
    } catch (err) {
        return next(err);
    }
});

router.delete("/stories/:id", authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid story ID" });
        }

        const result = await getStories().deleteOne({
            _id: new ObjectId(id),
            userId: ownerId
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Story not found" });
        }

        return res.json({ success: true });
    } catch (err) {
        return next(err);
    }
});

router.post("/stories/prettify", authMiddleware, aiLimiter, async (req, res) => {
    try {
        const content = parseRequiredString(req.body?.content, MAX_STORY_LENGTH);
        if (!content) {
            return res.status(400).json({
                error: `Story content is required (max ${MAX_STORY_LENGTH} characters)`
            });
        }

        const prettified = await prettifyStory(content);
        return res.json({ success: true, prettified });
    } catch (err) {
        logger.error("Story prettify failed", { requestId: req.id, error: err.message });
        return res.status(502).json({
            error: "AI formatting failed",
            requestId: req.id
        });
    }
});

// ==========================================
// IoT endpoint
// ==========================================

let priceCache = { btc: "0", idr: "0", lastFetch: 0 };
let iotDataCache = { data: null, lastFetch: 0 };

async function fetchBtcPrice() {
    try {
        const response = await axios.get("https://api.coinbase.com/v2/prices/spot?currency=USD", {
            timeout: 4000
        });
        const value = Number(response.data?.data?.amount);
        if (Number.isFinite(value)) return value;
    } catch {
        // Fall through to the secondary provider.
    }

    const response = await axios.get("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT", {
        timeout: 4000
    });
    const value = Number(response.data?.price);
    if (!Number.isFinite(value)) {
        throw new Error("Invalid BTC price");
    }
    return value;
}

async function refreshPrices() {
    if (Date.now() - priceCache.lastFetch < PRICE_TTL) return;

    try {
        const [btcValue, idrResponse] = await Promise.all([
            fetchBtcPrice(),
            axios.get("https://open.er-api.com/v6/latest/USD", { timeout: 5000 })
        ]);
        const idrValue = Number(idrResponse.data?.rates?.IDR);

        if (!Number.isFinite(btcValue) || !Number.isFinite(idrValue)) {
            throw new Error("Invalid price response");
        }

        priceCache.btc = Math.floor(btcValue).toLocaleString("de-DE");
        priceCache.idr = Math.floor(idrValue).toLocaleString("de-DE");
    } catch (err) {
        logger.warn("Price refresh failed", { error: err.message });
    } finally {
        priceCache.lastFetch = Date.now();
    }
}

async function getIotData() {
    if (iotDataCache.data && Date.now() - iotDataCache.lastFetch < IOT_DATA_TTL) {
        return iotDataCache.data;
    }

    await refreshPrices();

    const jkt = getJakartaNow();
    const datetime = `${jkt.day}.${jkt.month} ${jkt.hour}.${jkt.minute}`;
    const startOfToday = getStartOfJakartaDay();
    const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

    const todayData = await getTransactions().find({
        userId: ownerId,
        type: "expense",
        createdAt: { $gte: startOfToday, $lt: startOfTomorrow }
    }).toArray();

    const expensesFormatted = Math.floor(totalAmount(todayData)).toLocaleString("de-DE");

    const data = {
        btc: priceCache.btc,
        idr: priceCache.idr,
        datetime,
        expenses: expensesFormatted,
        display: [priceCache.btc, priceCache.idr, datetime, expensesFormatted]
    };

    iotDataCache = { data, lastFetch: Date.now() };
    return data;
}

function iotAuth(req, res, next) {
    if (!iotToken) {
        return res.status(503).json({ error: "IoT endpoint is disabled" });
    }

    const provided = req.get("x-iot-token")
        || (typeof req.query.token === "string" ? req.query.token : "");

    if (!provided || !safeEqualString(provided, iotToken)) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    return next();
}

async function handleIotRequest(req, res, next) {
    try {
        const data = await getIotData();
        res.setHeader("Cache-Control", "public, max-age=30");
        return res.json(data);
    } catch (err) {
        return next(err);
    }
}

// ==========================================
// Server setup
// ==========================================

function initWebServer(app) {
    if (isProd) {
        app.set("trust proxy", 1);
    }

    app.use(helmet({
        contentSecurityPolicy: {
            useDefaults: false,
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
                scriptSrcAttr: ["'none'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                imgSrc: ["'self'", "data:"],
                connectSrc: ["'self'"],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                frameAncestors: ["'none'"]
            }
        },
        strictTransportSecurity: isProd,
        crossOriginEmbedderPolicy: false
    }));
    app.use(compression());
    app.use(cookieParser());

    app.use((req, res, next) => {
        req.id = crypto.randomUUID();
        res.setHeader("X-Request-Id", req.id);

        const startedAt = Date.now();
        const requestPath = req.originalUrl.split("?")[0];
        res.on("finish", () => {
            logger.info("request", {
                requestId: req.id,
                method: req.method,
                path: requestPath,
                status: res.statusCode,
                durationMs: Date.now() - startedAt
            });
        });

        next();
    });

    const jsonParser = express.json({ limit: "32kb" });
    const storyJsonParser = express.json({ limit: "256kb" });

    app.use((req, res, next) => {
        const parser = req.path.startsWith("/api/stories") ? storyJsonParser : jsonParser;
        parser(req, res, next);
    });

    app.use(express.urlencoded({ extended: true, limit: "32kb" }));

    app.use(express.static(path.join(__dirname, "../public"), {
        maxAge: "1h",
        setHeaders(res, filePath) {
            if (filePath.endsWith(".html")) {
                res.setHeader("Cache-Control", "no-cache");
            }
        }
    }));

    app.get("/healthz", async (req, res) => {
        try {
            await getDb().command({ ping: 1 });
            return res.json({ ok: true, uptime: process.uptime() });
        } catch {
            return res.status(503).json({ ok: false });
        }
    });

    app.use("/api", checkOrigin, apiLimiter, router);

    app.get("/iot", iotLimiter, iotAuth, handleIotRequest);

    app.use((req, res) => {
        return res.status(404).json({ error: "Not found" });
    });

    app.use((err, req, res, next) => {
        if (res.headersSent) return next(err);

        if (err.type === "entity.parse.failed") {
            return res.status(400).json({
                error: "Invalid JSON body",
                requestId: req.id
            });
        }

        const status = err.type === "entity.too.large" ? 413 : err.status || 500;
        logger.error("Unhandled request error", {
            requestId: req.id,
            status,
            error: err.message,
            stack: err.stack
        });
        return res.status(status).json({
            error: status === 413 ? "Request body too large" : "Internal server error",
            requestId: req.id
        });
    });
}

module.exports = { initWebServer, handleIotRequest };
