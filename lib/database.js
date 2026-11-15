const { MongoClient } = require("mongodb");
const { mongodbUri, mongodbDbName } = require("./config");

let client;
let db;
let transactions;
let foodLogs;
let stories;
let sessions;

async function connectDB() {
    client = new MongoClient(mongodbUri, {
        serverSelectionTimeoutMS: 10000
    });
    await client.connect();
    await client.db("admin").command({ ping: 1 });

    db = client.db(mongodbDbName);
    transactions = db.collection("transactions");
    foodLogs = db.collection("food_logs");
    stories = db.collection("stories");
    sessions = db.collection("sessions");

    await transactions.createIndex({ userId: 1, createdAt: -1 });
    await transactions.createIndex({ type: 1, amount: -1 });
    await transactions.createIndex({ createdAt: -1 });
    await foodLogs.createIndex({ userId: 1, createdAt: -1 });
    await stories.createIndex({ userId: 1, createdAt: -1 });
    await sessions.createIndex({ sid: 1 }, { unique: true });
    await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    return { db, transactions, foodLogs, stories, sessions };
}

async function closeDB() {
    if (client) {
        await client.close();
        client = null;
    }
}

function getDb() {
    return db;
}

function getTransactions() {
    return transactions;
}

function getFoodLogs() {
    return foodLogs;
}

function getStories() {
    return stories;
}

function getSessions() {
    return sessions;
}

module.exports = {
    connectDB,
    closeDB,
    getDb,
    getTransactions,
    getFoodLogs,
    getStories,
    getSessions
};
