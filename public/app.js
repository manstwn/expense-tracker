// Global App State
const state = {
    currentTab: "overview",
    stats: null,
    statsFetchedAt: 0,
    statsRequestId: 0,
    transactionsRequestId: 0,
    transactions: [],
    transactionsTotal: 0,
    transactionsTotalPages: 0,
    recentTransactions: [],
    topExpenses: [],
    dayTransactions: [],
    calendarData: { days: [], stories: {}, monthTotal: 0 },
    calendarYear: new Date().getFullYear(),
    calendarMonth: new Date().getMonth() + 1,
    allStories: [],
    storiesPage: 1,
    storiesTotalPages: 0,
    foodPage: 1,
    foodTotalPages: 0,
    filters: {
        search: "",
        date: "",
        sortBy: "createdAt",
        sortOrder: -1,
        limit: 10,
        page: 1
    },
    charts: {
        trend: null,
        trendKey: null,
        category: null,
        categoryKey: null
    },
    tempParsedItems: [], // Store temporary items returned from AI Quick Parse
    chartMode: "day", // "day" or "item"
    chartMaxItems: 10 // Default to top 10 items
};

// Global Constants
const DAY_COLOR_CLASSES = ["day-group-purple", "day-group-pink", "day-group-cyan", "day-group-amber"];
const TAB_TITLES = {
    overview: "Financial Overview",
    transactions: "Transactions",
    food: "Food Tracker",
    insights: "Insights",
    stories: "Stories"
};

// Calendar state is initialized from the Jakarta date, not the browser's local date.
const initialJakartaToday = toJakartaDateStrClient(new Date());
state.calendarYear = Number(initialJakartaToday.slice(0, 4));
state.calendarMonth = Number(initialJakartaToday.slice(5, 7));

function isMobileViewport() {
    return window.matchMedia("(max-width: 768px)").matches;
}

function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

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

    const results = await Promise.allSettled(pageMap.map(async item => {
        const container = document.getElementById(item.id);
        if (!container) return;
        const res = await fetch(item.file);
        if (!res.ok) throw new Error(`${item.file}: HTTP ${res.status}`);
        container.innerHTML = await res.text();
    }));

    const failed = results.filter(result => result.status === "rejected");
    if (failed.length > 0) {
        failed.forEach(result => console.error("Failed to load dashboard section:", result.reason));
        const banner = document.createElement("div");
        banner.className = "load-error-banner";
        banner.textContent = "Some dashboard sections failed to load. Reload the page to try again.";
        document.body.prepend(banner);
    }
}

function initElementsCache() {
    el.loginScreen = document.getElementById("login-screen");
    el.dashboardScreen = document.getElementById("dashboard-screen");
    el.pinInput = document.getElementById("pin-input");
    el.loginForm = document.getElementById("login-form");
    el.loginError = document.getElementById("login-error");
    el.loginContainer = document.querySelector(".login-container");
    
    // Sidebar Tabs
    el.navItems = document.querySelectorAll(".nav-item");
    el.tabPanes = document.querySelectorAll(".tab-pane");
    el.logoutBtn = document.getElementById("logout-btn");
    
    // KPIs
    el.kpiTodayExpense = document.getElementById("kpi-today-expense");
    el.kpiMonthExpense = document.getElementById("kpi-month-expense");
    el.kpiCurrentMonthExpense = document.getElementById("kpi-current-month-expense");
    el.kpiCurrentMonthExpenseLabel = document.getElementById("kpi-current-month-expense-label");
    el.kpiAvgDay = document.getElementById("kpi-avg-day");
    
    // Tables
    el.recentTbody = document.getElementById("recent-transactions-tbody");
    el.allTbody = document.getElementById("all-transactions-tbody");
    el.topExpensiveTbody = document.getElementById("top-expensive-tbody");
    
    // Filters & Pagination
    el.txSearch = document.getElementById("tx-search-input");
    el.txFilterDate = document.getElementById("tx-filter-date");
    el.txLimitSelect = document.getElementById("tx-limit-select");
    el.sortHeaders = document.querySelectorAll("th.sortable");
    el.paginationInfo = document.getElementById("pagination-info");
    el.paginationPrev = document.getElementById("pagination-prev");
    el.paginationNext = document.getElementById("pagination-next");

    // Food pagination
    el.foodPaginationInfo = document.getElementById("food-pagination-info");
    el.foodPrev = document.getElementById("food-prev");
    el.foodNext = document.getElementById("food-next");

    // Stories pagination
    el.storiesInfo = document.getElementById("stories-info");
    el.storiesLoadMore = document.getElementById("stories-load-more");
    
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
    el.storyFormAiContent = document.getElementById("story-form-ai-content");
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
    el.storyViewAiContent = document.getElementById("story-view-ai-content");
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
    initPagination();
    initFoodPagination();
    initStoriesPagination();
    initAIParser();
    initChartToggle();
    initCalendar();
    initModalAccessibility();
    createIconsSafe();

    // The session lives in an HttpOnly cookie, so always ask the server.
    verifySession();
});

