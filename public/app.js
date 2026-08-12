// Global App State
const state = {
    pin: [],
    token: localStorage.getItem("session_token") || null,
    currentTab: "overview",
    stats: null,
    users: [],
    transactions: [],
    allTransactions: [],
    totalTransactions: 0,
    filters: {
        search: "",
        userId: "",
        date: "",
        sortBy: "createdAt",
        sortOrder: -1,
        limit: 10,
        skip: 0
    },
    charts: {
        trend: null,
        category: null
    },
    tempParsedItems: [], // Store temporary items returned from AI Quick Parse
    chartMode: "day", // "day" or "item"
    chartMaxItems: 10, // Default to top 10 items
    calendarDate: new Date(),
    allStories: []
};

// Global Constants
const DAY_COLOR_CLASSES = ["day-group-purple", "day-group-pink", "day-group-cyan", "day-group-amber"];

// Elements object container
const el = {};

async function loadDedicatedPages() {
    const pageMap = [
        { id: "login-screen", file: "pages/login.html" },
        { id: "tab-overview", file: "pages/overview.html" },
        { id: "tab-transactions", file: "pages/transactions.html" },
        { id: "tab-food", file: "pages/food.html" },
        { id: "tab-insights", file: "pages/insights.html" },
        { id: "tab-stories", file: "pages/stories.html" },
        { id: "modals-container", file: "pages/modals.html" }
    ];

    await Promise.all(pageMap.map(async item => {
        const container = document.getElementById(item.id);
        if (container) {
            try {
                const res = await fetch(item.file);
                if (res.ok) {
                    container.innerHTML = await res.text();
                }
            } catch (err) {
                console.error(`Failed to load ${item.file}:`, err);
            }
        }
    }));
}

function initElementsCache() {
    el.loginScreen = document.getElementById("login-screen");
    el.dashboardScreen = document.getElementById("dashboard-screen");
    el.pinDots = document.querySelectorAll(".pin-dot");
    el.loginError = document.getElementById("login-error");
    el.loginContainer = document.querySelector(".login-container");
    
    // Sidebar Tabs
    el.navItems = document.querySelectorAll(".nav-item");
    el.tabPanes = document.querySelectorAll(".tab-pane");
    el.logoutBtn = document.getElementById("logout-btn");
    
    // KPIs
    el.kpiTodayExpense = document.getElementById("kpi-today-expense");
    el.kpiMonthExpense = document.getElementById("kpi-month-expense");
    el.kpiMonthIncome = document.getElementById("kpi-month-income");
    el.kpiAvgDay = document.getElementById("kpi-avg-day");
    
    // Tables
    el.recentTbody = document.getElementById("recent-transactions-tbody");
    el.allTbody = document.getElementById("all-transactions-tbody");
    el.topExpensiveTbody = document.getElementById("top-expensive-tbody");
    
    // Filters & Pagination
    el.txSearch = document.getElementById("tx-search-input");
    el.txFilterUser = document.getElementById("tx-filter-user");
    el.txFilterDate = document.getElementById("tx-filter-date");
    el.txLimitSelect = document.getElementById("tx-limit-select");
    el.sortHeaders = document.querySelectorAll("th.sortable");
    el.paginationInfo = document.getElementById("pagination-info");
    el.paginationPrev = document.getElementById("pagination-prev");
    el.paginationNext = document.getElementById("pagination-next");
    
    // AI quick add
    el.aiInput = document.getElementById("ai-input-text");
    el.aiParseBtn = document.getElementById("ai-parse-btn");
    el.aiPreview = document.getElementById("ai-preview");
    
    // Modal & Form
    el.quickAddBtn = document.getElementById("quick-add-btn");
    el.modal = document.getElementById("tx-modal");
    el.modalTitle = document.getElementById("modal-title");
    el.modalCloseBtn = document.getElementById("modal-close-btn");
    el.formCancelBtn = document.getElementById("form-cancel-btn");
    el.form = document.getElementById("tx-form");
    el.formId = document.getElementById("form-tx-id");
    el.formType = document.getElementById("form-type");
    el.formCategory = document.getElementById("form-category");
    el.formItem = document.getElementById("form-item");
    el.formAmount = document.getElementById("form-amount");
    el.formDateOnly = document.getElementById("form-date-only");
    el.formTimeOnly = document.getElementById("form-time-only");
    el.formUserId = document.getElementById("form-userid");
    el.formUsername = document.getElementById("form-username");
    
    // Toast
    el.toast = document.getElementById("toast");
    el.toastIcon = document.getElementById("toast-icon");
    el.toastMsg = document.getElementById("toast-message");

    // Chart Mode Toggle Buttons
    el.chartModeDayBtn = document.getElementById("chart-mode-day");
    el.chartModeItemBtn = document.getElementById("chart-mode-item");
    el.chartMaxWrapper = document.getElementById("chart-max-wrapper");
    el.chartMaxSelect = document.getElementById("chart-max-select");
    
    // AI Modal Elements
    el.aiModal = document.getElementById("ai-modal");
    el.quickAiModalBtn = document.getElementById("quick-ai-modal-btn");
    el.aiModalCloseBtn = document.getElementById("ai-modal-close-btn");
    
    // Calendar Elements
    el.calendarMonthYear = document.getElementById("calendar-month-year");
    el.calendarMonthTotal = document.getElementById("calendar-month-total");
    el.calendarPrevBtn = document.getElementById("calendar-prev-btn");
    el.calendarNextBtn = document.getElementById("calendar-next-btn");
    el.calendarTodayBtn = document.getElementById("calendar-today-btn");
    el.calendarDaysGrid = document.getElementById("calendar-days-grid");
    el.calStatAvg = document.getElementById("cal-stat-avg");
    el.calStatPeak = document.getElementById("cal-stat-peak");
    el.calStatDays = document.getElementById("cal-stat-days");
    el.calendarDayModal = document.getElementById("calendar-day-modal");
    el.calModalCloseBtn = document.getElementById("cal-modal-close-btn");
    el.calModalDateTitle = document.getElementById("cal-modal-date-title");
    el.calModalTotal = document.getElementById("cal-modal-total");
    el.calModalTbody = document.getElementById("cal-modal-tbody");

    // Stories
    el.storiesGrid = document.getElementById("stories-grid");
    el.storiesEmpty = document.getElementById("stories-empty");
    el.quickAddStoryBtn = document.getElementById("quick-add-story-btn");
    el.storyModal = document.getElementById("story-modal");
    el.storyModalTitle = document.getElementById("story-modal-title");
    el.storyModalCloseBtn = document.getElementById("story-modal-close-btn");
    el.storyCancelBtn = document.getElementById("story-form-cancel-btn");
    el.storyForm = document.getElementById("story-form");
    el.storyFormId = document.getElementById("story-form-id");
    el.storyFormTitle = document.getElementById("story-form-title");
    el.storyFormContent = document.getElementById("story-form-content");
    el.storyFormDate = document.getElementById("story-form-date");
    el.storyFormMood = document.getElementById("story-form-mood");
    el.storyMoodPicker = document.getElementById("story-mood-picker");

    // Story View Modal
    el.storyViewModal = document.getElementById("story-view-modal");
    el.storyViewCloseBtn = document.getElementById("story-view-close-btn");
    el.storyViewMood = document.getElementById("story-view-mood");
    el.storyViewTitle = document.getElementById("story-view-title");
    el.storyViewMeta = document.getElementById("story-view-meta");
    el.storyViewContent = document.getElementById("story-view-content");
    el.storyViewPrevBtn = document.getElementById("story-view-prev");
    el.storyViewNextBtn = document.getElementById("story-view-next");
}

// Register custom Chart.js tooltip positioner to follow mouse cursor
if (typeof Chart !== "undefined" && Chart.Tooltip && Chart.Tooltip.positioners) {
    Chart.Tooltip.positioners.cursor = function(elements, eventPosition) {
        if (!eventPosition || typeof eventPosition.x === "undefined") {
            return false;
        }
        return {
            x: eventPosition.x,
            y: eventPosition.y
        };
    };
}

// Initialize Application
document.addEventListener("DOMContentLoaded", async () => {
    await loadDedicatedPages();
    initElementsCache();
    initKeypad();
    initTabs();
    initModal();
    initFoodModal();
    initStoryModal();
    initFilters();
    initAIParser();
    initChartToggle();
    initCalendar();
    createIconsSafe();
    
    // Auto-login check
    if (state.token) {
        verifySession();
    } else {
        showScreen("login");
    }
});

