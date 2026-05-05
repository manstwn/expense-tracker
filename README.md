# 💰 AI Money Tracker Bot

A powerful and intuitive Telegram bot designed to help you track your personal expenses effortlessly. Built with **Node.js**, **Google Gemini AI**, **MongoDB**, and **MQTT** integration.

---

## 🚀 Features

- 🎙️ **Voice & Text Transactions**: Simply type or speak your transactions (e.g., "Beli nasi padang 25rb"). The bot handles it!
- 🧠 **AI-Powered Parsing**: Uses **Google Gemini** to intelligently extract items, amounts, and categories from your messages.
- 📊 **Smart Reporting**: Generate beautiful summaries of your spending (Today, Yesterday, Last 7 Days, and This Month).
- 📡 **MQTT Real-Time Display**: Publishes live spending data, BTC price, and exchange rates to your MQTT broker—perfect for smart home displays.
- 🔐 **Secure access**: Only authorized users can interact with the bot.
- 🌍 **Timezone Aware**: Optimized for Jakarta (WIB) timezone for accurate daily resets.

---

## 🛠️ Commands

| Command | Description |
| :--- | :--- |
| `/h` or `/help` | 📖 Show all available commands |
| `/r` | 📊 Generate spending report |
| `/t` or `/today` | 📅 List today's transactions |
| `/l` or `/list` | 📜 Detailed list of transactions for the last 7 days |
| `/td <number>` | 🗑️ Delete a transaction from today's list |

---

## 📋 Prerequisites

- **Node.js** (v16+)
- **MongoDB** (Local or Atlas)
- **Telegram Bot Token** (from @BotFather)
- **Google Gemini API Key** (from Google AI Studio)
- **MQTT Broker** (Optional, for real-time display)

---

## ⚙️ Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd money
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Fill in your tokens and keys:
   - `TELEGRAM_TOKEN`: Your Telegram bot token.
   - `GEMINI_API_KEY`: Your Google Gemini API key.
   - `MONGODB_URI`: Your MongoDB connection string.
   - `AUTHORIZED_USER_ID`: Your Telegram User ID (to prevent unauthorized use).
   - `MQTT_*`: Configuration for your MQTT broker.

4. **Start the bot:**
   ```bash
   npm start
   ```

---

## 📂 Project Structure

- `bot.js`: Main entry point and Telegram event handler.
- `lib/ai.js`: Integration with Google Gemini for transaction parsing.
- `lib/database.js`: MongoDB connection and schema handling.
- `lib/mqtt.js`: Logic for fetching and publishing data to MQTT.
- `lib/reporter.js`: Spending report generation logic.
- `lib/helpers.js`: Shared utility functions (formatting, date handling).

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