function initFoodModal() {
    const addFoodBtn = document.getElementById("quick-add-food-btn");
    const foodModal = document.getElementById("food-modal");
    const foodCloseBtn = document.getElementById("food-modal-close-btn");
    const foodCancelBtn = document.getElementById("food-form-cancel-btn");
    const foodForm = document.getElementById("food-form");

    if (!foodModal) return;

    if (addFoodBtn) addFoodBtn.addEventListener("click", () => foodModal.classList.add("active"));
    if (foodCloseBtn) foodCloseBtn.addEventListener("click", () => foodModal.classList.remove("active"));
    if (foodCancelBtn) foodCancelBtn.addEventListener("click", () => foodModal.classList.remove("active"));
    if (!foodForm) return;

    foodForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const foodName = document.getElementById("food-form-name").value;
        const category = document.getElementById("food-form-category").value;

        try {
            await apiCall("/api/food/logs", "POST", { foodName, category });
            showToast("Food logged successfully", "success");
            foodModal.classList.remove("active");
            foodForm.reset();
            fetchFoodLogs(1);
        } catch (err) {
            showToast(err.message || "Failed to log food", "error");
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

    if (!storyForm || !storyModal) return;

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

    // AI Prettify / Format Story listener
    const prettifyBtn = document.getElementById("story-ai-prettify-btn");
    if (prettifyBtn) {
        prettifyBtn.addEventListener("click", async () => {
            const content = el.storyFormContent.value;
            if (!content || !content.trim()) {
                showToast("Tulis cerita asli di kolom Teks Asli terlebih dahulu", "error");
                return;
            }

            const originalBtnHtml = prettifyBtn.innerHTML;
            prettifyBtn.disabled = true;
            prettifyBtn.innerHTML = `<i data-lucide="loader-2" class="spin" style="width: 13px; height: 13px;"></i> <span>Memproses...</span>`;
            createIconsSafe();

            try {
                const res = await apiCall("/api/stories/prettify", "POST", { content });
                if (res.success && res.prettified) {
                    const { title, content: formattedContent, mood } = res.prettified;
                    
                    // Put output in column 2 (Hasil AI) WITHOUT deleting or replacing column 1 (Teks Asli)!
                    if (formattedContent && el.storyFormAiContent) {
                        el.storyFormAiContent.value = formattedContent;
                    }
                    if (title && !el.storyFormTitle.value.trim()) {
                        el.storyFormTitle.value = title;
                    }
                    if (mood && !el.storyFormMood.value && el.storyMoodPicker) {
                        el.storyFormMood.value = mood;
                        el.storyMoodPicker.querySelectorAll(".mood-btn").forEach(b => {
                            b.classList.toggle("active", b.dataset.mood === mood);
                        });
                    }
                    showToast("Hasil rapian AI Bahasa Indonesia berhasil dibuat!", "success");
                }
            } catch (err) {
                console.error("AI Prettify failed:", err);
                showToast(err.message || "Gagal memproses AI", "error");
            } finally {
                prettifyBtn.disabled = false;
                prettifyBtn.innerHTML = originalBtnHtml;
                createIconsSafe();
            }
        });
    }

    storyForm.addEventListener("submit", handleStoryFormSubmit);
}

async function fetchStories(page = 1, append = false) {
    try {
        const data = await apiCall(`/api/stories?page=${page}&pageSize=24`);
        state.storiesPage = data.page;
        state.storiesTotalPages = data.totalPages;
        state.allStories = append
            ? [...state.allStories, ...(data.stories || [])]
            : (data.stories || []);
        renderStoriesList(state.allStories);
        updateStoriesPagination(data);
    } catch (err) {
        console.error("Failed to fetch stories:", err);
        showToast(err.message || "Failed to fetch stories", "error");
    }
}

function updateStoriesPagination(data) {
    if (el.storiesInfo) {
        el.storiesInfo.textContent = data.total
            ? `Showing ${state.allStories.length} of ${data.total} stories`
            : "";
    }
    if (el.storiesLoadMore) {
        el.storiesLoadMore.style.display = state.storiesPage < data.totalPages ? "inline-flex" : "none";
    }
}

function initStoriesPagination() {
    if (!el.storiesLoadMore) return;
    el.storiesLoadMore.addEventListener("click", () => {
        fetchStories(state.storiesPage + 1, true);
    });
}

function renderStoriesList(stories) {
    if (!el.storiesGrid) return;

    if (el.storiesEmpty) el.storiesEmpty.style.display = stories.length === 0 ? "flex" : "none";

    el.storiesGrid.innerHTML = "";
    if (stories.length === 0) return;

    const fragment = document.createDocumentFragment();

    stories.forEach(story => {
        const d = new Date(story.createdAt);
        const validDate = !Number.isNaN(d.getTime());
        const dateStr = validDate ? formatJakartaIndonesianDate(d, false) : "-";
        const timeStr = validDate
            ? new Intl.DateTimeFormat("id-ID", {
                timeZone: "Asia/Jakarta",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            }).format(d)
            : "";
        const tzLabel = validDate ? "WIB" : "";
        const relativeStr = getRelativeTimeString(story.createdAt);
        const mood = story.mood || "😐";
        const title = story.title || "Untitled Story";

        const card = document.createElement("div");
        card.className = "story-card glass";
        card.innerHTML = `
            <div class="story-card-header">
                <span class="story-mood-badge" title="Mood">${escapeHtml(mood)}</span>
                <div class="story-card-actions">
                    <button class="action-btn view" data-id="${story._id}" title="Read" aria-label="Read story"><i data-lucide="eye"></i></button>
                    <button class="action-btn edit" data-id="${story._id}" title="Edit" aria-label="Edit story"><i data-lucide="edit-3"></i></button>
                    <button class="action-btn delete" data-id="${story._id}" title="Delete" aria-label="Delete story"><i data-lucide="trash-2"></i></button>
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
            openStoryView(story, state.allStories);
        });
        card.querySelector(".view").addEventListener("click", (e) => {
            e.stopPropagation();
            openStoryView(story, state.allStories);
        });
        card.querySelector(".edit").addEventListener("click", (e) => {
            e.stopPropagation();
            openStoryModal(story);
        });
        card.querySelector(".delete").addEventListener("click", (e) => {
            e.stopPropagation();
            deleteStory(story._id);
        });

        fragment.appendChild(card);
    });

    el.storiesGrid.appendChild(fragment);
    createIconsSafe();
}

function openStoryModal(story) {
    if (!el.storyModal) return;

    // Reset form
    el.storyForm.reset();
    el.storyFormId.value = "";
    el.storyFormMood.value = "";
    el.storyMoodPicker.querySelectorAll(".mood-btn").forEach((button) => {
        button.classList.toggle("active", button.dataset.mood === "");
    });

    if (story) {
        el.storyModalTitle.innerHTML = `<i data-lucide="notebook-pen" style="width: 18px; height: 18px; color: var(--accent-pink); display: inline-block; vertical-align: sub; margin-right: 6px;"></i>Edit Story`;
        el.storyFormId.value = story._id;
        el.storyFormTitle.value = story.title || "";
        el.storyFormContent.value = story.content || "";
        if (el.storyFormAiContent) el.storyFormAiContent.value = story.aiContent || "";

        const moodVal = story.mood || "";
        el.storyFormMood.value = moodVal;
        el.storyMoodPicker.querySelectorAll(".mood-btn").forEach(b => {
            b.classList.toggle("active", b.dataset.mood === moodVal);
        });

        const dateObj = story.createdAt ? new Date(story.createdAt) : new Date();
        el.storyFormDate.value = toDatetimeLocalValue(dateObj);
    } else {
        el.storyModalTitle.innerHTML = `<i data-lucide="notebook-pen" style="width: 18px; height: 18px; color: var(--accent-pink); display: inline-block; vertical-align: sub; margin-right: 6px;"></i>New Story`;
        if (el.storyFormAiContent) el.storyFormAiContent.value = "";
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
    const aiContent = el.storyFormAiContent ? el.storyFormAiContent.value.trim() : "";
    const mood = el.storyFormMood.value;
    const dateVal = el.storyFormDate.value;

    if (!content) {
        showToast("Teks cerita asli wajib diisi", "error");
        return;
    }

    const body = { title, content, aiContent, mood };

    if (dateVal) {
        // Story dates are entered and displayed in Jakarta time, like transactions.
        const createdAt = new Date(`${dateVal}:00+07:00`);
        if (Number.isNaN(createdAt.getTime())) {
            showToast("Invalid story date", "error");
            return;
        }
        body.createdAt = createdAt.toISOString();
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
        fetchStories(1);
        fetchCalendar();
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
    const validDate = !Number.isNaN(d.getTime());
    const dateStr = validDate ? formatJakartaIndonesianDate(d, false) : "-";
    const timeStr = validDate
        ? new Intl.DateTimeFormat("id-ID", {
            timeZone: "Asia/Jakarta",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }).format(d)
        : "";
    const tzLabel = validDate ? "WIB" : "";

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

    if (el.storyViewAiContent) {
        el.storyViewAiContent.textContent = story.aiContent || "Belum ada hasil rapian AI. Klik Edit untuk membuat versi AI Bahasa Indonesia.";
        el.storyViewAiContent.scrollTop = 0;
    }

    if (el.storyViewPrevBtn) el.storyViewPrevBtn.style.display = multi ? "inline-flex" : "none";
    if (el.storyViewNextBtn) el.storyViewNextBtn.style.display = multi ? "inline-flex" : "none";
}

async function deleteStory(id) {
    if (!confirm("Are you sure you want to delete this story?")) return;
    try {
        await apiCall(`/api/stories/${id}`, "DELETE");
        showToast("Story deleted successfully", "success");
        fetchStories(1);
        fetchCalendar();
    } catch (err) {
        showToast(err.message || "Failed to delete story", "error");
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
async function apiCall(endpoint, method = "GET", body = null, options = {}) {
    const headers = {
        "Content-Type": "application/json"
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(endpoint, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            credentials: "same-origin",
            signal: controller.signal
        });

        const contentType = response.headers.get("content-type") || "";
        const data = contentType.includes("application/json")
            ? await response.json()
            : { error: await response.text() };

        if (response.status === 401 && !options.skipAuthRedirect) {
            handleUnauthorized();
            throw new Error("Session expired");
        }

        if (!response.ok) {
            throw new Error(data.error || `Request failed (${response.status})`);
        }

        return data;
    } catch (err) {
        if (err.name === "AbortError") {
            throw new Error("Request timed out");
        }
        console.error(`API call failed (${endpoint}):`, err.message);
        throw err;
    } finally {
        clearTimeout(timeout);
    }
}

function handleUnauthorized(showMessage = false) {
    state.stats = null;
    state.statsFetchedAt = 0;
    showScreen("login");
    if (showMessage) {
        showToast("Session expired. Please log in again.", "error");
    }
}

// Session Validation
async function verifySession() {
    try {
        await apiCall("/api/verify", "GET", null, { skipAuthRedirect: true });
        showScreen("dashboard");
    } catch {
        handleUnauthorized(false);
    }
}

// Load Dashboard Data
async function loadDashboardData(force = false) {
    await Promise.allSettled([
        fetchStats(force),
        fetchRecentTransactions(),
        fetchDayTransactions(getTodayDateStr()),
        fetchTopExpenses(),
        fetchCalendar()
    ]);
}

// Logout
async function logout() {
    try {
        await apiCall("/api/logout", "POST", null, { skipAuthRedirect: true });
    } catch {
        // The local session is cleared regardless of the server response.
    }
    handleUnauthorized(false);
    showToast("Logged out successfully", "success");
}

// ======================================================
// PIN KEYPAD LOGIN SYSTEM
// ======================================================
function initKeypad() {
    if (!el.pinInput) return;

    const keys = document.querySelectorAll(".key-btn[data-val]");
    keys.forEach(key => {
        key.addEventListener("click", () => {
            if (el.pinInput.value.length < Number(el.pinInput.maxLength)) {
                el.pinInput.value += key.dataset.val;
                el.pinInput.focus();
                el.loginError.classList.remove("visible");
            }
        });
    });

    const clearButton = document.getElementById("key-clear");
    const backspaceButton = document.getElementById("key-backspace");
    if (clearButton) clearButton.addEventListener("click", resetPin);
    if (backspaceButton) {
        backspaceButton.addEventListener("click", () => {
            el.pinInput.value = el.pinInput.value.slice(0, -1);
            el.pinInput.focus();
            el.loginError.classList.remove("visible");
        });
    }

    el.pinInput.addEventListener("input", () => el.loginError.classList.remove("visible"));
    el.pinInput.addEventListener("keydown", (event) => {
        if (event.key === "Escape") resetPin();
    });

    if (el.loginForm) {
        el.loginForm.addEventListener("submit", (event) => {
            event.preventDefault();
            submitLogin();
        });
    }
}

function resetPin() {
    if (el.pinInput) el.pinInput.value = "";
    if (el.loginError) el.loginError.classList.remove("visible");
}

async function submitLogin() {
    const enteredPin = el.pinInput ? el.pinInput.value : "";
    if (!enteredPin) {
        el.loginError.classList.add("visible");
        return;
    }

    const submitButton = el.loginForm?.querySelector("button[type='submit']");
    if (submitButton) submitButton.disabled = true;

    try {
        await apiCall("/api/login", "POST", { pin: enteredPin }, { skipAuthRedirect: true });
        showToast("Login successful", "success");
        showScreen("dashboard");
    } catch {
        el.loginContainer.classList.add("shake");
        el.loginError.classList.add("visible");
        resetPin();
        setTimeout(() => el.loginContainer.classList.remove("shake"), 500);
    } finally {
        if (submitButton) submitButton.disabled = false;
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

    const viewAllTransactions = document.getElementById("view-all-transactions-btn");
    if (viewAllTransactions) {
        viewAllTransactions.addEventListener("click", () => switchTab("transactions"));
    }
}

function switchTab(tab) {
    state.currentTab = tab;

    const titleEl = document.getElementById("welcome-message");
    if (titleEl) titleEl.textContent = TAB_TITLES[tab] || "Money Tracker";

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
        fetchTransactionsPage(state.filters.page);
    } else if (tab === "overview") {
        loadDashboardData();
    } else if (tab === "insights") {
        fetchStats();
    } else if (tab === "food") {
        fetchFoodLogs(1);
    } else if (tab === "stories") {
        fetchStories(1);
    }
}

// ======================================================
// FOOD LOGS FETCH & VIEW
// ======================================================
async function fetchFoodLogs(page = 1) {
    try {
        const data = await apiCall(`/api/food/logs?page=${page}&pageSize=25`);
        state.foodPage = data.page;
        state.foodTotalPages = data.totalPages;
        renderFoodLogsTable(data.logs || []);
        updateFoodPagination(data);
    } catch (err) {
        console.error("Failed to fetch food logs:", err);
        showToast(err.message || "Failed to fetch food logs", "error");
    }
}

function updateFoodPagination(data) {
    if (el.foodPaginationInfo) {
        el.foodPaginationInfo.textContent = data.total
            ? `Page ${data.page} of ${data.totalPages} (${data.total} logs)`
            : "No logs";
    }
    if (el.foodPrev) el.foodPrev.disabled = data.page <= 1;
    if (el.foodNext) el.foodNext.disabled = data.page >= data.totalPages;
}

function initFoodPagination() {
    if (el.foodPrev) {
        el.foodPrev.addEventListener("click", () => {
            if (state.foodPage > 1) fetchFoodLogs(state.foodPage - 1);
        });
    }
    if (el.foodNext) {
        el.foodNext.addEventListener("click", () => {
            if (state.foodPage < state.foodTotalPages) fetchFoodLogs(state.foodPage + 1);
        });
    }
}

function renderFoodLogsTable(logs) {
    const tbody = document.getElementById("food-logs-tbody");
    if (!tbody) return;

    tbody.innerHTML = "";
    if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-secondary)">No food logs found</td></tr>`;
        return;
    }

    const fragment = document.createDocumentFragment();

    logs.forEach(log => {
        const d = new Date(log.createdAt);
        const dateStr = Number.isNaN(d.getTime())
            ? "-"
            : d.toLocaleString("id-ID", {
                timeZone: "Asia/Jakarta",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            });

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${escapeHtml(log.foodName)}</strong></td>
            <td><span class="tx-badge">${escapeHtml(log.category)}</span></td>
            <td>${dateStr}</td>
        `;
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
}

// ======================================================
// STATS AND CHART CALCULATIONS
// ======================================================
async function fetchStats(force = false) {
    if (!force && state.stats && Date.now() - state.statsFetchedAt < 30000) {
        return;
    }

    const requestId = ++state.statsRequestId;

    try {
        const data = await apiCall("/api/stats");
        if (requestId !== state.statsRequestId) return;

        state.stats = data;
        state.statsFetchedAt = Date.now();

        const kpi = data.kpi || {};
        const dailyStats = data.dailyStats || [];

        const totalExpense30D = dailyStats.reduce((sum, day) => sum + day.expense, 0);
        const { month } = getJakartaYearMonthClient();

        // Update KPIs
        if (el.kpiTodayExpense) el.kpiTodayExpense.textContent = `Rp${formatCurrency(kpi.todayExpense || 0)}`;
        if (el.kpiMonthExpense) el.kpiMonthExpense.textContent = `Rp${formatCurrency(totalExpense30D)}`;
        if (el.kpiCurrentMonthExpense) {
            el.kpiCurrentMonthExpense.textContent = `Rp${formatCurrency(kpi.thisMonthExpense || 0)}`;
        }
        if (el.kpiCurrentMonthExpenseLabel) {
            el.kpiCurrentMonthExpenseLabel.textContent = `${ID_MONTHS_FULL[month - 1]} Expenses`;
        }

        // Calculate and update AVG Spend/Day (last 30 days)
        const dailyAvg = totalExpense30D / (dailyStats.length || 30);
        if (el.kpiAvgDay) el.kpiAvgDay.textContent = `Rp${formatCurrency(Math.round(dailyAvg))}`;

        // Render 30 Days Trend Line / Bar Chart
        if (state.chartMode === "item") {
            renderTrendChart(data.itemStats || []);
        } else {
            renderTrendChart(dailyStats);
        }

        // Render Category spend donut
        renderCategoryBreakdown(data.categoryStats || []);
    } catch (err) {
        showToast(err.message || "Failed to fetch dashboard statistics", "error");
    }
}

function renderTrendChart(chartData) {
    const canvas = document.getElementById("trend-chart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const mobile = isMobileViewport();
    const reduceMotion = prefersReducedMotion();

    // Ranking mode: sort by amount first, then keep the displayed sample chronological.
    let displayData = [...chartData];
    if (state.chartMode === "item") {
        displayData = displayData
            .sort((a, b) => b.amount - a.amount)
            .slice(0, state.chartMaxItems)
            .reverse();
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
    const chartKey = JSON.stringify({
        mode: state.chartMode,
        max: state.chartMaxItems,
        data: displayData
    });

    if (state.charts.trend && state.charts.trendKey === chartKey) {
        return;
    }
    if (state.charts.trend) {
        state.charts.trend.destroy();
    }
    state.charts.trendKey = chartKey;

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
                    borderWidth: mobile ? 2 : 3,
                    backgroundColor: purpleGrad,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: "#8b5cf6",
                    pointRadius: mobile ? 2 : 3,
                    pointHoverRadius: mobile ? 4 : 6
                }
            ]
        },
        plugins: [verticalLinePlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            ...(mobile || reduceMotion ? { animation: false } : {}),
            onClick: (event, activeElements) => {
                if (activeElements && activeElements.length > 0) {
                    const activePoint = activeElements[0];
                    const index = activePoint.index;
                    const clickedData = displayData[index];
                    if (state.chartMode === "day" && clickedData && clickedData.date) {
                        fetchDayTransactions(clickedData.date);
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
    if (dailyAvgEl && state.stats) {
        const dailyStats = state.stats.dailyStats || [];
        const totalExpense30D = dailyStats.reduce((sum, day) => sum + day.expense, 0);
        const dailyAvg = totalExpense30D / (dailyStats.length || 30);
        dailyAvgEl.textContent = `Rp${formatCurrency(Math.round(dailyAvg))}`;
    }

    // 3. Metric: Average Transaction Value (server-computed for a stable denominator)
    const avgTxEl = document.getElementById("insight-avg-tx");
    if (avgTxEl) {
        const avgTxVal = Number(state.stats?.kpi?.avgExpenseTransaction || 0);
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
                            <strong>${escapeHtml(capitalize(cat.category))}</strong>
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
        }
        state.charts.category = null;
        state.charts.categoryKey = null;
        return;
    }

    const categoryColors = ["#8b5cf6", "#ec4899", "#3b82f6", "#10b981", "#f59e0b", "#6366f1", "#ef4444", "#14b8a6"];
    const categoryKey = JSON.stringify(categories.map(c => [c.category, c.amount]));

    if (state.charts.category && state.charts.categoryKey === categoryKey) {
        return;
    }
    state.charts.categoryKey = categoryKey;

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
            ...(prefersReducedMotion() || isMobileViewport() ? { animation: false } : {}),
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
// TRANSACTIONS FETCH & VIEW
// ======================================================
async function fetchTransactionsPage(page = 1) {
    if (!el.allTbody) return;

    const requestId = ++state.transactionsRequestId;

    try {
        const params = new URLSearchParams({
            page: String(page),
            pageSize: String(state.filters.limit),
            sort: state.filters.sortBy,
            order: state.filters.sortOrder === 1 ? "asc" : "desc"
        });
        if (state.filters.search) params.set("search", state.filters.search);
        if (state.filters.date) params.set("date", state.filters.date);

        const data = await apiCall(`/api/transactions?${params.toString()}`);
        if (requestId !== state.transactionsRequestId) return;

        state.transactions = data.transactions || [];
        state.transactionsTotal = data.total;
        state.transactionsTotalPages = data.totalPages;
        state.filters.page = data.page;

        renderAllTransactionsTable();
        updatePaginationControls();
    } catch (err) {
        showToast(err.message || "Failed to fetch transactions list", "error");
    }
}

async function fetchRecentTransactions() {
    try {
        const data = await apiCall("/api/transactions?page=1&pageSize=20&sort=createdAt&order=desc");
        state.recentTransactions = data.transactions || [];
        renderRecentTransactionsMiniTable(state.recentTransactions);
    } catch (err) {
        console.error("Failed to fetch recent transactions:", err);
    }
}

async function fetchTopExpenses() {
    try {
        const data = await apiCall("/api/transactions/top?limit=20");
        state.topExpenses = data.transactions || [];
        renderTopExpensiveTable(state.topExpenses);
    } catch (err) {
        console.error("Failed to fetch top expenses:", err);
    }
}

async function fetchDayTransactions(dateStr) {
    const date = dateStr || getTodayDateStr();
    try {
        const data = await apiCall(
            `/api/transactions?date=${encodeURIComponent(date)}&pageSize=200&sort=createdAt&order=asc`
        );
        state.dayTransactions = data.transactions || [];
        updateCurrentDayHeader(date);
        renderCurrentDayTable(state.dayTransactions);
    } catch (err) {
        console.error("Failed to fetch day transactions:", err);
    }
}

function updateCurrentDayHeader(dateStr) {
    const titleEl = document.getElementById("current-day-title");
    const badgeEl = document.getElementById("current-day-badge");
    const todayStr = getTodayDateStr();

    if (dateStr === todayStr) {
        if (titleEl) titleEl.textContent = "Transaksi Hari Ini";
        if (badgeEl) {
            badgeEl.textContent = "Hari Ini";
            badgeEl.style.background = "linear-gradient(135deg, var(--accent-purple), var(--accent-pink))";
        }
    } else {
        const displayDate = new Date(`${dateStr}T00:00:00+07:00`).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Jakarta"
        });
        if (titleEl) titleEl.textContent = `Transaksi ${displayDate}`;
        if (badgeEl) {
            badgeEl.textContent = "Hari Terpilih";
            badgeEl.style.background = "linear-gradient(135deg, var(--accent-blue, #3b82f6), var(--accent-purple))";
        }
    }
}

function renderRecentTransactionsMiniTable(transactions) {
    if (!el.recentTbody) return;

    el.recentTbody.innerHTML = "";
    if (transactions.length === 0) {
        el.recentTbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-secondary)">No transactions found</td></tr>`;
        return;
    }

    let currentDayStr = null;
    let colorIndex = -1;
    const fragment = document.createDocumentFragment();

    transactions.forEach(t => {
        const formattedDate = formatTableDate(t.createdAt);
        const dayRef = t.createdAt ? toJakartaDateStrClient(new Date(t.createdAt)) : "no-date";
        const type = t.type === "income" ? "income" : "expense";

        if (currentDayStr !== dayRef) {
            currentDayStr = dayRef;
            colorIndex = (colorIndex + 1) % DAY_COLOR_CLASSES.length;
        }

        const tr = document.createElement("tr");
        tr.className = DAY_COLOR_CLASSES[colorIndex];
        tr.innerHTML = `
            <td><strong>${escapeHtml(t.item)}</strong></td>
            <td><span class="tx-amount ${type}">Rp${formatCurrency(t.amount)}</span></td>
            <td>${formattedDate}</td>
        `;
        fragment.appendChild(tr);
    });

    el.recentTbody.appendChild(fragment);
}

function renderAllTransactionsTable() {
    if (!el.allTbody) return;

    el.allTbody.innerHTML = "";
    if (state.transactions.length === 0) {
        el.allTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary)">No transactions found</td></tr>`;
        return;
    }

    let currentDayStr = null;
    let colorIndex = -1;
    const fragment = document.createDocumentFragment();

    state.transactions.forEach(t => {
        const formattedDate = formatTableDate(t.createdAt);
        const dayRef = t.createdAt ? toJakartaDateStrClient(new Date(t.createdAt)) : "no-date";
        const type = t.type === "income" ? "income" : "expense";
        const id = escapeHtml(String(t._id || ""));

        if (currentDayStr !== dayRef) {
            currentDayStr = dayRef;
            colorIndex = (colorIndex + 1) % DAY_COLOR_CLASSES.length;
        }

        const tr = document.createElement("tr");
        tr.className = DAY_COLOR_CLASSES[colorIndex];
        tr.innerHTML = `
            <td><strong>${escapeHtml(t.item)}</strong></td>
            <td><span class="tx-amount ${type}">Rp${formatCurrency(t.amount)}</span></td>
            <td><span class="tx-badge ${type}">${escapeHtml(t.category)}</span></td>
            <td style="text-transform: capitalize;">${escapeHtml(type)}</td>
            <td>${formattedDate}</td>
            <td>
                <div class="action-btns">
                    <button class="action-btn edit" data-id="${id}" title="Edit" aria-label="Edit transaction"><i data-lucide="edit-3"></i></button>
                    <button class="action-btn delete" data-id="${id}" title="Delete" aria-label="Delete transaction"><i data-lucide="trash-2"></i></button>
                </div>
            </td>
        `;

        tr.querySelector(".edit").addEventListener("click", () => openEditModal(t));
        tr.querySelector(".delete").addEventListener("click", () => deleteTransaction(t._id));

        fragment.appendChild(tr);
    });

    el.allTbody.appendChild(fragment);
    createIconsSafe();
}

// Delete transaction helper
async function deleteTransaction(id) {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    try {
        await apiCall(`/api/transactions/${id}`, "DELETE");
        showToast("Transaction deleted successfully", "success");
        await loadDashboardData(true);
        if (state.currentTab === "transactions") fetchTransactionsPage(state.filters.page);
    } catch (err) {
        showToast(err.message || "Failed to delete transaction", "error");
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
                state.filters.search = el.txSearch.value.trim();
                state.filters.page = 1;
                fetchTransactionsPage(1);
            }, 400);
        });
    }

    // Date filter selection
    if (el.txFilterDate) {
        el.txFilterDate.addEventListener("change", () => {
            state.filters.date = el.txFilterDate.value;
            state.filters.page = 1;
            fetchTransactionsPage(1);
        });
    }

    // Limit select change
    if (el.txLimitSelect) {
        el.txLimitSelect.addEventListener("change", () => {
            state.filters.limit = Number(el.txLimitSelect.value) || 10;
            state.filters.page = 1;
            fetchTransactionsPage(1);
        });
    }

    // Sorting headers click
    el.sortHeaders.forEach(header => {
        header.addEventListener("click", () => {
            const field = header.dataset.sort;
            if (state.filters.sortBy === field) {
                state.filters.sortOrder = state.filters.sortOrder === 1 ? -1 : 1;
            } else {
                state.filters.sortBy = field;
                state.filters.sortOrder = -1;
            }

            el.sortHeaders.forEach(h => {
                h.classList.remove("active");
                const icon = h.querySelector("i");
                if (icon) icon.setAttribute("data-lucide", "chevrons-up-down");
            });

            header.classList.add("active");
            const activeIcon = header.querySelector("i");
            if (activeIcon) {
                activeIcon.setAttribute("data-lucide", state.filters.sortOrder === 1 ? "chevron-up" : "chevron-down");
            }

            createIconsSafe();
            state.filters.page = 1;
            fetchTransactionsPage(1);
        });
    });
}