function initFoodModal() {
    const addFoodBtn = document.getElementById("quick-add-food-btn");
    const foodModal = document.getElementById("food-modal");
    const foodCloseBtn = document.getElementById("food-modal-close-btn");
    const foodCancelBtn = document.getElementById("food-form-cancel-btn");
    const foodForm = document.getElementById("food-form");

    if (addFoodBtn) addFoodBtn.addEventListener("click", () => foodModal.classList.add("active"));
    if (foodCloseBtn) foodCloseBtn.addEventListener("click", () => foodModal.classList.remove("active"));
    if (foodCancelBtn) foodCancelBtn.addEventListener("click", () => foodModal.classList.remove("active"));
    
    foodForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const foodName = document.getElementById("food-form-name").value;
        const category = document.getElementById("food-form-category").value;
        
        try {
            await apiCall("/api/food/logs", "POST", { foodName, category });
            showToast("Food logged successfully", "success");
            foodModal.classList.remove("active");
            foodForm.reset();
            fetchFoodLogs();
        } catch (err) {
            showToast("Failed to log food", "error");
        }
    });
}

// ======================================================
// STORIES (DIARY) FEATURE
// ======================================================
function initStoryModal() {
    const addStoryBtn = el.quickAddStoryBtn;
    const storyModal = el.storyModal;
    const storyCloseBtn = el.storyModalCloseBtn;
    const storyCancelBtn = el.storyCancelBtn;
    const storyForm = el.storyForm;

    if (addStoryBtn) addStoryBtn.addEventListener("click", () => openStoryModal());
    if (storyCloseBtn) storyCloseBtn.addEventListener("click", () => storyModal.classList.remove("active"));
    if (storyCancelBtn) storyCancelBtn.addEventListener("click", () => storyModal.classList.remove("active"));
    if (storyModal) storyModal.addEventListener("click", (e) => {
        if (e.target === storyModal) storyModal.classList.remove("active");
    });

    // Story view modal
    if (el.storyViewCloseBtn) el.storyViewCloseBtn.addEventListener("click", () => el.storyViewModal.classList.remove("active"));
    if (el.storyViewModal) el.storyViewModal.addEventListener("click", (e) => {
        if (e.target === el.storyViewModal) el.storyViewModal.classList.remove("active");
    });
    if (el.storyViewPrevBtn) el.storyViewPrevBtn.addEventListener("click", () => changeStoryView(-1));
    if (el.storyViewNextBtn) el.storyViewNextBtn.addEventListener("click", () => changeStoryView(1));

    // Mood picker single-select
    if (el.storyMoodPicker) {
        el.storyMoodPicker.addEventListener("click", (e) => {
            const btn = e.target.closest(".mood-btn");
            if (!btn) return;
            el.storyMoodPicker.querySelectorAll(".mood-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            el.storyFormMood.value = btn.dataset.mood;
        });
    }

    storyForm.addEventListener("submit", handleStoryFormSubmit);
}

async function fetchStories() {
    try {
        const data = await apiCall("/api/stories");
        state.allStories = data.stories || [];
        renderStoriesList(state.allStories);
    } catch (err) {
        console.error("Failed to fetch stories:", err);
        showToast("Failed to fetch stories", "error");
    }
}

async function loadStoriesData() {
    try {
        const data = await apiCall("/api/stories");
        state.allStories = data.stories || [];
    } catch (err) {
        console.error("Failed to load stories data:", err);
        state.allStories = state.allStories || [];
    }
}

function renderStoriesList(stories) {
    if (!el.storiesGrid) return;

    if (el.storiesEmpty) el.storiesEmpty.style.display = stories.length === 0 ? "flex" : "none";

    el.storiesGrid.innerHTML = "";
    if (stories.length === 0) return;

    stories.forEach(story => {
        const d = new Date(story.createdAt);
        const dateStr = formatLocalIndonesianDate(d, false);
        const timeStr = new Intl.DateTimeFormat("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }).format(d);
        const tzLabel = getLocalTimeZoneLabel();
        const relativeStr = getRelativeTimeString(story.createdAt);
        const mood = story.mood || "😐";
        const title = story.title || "Untitled Story";

        const card = document.createElement("div");
        card.className = "story-card glass";
        card.innerHTML = `
            <div class="story-card-header">
                <span class="story-mood-badge" title="Mood">${mood}</span>
                <div class="story-card-actions">
                    <button class="action-btn view" data-id="${story._id}" title="Read"><i data-lucide="eye"></i></button>
                    <button class="action-btn edit" data-id="${story._id}" title="Edit"><i data-lucide="edit-3"></i></button>
                    <button class="action-btn delete" data-id="${story._id}" title="Delete"><i data-lucide="trash-2"></i></button>
                </div>
            </div>
            <h3 class="story-card-title">${escapeHtml(title)}</h3>
            <p class="story-card-content">${escapeHtml(story.content)}</p>
            <div class="story-card-footer">
                <span><i data-lucide="calendar" style="width: 12px; height: 12px; vertical-align: -1px;"></i> ${dateStr} ${timeStr} ${tzLabel}</span>
                <span class="story-card-relative">${relativeStr}</span>
            </div>
        `;

        card.addEventListener("click", (e) => {
            if (e.target.closest(".action-btn")) return;
            openStoryView(story);
        });
        card.querySelector(".view").addEventListener("click", (e) => {
            e.stopPropagation();
            openStoryView(story);
        });
        card.querySelector(".edit").addEventListener("click", (e) => {
            e.stopPropagation();
            openStoryModal(story);
        });
        card.querySelector(".delete").addEventListener("click", (e) => {
            e.stopPropagation();
            deleteStory(story._id);
        });

        el.storiesGrid.appendChild(card);
    });

    createIconsSafe();
}

function openStoryModal(story) {
    if (!el.storyModal) return;

    // Reset form
    el.storyForm.reset();
    el.storyFormId.value = "";
    el.storyFormMood.value = "";
    el.storyMoodPicker.querySelectorAll(".mood-btn").forEach((b, i) => {
        b.classList.toggle("active", b.dataset.mood === "");
    });

    if (story) {
        el.storyModalTitle.innerHTML = `<i data-lucide="notebook-pen" style="width: 18px; height: 18px; color: var(--accent-pink); display: inline-block; vertical-align: sub; margin-right: 6px;"></i>Edit Story`;
        el.storyFormId.value = story._id;
        el.storyFormTitle.value = story.title || "";
        el.storyFormContent.value = story.content || "";

        const moodVal = story.mood || "";
        el.storyFormMood.value = moodVal;
        el.storyMoodPicker.querySelectorAll(".mood-btn").forEach(b => {
            b.classList.toggle("active", b.dataset.mood === moodVal);
        });

        const dateObj = story.createdAt ? new Date(story.createdAt) : new Date();
        el.storyFormDate.value = toDatetimeLocalValue(dateObj);
    } else {
        el.storyModalTitle.innerHTML = `<i data-lucide="notebook-pen" style="width: 18px; height: 18px; color: var(--accent-pink); display: inline-block; vertical-align: sub; margin-right: 6px;"></i>New Story`;
        el.storyFormDate.value = toDatetimeLocalValue(new Date());
    }

    el.storyModal.classList.add("active");
    createIconsSafe();
}

async function handleStoryFormSubmit(e) {
    e.preventDefault();

    const id = el.storyFormId.value;
    const title = el.storyFormTitle.value.trim();
    const content = el.storyFormContent.value.trim();
    const mood = el.storyFormMood.value;
    const dateVal = el.storyFormDate.value;

    if (!content) {
        showToast("Story content is required", "error");
        return;
    }

    const body = { title, content, mood };

    if (dateVal) {
        // datetime-local value = user's wall clock in their own timezone
        // Convert to the absolute UTC instant (international time), like transactions do.
        body.createdAt = new Date(dateVal).toISOString();
    }

    try {
        if (id) {
            await apiCall(`/api/stories/${id}`, "PUT", body);
            showToast("Story updated successfully", "success");
        } else {
            await apiCall("/api/stories", "POST", body);
            showToast("Story saved successfully", "success");
        }
        el.storyModal.classList.remove("active");
        fetchStories();
    } catch (err) {
        showToast(err.message || "Failed to save story", "error");
    }
}

// Story view modal queue navigation state
let storyViewQueue = [];
let storyViewIndex = 0;

function openStoryView(story, queue) {
    if (!el.storyViewModal) return;

    if (Array.isArray(queue) && queue.length > 0) {
        storyViewQueue = queue;
        storyViewIndex = queue.findIndex(s => s._id === story._id);
        if (storyViewIndex === -1) storyViewIndex = 0;
    } else {
        storyViewQueue = [story];
        storyViewIndex = 0;
    }

    renderStoryView(storyViewIndex);
    el.storyViewModal.classList.add("active");
    createIconsSafe();
}

function changeStoryView(dir) {
    if (storyViewQueue.length === 0) return;
    storyViewIndex = (storyViewIndex + dir + storyViewQueue.length) % storyViewQueue.length;
    renderStoryView(storyViewIndex);
    createIconsSafe();
}

function renderStoryView(idx) {
    const story = storyViewQueue[idx] || {};
    const d = new Date(story.createdAt);
    const dateStr = formatLocalIndonesianDate(d, false);
    const timeStr = new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    }).format(d);
    const tzLabel = getLocalTimeZoneLabel();

    const mood = story.mood || "😐";
    const title = story.title || "Untitled Story";
    const multi = storyViewQueue.length > 1;

    el.storyViewMood.textContent = mood;
    el.storyViewTitle.textContent = title;
    el.storyViewMeta.innerHTML = `
        <span><i data-lucide="calendar" style="width: 13px; height: 13px; vertical-align: -2px;"></i> ${dateStr} ${timeStr} ${tzLabel}</span>
        ${multi ? `<span class="story-view-count">${idx + 1} / ${storyViewQueue.length}</span>` : ""}
    `;
    el.storyViewContent.textContent = story.content || "";
    el.storyViewContent.scrollTop = 0;

    if (el.storyViewPrevBtn) el.storyViewPrevBtn.style.display = multi ? "inline-flex" : "none";
    if (el.storyViewNextBtn) el.storyViewNextBtn.style.display = multi ? "inline-flex" : "none";
}

