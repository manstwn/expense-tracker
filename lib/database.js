const { MongoClient } = require("mongodb");

let db;
let transactions;

async function connectDB() {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    
    db = client.db(process.env.MONGODB_DB_NAME);
    transactions = db.collection("transactions");

    await transactions.createIndex({ userId: 1 });
    await transactions.createIndex({ createdAt: 1 });

    return { db, transactions };
}

function getTransactions() {
    return transactions;
}

module.exports = { connectDB, getTransactions };
