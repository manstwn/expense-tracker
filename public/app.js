// Global App State
const state = {
    pin: [],
    token: localStorage.getItem("session_token") || null,
    currentTab: "overview",
    stats: null,
    users: [],
    transactions: [],
    totalTransactions: 0,
    filters: {
        search: "",
        userId: "",
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
    chartMaxItems: 10 // Default to top 10 items
};

// Elements
const el = {
    loginScreen: document.getElementById("login-screen"),
    dashboardScreen: document.getElementById("dashboard-screen"),
    pinDots: document.querySelectorAll(".pin-dot"),
    loginError: document.getElementById("login-error"),
    loginContainer: document.querySelector(".login-container"),
    
    // Sidebar Tabs
    navItems: document.querySelectorAll(".nav-item"),
    tabPanes: document.querySelectorAll(".tab-pane"),
    logoutBtn: document.getElementById("logout-btn"),
    
    // KPIs
    kpiTodayExpense: document.getElementById("kpi-today-expense"),
    kpiMonthExpense: document.getElementById("kpi-month-expense"),
    kpiMonthIncome: document.getElementById("kpi-month-income"),
    kpiAvgDay: document.getElementById("kpi-avg-day"),
    
    // Tables
    recentTbody: document.getElementById("recent-transactions-tbody"),
    allTbody: document.getElementById("all-transactions-tbody"),
    topExpensiveTbody: document.getElementById("top-expensive-tbody"),
    
    // Filters & Pagination
    txSearch: document.getElementById("tx-search-input"),
    txFilterUser: document.getElementById("tx-filter-user"),
    txLimitSelect: document.getElementById("tx-limit-select"),
    sortHeaders: document.querySelectorAll("th.sortable"),
    paginationInfo: document.getElementById("pagination-info"),
    paginationPrev: document.getElementById("pagination-prev"),
    paginationNext: document.getElementById("pagination-next"),
    
    // AI quick add
    aiInput: document.getElementById("ai-input-text"),
    aiParseBtn: document.getElementById("ai-parse-btn"),
    aiPreview: document.getElementById("ai-preview"),
    
    // Modal & Form
    quickAddBtn: document.getElementById("quick-add-btn"),
    modal: document.getElementById("tx-modal"),
    modalTitle: document.getElementById("modal-title"),
    modalCloseBtn: document.getElementById("modal-close-btn"),
    formCancelBtn: document.getElementById("form-cancel-btn"),
    form: document.getElementById("tx-form"),
    formId: document.getElementById("form-tx-id"),
    formType: document.getElementById("form-type"),
    formCategory: document.getElementById("form-category"),
    formItem: document.getElementById("form-item"),
    formAmount: document.getElementById("form-amount"),
    formDate: document.getElementById("form-date"),
    formUserId: document.getElementById("form-userid"),
    formUsername: document.getElementById("form-username"),
    
    // Toast
    toast: document.getElementById("toast"),
    toastIcon: document.getElementById("toast-icon"),
    toastMsg: document.getElementById("toast-message"),

    // Chart Mode Toggle Buttons
    chartModeDayBtn: document.getElementById("chart-mode-day"),
    chartModeItemBtn: document.getElementById("chart-mode-item"),
    chartMaxWrapper: document.getElementById("chart-max-wrapper"),
    chartMaxSelect: document.getElementById("chart-max-select"),
    
    // AI Modal Elements
    aiModal: document.getElementById("ai-modal"),
    quickAiModalBtn: document.getElementById("quick-ai-modal-btn"),
    aiModalCloseBtn: document.getElementById("ai-modal-close-btn")
};

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
document.addEventListener("DOMContentLoaded", () => {
    initKeypad();
    initTabs();
    initModal();
    initFilters();
    initPagination();
    initAIParser();
    initChartToggle();
    createIconsSafe();
    
    // Auto-login check
    if (state.token) {
        verifySession();
    } else {
        showScreen("login");
    }
});

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
function loadDashboardData() {
    fetchStats();
    fetchUsers();
    fetchTransactions();
    fetchTopExpenses();
    fetchCurrentDayTransactions();
}

// Logout
function logout() {
    state.token = null;
    localStorage.removeItem("session_token");
    showScreen("login");
    showToast("Logged out successfully", "success");
}

el.logoutBtn.addEventListener("click", logout);

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
        fetchCurrentDayTransactions();
    } else if (tab === "insights") {
        fetchStats();
    }
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
                        fetchCurrentDayTransactions(clickedData.date);
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
        const params = new URLSearchParams();
        if (state.filters.search) params.append("search", state.filters.search);
        if (state.filters.userId) params.append("userId", state.filters.userId);
        params.append("sortBy", state.filters.sortBy);
        params.append("sortOrder", state.filters.sortOrder.toString());
        
        // Pagination logic for full tab
        if (state.currentTab === "transactions") {
            params.append("limit", state.filters.limit.toString());
            params.append("skip", state.filters.skip.toString());
        } else {
            // For overview mini list, fetch latest 10 items
            params.append("limit", "10");
            params.append("skip", "0");
        }
        
        const data = await apiCall(`/api/transactions?${params.toString()}`);
        
        if (state.currentTab === "transactions") {
            state.transactions = data.transactions;
            state.totalTransactions = data.total;
            renderAllTransactionsTable();
            updatePaginationControls();
        } else {
            renderRecentTransactionsMiniTable(data.transactions);
        }
    } catch (err) {
        showToast("Failed to fetch transactions list", "error");
    }
}