async function deleteStory(id) {
    if (!confirm("Are you sure you want to delete this story?")) return;
    try {
        await apiCall(`/api/stories/${id}`, "DELETE");
        showToast("Story deleted successfully", "success");
        fetchStories();
    } catch (err) {
        showToast("Failed to delete story", "error");
    }
}

// Helper: Show specific screen
function showScreen(screen) {
    if (screen === "login") {
        el.loginScreen.classList.add("active");
        el.dashboardScreen.classList.remove("active");
        resetPin();
    } else {
        el.loginScreen.classList.remove("active");
        el.dashboardScreen.classList.add("active");
        loadDashboardData();
    }
}

// REST API Helper
async function apiCall(endpoint, method = "GET", body = null) {
    const headers = {
        "Content-Type": "application/json"
    };
    if (state.token) {
        headers["Authorization"] = `Bearer ${state.token}`;
    }
    
    const config = { method, headers };
    if (body) {
        config.body = JSON.stringify(body);
    }
    
    try {
        const response = await fetch(endpoint, config);
        if (response.status === 401) {
            // Invalid session or logged out
            logout();
            throw new Error("Unauthorized");
        }
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Something went wrong");
        }
        return data;
    } catch (err) {
        console.error(`API Call failed (${endpoint}):`, err.message);
        throw err;
    }
}

// Session Validation
async function verifySession() {
    try {
        await apiCall("/api/verify");
        showScreen("dashboard");
    } catch (err) {
        logout();
    }
}

// Load Dashboard Data
async function loadDashboardData() {
    fetchStats();
    fetchUsers();
    await Promise.all([fetchTransactions(), loadStoriesData()]); // Wait for data before deriving views
    renderCurrentDayFromState(); // Filter today's transactions from state
    renderTopExpensesFromState(); // Sort top expenses from state
    renderExpenseCalendar(); // Render Calendar View with expenses
}

// Logout
function logout() {
    state.token = null;
    localStorage.removeItem("session_token");
    showScreen("login");
    showToast("Logged out successfully", "success");
}

// ======================================================
// PIN KEYPAD LOGIN SYSTEM
// ======================================================
function initKeypad() {
    const keys = document.querySelectorAll(".key-btn[data-val]");
    keys.forEach(key => {
        key.addEventListener("click", () => {
            if (state.pin.length < 4) {
                state.pin.push(key.dataset.val);
                updatePinDisplay();
                if (state.pin.length === 4) {
                    submitLogin();
                }
            }
        });
    });
    
    document.getElementById("key-clear").addEventListener("click", resetPin);
    document.getElementById("key-backspace").addEventListener("click", () => {
        state.pin.pop();
        updatePinDisplay();
    });
    
    // Keyboard listener support
    document.addEventListener("keydown", (e) => {
        if (!el.loginScreen.classList.contains("active")) return;
        
        if (e.key >= "0" && e.key <= "9") {
            if (state.pin.length < 4) {
                state.pin.push(e.key);
                updatePinDisplay();
                if (state.pin.length === 4) {
                    submitLogin();
                }
            }
        } else if (e.key === "Backspace") {
            state.pin.pop();
            updatePinDisplay();
        } else if (e.key === "Escape") {
            resetPin();
        }
    });
}

function updatePinDisplay() {
    el.pinDots.forEach((dot, idx) => {
        if (idx < state.pin.length) {
            dot.classList.add("filled");
        } else {
            dot.classList.remove("filled");
        }
    });
    el.loginError.classList.remove("visible");
}

function resetPin() {
    state.pin = [];
    updatePinDisplay();
}

async function submitLogin() {
    const enteredPin = state.pin.join("");
    try {
        const response = await apiCall("/api/login", "POST", { pin: enteredPin });
        if (response.success && response.token) {
            state.token = response.token;
            localStorage.setItem("session_token", response.token);
            showToast("Login successful", "success");
            showScreen("dashboard");
        }
    } catch (err) {
        // Shake feedback animation
        el.loginContainer.classList.add("shake");
        el.loginError.classList.add("visible");
        resetPin();
        setTimeout(() => el.loginContainer.classList.remove("shake"), 500);
    }
}

// ======================================================
// TAB PANES
// ======================================================
function initTabs() {
    const allNavs = document.querySelectorAll(".nav-item, .bottom-nav-item");
    allNavs.forEach(item => {
        item.addEventListener("click", () => {
            const tab = item.dataset.tab;
            if (tab) switchTab(tab);
        });
    });

    if (el.logoutBtn) {
        el.logoutBtn.addEventListener("click", logout);
    }

    const mobileLogout = document.getElementById("mobile-logout-btn");
    if (mobileLogout) {
        mobileLogout.addEventListener("click", logout);
    }
}

function switchTab(tab) {
    state.currentTab = tab;
    
    const allNavs = document.querySelectorAll(".nav-item, .bottom-nav-item");
    allNavs.forEach(item => {
        if (item.dataset.tab === tab) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });
    
    el.tabPanes.forEach(pane => {
        if (pane.id === `tab-${tab}`) {
            pane.classList.add("active");
        } else {
            pane.classList.remove("active");
        }
    });
    
    // Reload components if needed
    if (tab === "transactions") {
        fetchTransactions();
    } else if (tab === "overview") {
        fetchStats();
        loadStoriesData().then(() => renderExpenseCalendar());
        // Re-render overview derived views from cached state
        renderRecentTransactionsMiniTable(state.allTransactions.slice(0, 10));
        renderCurrentDayFromState();
        renderTopExpensesFromState();
    } else if (tab === "insights") {
        fetchStats();
    } else if (tab === "food") {
        fetchFoodLogs();
    } else if (tab === "stories") {
        fetchStories();
    }
}

// ======================================================
// FOOD LOGS FETCH & VIEW
// ======================================================
async function fetchFoodLogs() {
    console.log("Fetching food logs...");
    try {
        const logs = await apiCall("/api/food/logs");
        console.log("Fetched food logs:", logs);
        renderFoodLogsTable(logs);
    } catch (err) {
        console.error("Failed to fetch food logs:", err);
        showToast("Failed to fetch food logs", "error");
    }
}

