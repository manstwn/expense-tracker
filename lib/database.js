const { MongoClient } = require("mongodb");

let db;
let transactions;
let foodLogs;

async function connectDB() {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    
    db = client.db(process.env.MONGODB_DB_NAME);
    transactions = db.collection("transactions");
    foodLogs = db.collection("food_logs");

    await transactions.createIndex({ userId: 1 });
    await transactions.createIndex({ createdAt: 1 });
    await foodLogs.createIndex({ userId: 1 });
    await foodLogs.createIndex({ createdAt: 1 });

    return { db, transactions, foodLogs };
}

function getTransactions() {
    return transactions;
}

function getFoodLogs() {
    return foodLogs;
}

module.exports = { connectDB, getTransactions, getFoodLogs };