// ======================================================
// PAGINATION CONTROLS
// ======================================================
function initPagination() {
    if (el.paginationPrev) {
        el.paginationPrev.addEventListener("click", () => {
            if (state.filters.page > 1) {
                fetchTransactionsPage(state.filters.page - 1);
            }
        });
    }

    if (el.paginationNext) {
        el.paginationNext.addEventListener("click", () => {
            if (state.filters.page < state.transactionsTotalPages) {
                fetchTransactionsPage(state.filters.page + 1);
            }
        });
    }
}

function updatePaginationControls() {
    const total = state.transactionsTotal || 0;
    const page = state.filters.page || 1;
    const pageSize = state.filters.limit || 10;
    const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);

    if (el.paginationInfo) {
        el.paginationInfo.textContent = `Showing ${start}-${end} of ${total} transactions`;
    }
    if (el.paginationPrev) el.paginationPrev.disabled = page <= 1;
    if (el.paginationNext) el.paginationNext.disabled = page >= state.transactionsTotalPages;
}

// ======================================================
// DYNAMIC MODALS & FORMS
// ======================================================
function initModal() {
    if (el.quickAddBtn) el.quickAddBtn.addEventListener("click", () => openAddModal());
    if (el.modalCloseBtn) el.modalCloseBtn.addEventListener("click", closeModal);
    if (el.formCancelBtn) el.formCancelBtn.addEventListener("click", closeModal);

    if (el.modal) {
        el.modal.addEventListener("click", (e) => {
            if (e.target === el.modal) closeModal();
        });
    }

    if (el.form) el.form.addEventListener("submit", handleFormSubmit);
}