function renderFoodLogsTable(logs) {
    const tbody = document.getElementById("food-logs-tbody");
    if (!tbody) {
        console.error("food-logs-tbody element not found");
        return;
    }
    
    tbody.innerHTML = "";
    if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-secondary)">No food logs found</td></tr>`;
        return;
    }
    
    logs.forEach(log => {
        const d = new Date(log.createdAt);
        const dateStr = d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
        
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${escapeHtml(log.foodName)}</strong></td>
            <td><span class="tx-badge">${escapeHtml(log.category)}</span></td>
            <td>${dateStr}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ======================================================
// STATS AND CHART CALCULATIONS
// ======================================================
async function fetchStats() {
    try {
        const data = await apiCall("/api/stats");
        state.stats = data;
        
        // Update KPIs
        el.kpiTodayExpense.textContent = `Rp${formatCurrency(data.kpi.todayExpense)}`;
        el.kpiMonthExpense.textContent = `Rp${formatCurrency(data.kpi.thisMonthExpense)}`;
        el.kpiMonthIncome.textContent = `Rp${formatCurrency(data.kpi.thisMonthIncome)}`;
        
        // Calculate and update AVG Spend/Day (last 30 days)
        const totalExpense30D = data.dailyStats.reduce((sum, d) => sum + d.expense, 0);
        const dailyAvg = totalExpense30D / (data.dailyStats.length || 30);
        el.kpiAvgDay.textContent = `Rp${formatCurrency(Math.round(dailyAvg))}`;
        
        // Render 30 Days Trend Line / Bar Chart
        if (state.chartMode === "item") {
            renderTrendChart(data.itemStats || []);
        } else {
            renderTrendChart(data.dailyStats || []);
        }
        
        // Render Category spend donut
        renderCategoryBreakdown(data.categoryStats);
    } catch (err) {
        showToast("Failed to fetch dashboard statistics", "error");
    }
}

function renderTrendChart(chartData) {
    const ctx = document.getElementById("trend-chart").getContext("2d");
    
    // Slice data if grouping by item to prevent overcrowding
    let displayData = [...chartData];
    if (state.chartMode === "item") {
        displayData = displayData.slice(0, state.chartMaxItems);
        displayData.reverse(); // Show oldest first (left-to-right) so the most recent is on the far right
    } else {
        // Sort chronologically for daily trend
        displayData.sort((a, b) => a.date.localeCompare(b.date));
    }
    
    const labels = displayData.map(d => {
        if (state.chartMode === "item") {
            return d.item;
        }
        const dateObj = new Date(d.date);
        return dateObj.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    });
    
    const datasetData = displayData.map(d => state.chartMode === "item" ? d.amount : d.expense);
    
    if (state.charts.trend) {
        state.charts.trend.destroy();
    }
    
    if (typeof Chart === "undefined") {
        console.error("Chart.js is not loaded.");
        return;
    }
    
    // Gradients
    const purpleGrad = ctx.createLinearGradient(0, 0, 0, 300);
    purpleGrad.addColorStop(0, "rgba(139, 92, 246, 0.4)");
    purpleGrad.addColorStop(1, "rgba(139, 92, 246, 0)");
    
    const verticalLinePlugin = {
        id: 'verticalLine',
        afterDraw: (chart) => {
            const active = chart.tooltip && (chart.tooltip.active || chart.tooltip._active);
            if (active && active.length) {
                const activePoint = active[0];
                const ctx = chart.ctx;
                const x = activePoint.element.x;
                const topY = chart.scales.y.top;
                const bottomY = chart.scales.y.bottom;

                ctx.save();
                ctx.beginPath();
                ctx.moveTo(x, topY);
                ctx.lineTo(x, bottomY);
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
                ctx.setLineDash([4, 4]);
                ctx.stroke();
                ctx.restore();
            }
        }
    };

    state.charts.trend = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Expenses",
                    data: datasetData,
                    borderColor: "#8b5cf6",
                    borderWidth: 3,
                    backgroundColor: purpleGrad,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: "#8b5cf6",
                    pointHoverRadius: 6
                }
            ]
        },
        plugins: [verticalLinePlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (event, activeElements) => {
                if (activeElements && activeElements.length > 0) {
                    const activePoint = activeElements[0];
                    const index = activePoint.index;
                    const clickedData = displayData[index];
                    if (state.chartMode === "day" && clickedData && clickedData.date) {
                        renderCurrentDayFromState(clickedData.date);
                    }
                }
            },
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    position: 'cursor',
                    padding: 12,
                    backgroundColor: "rgba(15, 10, 32, 0.95)",
                    titleFont: { family: "Plus Jakarta Sans", size: 13, weight: "bold" },
                    bodyFont: { family: "Plus Jakarta Sans", size: 13 },
                    borderColor: "rgba(255,255,255,0.1)",
                    borderWidth: 1,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            return ` ${context.dataset.label}: Rp${formatCurrency(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: "#9ea2c6", font: { family: "Plus Jakarta Sans", size: 12 } }
                },
                y: {
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    ticks: {
                        color: "#9ea2c6",
                        font: { family: "Plus Jakarta Sans", size: 15, weight: "700" },
                        callback: function(val) {
                            if (val >= 1000000) return (val / 1000000) + "M";
                            if (val >= 1000) return (val / 1000) + "K";
                            return val;
                        }
                    }
                }
            }
        }
    });
}

function renderCategoryBreakdown(categories) {
    const ctx = document.getElementById("category-chart");
    if (!ctx) return;
    
    // Total Expense
    const totalExpense = categories.reduce((sum, c) => sum + c.amount, 0);

    // 1. Metric: Top Category
    const topCategoryEl = document.getElementById("insight-top-category");
    if (topCategoryEl) {
        if (categories.length > 0) {
            topCategoryEl.textContent = `${capitalize(categories[0].category)} (Rp${formatCurrency(categories[0].amount)})`;
        } else {
            topCategoryEl.textContent = "-";
        }
    }

    // 2. Metric: Daily Average
    const dailyAvgEl = document.getElementById("insight-daily-avg");
    let dailyAvg = 0;
    if (dailyAvgEl && state.stats) {
        const totalExpense30D = state.stats.dailyStats.reduce((sum, d) => sum + d.expense, 0);
        dailyAvg = totalExpense30D / (state.stats.dailyStats.length || 30);
        dailyAvgEl.textContent = `Rp${formatCurrency(Math.round(dailyAvg))}`;
    }

    // 3. Metric: Average Transaction Value
    const avgTxEl = document.getElementById("insight-avg-tx");
    if (avgTxEl) {
        const expensesList = state.transactions.filter(t => t.type === "expense");
        const avgTxVal = expensesList.length ? (expensesList.reduce((sum, t) => sum + t.amount, 0) / expensesList.length) : (totalExpense / (state.stats?.kpi.totalTransactions || 1));
        avgTxEl.textContent = `Rp${formatCurrency(Math.round(avgTxVal))}`;
    }

    // 4. Metric: Savings Rate
    const healthEl = document.getElementById("insight-health");
    let savingsRateText = "-";
    let isOverspent = false;
    if (healthEl && state.stats) {
        const monthlyExpense = state.stats.kpi.thisMonthExpense;
        const monthlyIncome = state.stats.kpi.thisMonthIncome;
        if (monthlyIncome > 0) {
            const savingsRate = Math.round(((monthlyIncome - monthlyExpense) / monthlyIncome) * 100);
            if (savingsRate < 0) {
                savingsRateText = `${savingsRate}% (Overspent)`;
                isOverspent = true;
            } else {
                savingsRateText = `${savingsRate}%`;
            }
        } else if (monthlyExpense > 0) {
            savingsRateText = "0% (No Income)";
            isOverspent = true;
        } else {
            savingsRateText = "100% (No Spend)";
        }
        healthEl.textContent = savingsRateText;
        if (isOverspent) {
            healthEl.style.color = "var(--danger-red)";
        } else {
            healthEl.style.color = "var(--success-green)";
        }
    }

    // Render Category progress list
    const progressList = document.getElementById("category-progress-list");
    if (progressList) {
        progressList.innerHTML = "";
        if (categories.length === 0) {
            progressList.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 20px;">No category breakdowns available</div>`;
        } else {
            const categoryColors = ["#8b5cf6", "#ec4899", "#3b82f6", "#10b981", "#f59e0b", "#6366f1", "#ef4444", "#14b8a6"];
            categories.forEach((cat, idx) => {
                const color = categoryColors[idx % categoryColors.length];
                const pct = totalExpense ? Math.round((cat.amount / totalExpense) * 100) : 0;
                
                const itemDiv = document.createElement("div");
                itemDiv.className = "progress-item";
                itemDiv.style.marginBottom = "12px";
                itemDiv.innerHTML = `
                    <div class="progress-info flex-between" style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                        <span class="progress-label" style="display: flex; align-items: center; gap: 6px;">
                            <span class="color-dot" style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${color}"></span>
                            <strong>${capitalize(cat.category)}</strong>
                        </span>
                        <span class="progress-val" style="color: var(--text-secondary);">${pct}% (${formatCurrency(cat.amount)} Rp)</span>
                    </div>
                    <div class="progress-bar-track" style="width: 100%; height: 6px; background: rgba(255, 255, 255, 0.05); border-radius: 3px; overflow: hidden;">
                        <div class="progress-bar-fill" style="width: ${pct}%; height: 100%; background: ${color}; border-radius: 3px; box-shadow: 0 0 8px ${color}80; transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);"></div>
                    </div>
                `;
                progressList.appendChild(itemDiv);
            });
        }
    }


    
    // Doughnut chart rendering
    if (categories.length === 0) {
        if (state.charts.category) {
            state.charts.category.destroy();
            state.charts.category = null;
        }
        return;
    }
    
    const categoryColors = ["#8b5cf6", "#ec4899", "#3b82f6", "#10b981", "#f59e0b", "#6366f1", "#ef4444", "#14b8a6"];
    
    if (state.charts.category) {
        state.charts.category.destroy();
    }
    
    if (typeof Chart === "undefined") {
        console.error("Chart.js is not loaded.");
        return;
    }

    state.charts.category = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: categories.map(c => capitalize(c.category)),
            datasets: [{
                data: categories.map(c => c.amount),
                backgroundColor: categoryColors.slice(0, categories.length),
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    padding: 12,
                    backgroundColor: "rgba(15, 10, 32, 0.95)",
                    bodyFont: { family: "Plus Jakarta Sans", size: 13 },
                    borderColor: "rgba(255,255,255,0.1)",
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return ` Rp${formatCurrency(context.parsed)}`;
                        }
                    }
                }
            },
            cutout: "70%"
        }
    });
}

// ======================================================
// USERS FILTER FETCH
// ======================================================
async function fetchUsers() {
    try {
        const users = await apiCall("/api/users");
        state.users = users;
        
        // Populate select list
        el.txFilterUser.innerHTML = `<option value="">All Users</option>`;
        users.forEach(u => {
            const label = u.username ? `@${u.username}` : `User (ID: ${u.userId})`;
            el.txFilterUser.innerHTML += `<option value="${u.userId}">${label}</option>`;
        });
    } catch (err) {
        console.error("Failed to populate users dropdown:", err);
    }
}