function renderRecentTransactionsMiniTable(transactions) {
    el.recentTbody.innerHTML = "";
    if (transactions.length === 0) {
        el.recentTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary)">No transactions found</td></tr>`;
        return;
    }
    
    let currentDayStr = null;
    let dayGroupClass = "day-group-1";
    
    transactions.forEach(t => {
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
            <td>${formattedDate}</td>
        `;
        el.recentTbody.appendChild(tr);
    });
}

function renderAllTransactionsTable() {
    el.allTbody.innerHTML = "";
    if (state.transactions.length === 0) {
        el.allTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary)">No transactions found</td></tr>`;
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
        
        let displayUsername = t.username;
        if (!displayUsername && t.userId && t.userId.toString() === "1828479746") {
            displayUsername = "imanstwn";
        }
        const userLabel = displayUsername ? `@${displayUsername}` : (t.userId ? `ID: ${t.userId}` : "-");
        const avatarChar = (displayUsername || "U").charAt(0).toUpperCase();
        
        const tr = document.createElement("tr");
        tr.className = dayGroupClass;
        tr.innerHTML = `
            <td><strong>${escapeHtml(t.item)}</strong></td>
            <td><span class="tx-amount ${t.type}">Rp${formatCurrency(t.amount)}</span></td>
            <td><span class="tx-badge ${t.type}">${escapeHtml(t.category)}</span></td>
            <td style="text-transform: capitalize;">${t.type}</td>
            <td>
                <div class="user-tag">
                    <div class="avatar">${avatarChar}</div>
                    <span>${userLabel}</span>
                </div>
            </td>
            <td>${formattedDate}</td>
            <td>
                <div class="action-btns">
                    <button class="action-btn edit" data-id="${t._id}"><i data-lucide="edit-3"></i></button>
                    <button class="action-btn delete" data-id="${t._id}"><i data-lucide="trash-2"></i></button>
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
    el.txSearch.addEventListener("input", () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
            state.filters.search = el.txSearch.value;
            state.filters.skip = 0;
            fetchTransactions();
        }, 400);
    });
    
    // User filter dropdown selection
    el.txFilterUser.addEventListener("change", () => {
        state.filters.userId = el.txFilterUser.value;
        state.filters.skip = 0;
        fetchTransactions();
    });

    // Limit select change
    el.txLimitSelect.addEventListener("change", () => {
        state.filters.limit = parseInt(el.txLimitSelect.value) || 10;
        state.filters.skip = 0;
        fetchTransactions();
    });
    
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
            state.filters.skip = 0;
            fetchTransactions();
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

function openAddModal() {
    el.modalTitle.textContent = "Add Transaction";
    el.formId.value = "";
    el.form.reset();
    
    // Set default date-time to now in local user's timezone
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    el.formDate.value = now.toISOString().slice(0, 16);
    
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
    
    const date = tx.createdAt ? new Date(tx.createdAt) : new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    el.formDate.value = date.toISOString().slice(0, 16);
    
    el.modal.classList.add("active");
}

function closeModal() {
    el.modal.classList.remove("active");
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const id = el.formId.value;
    const body = {
        type: el.formType.value,
        category: el.formCategory.value,
        item: el.formItem.value,
        amount: parseFloat(el.formAmount.value),
        createdAt: new Date(el.formDate.value).toISOString(),
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

async function fetchTopExpenses() {
    try {
        const topExpenses = await apiCall("/api/transactions/top");
        renderTopExpensiveTable(topExpenses);
    } catch (err) {
        console.error("Failed to fetch top expenses:", err);
    }
}

function renderTopExpensiveTable(transactions) {
    el.topExpensiveTbody.innerHTML = "";
    if (transactions.length === 0) {
        el.topExpensiveTbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-secondary)">No high value items</td></tr>`;
        return;
    }
    
    let currentDayStr = null;
    let dayGroupClass = "day-group-1";
    
    transactions.forEach(t => {
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

// Current Day / Clicked Day Transactions Helpers
function getTodayDateStr() {
    // Explicitly format in Jakarta timezone to match backend grouping
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());
    const map = {};
    parts.forEach(({ type, value }) => (map[type] = value));
    return `${map.year}-${map.month}-${map.day}`;
}

async function fetchCurrentDayTransactions(dateStr) {
    try {
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

        const data = await apiCall(`/api/transactions?date=${dateToQuery}&limit=100`);
        renderCurrentDayTable(data.transactions);
    } catch (err) {
        console.error("Failed to fetch current day transactions:", err);
    }
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
        const timeStr = `${String(d.getHours()).padStart(2,'0')}.${String(d.getMinutes()).padStart(2,'0')}`;
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

function formatTableDate(date) {
    if (!date) return "-";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "-";
    const day = d.getDate();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[d.getMonth()];
    const year = d.getFullYear();
    const dateStr = `${day} ${month} ${year}`;
    const relativeStr = getRelativeTimeString(date);
    return `
        <div>${dateStr}</div>
        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">${relativeStr}</div>
    `;
}