function setSelectValue(select, value, fallback) {
    if (!select) return;
    const next = value || fallback;
    if (!next) return;
    const exists = Array.from(select.options).some((option) => option.value === next);
    if (!exists) {
        select.add(new Option(capitalize(next), next));
    }
    select.value = next;
}

function toDatetimeLocalValue(dateInput) {
    if (!dateInput) return "";
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) return "";

    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    }).formatToParts(d);

    const p = {};
    parts.forEach(({ type, value }) => { p[type] = value; });
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
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

    el.modal.classList.add("active");
}

function openEditModal(tx) {
    el.modalTitle.textContent = "Edit Transaction";
    el.formId.value = tx._id;

    setSelectValue(el.formType, tx.type, "expense");
    setSelectValue(el.formCategory, tx.category, "manual");
    el.formItem.value = tx.item;
    el.formAmount.value = tx.amount;

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
    const createdAt = new Date(`${dateVal}T${timeVal}:00+07:00`);
    if (Number.isNaN(createdAt.getTime())) {
        showToast("Invalid date or time", "error");
        return;
    }
    const createdAtIso = createdAt.toISOString();

    const body = {
        type: el.formType.value,
        category: el.formCategory.value,
        item: el.formItem.value,
        amount: Number(el.formAmount.value),
        createdAt: createdAtIso
    };

    try {
        if (id) {
            await apiCall(`/api/transactions/${id}`, "PUT", body);
            showToast("Transaction updated successfully", "success");
        } else {
            await apiCall("/api/transactions", "POST", body);
            showToast("Transaction added successfully", "success");
        }
        closeModal();
        await loadDashboardData(true);
        if (state.currentTab === "transactions") fetchTransactionsPage(state.filters.page);
    } catch (err) {
        showToast(err.message || "Failed to save transaction", "error");
    }
}