// ======================================================
// TRANSACTIONS FETCH & VIEW
// ======================================================
async function fetchTransactions() {
    try {
        const data = await apiCall(`/api/transactions`);
        // Always store the full dump for client-side filtering
        state.allTransactions = data.transactions;
        state.totalTransactions = data.total;
        
        if (state.currentTab === "transactions") {
            applyFiltersAndRender();
        } else {
            // For overview mini list, take latest 20 items
            renderRecentTransactionsMiniTable(data.transactions.slice(0, 20));
        }
    } catch (err) {
        showToast("Failed to fetch transactions list", "error");
    }
}

function applyFiltersAndRender() {
    let filtered = [...state.allTransactions];
    
    // Filter search
    if (state.filters.search) {
        const q = state.filters.search.toLowerCase().trim();
        filtered = filtered.filter(t => 
            (t.item && t.item.toLowerCase().includes(q)) ||
            (t.category && t.category.toLowerCase().includes(q))
        );
    }
    
    // Filter user
    if (state.filters.userId) {
        filtered = filtered.filter(t => t.userId && t.userId.toString() === state.filters.userId.toString());
    }
    
    // Filter date (YYYY-MM-DD)
    if (state.filters.date) {
        filtered = filtered.filter(t => {
            if (!t.createdAt) return false;
            const d = new Date(t.createdAt);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            const dateStr = `${year}-${month}-${day}`;
            return dateStr === state.filters.date;
        });
    }
    
    // Sort
    if (state.filters.sortBy) {
        const field = state.filters.sortBy;
        const dir = state.filters.sortOrder;
        filtered.sort((a, b) => {
            let valA = a[field];
            let valB = b[field];
            if (field === "createdAt") {
                valA = new Date(valA || 0).getTime();
                valB = new Date(valB || 0).getTime();
            } else if (typeof valA === "number") {
                valA = valA || 0;
                valB = valB || 0;
            } else if (typeof valA === "string") {
                valA = (valA || "").toLowerCase();
                valB = (valB || "").toLowerCase();
            }
            if (valA < valB) return -1 * dir;
            if (valA > valB) return 1 * dir;
            return 0;
        });
    }
    
    const limit = state.filters.limit || 10;
    state.transactions = filtered.slice(0, limit);
    renderAllTransactionsTable();
    
    if (el.paginationInfo) {
        el.paginationInfo.textContent = `Showing ${state.transactions.length} of ${filtered.length} transactions`;
    }
}

function renderRecentTransactionsMiniTable(transactions) {
    el.recentTbody.innerHTML = "";
    if (transactions.length === 0) {
        el.recentTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary)">No transactions found</td></tr>`;
        return;
    }
    
    let currentDayStr = null;
    let colorIndex = 0;
    
    transactions.forEach(t => {
        const formattedDate = formatTableDate(t.createdAt);
        const dayRef = t.createdAt ? toJakartaDateStrClient(new Date(t.createdAt)) : "no-date";
        
        if (currentDayStr !== dayRef) {
            currentDayStr = dayRef;
            colorIndex = (colorIndex + 1) % DAY_COLOR_CLASSES.length;
        }
        const dayGroupClass = DAY_COLOR_CLASSES[colorIndex];
        
        const tr = document.createElement("tr");
        tr.className = dayGroupClass;
        tr.innerHTML = `
            <td><strong>${escapeHtml(t.item)}</strong></td>
            <td><span class="tx-amount ${t.type}">Rp${formatCurrency(t.amount)}</span></td>
            <td>${formattedDate}</td>
        `;
        el.recentTbody.appendChild(tr);
    });
}

function renderAllTransactionsTable() {
    el.allTbody.innerHTML = "";
    if (state.transactions.length === 0) {
        el.allTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary)">No transactions found</td></tr>`;
        return;
    }
    
    let currentDayStr = null;
    let dayGroupClass = "day-group-1";
    
    state.transactions.forEach(t => {
        const formattedDate = formatTableDate(t.createdAt);
        
        // Extract only the day part for grouping
        const dayRef = t.createdAt ? new Date(t.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }) : "no-date";
        
        if (currentDayStr !== dayRef) {
            currentDayStr = dayRef;
            dayGroupClass = dayGroupClass === "day-group-1" ? "day-group-2" : "day-group-1";
        }
        
        const tr = document.createElement("tr");
        tr.className = dayGroupClass;
        tr.innerHTML = `
            <td><strong>${escapeHtml(t.item)}</strong></td>
            <td><span class="tx-amount ${t.type}">Rp${formatCurrency(t.amount)}</span></td>
            <td><span class="tx-badge ${t.type}">${escapeHtml(t.category)}</span></td>
            <td style="text-transform: capitalize;">${t.type}</td>
            <td>${formattedDate}</td>
            <td>
                <div class="action-btns">
                    <button class="action-btn edit" data-id="${t._id}" title="Edit"><i data-lucide="edit-3"></i></button>
                    <button class="action-btn delete" data-id="${t._id}" title="Delete"><i data-lucide="trash-2"></i></button>
                </div>
            </td>
        `;
        
        // Add listeners to actions
        tr.querySelector(".edit").addEventListener("click", () => openEditModal(t));
        tr.querySelector(".delete").addEventListener("click", () => deleteTransaction(t._id));
        
        el.allTbody.appendChild(tr);
    });
    
    createIconsSafe();
}

// Delete transaction helper
async function deleteTransaction(id) {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    try {
        await apiCall(`/api/transactions/${id}`, "DELETE");
        showToast("Transaction deleted successfully", "success");
        fetchTransactions();
    } catch (err) {
        showToast("Failed to delete transaction", "error");
    }
}

// ======================================================
// FILTER ACTIONS & SORTING
// ======================================================
function initFilters() {
    // Search filter with debounce
    let searchDebounce;
    if (el.txSearch) {
        el.txSearch.addEventListener("input", () => {
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(() => {
                state.filters.search = el.txSearch.value;
                state.filters.skip = 0;
                applyFiltersAndRender();
            }, 400);
        });
    }
    
    // User filter dropdown selection
    if (el.txFilterUser) {
        el.txFilterUser.addEventListener("change", () => {
            state.filters.userId = el.txFilterUser.value;
            state.filters.skip = 0;
            applyFiltersAndRender();
        });
    }

    // Date filter selection
    if (el.txFilterDate) {
        el.txFilterDate.addEventListener("change", () => {
            state.filters.date = el.txFilterDate.value;
            state.filters.skip = 0;
            applyFiltersAndRender();
        });
    }

    // Limit select change
    if (el.txLimitSelect) {
        el.txLimitSelect.addEventListener("change", () => {
            state.filters.limit = parseInt(el.txLimitSelect.value) || 10;
            state.filters.skip = 0;
            applyFiltersAndRender();
        });
    }
    
    // Sorting headers click
    el.sortHeaders.forEach(header => {
        header.addEventListener("click", () => {
            const field = header.dataset.sort;
            if (state.filters.sortBy === field) {
                // Toggle order direction
                state.filters.sortOrder = state.filters.sortOrder === 1 ? -1 : 1;
            } else {
                state.filters.sortBy = field;
                state.filters.sortOrder = -1; // Default desc
            }
            
            // Render active sort state icons
            el.sortHeaders.forEach(h => {
                h.classList.remove("active");
                const icon = h.querySelector("i");
                if (icon) {
                    icon.setAttribute("data-lucide", "chevrons-up-down");
                }
            });
            
            header.classList.add("active");
            const activeIcon = header.querySelector("i");
            if (activeIcon) {
                activeIcon.setAttribute("data-lucide", state.filters.sortOrder === 1 ? "chevron-up" : "chevron-down");
            }
            
            lucide.createIcons();
            applyFiltersAndRender();
        });
    });
}

// ======================================================
// PAGINATION CONTROLS
// ======================================================
function initPagination() {
    el.paginationPrev.addEventListener("click", () => {
        if (state.filters.skip > 0) {
            state.filters.skip = Math.max(0, state.filters.skip - state.filters.limit);
            fetchTransactions();
        }
    });
    
    el.paginationNext.addEventListener("click", () => {
        if (state.filters.skip + state.filters.limit < state.totalTransactions) {
            state.filters.skip += state.filters.limit;
            fetchTransactions();
        }
    });
}

function updatePaginationControls() {
    const start = state.totalTransactions === 0 ? 0 : state.filters.skip + 1;
    const end = Math.min(state.filters.skip + state.filters.limit, state.totalTransactions);
    
    el.paginationInfo.textContent = `Showing ${start}-${end} of ${state.totalTransactions}`;
    el.paginationPrev.disabled = state.filters.skip === 0;
    el.paginationNext.disabled = state.filters.skip + state.filters.limit >= state.totalTransactions;
}

