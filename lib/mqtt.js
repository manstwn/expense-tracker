const mqtt = require("mqtt");
const axios = require("axios");
const { totalAmount, getJakartaNow, getStartOfJakartaDay } = require("./helpers");

let mqttClient;

const MQTT_BROKER = process.env.MQTT_BROKER || "mqtt://localhost:1883";
const MQTT_OPTIONS = {
    username: process.env.MQTT_USERNAME || "myuser",
    password: process.env.MQTT_PASSWORD || "mypassword"
};
const MQTT_TOPIC = process.env.MQTT_TOPIC || "home/display";

async function fetchMqttData(transactions) {
    try {
        console.log("Fetching MQTT display data...");

        // 1. BTC Price
        const btcRes = await axios.get("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd");
        
        // 2. IDR Rate
        const idrRes = await axios.get("https://open.er-api.com/v6/latest/USD");

        // 3. Date Time (Jakarta/WIB)
        const jkt = getJakartaNow();
        const day = jkt.day;
        const month = jkt.month;
        const hour = jkt.hour;
        const minute = jkt.minute;

        // 4. Today Expenses (Jakarta Day)
        const today = getStartOfJakartaDay();
        const userId = process.env.AUTHORIZED_USER_ID;
        let todayExpenses = 0;
        if (userId) {
            const todayData = await transactions.find({ 
                userId: parseInt(userId), 
                type: "expense", 
                createdAt: { $gte: today } 
            }).toArray();
            todayExpenses = totalAmount(todayData);
        }

        // Formatting
        const formatPrice = (p) => Math.floor(p).toLocaleString("de-DE");
        const btcPrice = formatPrice(btcRes.data.bitcoin.usd);
        const idrPrice = formatPrice(idrRes.data.rates.IDR);
        const dateTimeFormatted = `${day}.${month}${hour}.${minute}`;
        const expensesFormatted = formatPrice(todayExpenses);

        const payload = JSON.stringify([
            btcPrice,
            idrPrice,
            dateTimeFormatted,
            expensesFormatted
        ]);

        if (mqttClient && mqttClient.connected) {
            mqttClient.publish(MQTT_TOPIC, payload, (err) => {
                if (err) console.error("MQTT Publish Error:", err.message);
                else console.log(`Published to ${MQTT_TOPIC}: ${payload}`);
            });
        }
    } catch (err) {
        console.error("MQTT Update Failed:", err.message);
    }
}

function initMQTT(transactions) {
    mqttClient = mqtt.connect(MQTT_BROKER, MQTT_OPTIONS);
    mqttClient.on("connect", () => {
        console.log("✅ MQTT Connected");
        fetchMqttData(transactions);
        setInterval(() => fetchMqttData(transactions), 60 * 1000);
    });
    mqttClient.on("error", (err) => console.error("MQTT Error:", err.message));
}

module.exports = { initMQTT };
