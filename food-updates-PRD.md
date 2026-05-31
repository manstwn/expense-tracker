# Detailed PRD: Unified Architecture & Food Tracker Integration

## 1. Overview
This project refactors the existing Money Tracker into a consolidated Node.js application hosting:
- Two independent Telegram Bots (Money, Food)
- One Express Web Dashboard
- One MQTT Service
- Cloudflare Tunnel (for production)

All services will share a single MongoDB connection pool and process, while maintaining full feature parity and stability of the existing Money Tracker.

## 2. Technical Architecture & Folder Structure
```text
/
├── .env                (Required: TELEGRAM_MONEY_TOKEN, TELEGRAM_FOOD_TOKEN, MONGODB_URI, etc.)
├── main.js             (NEW ENTRY POINT: Bootstraps DB, then starts all services)
├── lib/
│   ├── ai.js           (Refactored: Shared Gemini AI logic for both bots)
│   ├── database.js     (Refactored: Initializes Mongo, exposes both 'transactions' & 'foodLogs' collections)
│   ├── mqtt.js         (Persisted: Existing MQTT handler, now called by main.js)
│   ├── server.js       (Refactored: Unified Express server with /api/money & /api/food routes)
│   ├── helpers.js      (Persisted: Shared utilities)
│   └── bots/           (New: Logic isolation)
│       ├── moneyBot.js (Refactored from original bot.js)
│       └── foodBot.js  (New: Food-specific logic)
└── public/             (Existing: Static assets, to be updated for UI expansion)
```

## 3. Transition Strategy (Ensuring Stability)

### 3.1 Environment Variables
- Ensure `.env` is updated to include `TELEGRAM_FOOD_TOKEN`.
- Existing `TELEGRAM_TOKEN` will be renamed to `TELEGRAM_MONEY_TOKEN` in `.env` and `main.js`.

### 3.2 Database Migration
- `lib/database.js` will be updated to `await` index creation for both `transactions` and `food_logs` collections before starting services.

### 3.3 Service Bootstrapping (`main.js`)
- `main.js` will encapsulate the startup logic currently in `bot.js`.
- **Order of Operations:**
  1. Load `.env`.
  2. Connect to MongoDB.
  3. Start Web Server.
  4. Initialize MQTT (conditional on `MQTT_ENABLED`).
  5. Initialize Money Bot.
  6. Initialize Food Bot.
  7. Start Cloudflare Tunnel (if `ENV === 'prod'`).

### 3.4 Feature Parity
- **Cloudflare:** The `child_process` logic currently in `bot.js` will be moved directly into `main.js`. No changes to the binary execution path.
- **MQTT:** MQTT logic will remain strictly compatible with the existing broker setup.

## 4. Implementation Steps

### Phase 1: Preparation
- [ ] Create `lib/bots/` directory.
- [ ] Refactor `database.js` to handle two collections.

### Phase 2: Refactor & Migration
- [ ] Extract `moneyBot.js` from `bot.js`.
- [ ] Create `foodBot.js`.
- [ ] Implement `main.js` wrapper.
- [ ] Update `lib/server.js` to manage `/api/food` routes.

### Phase 3: AI & Logic
- [ ] Update `lib/ai.js` to support `parseFoodTransaction`.

### Phase 4: UI & Integration
- [ ] Update `/public/` files to support CRUD for Food logs.

### Phase 5: Verification (Crucial)
- [ ] Test Money Bot functionality (ensure no regression).
- [ ] Test Food Bot functionality.
- [ ] Verify Web Dashboard API (both money/food).
- [ ] Verify Cloudflare Tunnel health.

---
*Implementation Plan: Pending Final Approval.*