// ======================================================
// DYNAMIC MODALS & FORMS
// ======================================================
function initModal() {
    el.quickAddBtn.addEventListener("click", () => openAddModal());
    el.modalCloseBtn.addEventListener("click", closeModal);
    el.formCancelBtn.addEventListener("click", closeModal);
    
    el.modal.addEventListener("click", (e) => {
        if (e.target === el.modal) closeModal();
    });
    
    el.form.addEventListener("submit", handleFormSubmit);
}

function toDatetimeLocalValue(dateInput) {
    if (!dateInput) return "";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function openAddModal() {
    el.modalTitle.textContent = "Add Transaction";
    el.formId.value = "";
    el.form.reset();
    
    // Set default date and time in Jakarta timezone
    const now = new Date();
    const jStr = toJakartaDateStrClient(now);
    const parts = new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    }).formatToParts(now);
    const p = {};
    parts.forEach(({ type, value }) => { p[type] = value; });

    if (el.formDateOnly) el.formDateOnly.value = jStr;
    if (el.formTimeOnly) el.formTimeOnly.value = `${p.hour}:${p.minute}`;
    
    // Prefill user data automatically
    el.formUserId.value = "1828479746";
    el.formUsername.value = "imanstwn";
    
    el.modal.classList.add("active");
}

function openEditModal(tx) {
    el.modalTitle.textContent = "Edit Transaction";
    el.formId.value = tx._id;
    
    el.formType.value = tx.type;
    el.formCategory.value = tx.category || "manual";
    el.formItem.value = tx.item;
    el.formAmount.value = tx.amount;
    el.formUserId.value = tx.userId || "";
    el.formUsername.value = tx.username || "";
    
    const dateObj = tx.createdAt ? new Date(tx.createdAt) : new Date();
    const jStr = toJakartaDateStrClient(dateObj);
    const parts = new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    }).formatToParts(dateObj);
    const p = {};
    parts.forEach(({ type, value }) => { p[type] = value; });

    if (el.formDateOnly) el.formDateOnly.value = jStr;
    if (el.formTimeOnly) el.formTimeOnly.value = `${p.hour}:${p.minute}`;
    
    el.modal.classList.add("active");
}

function closeModal() {
    el.modal.classList.remove("active");
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const id = el.formId.value;
    const dateVal = el.formDateOnly.value || getTodayDateStr();
    const timeVal = el.formTimeOnly.value || "00:00";
    
    // Parse selected date and time in Jakarta timezone (+07:00)
    const createdAtIso = new Date(`${dateVal}T${timeVal}:00+07:00`).toISOString();

    const body = {
        type: el.formType.value,
        category: el.formCategory.value,
        item: el.formItem.value,
        amount: parseFloat(el.formAmount.value),
        createdAt: createdAtIso,
        userId: el.formUserId.value ? parseInt(el.formUserId.value) : null,
        username: el.formUsername.value.trim()
    };
    
    try {
        if (id) {
            // Edit mode
            await apiCall(`/api/transactions/${id}`, "PUT", body);
            showToast("Transaction updated successfully", "success");
        } else {
            // Add mode
            await apiCall("/api/transactions", "POST", body);
            showToast("Transaction added successfully", "success");
        }
        closeModal();
        loadDashboardData();
    } catch (err) {
        showToast(err.message || "Failed to save transaction", "error");
    }
}

// ======================================================
// GEMINI AI QUICK PARSER CONSOLE
// ======================================================
function initAIParser() {
    el.aiParseBtn.addEventListener("click", handleAIQuickParse);
    
    // Setup AI Modal visibility
    if (el.quickAiModalBtn) {
        el.quickAiModalBtn.addEventListener("click", () => {
            el.aiInput.value = "";
            el.aiPreview.classList.add("hidden");
            el.aiPreview.innerHTML = "";
            el.aiModal.classList.add("active");
        });
    }
    if (el.aiModalCloseBtn) {
        el.aiModalCloseBtn.addEventListener("click", () => {
            el.aiModal.classList.remove("active");
        });
    }
    if (el.aiModal) {
        el.aiModal.addEventListener("click", (e) => {
            if (e.target === el.aiModal) el.aiModal.classList.remove("active");
        });
    }
}

async function handleAIQuickParse() {
    const text = el.aiInput.value.trim();
    if (!text) {
        showToast("Please enter some text to parse", "error");
        return;
    }
    
    el.aiParseBtn.disabled = true;
    el.aiParseBtn.innerHTML = `<span class="badge shimmer">Parsing...</span>`;
    
    try {
        const response = await apiCall("/api/transactions/parse", "POST", { text });
        state.tempParsedItems = response.parsed || [];
        
        if (state.tempParsedItems.length === 0) {
            el.aiPreview.innerHTML = `<p style="font-size: 13px; color: var(--text-secondary);">No transactions detected. Try rephrasing.</p>`;
            el.aiPreview.classList.remove("hidden");
        } else {
            renderAIQuickParsePreview();
        }
    } catch (err) {
        showToast("AI parsing failed. Please try again.", "error");
    } finally {
        el.aiParseBtn.disabled = false;
        el.aiParseBtn.innerHTML = `<i data-lucide="sparkles"></i> Parse Text`;
        createIconsSafe();
    }
}

function renderAIQuickParsePreview() {
    el.aiPreview.innerHTML = "";
    el.aiPreview.classList.remove("hidden");
    
    const title = document.createElement("div");
    title.className = "preview-title";
    title.innerHTML = `<span>AI detected ${state.tempParsedItems.length} transactions</span>`;
    
    const list = document.createElement("div");
    list.className = "preview-items-list";
    
    state.tempParsedItems.forEach(item => {
        const div = document.createElement("div");
        div.className = "preview-item";
        div.innerHTML = `
            <span>${escapeHtml(item.item)}</span>
            <div style="display: flex; gap: 8px; align-items: center;">
                <span class="tx-amount ${item.type}">Rp${formatCurrency(item.amount)}</span>
                <span class="item-type ${item.type}">${item.type}</span>
            </div>
        `;
        list.appendChild(div);
    });
    
    const saveBtn = document.createElement("button");
    saveBtn.className = "btn btn-primary";
    saveBtn.style.width = "100%";
    saveBtn.style.marginTop = "10px";
    saveBtn.innerHTML = `<i data-lucide="save"></i> Save Detected Items`;
    saveBtn.addEventListener("click", saveAIQuickParseItems);
    
    el.aiPreview.appendChild(title);
    el.aiPreview.appendChild(list);
    el.aiPreview.appendChild(saveBtn);
    
    createIconsSafe();
}

async function saveAIQuickParseItems() {
    if (state.tempParsedItems.length === 0) return;
    
    let successCount = 0;
    for (const item of state.tempParsedItems) {
        try {
            await apiCall("/api/transactions", "POST", {
                type: item.type,
                category: item.category || "manual",
                item: item.item,
                amount: item.amount,
                userId: 1828479746,
                username: "imanstwn"
            });
            successCount++;
        } catch (err) {
            console.error("Failed to quick save item:", item);
        }
    }
    
    showToast(`Saved ${successCount} transactions successfully`, "success");
    el.aiPreview.classList.add("hidden");
    el.aiInput.value = "";
    state.tempParsedItems = [];
    
    // Close modal
    if (el.aiModal) {
        el.aiModal.classList.remove("active");
    }
    
    loadDashboardData();
}

// ======================================================
// COMMON FRONTEND UTILITY HELPERS
// ======================================================
function createIconsSafe() {
    if (typeof lucide !== "undefined" && lucide.createIcons) {
        lucide.createIcons();
    } else {
        console.warn("Lucide icons library is not loaded.");
    }
}
function showToast(message, type = "success") {
    el.toastMsg.textContent = message;
    el.toast.className = `toast glass show ${type}`;
    
    // Switch icon
    if (type === "success") {
        el.toastIcon.setAttribute("data-lucide", "check-circle-2");
    } else {
        el.toastIcon.setAttribute("data-lucide", "alert-triangle");
    }
    createIconsSafe();
    
    setTimeout(() => {
        el.toast.classList.remove("show");
    }, 3000);
}

function formatCurrency(value) {
    return new Intl.NumberFormat("id-ID").format(value);
}

function capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function renderTopExpensesFromState() {
    const topExpenses = (state.allTransactions || [])
        .filter(t => t.type === "expense")
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 20);
    renderTopExpensiveTable(topExpenses);
}

function renderTopExpensiveTable(transactions) {
    el.topExpensiveTbody.innerHTML = "";
    if (transactions.length === 0) {
        el.topExpensiveTbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-secondary)">No high value items</td></tr>`;
        return;
    }
    
    let currentDayStr = null;
    let colorIndex = 0;
    
    transactions.forEach(t => {
        const formattedDate = formatTableDate(t.createdAt);
        const dayRef = t.createdAt ? toJakartaDateStrClient(new Date(t.createdAt)) : "no-date";
        
        if (currentDayStr !== dayRef) {
            currentDayStr = dayRef;
            colorIndex = (colorIndex + 1) % DAY_COLOR_CLASSES.length;
        }
        const dayGroupClass = DAY_COLOR_CLASSES[colorIndex];
        
        const tr = document.createElement("tr");
        tr.className = dayGroupClass;
        tr.innerHTML = `
            <td><strong>${escapeHtml(t.item)}</strong></td>
            <td><span class="tx-amount expense">Rp${formatCurrency(t.amount)}</span></td>
            <td>${formattedDate}</td>
        `;
        el.topExpensiveTbody.appendChild(tr);
    });
}