// ======================================================
// GEMINI AI QUICK PARSER CONSOLE
// ======================================================
function initAIParser() {
    if (el.aiParseBtn) el.aiParseBtn.addEventListener("click", handleAIQuickParse);

    // Setup AI Modal visibility
    if (el.quickAiModalBtn) {
        el.quickAiModalBtn.addEventListener("click", () => {
            if (!el.aiInput || !el.aiPreview || !el.aiModal) return;
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
    if (!el.aiInput || !el.aiParseBtn || !el.aiPreview) return;

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
        showToast(err.message || "AI parsing failed. Please try again.", "error");
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
        const type = item.type === "income" ? "income" : "expense";
        div.className = "preview-item";
        div.innerHTML = `
            <div>
                <span>${escapeHtml(item.item)}</span>
                ${item.date ? `<span style="font-size: 11px; opacity: 0.7; margin-left: 6px;">${escapeHtml(item.date)}</span>` : ""}
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <span class="tx-amount ${type}">Rp${formatCurrency(item.amount)}</span>
                <span class="item-type ${type}">${escapeHtml(type)}</span>
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

    const transactions = state.tempParsedItems.map(item => ({
        type: item.type === "income" ? "income" : "expense",
        category: item.category || "manual",
        item: item.item,
        amount: item.amount,
        createdAt: item.date ? `${item.date}T12:00:00+07:00` : new Date().toISOString()
    }));

    try {
        const result = await apiCall("/api/transactions/bulk", "POST", { transactions });
        const failed = result.failed?.length || 0;
        showToast(
            `Saved ${result.inserted} of ${transactions.length} transactions`,
            failed > 0 ? "error" : "success"
        );
        el.aiPreview.classList.add("hidden");
        el.aiInput.value = "";
        state.tempParsedItems = [];

        if (el.aiModal) {
            el.aiModal.classList.remove("active");
        }

        await loadDashboardData(true);
        if (state.currentTab === "transactions") fetchTransactionsPage(1);
    } catch (err) {
        showToast(err.message || "Failed to save transactions", "error");
    }
}

// ======================================================
// COMMON FRONTEND UTILITY HELPERS
// ======================================================
let iconFrame = null;

function createIconsSafe() {
    if (typeof lucide === "undefined" || !lucide.createIcons) {
        console.warn("Lucide icons library is not loaded.");
        return;
    }

    // After the first pass, most calls have nothing to do. Avoid a full-document
    // scan on every table/calendar/toast render.
    if (!document.querySelector("[data-lucide]")) return;
    if (iconFrame !== null) return;

    iconFrame = window.requestAnimationFrame(() => {
        iconFrame = null;
        lucide.createIcons();
    });
}
let toastTimer = null;

function showToast(message, type = "success") {
    if (!el.toast || !el.toastMsg || !el.toastIcon) return;

    clearTimeout(toastTimer);
    el.toastMsg.textContent = message;
    el.toast.className = `toast glass show ${type}`;

    if (type === "success") {
        el.toastIcon.setAttribute("data-lucide", "check-circle-2");
    } else {
        el.toastIcon.setAttribute("data-lucide", "alert-triangle");
    }
    createIconsSafe();

    toastTimer = setTimeout(() => {
        el.toast.classList.remove("show");
    }, 3000);
}

function formatCurrency(value) {
    return new Intl.NumberFormat("id-ID").format(Number(value) || 0);
}

function capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
        switch (char) {
            case "&": return "&amp;";
            case "<": return "&lt;";
            case ">": return "&gt;";
            case '"': return "&quot;";
            default: return "&#039;";
        }
    });
}

function renderTopExpensiveTable(transactions) {
    if (!el.topExpensiveTbody) return;

    el.topExpensiveTbody.innerHTML = "";
    if (transactions.length === 0) {
        el.topExpensiveTbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-secondary)">No high value items</td></tr>`;
        return;
    }

    let currentDayStr = null;
    let colorIndex = -1;
    const fragment = document.createDocumentFragment();

    transactions.forEach(t => {
        const formattedDate = formatTableDate(t.createdAt);
        const dayRef = t.createdAt ? toJakartaDateStrClient(new Date(t.createdAt)) : "no-date";

        if (currentDayStr !== dayRef) {
            currentDayStr = dayRef;
            colorIndex = (colorIndex + 1) % DAY_COLOR_CLASSES.length;
        }

        const tr = document.createElement("tr");
        tr.className = DAY_COLOR_CLASSES[colorIndex];
        tr.innerHTML = `
            <td><strong>${escapeHtml(t.item)}</strong></td>
            <td><span class="tx-amount expense">Rp${formatCurrency(t.amount)}</span></td>
            <td>${formattedDate}</td>
        `;
        fragment.appendChild(tr);
    });

    el.topExpensiveTbody.appendChild(fragment);
}

function initChartToggle() {
    if (!el.chartModeDayBtn || !el.chartModeItemBtn) return;

    el.chartModeDayBtn.addEventListener("click", () => {
        if (state.chartMode === "day") return;
        state.chartMode = "day";
        el.chartModeDayBtn.classList.add("active");
        el.chartModeItemBtn.classList.remove("active");
        if (el.chartMaxWrapper) el.chartMaxWrapper.style.display = "none";
        renderTrendChart(state.stats?.dailyStats || []);
    });

    el.chartModeItemBtn.addEventListener("click", () => {
        if (state.chartMode === "item") return;
        state.chartMode = "item";
        el.chartModeItemBtn.classList.add("active");
        el.chartModeDayBtn.classList.remove("active");
        if (el.chartMaxWrapper) el.chartMaxWrapper.style.display = "inline-block";
        renderTrendChart(state.stats?.itemStats || []);
    });

    if (el.chartMaxSelect) {
        el.chartMaxSelect.addEventListener("change", () => {
            state.chartMaxItems = Number(el.chartMaxSelect.value) || 10;
            if (state.chartMode === "item") {
                renderTrendChart(state.stats?.itemStats || []);
            }
        });
    }
}

// ======================================================
// CLIENT-SIDE DATE HELPERS & DAY-FILTERED RENDERING
// ======================================================

// Convert any Date to YYYY-MM-DD string in Jakarta timezone
function toJakartaDateStrClient(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return "no-date";

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

function getJakartaYearMonthClient(date = new Date()) {
    const [year, month] = toJakartaDateStrClient(date).split("-").map(Number);
    return { year, month };
}

function renderCurrentDayTable(transactions) {
    const tbody = document.getElementById("current-day-tbody");
    const totalEl = document.getElementById("current-day-total");
    if (!tbody) return;

    tbody.innerHTML = "";

    // Calculate total expenses and income for this specific day
    const totalExpenses = (transactions || []).filter(t => t.type === "expense").reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totalIncome = (transactions || []).filter(t => t.type === "income").reduce((sum, t) => sum + Number(t.amount || 0), 0);

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

    const fragment = document.createDocumentFragment();

    transactions.forEach(t => {
        const d = new Date(t.createdAt);
        const type = t.type === "income" ? "income" : "expense";
        const validDate = !Number.isNaN(d.getTime());
        let timeStr = "-";

        if (validDate) {
            const parts = new Intl.DateTimeFormat("id-ID", {
                timeZone: "Asia/Jakarta",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            }).formatToParts(d);
            const p = {};
            parts.forEach(({ type: partType, value }) => { p[partType] = value; });
            timeStr = `${p.hour}:${p.minute} WIB`;
        }

        const relativeStr = getRelativeTimeString(t.createdAt);

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${escapeHtml(t.item)}</strong></td>
            <td><span class="tx-amount ${type}">Rp${formatCurrency(t.amount)}</span></td>
            <td><div>${timeStr}</div><div style="font-size:10px;color:var(--text-secondary);margin-top:1px;">${relativeStr}</div></td>
        `;
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
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
    const timestamp = new Date(date).getTime();
    if (Number.isNaN(timestamp)) return "";

    const now = Date.now();
    const diffMs = now - timestamp;
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

const ID_MONTHS_FULL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function formatJakartaIndonesianDate(dateInput, includeTime = true, shortMonth = false) {
    if (!dateInput) return "-";
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (Number.isNaN(d.getTime())) return "-";

    const formatter = new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        weekday: "long",
        day: "numeric",
        month: shortMonth ? "short" : "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    });

    const parts = formatter.formatToParts(d);
    const p = {};
    parts.forEach(({ type, value }) => { p[type] = value; });

    const weekday = p.weekday ? p.weekday.charAt(0).toUpperCase() + p.weekday.slice(1) : "";
    const dateStr = `${weekday}, ${p.day} ${p.month} ${p.year}`;
    if (!includeTime) return dateStr;
    return `${dateStr} ${p.hour}:${p.minute} WIB`;
}

function formatTableDate(date) {
    if (!date) return "-";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "-";
    
    const dateStr = formatJakartaIndonesianDate(d, false);
    const shortDateStr = formatJakartaIndonesianDate(d, false, true);
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
                <span class="tx-date-text">
                    <span class="tx-date-full">${dateStr}</span>
                    <span class="tx-date-short">${shortDateStr}</span>
                </span>
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
    if (el.calendarPrevBtn) el.calendarPrevBtn.addEventListener("click", () => shiftCalendarMonth(-1));
    if (el.calendarNextBtn) el.calendarNextBtn.addEventListener("click", () => shiftCalendarMonth(1));

    if (el.calendarTodayBtn) {
        el.calendarTodayBtn.addEventListener("click", () => {
            const { year, month } = getJakartaYearMonthClient();
            state.calendarYear = year;
            state.calendarMonth = month;
            fetchCalendar();
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

function shiftCalendarMonth(delta) {
    const monthIndex = state.calendarYear * 12 + (state.calendarMonth - 1) + delta;
    const year = Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;

    if (year < 2000 || year > 2100) return;

    state.calendarYear = year;
    state.calendarMonth = month;
    fetchCalendar();
}

async function fetchCalendar() {
    try {
        const data = await apiCall(
            `/api/calendar?year=${state.calendarYear}&month=${state.calendarMonth}&detail=1`
        );
        state.calendarData = data;
        renderExpenseCalendar();
    } catch (err) {
        console.error("Failed to fetch calendar:", err);
        showToast(err.message || "Failed to fetch calendar", "error");
    }
}

function renderExpenseCalendar() {
    if (!el.calendarDaysGrid) return;

    const currentYear = state.calendarYear;
    const currentMonth = state.calendarMonth; // 1-indexed
    const monthIndex = currentMonth - 1;
    const monthNames = ID_MONTHS_FULL;
    const mobile = isMobileViewport();

    if (el.calendarMonthYear) {
        el.calendarMonthYear.textContent = `${monthNames[monthIndex]} ${currentYear}`;
    }

    const firstDayIndex = new Date(currentYear, monthIndex, 1).getDay();
    const totalDaysInMonth = new Date(currentYear, monthIndex + 1, 0).getDate();
    const prevMonthLastDay = new Date(currentYear, monthIndex, 0).getDate();

    const dayExpenseMap = {};
    (state.calendarData.days || []).forEach(day => {
        const dayNum = Number(String(day.date || "").slice(8, 10));
        if (dayNum >= 1 && dayNum <= totalDaysInMonth) {
            dayExpenseMap[dayNum] = {
                total: Number(day.total || 0),
                items: Array.isArray(day.items) ? day.items : []
            };
        }
    });

    let peakExpense = 0;
    let peakDay = null;

    Object.keys(dayExpenseMap).forEach(dayKey => {
        const dayTotal = dayExpenseMap[dayKey].total;
        if (dayTotal > peakExpense) {
            peakExpense = dayTotal;
            peakDay = dayKey;
        }
    });

    // monthTotal comes from the API's aggregation scoped to the selected month.
    const monthlyExpenseSum = Number(state.calendarData.monthTotal || 0);

    if (el.calendarMonthTotal) {
        el.calendarMonthTotal.textContent = `Total: Rp${formatCurrency(monthlyExpenseSum)}`;
    }
    const dailyAvg = totalDaysInMonth > 0 ? Math.round(monthlyExpenseSum / totalDaysInMonth) : 0;
    if (el.calStatAvg) el.calStatAvg.textContent = `Rp${formatCurrency(dailyAvg)}`;
    if (el.calStatPeak) {
        el.calStatPeak.textContent = peakDay
            ? `${peakDay} ${monthNames[monthIndex]} (Rp${formatCurrency(peakExpense)})`
            : "-";
    }

    el.calendarDaysGrid.innerHTML = "";

    const todayStr = getTodayDateStr();
    const [todayYear, todayMonth, todayDay] = todayStr.split("-").map(Number);
    const isCurrentActualMonth = todayYear === currentYear && todayMonth === currentMonth;
    const dayStories = state.calendarData.stories || {};

    for (let i = firstDayIndex; i > 0; i -= 1) {
        const prevDayNum = prevMonthLastDay - i + 1;
        const cell = document.createElement("div");
        cell.className = "calendar-day-cell other-month";
        cell.innerHTML = `<span class="calendar-day-number">${prevDayNum}</span>`;
        el.calendarDaysGrid.appendChild(cell);
    }

    for (let day = 1; day <= totalDaysInMonth; day += 1) {
        const cell = document.createElement("div");
        const isToday = isCurrentActualMonth && day === todayDay;
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
            (dayData.items || []).forEach(item => {
                itemRows += `
                    <div class="cal-item-row">
                        <span class="cal-item-name" title="${escapeHtml(item.item)}">${escapeHtml(item.item)}</span>
                        <span class="cal-item-amt"><span class="cal-item-amt-currency">Rp</span>${formatShortCurrency(item.amount)}</span>
                    </div>
                `;
            });

            itemsListHtml = `<div class="calendar-day-items-list">${itemRows}</div>`;
        }

        const dateKey = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const storiesForDay = dayStories[dateKey] || [];
        const hasStories = storiesForDay.length > 0;
        let storyHtml = "";

        if (hasStories) {
            const titleText = storiesForDay[0].title || "Untitled Story";

            if (mobile) {
                storyHtml = `
                    <button type="button" class="cal-story-wrap has-stories" title="Read: ${escapeHtml(titleText)}">
                        <i data-lucide="notebook-pen" class="cal-story-icon"></i>
                    </button>
                `;
            } else {
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

        const storyBtn = cell.querySelector(".cal-story-wrap.has-stories");
        if (storyBtn) {
            storyBtn.addEventListener("click", (event) => {
                event.stopPropagation();
                openStoryView(storiesForDay[0], storiesForDay);
            });
        }

        if (dayData && dayData.total > 0) {
            cell.addEventListener("click", () => openCalendarDayModal(currentYear, currentMonth, day, dayData));
        }

        el.calendarDaysGrid.appendChild(cell);
    }

    const totalCellsSoFar = firstDayIndex + totalDaysInMonth;
    const remainingCells = (7 - (totalCellsSoFar % 7)) % 7;
    for (let i = 1; i <= remainingCells; i += 1) {
        const cell = document.createElement("div");
        cell.className = "calendar-day-cell other-month";
        cell.innerHTML = `<span class="calendar-day-number">${i}</span>`;
        el.calendarDaysGrid.appendChild(cell);
    }

    createIconsSafe();
}

async function openCalendarDayModal(year, month, day, dayData) {
    const jsMonth = String(month).padStart(2, "0");
    const jsDay = String(day).padStart(2, "0");
    const dateKey = `${year}-${jsMonth}-${jsDay}`;
    const dateObj = new Date(`${dateKey}T12:00:00+07:00`);
    const dateStr = formatJakartaIndonesianDate(dateObj, false);

    if (el.calModalDateTitle) el.calModalDateTitle.textContent = dateStr;
    if (el.calModalTotal) el.calModalTotal.textContent = `Total Pengeluaran: Rp${formatCurrency(dayData.total)}`;
    if (el.calModalTbody) {
        el.calModalTbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--text-secondary)">Loading...</td></tr>`;
    }

    if (el.calendarDayModal) {
        el.calendarDayModal.classList.add("active");
    }

    let items = Array.isArray(dayData.items) ? dayData.items : null;

    if (!items) {
        try {
            const data = await apiCall(
                `/api/transactions?date=${dateKey}&pageSize=200&sort=createdAt&order=asc`
            );
            items = data.transactions || [];
        } catch (err) {
            items = [];
            showToast(err.message || "Failed to fetch day details", "error");
        }
    }

    if (!el.calModalTbody) return;

    el.calModalTbody.innerHTML = "";
    const fragment = document.createDocumentFragment();

    items.forEach(item => {
        const type = item.type === "income" ? "income" : "expense";
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${escapeHtml(item.item)}</strong></td>
            <td><span class="tx-badge ${type}">${escapeHtml(item.category || "manual")}</span></td>
            <td><span class="tx-amount ${type}">Rp${formatCurrency(item.amount)}</span></td>
        `;
        fragment.appendChild(tr);
    });

    el.calModalTbody.appendChild(fragment);
}

function initModalAccessibility() {
    const modals = document.querySelectorAll(".modal-overlay");

    modals.forEach((modal) => {
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
    });

    document.querySelectorAll(".modal-close").forEach((button) => {
        if (!button.getAttribute("aria-label")) {
            button.setAttribute("aria-label", "Close dialog");
        }
    });

    if (el.storyMoodPicker) {
        el.storyMoodPicker.querySelectorAll(".mood-btn").forEach((button) => {
            button.setAttribute("aria-label", button.dataset.mood ? `Mood ${button.dataset.mood}` : "No mood");
        });
    }

    let lastFocused = null;
    const focusableSelector = [
        "button:not([disabled])",
        "[href]",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "[tabindex]:not([tabindex='-1'])"
    ].join(",");

    const observer = new MutationObserver(() => {
        const activeModal = document.querySelector(".modal-overlay.active");
        document.body.classList.toggle("modal-open", Boolean(activeModal));

        if (activeModal && !lastFocused) {
            lastFocused = document.activeElement;
            const focusable = activeModal.querySelectorAll(focusableSelector);
            if (focusable.length > 0) focusable[0].focus();
        } else if (!activeModal && lastFocused) {
            if (typeof lastFocused.focus === "function") lastFocused.focus();
            lastFocused = null;
        }
    });

    modals.forEach((modal) => {
        observer.observe(modal, { attributes: true, attributeFilter: ["class"] });
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            document.querySelectorAll(".modal-overlay.active").forEach((modal) => {
                modal.classList.remove("active");
            });
            return;
        }

        if (event.key !== "Tab") return;

        const activeModal = document.querySelector(".modal-overlay.active .modal-content");
        if (!activeModal) return;

        const focusable = Array.from(activeModal.querySelectorAll(focusableSelector))
            .filter((element) => element.offsetParent !== null);
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });
}
