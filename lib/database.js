const { MongoClient } = require("mongodb");

let db;
let transactions;
let foodLogs;
let stories;

async function connectDB() {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    
    db = client.db(process.env.MONGODB_DB_NAME);
    transactions = db.collection("transactions");
    foodLogs = db.collection("food_logs");
    stories = db.collection("stories");

    await transactions.createIndex({ userId: 1 });
    await transactions.createIndex({ createdAt: 1 });
    await foodLogs.createIndex({ userId: 1 });
    await foodLogs.createIndex({ createdAt: 1 });
    await stories.createIndex({ userId: 1 });
    await stories.createIndex({ createdAt: 1 });

    return { db, transactions, foodLogs, stories };
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

module.exports = { connectDB, getTransactions, getFoodLogs, getStories };