function initChartToggle() {
    if (!el.chartModeDayBtn || !el.chartModeItemBtn) return;
    
    el.chartModeDayBtn.addEventListener("click", () => {
        if (state.chartMode === "day") return;
        state.chartMode = "day";
        el.chartModeDayBtn.classList.add("active");
        el.chartModeItemBtn.classList.remove("active");
        el.chartMaxWrapper.style.display = "none";
        renderTrendChart(state.stats?.dailyStats || []);
    });
    
    el.chartModeItemBtn.addEventListener("click", () => {
        if (state.chartMode === "item") return;
        state.chartMode = "item";
        el.chartModeItemBtn.classList.add("active");
        el.chartModeDayBtn.classList.remove("active");
        el.chartMaxWrapper.style.display = "inline-block";
        renderTrendChart(state.stats?.itemStats || []);
    });
    
    el.chartMaxSelect.addEventListener("change", () => {
        state.chartMaxItems = parseInt(el.chartMaxSelect.value) || 10;
        if (state.chartMode === "item") {
            renderTrendChart(state.stats?.itemStats || []);
        }
    });
}

// ======================================================
// CLIENT-SIDE DATE HELPERS & DAY-FILTERED RENDERING
// ======================================================

// Convert any Date to YYYY-MM-DD string in Jakarta timezone
function toJakartaDateStrClient(date) {
    const d = date instanceof Date ? date : new Date(date);
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(d);
    const map = {};
    parts.forEach(({ type, value }) => (map[type] = value));
    return `${map.year}-${map.month}-${map.day}`;
}

function getTodayDateStr() {
    return toJakartaDateStrClient(new Date());
}

