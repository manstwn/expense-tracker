const {
    connectDB,
    closeDB,
    getTransactions,
    getFoodLogs,
    getStories
} = require("../lib/database");
const { ownerId } = require("../lib/config");

const apply = process.argv.includes("--apply");

async function run() {
    await connectDB();

    const collections = [
        ["transactions", getTransactions()],
        ["food_logs", getFoodLogs()],
        ["stories", getStories()]
    ];

    const filter = {
        $or: [
            { userId: { $exists: false } },
            { userId: null },
            { userId: 0 },
            { userId: "0" },
            { userId: NaN },
            { userId: "NaN" },
            { userId: String(ownerId) }
        ]
    };

    for (const [name, collection] of collections) {
        const count = await collection.countDocuments(filter);
        console.log(`${name}: ${count} document(s) need owner normalization`);

        if (apply && count > 0) {
            const result = await collection.updateMany(filter, { $set: { userId: ownerId } });
            console.log(`${name}: updated ${result.modifiedCount} document(s)`);
        }
    }

    if (!apply) {
        console.log("Dry run complete. Re-run with --apply to update the documents.");
    }
}

run()
    .then(async () => {
        await closeDB();
    })
    .catch(async (err) => {
        console.error("Owner normalization failed:", err);
        await closeDB();
        process.exit(1);
    });