// Render current-day transactions panel by filtering from state (no API call)
function renderCurrentDayFromState(dateStr) {
    const dateToQuery = dateStr || getTodayDateStr();
    
    const titleEl = document.getElementById("current-day-title");
    const badgeEl = document.getElementById("current-day-badge");
    
    const todayStr = getTodayDateStr();
    if (dateToQuery === todayStr) {
        if (titleEl) titleEl.textContent = "Today's Transactions";
        if (badgeEl) {
            badgeEl.textContent = "Today";
            badgeEl.style.background = "linear-gradient(135deg, var(--accent-purple), var(--accent-pink))";
        }
    } else {
        const displayDate = new Date(dateToQuery + "T00:00:00+07:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
        if (titleEl) titleEl.textContent = `Transactions on ${displayDate}`;
        if (badgeEl) {
            badgeEl.textContent = "Selected Day";
            badgeEl.style.background = "linear-gradient(135deg, var(--accent-blue, #3b82f6), var(--accent-purple))";
        }
    }
    
    // Filter transactions from state by Jakarta date
    const filtered = (state.allTransactions || []).filter(t => {
        if (!t.createdAt) return false;
        return toJakartaDateStrClient(new Date(t.createdAt)) === dateToQuery;
    });
    
    renderCurrentDayTable(filtered);
}

function renderCurrentDayTable(transactions) {
    const tbody = document.getElementById("current-day-tbody");
    const totalEl = document.getElementById("current-day-total");
    if (!tbody) return;
    
    tbody.innerHTML = "";
    
    // Calculate total expenses and income for this specific day
    const totalExpenses = (transactions || []).filter(t => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
    const totalIncome = (transactions || []).filter(t => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
    
    if (totalEl) {
        if (totalIncome > 0) {
            totalEl.innerHTML = `Expenses: <span style="color: #ff4a9e; font-weight: 800;">Rp${formatCurrency(totalExpenses)}</span> &middot; Income: <span style="color: #10b981; font-weight: 800;">Rp${formatCurrency(totalIncome)}</span>`;
        } else {
            totalEl.innerHTML = `Total: <span style="color: #ff4a9e; font-weight: 800;">Rp${formatCurrency(totalExpenses)}</span>`;
        }
    }
    
    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-secondary); padding: 20px;">No transactions found</td></tr>`;
        return;
    }
    
    transactions.forEach(t => {
        const d = new Date(t.createdAt);
        const parts = new Intl.DateTimeFormat("id-ID", {
            timeZone: "Asia/Jakarta",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }).formatToParts(d);
        const p = {};
        parts.forEach(({ type, value }) => { p[type] = value; });
        const timeStr = `${p.hour}:${p.minute} WIB`;
        const relativeStr = getRelativeTimeString(t.createdAt);
        
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${escapeHtml(t.item)}</strong></td>
            <td><span class="tx-amount ${t.type}">Rp${formatCurrency(t.amount)}</span></td>
            <td><div>${timeStr}</div><div style="font-size:10px;color:var(--text-secondary);margin-top:1px;">${relativeStr}</div></td>
        `;
        tbody.appendChild(tr);
    });
}

function formatShortCurrency(amount) {
    if (!amount) return "0";
    if (amount >= 1000000) {
        return (amount / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    }
    if (amount >= 1000) {
        return Math.round(amount / 1000) + "k";
    }
    return String(amount);
}

function getRelativeTimeString(date) {
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
        return "just now";
    }
    if (diffMins < 60) {
        return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    }
    if (diffHours < 24) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    }
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

const ID_DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const ID_MONTHS_FULL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function formatJakartaIndonesianDate(dateInput, includeTime = true) {
    if (!dateInput) return "-";
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return "-";

    const formatter = new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    });

    const parts = formatter.formatToParts(d);
    const p = {};
    parts.forEach(({ type, value }) => { p[type] = value; });

    const weekday = p.weekday ? p.weekday.charAt(0).toUpperCase() + p.weekday.slice(1) : "";
    const dateStr = `${weekday}, ${p.day} ${p.month} ${p.year}`;
    if (!includeTime) return dateStr;
    const timeStr = `${p.hour}:${p.minute}`;
    return `${dateStr} ${timeStr} WIB`;
}

// Viewer-local variant: formats using the browser's own timezone (multi-timezone support)
function formatLocalIndonesianDate(dateInput, includeTime = true) {
    if (!dateInput) return "-";
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return "-";

    const formatter = new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    });

    const parts = formatter.formatToParts(d);
    const p = {};
    parts.forEach(({ type, value }) => { p[type] = value; });

    const weekday = p.weekday ? p.weekday.charAt(0).toUpperCase() + p.weekday.slice(1) : "";
    const dateStr = `${weekday}, ${p.day} ${p.month} ${p.year}`;
    if (!includeTime) return dateStr;
    const timeStr = `${p.hour}:${p.minute}`;
    return `${dateStr} ${timeStr}`;
}

// Short label for the viewer's own timezone, e.g. "GMT+7", "PDT", "WIB"
function getLocalTimeZoneLabel() {
    try {
        const parts = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(new Date());
        const tz = parts.find(part => part.type === "timeZoneName");
        return tz ? tz.value : "";
    } catch (e) {
        return "";
    }
}

function formatTableDate(date) {
    if (!date) return "-";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "-";
    
    const dateStr = formatJakartaIndonesianDate(d, false);
    const parts = new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    }).formatToParts(d);
    const p = {};
    parts.forEach(({ type, value }) => { p[type] = value; });
    const timeStr = `${p.hour}:${p.minute} WIB`;

    const relativeStr = getRelativeTimeString(date);
    return `
        <div class="tx-date-cell">
            <div class="tx-date-main">
                <span class="tx-date-text">${dateStr}</span>
                <span class="tx-time-badge">${timeStr}</span>
            </div>
            <div class="tx-date-relative">${relativeStr}</div>
        </div>
    `;
}

// ======================================================
// EXPENSE CALENDAR VIEW SYSTEM
// ======================================================
function initCalendar() {
    if (el.calendarPrevBtn) {
        el.calendarPrevBtn.addEventListener("click", () => {
            state.calendarDate.setMonth(state.calendarDate.getMonth() - 1);
            renderExpenseCalendar();
        });
    }
    if (el.calendarNextBtn) {
        el.calendarNextBtn.addEventListener("click", () => {
            state.calendarDate.setMonth(state.calendarDate.getMonth() + 1);
            renderExpenseCalendar();
        });
    }
    if (el.calendarTodayBtn) {
        el.calendarTodayBtn.addEventListener("click", () => {
            state.calendarDate = new Date();
            renderExpenseCalendar();
        });
    }
    if (el.calModalCloseBtn) {
        el.calModalCloseBtn.addEventListener("click", () => {
            if (el.calendarDayModal) el.calendarDayModal.classList.remove("active");
        });
    }
    if (el.calendarDayModal) {
        el.calendarDayModal.addEventListener("click", (e) => {
            if (e.target === el.calendarDayModal) {
                el.calendarDayModal.classList.remove("active");
            }
        });
    }
}

function renderExpenseCalendar() {
    if (!el.calendarDaysGrid) return;
    
    const currentYear = state.calendarDate.getFullYear();
    const currentMonth = state.calendarDate.getMonth(); // 0-indexed
    
    const monthNames = ID_MONTHS_FULL;
    if (el.calendarMonthYear) {
        el.calendarMonthYear.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    }
    
    // Calculate grid boundaries
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    
    // Map transactions for this year & month
    const txs = state.allTransactions || [];
    const dayExpenseMap = {};
    let monthlyExpenseSum = 0;
    let peakExpense = 0;
    let peakDay = null;
    let activeDaysCount = 0;
    
    txs.forEach(t => {
        if (!t.createdAt || t.type !== "expense") return;
        const d = new Date(t.createdAt);
        // Compare using Jakarta timezone
        const jStr = toJakartaDateStrClient(d);
        const [jY, jM, jD] = jStr.split("-").map(Number);
        if (jY === currentYear && (jM - 1) === currentMonth) {
            const dayNum = jD;
            if (!dayExpenseMap[dayNum]) {
                dayExpenseMap[dayNum] = { total: 0, items: [] };
            }
            dayExpenseMap[dayNum].total += t.amount || 0;
            dayExpenseMap[dayNum].items.push(t);
        }
    });

    // Map stories by Jakarta day (YYYY-MM-DD) for this calendar
    const storyDayMap = {};
    (state.allStories || []).forEach(s => {
        if (!s.createdAt) return;
        const jStr = toJakartaDateStrClient(new Date(s.createdAt));
        const [sY, sM, sD] = jStr.split("-").map(Number);
        if (sY === currentYear && (sM - 1) === currentMonth) {
            if (!storyDayMap[sD]) storyDayMap[sD] = [];
            storyDayMap[sD].push(s);
        }
    });
    Object.values(storyDayMap).forEach(list => list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    
    Object.keys(dayExpenseMap).forEach(dayKey => {
        const dayTotal = dayExpenseMap[dayKey].total;
        monthlyExpenseSum += dayTotal;
        activeDaysCount++;
        if (dayTotal > peakExpense) {
            peakExpense = dayTotal;
            peakDay = dayKey;
        }
    });
    
    // Update Header & Summary Stats
    if (el.calendarMonthTotal) {
        el.calendarMonthTotal.textContent = `Total: Rp${formatCurrency(monthlyExpenseSum)}`;
    }
    const dailyAvg = totalDaysInMonth > 0 ? Math.round(monthlyExpenseSum / totalDaysInMonth) : 0;
    if (el.calStatAvg) el.calStatAvg.textContent = `Rp${formatCurrency(dailyAvg)}`;
    if (el.calStatPeak) el.calStatPeak.textContent = peakDay ? `${peakDay} ${monthNames[currentMonth]} (Rp${formatCurrency(peakExpense)})` : "-";
    if (el.calStatDays) el.calStatDays.textContent = `${activeDaysCount} dari ${totalDaysInMonth} hari`;
    
    // Build Days Grid
    el.calendarDaysGrid.innerHTML = "";
    
    const todayStr = getTodayDateStr();
    const [tY, tM, tD] = todayStr.split("-").map(Number);
    const isCurrentActualMonth = tY === currentYear && (tM - 1) === currentMonth;
    const todayDateNum = tD;
    
    // 1. Previous Month Padding Cells
    for (let i = firstDayIndex; i > 0; i--) {
        const prevDayNum = prevMonthLastDay - i + 1;
        const cell = document.createElement("div");
        cell.className = "calendar-day-cell other-month";
        cell.innerHTML = `<span class="calendar-day-number">${prevDayNum}</span>`;
        el.calendarDaysGrid.appendChild(cell);
    }
    
    // 2. Current Month Day Cells
    for (let day = 1; day <= totalDaysInMonth; day++) {
        const cell = document.createElement("div");
        const isToday = isCurrentActualMonth && day === todayDateNum;
        cell.className = `calendar-day-cell${isToday ? " is-today" : ""}`;
        
        const dayData = dayExpenseMap[day];
        
        let headerRight = "";
        let itemsListHtml = "";
        
        if (isToday) {
            headerRight = '<span style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #ff4a9e; font-weight: 800;">Hari Ini</span>';
        }
        
        if (dayData && dayData.total > 0) {
            const isHigh = peakExpense > 0 && dayData.total >= (peakExpense * 0.7);
            const badgeClass = isHigh ? "calendar-day-total-badge high-expense" : "calendar-day-total-badge";
            headerRight = `<span class="${badgeClass}">Rp${formatShortCurrency(dayData.total)}</span>`;
            
            let itemRows = "";
            dayData.items.forEach(item => {
                itemRows += `
                    <div class="cal-item-row">
                        <span class="cal-item-name" title="${escapeHtml(item.item)}">${escapeHtml(item.item)}</span>
                        <span class="cal-item-amt">Rp${formatShortCurrency(item.amount)}</span>
                    </div>
                `;
            });
            
            itemsListHtml = `<div class="calendar-day-items-list">${itemRows}</div>`;
        }
        
        // Story indicator: green journal + marquee title when stories exist, red icon when none
        const dayStories = storyDayMap[day] || [];
        const hasStories = dayStories.length > 0;
        let storyHtml = "";
        if (hasStories) {
            const titleText = dayStories[0].title || "Untitled Story";
            const duration = Math.max(6, Math.min(Math.round(titleText.length * 0.6), 20));
            const shouldMarquee = titleText.length > 24;
            if (shouldMarquee) {
                storyHtml = `
                    <button type="button" class="cal-story-wrap has-stories" title="Read: ${escapeHtml(titleText)}">
                        <i data-lucide="notebook-pen" class="cal-story-icon"></i>
                        <span class="cal-story-text marquee">
                            <span class="cal-story-marquee-inner" style="animation-duration:${duration}s">
                                <span class="cal-story-copy">${escapeHtml(titleText)}</span>
                                <span class="cal-story-copy">${escapeHtml(titleText)}</span>
                            </span>
                        </span>
                    </button>
                `;
            } else {
                storyHtml = `
                    <button type="button" class="cal-story-wrap has-stories" title="Read: ${escapeHtml(titleText)}">
                        <i data-lucide="notebook-pen" class="cal-story-icon"></i>
                        <span class="cal-story-text">${escapeHtml(titleText)}</span>
                    </button>
                `;
            }
        } else {
            storyHtml = `
                <span class="cal-story-wrap no-stories" title="No stories this day">
                    <i data-lucide="notebook-pen" class="cal-story-icon"></i>
                </span>
            `;
        }

        cell.innerHTML = `
            <div class="calendar-day-header">
                <div class="cal-day-left">
                    <span class="calendar-day-number">${day}</span>
                    ${storyHtml}
                </div>
                ${headerRight}
            </div>
            ${itemsListHtml}
        `;

        // Story click: open read modal for this day's stories
        const storyBtn = cell.querySelector(".cal-story-wrap.has-stories");
        if (storyBtn) {
            storyBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                openStoryView(dayStories[0], dayStories);
            });
        }

        if (dayData && dayData.items.length > 0) {
            cell.addEventListener("click", () => openCalendarDayModal(currentYear, currentMonth, day, dayData));
        }
        
        el.calendarDaysGrid.appendChild(cell);
    }
    
    // 3. Next Month Padding Cells
    const totalCellsSoFar = firstDayIndex + totalDaysInMonth;
    const remainingCells = (7 - (totalCellsSoFar % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
        const cell = document.createElement("div");
        cell.className = "calendar-day-cell other-month";
        cell.innerHTML = `<span class="calendar-day-number">${i}</span>`;
        el.calendarDaysGrid.appendChild(cell);
    }
    
    createIconsSafe();
}

function openCalendarDayModal(year, month, day, dayData) {
    const jsMonth = String(month + 1).padStart(2, "0");
    const jsDay = String(day).padStart(2, "0");
    const dObj = new Date(`${year}-${jsMonth}-${jsDay}T12:00:00+07:00`);
    const dateStr = formatJakartaIndonesianDate(dObj, false);
    
    if (el.calModalDateTitle) el.calModalDateTitle.textContent = dateStr;
    if (el.calModalTotal) el.calModalTotal.textContent = `Total Pengeluaran: Rp${formatCurrency(dayData.total)}`;
    
    if (el.calModalTbody) {
        el.calModalTbody.innerHTML = "";
        dayData.items.forEach(item => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${escapeHtml(item.item)}</strong></td>
                <td><span class="tx-badge ${item.type}">${escapeHtml(item.category || "manual")}</span></td>
                <td><span class="tx-amount ${item.type}">Rp${formatCurrency(item.amount)}</span></td>
            `;
            el.calModalTbody.appendChild(tr);
        });
    }
    
    if (el.calendarDayModal) {
        el.calendarDayModal.classList.add("active");
    }
}
