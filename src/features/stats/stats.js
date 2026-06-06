import { store } from "../../store.js";

// Chart instances — destroy trước khi re-render
let _barChart = null;
let _pieChart = null;

// State
let _currentTimeframe = "month"; // 'month' | 'quarter' | 'year'
let _currentPeriod = null; // 'YYYY-MM' | 'YYYY-QN' | 'YYYY'

// Fallback colors khi NXB không có trong bảng brand
const PIE_COLORS = [
  "#16a34a",
  "#2563eb",
  "#7c3aed",
  "#ea580c",
  "#0891b2",
  "#db2777",
  "#d97706",
  "#64748b",
];

// Màu thương hiệu + logo NXB (Google Favicon fallback)
const PUBLISHER_BRANDS = {
  "Kim Đồng": {
    color: "#ed1b24",
    logo: "https://www.google.com/s2/favicons?domain=nxbkimdong.com.vn&sz=32",
  },
  IPM: {
    color: "#00a14b",
    logo: "https://www.google.com/s2/favicons?domain=ipm.com.vn&sz=32",
  },
  "NXB Trẻ": {
    color: "#004b8d",
    logo: "https://www.google.com/s2/favicons?domain=nxbtre.com.vn&sz=32",
  },
  Skycomics: {
    color: "#6a1b9a",
    logo: "https://www.google.com/s2/favicons?domain=skycomics.vn&sz=32",
  },
  "Đông A": {
    color: "#e65100",
    logo: "https://www.google.com/s2/favicons?domain=dongabook.com.vn&sz=32",
  },
  "Tsuki Manga": {
    color: "#7e22ce",
    logo: "https://www.google.com/s2/favicons?domain=tsukimanga.com&sz=32",
  },
  Wingsbooks: {
    color: "#0369a1",
    logo: "https://www.google.com/s2/favicons?domain=wingsbooks.vn&sz=32",
  },
};

function _getBrandColor(name, fallbackIdx) {
  return (
    PUBLISHER_BRANDS[name]?.color ?? PIE_COLORS[fallbackIdx % PIE_COLORS.length]
  );
}
function _getBrandLogo(name) {
  return PUBLISHER_BRANDS[name]?.logo ?? null;
}

// ─── PUBLIC API ────────────────────────────────────────────────────────────────

export async function renderStats(forceSkeleton = false) {
  const loginGate = document.getElementById("stats-login-gate");
  const content = document.getElementById("stats-content");

  if (forceSkeleton) {
    if (loginGate) loginGate.classList.add("hidden");
    if (content) content.classList.remove("hidden");
  } else if (!store.user) {
    if (loginGate) loginGate.classList.remove("hidden");
    if (content) content.classList.add("hidden");
    if (window.feather) {
      try {
        feather.replace();
      } catch (e) {}
    }
    return;
  } else {
    if (loginGate) loginGate.classList.add("hidden");
    if (content) content.classList.remove("hidden");
  }

  if (!store.data || store.data.length === 0) {
    // Render skeletons
    const statGrid = document.querySelector(".stats-grid");
    if (statGrid) {
      statGrid.innerHTML = Array(4)
        .fill(
          `
                <div class="stats-card" style="border: 1px solid var(--border); box-shadow: none;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
                        <div class="skeleton skeleton-text medium" style="margin:0;"></div>
                        <div class="skeleton skeleton-text" style="width:32px; height:32px; border-radius:8px; margin:0;"></div>
                    </div>
                    <div class="skeleton skeleton-text large" style="height:2rem; margin:0;"></div>
                </div>
            `,
        )
        .join("");
    }

    const chartGrid = document.querySelector(".stats-chart-grid");
    if (chartGrid) {
      chartGrid.innerHTML = `
                <div class="stats-chart-card" style="border: 1px solid var(--border); box-shadow: none; min-height: 350px; display:flex; flex-direction:column;">
                    <div class="skeleton skeleton-text medium" style="height:1.5rem; margin-bottom:1.5rem;"></div>
                    <div class="skeleton" style="flex:1; width:100%; border-radius:8px;"></div>
                </div>
                <div class="stats-chart-card" style="border: 1px solid var(--border); box-shadow: none; min-height: 350px; display:flex; flex-direction:column;">
                    <div class="skeleton skeleton-text medium" style="height:1.5rem; margin-bottom:1.5rem;"></div>
                    <div class="skeleton" style="flex:1; width:100%; border-radius:50%; aspect-ratio:1/1; max-height:250px; margin:0 auto;"></div>
                </div>
            `;
    }

    if (forceSkeleton) return; // Stop here, don't await loadData or render summary cards

    await window.app.loadData();

    // Cần render lại DOM gốc vì skeleton đã ghi đè innerHTML của grid
    if (statGrid)
      statGrid.innerHTML = `
            <div class="stats-card">
                <div class="stats-card-header">
                    <h3 class="stats-card-title">Tổng số cuốn</h3>
                    <div class="stats-card-icon"><i data-feather="book"></i></div>
                </div>
                <div class="stats-card-value" id="stat-total-books">0</div>
            </div>
            <div class="stats-card">
                <div class="stats-card-header">
                    <h3 class="stats-card-title">Series đang theo</h3>
                    <div class="stats-card-icon" style="background:#dbeafe;color:#2563eb;"><i data-feather="layers"></i></div>
                </div>
                <div class="stats-card-value" id="stat-total-series">0</div>
            </div>
            <div class="stats-card">
                <div class="stats-card-header">
                    <h3 class="stats-card-title">Thêm tháng này</h3>
                    <div class="stats-card-icon" style="background:#dcfce7;color:#16a34a;"><i data-feather="trending-up"></i></div>
                </div>
                <div class="stats-card-value" id="stat-this-month">0</div>
                <div class="stats-card-trend">
                    <span style="color:var(--text-muted); font-size:0.8rem;">Bắt đầu <strong id="stat-new-series">0</strong> series mới</span>
                </div>
            </div>
            <div class="stats-card">
                <div class="stats-card-header">
                    <h3 class="stats-card-title">Tổng giá trị</h3>
                    <div class="stats-card-icon" style="background:#fef3c7;color:#d97706;"><i data-feather="dollar-sign"></i></div>
                </div>
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <div class="stats-card-value" id="stat-total-value" data-raw="0" data-visible="false">••••••••</div>
                    <button class="btn btn-icon" id="stat-value-eye" onclick="app.toggleTotalValue()" title="Hiện/Ẩn giá trị" style="margin-top:-5px;">
                        <i data-feather="eye"></i>
                    </button>
                </div>
            </div>
        `;

    if (chartGrid)
      chartGrid.innerHTML = `
            <div class="stats-chart-card">
                <div class="stats-chart-header">
                    <h3 class="stats-chart-title">Tiến độ sưu tầm</h3>
                    <div class="stats-tf-controls">
                        <button class="stats-tf-btn stats-tf-active" data-tf="month" onclick="app.setStatsTimeframe('month')">Tháng</button>
                        <button class="stats-tf-btn" data-tf="quarter" onclick="app.setStatsTimeframe('quarter')">Quý</button>
                        <button class="stats-tf-btn" data-tf="year" onclick="app.setStatsTimeframe('year')">Năm</button>
                    </div>
                </div>
                <!-- Custom Dropdown Chọn Kỳ -->
                <div id="stats-period-wrapper" class="custom-select-container dropdown-wrapper" style="margin-bottom: 1rem;">
                    <button class="custom-select-btn" onclick="app.toggleCustomDropdown('stats-period-dropdown')" style="width:fit-content; padding: 0.4rem 0.8rem; border-color: var(--border);">
                        <i data-feather="calendar" style="width:14px; height:14px; color:var(--text-muted);"></i>
                        <span id="stats-period-label" style="font-size:0.85rem; font-weight:500;">...</span>
                        <i data-feather="chevron-down" style="width:14px; height:14px; color:var(--text-muted);"></i>
                    </button>
                    <div id="stats-period-dropdown" class="user-dropdown custom-select-menu hidden" style="min-width: 180px;">
                        <!-- Options sẽ được render ở đây -->
                    </div>
                </div>
                <div class="stats-chart-body">
                    <canvas id="chart-bar-timeline"></canvas>
                </div>
            </div>
            <div class="stats-chart-card">
                <div class="stats-chart-header">
                    <h3 class="stats-chart-title">Nhà xuất bản</h3>
                </div>
                <div class="stats-chart-body pie-chart-body">
                    <canvas id="chart-pie-publisher"></canvas>
                </div>
                <div class="stats-legend" id="stats-publisher-legend"></div>
            </div>
        `;
  }

  _renderSummaryCards();
  _renderMonthlyMessage();

  // Init period về tháng hiện tại
  const now = new Date();
  _currentTimeframe = "month";
  _currentPeriod = _formatPeriodKey("month", now);

  try {
    await window.app.loadLibrary(
      "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js",
      "Chart",
    );
    _populatePeriodDropdown("month");
    _renderBarChart();
    _renderPieChart();
  } catch (e) {
    console.warn("[Stats] Không thể tải Chart.js:", e);
  }

  if (window.feather) {
    try {
      feather.replace();
    } catch (e) {}
  }
}

/**
 * Đổi timeframe (Tháng/Quý/Năm) → reset period về hiện tại rồi re-render.
 */
export function setStatsTimeframe(tf) {
  _currentTimeframe = tf;
  const now = new Date();
  _currentPeriod = _formatPeriodKey(tf, now);

  document.querySelectorAll(".stats-tf-btn").forEach((btn) => {
    btn.classList.toggle("stats-tf-active", btn.dataset.tf === tf);
  });

  // Ẩn/hiện custom dropdown wrapper: năm không cần chọn kỳ
  const wrapper = document.getElementById("stats-period-wrapper");
  if (wrapper) wrapper.style.display = tf === "year" ? "none" : "";

  if (tf !== "year") _populatePeriodDropdown(tf);
  _renderBarChart();
}

/**
 * Đổi period từ custom dropdown → cập nhật label + re-render bar chart.
 */
export function setStatsPeriod(value, label) {
  _currentPeriod = value;
  // Cập nhật label trên button
  const labelEl = document.getElementById("stats-period-label");
  if (labelEl && label) labelEl.textContent = label;
  // Đóng dropdown
  document.getElementById("stats-period-dropdown")?.classList.add("hidden");
  _renderBarChart();
}

// ─── PERIOD HELPERS ────────────────────────────────────────────────────────────

/** Tạo key period từ Date + timeframe. */
function _formatPeriodKey(tf, date) {
  const y = date.getFullYear();
  const m = date.getMonth(); // 0-indexed
  if (tf === "month") return `${y}-${String(m + 1).padStart(2, "0")}`;
  if (tf === "quarter") return `${y}-Q${Math.floor(m / 3) + 1}`;
  return `${y}`;
}

/** Populate custom dropdown options theo timeframe. */
function _populatePeriodDropdown(tf) {
  const menu = document.getElementById("stats-period-dropdown");
  if (!menu) return;

  const data = store.data || [];
  const now = new Date();
  const optionSet = new Set();

  // Thêm kỳ hiện tại luôn
  optionSet.add(_formatPeriodKey(tf, now));

  // Thêm kỳ có dữ liệu
  data.forEach((m) => {
    if (!m.addedAt) return;
    const d = new Date(m.addedAt);
    optionSet.add(_formatPeriodKey(tf, d));
  });

  // Sort desc (mới nhất trên đầu)
  const sorted = [...optionSet].sort().reverse();

  // Render items dạng udrop-item (giống /library)
  menu.innerHTML = sorted
    .map((key) => {
      const label = _periodLabel(tf, key);
      const isActive =
        key === _currentPeriod
          ? 'style="font-weight:700; color:var(--primary);"'
          : "";
      return `<button class="udrop-item" ${isActive} onclick="app.setStatsPeriod('${key}', '${label}')"><span>${label}</span></button>`;
    })
    .join("");

  // Cập nhật label button về kỳ hiện tại
  const labelEl = document.getElementById("stats-period-label");
  if (labelEl && sorted.length > 0) {
    labelEl.textContent = _periodLabel(tf, _currentPeriod);
  }
}

/** Tạo label hiển thị cho một period key. */
function _periodLabel(tf, key) {
  if (tf === "month") {
    const [y, m] = key.split("-");
    return `Tháng ${parseInt(m)}, ${y}`;
  }
  if (tf === "quarter") {
    const [y, q] = key.split("-");
    return `${q}, ${y}`;
  }
  return key; // year
}

/**
 * Toggle hiển thị/ẩn tổng giá trị kho truyện.
 */
export function toggleTotalValue() {
  const el = document.getElementById("stat-total-value");
  const eyeBtn = document.getElementById("stat-value-eye");
  if (!el) return;

  const isVisible = el.dataset.visible === "true";
  const rawValue = parseInt(el.dataset.raw) || 0;

  if (isVisible) {
    // Ẩn đi
    el.textContent = "••••••••";
    el.dataset.visible = "false";
    // Đổi icon thành eye
    eyeBtn?.querySelectorAll("svg").forEach((s) => s.remove());
    const icon = document.createElement("i");
    icon.setAttribute("data-feather", "eye");
    eyeBtn?.appendChild(icon);
  } else {
    // Hiển ra
    el.textContent = new Intl.NumberFormat("vi-VN").format(rawValue) + " đ";
    el.dataset.visible = "true";
    // Đổi icon thành eye-off
    eyeBtn?.querySelectorAll("svg").forEach((s) => s.remove());
    const icon = document.createElement("i");
    icon.setAttribute("data-feather", "eye-off");
    eyeBtn?.appendChild(icon);
  }
  if (window.feather) {
    try {
      feather.replace();
    } catch (e) {}
  }
}

// ─── INTERNAL: Summary Cards ───────────────────────────────────────────────────

function _renderSummaryCards() {
  const data = store.data || [];
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const totalBooks = data.length;
  const totalSeries = new Set(data.map((m) => m.series).filter(Boolean)).size;

  const thisMonthBooks = data.filter((m) => {
    if (!m.addedAt) return false;
    const d = new Date(m.addedAt);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  }).length;

  // Series có cuốn đầu tiên trong tháng này
  const seriesFirstDate = {};
  data.forEach((m) => {
    if (!m.series || !m.addedAt) return;
    const d = new Date(m.addedAt);
    if (!seriesFirstDate[m.series] || d < seriesFirstDate[m.series]) {
      seriesFirstDate[m.series] = d;
    }
  });
  const newSeriesThisMonth = Object.values(seriesFirstDate).filter(
    (d) => d.getMonth() === thisMonth && d.getFullYear() === thisYear,
  ).length;

  // Tổng giá trị kho truyện
  const totalValue = data.reduce((sum, m) => sum + (parseInt(m.price) || 0), 0);
  const totalValueEl = document.getElementById("stat-total-value");
  if (totalValueEl) {
    totalValueEl.dataset.raw = totalValue;
    totalValueEl.dataset.visible = "false";
    totalValueEl.textContent = "••••••••";
  }

  _setText("stat-total-books", totalBooks);
  _setText("stat-total-series", totalSeries);
  _setText("stat-this-month", thisMonthBooks);
  _setText("stat-new-series", newSeriesThisMonth);
}

// ─── INTERNAL: Monthly Message ────────────────────────────────────────────────

function _renderMonthlyMessage() {
  const el = document.getElementById("stats-monthly-message");
  if (!el) return;

  const data = store.data || [];
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const booksThisMonth = data.filter((m) => {
    if (!m.addedAt) return false;
    const d = new Date(m.addedAt);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  }).length;

  const seriesFirstDate = {};
  data.forEach((m) => {
    if (!m.series || !m.addedAt) return;
    const d = new Date(m.addedAt);
    if (!seriesFirstDate[m.series] || d < seriesFirstDate[m.series]) {
      seriesFirstDate[m.series] = d;
    }
  });
  const newSeriesCount = Object.values(seriesFirstDate).filter(
    (d) => d.getMonth() === thisMonth && d.getFullYear() === thisYear,
  ).length;

  let html = "";
  if (booksThisMonth === 0) {
    el.className = "stats-monthly-message no-books";
    html = `<div class="stats-monthly-msg-line">
            <span>😔</span>
            <span>Tháng ${now.getMonth() + 1} bạn chưa thêm cuốn truyện nào cả.</span>
        </div>`;
  } else {
    el.className = "stats-monthly-message has-books";
    html = `<div class="stats-monthly-msg-line">
            <span>📚</span>
            <span>Tháng ${now.getMonth() + 1} bạn đã thêm <strong>${booksThisMonth}</strong> cuốn truyện!</span>
        </div>`;
    if (newSeriesCount > 0) {
      html += `<div class="stats-monthly-msg-line">
                <span>✨</span>
                <span>Bạn đã bắt đầu <strong>${newSeriesCount}</strong> bộ truyện mới trong tháng này.</span>
            </div>`;
    }
  }
  el.innerHTML = html;
}

// ─── INTERNAL: Bar Chart ───────────────────────────────────────────────────────

function _renderBarChart() {
  const canvas = document.getElementById("chart-bar-timeline");
  if (!canvas || typeof Chart === "undefined") return;

  const { labels, counts } = _buildBarData(_currentTimeframe, _currentPeriod);

  if (_barChart) {
    _barChart.destroy();
    _barChart = null;
  }

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const tickColor = isDark ? "#6ee7b7" : "#166534";

  _barChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Số cuốn thêm",
          data: counts,
          backgroundColor: "rgba(22, 163, 74, 0.75)",
          borderColor: "rgba(22, 163, 74, 1)",
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.y} cuốn` } },
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: tickColor, font: { size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: {
            color: tickColor,
            font: { size: 11 },
            stepSize: 1,
            precision: 0,
          },
        },
      },
    },
  });
}

/**
 * Tạo labels + counts cho bar chart.
 *
 * @param {'month'|'quarter'|'year'} tf
 * @param {string} period  - 'YYYY-MM' | 'YYYY-QN' | 'YYYY'
 */
function _buildBarData(tf, period) {
  const data = store.data || [];

  // ── Tháng: ngày 1..N của tháng được chọn ──────────────────────────────
  if (tf === "month") {
    const [y, m] = (period || "").split("-").map(Number);
    const year = y || new Date().getFullYear();
    const month = (m || new Date().getMonth() + 1) - 1; // 0-indexed
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);
    const counts = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return data.filter((item) => {
        if (!item.addedAt) return false;
        const d = new Date(item.addedAt);
        return (
          d.getFullYear() === year &&
          d.getMonth() === month &&
          d.getDate() === day
        );
      }).length;
    });
    return { labels, counts };
  }

  // ── Quý: tháng 1..3 của quý được chọn ────────────────────────────────
  if (tf === "quarter") {
    // period = 'YYYY-QN'
    const parts = (period || "").split("-");
    const year = parseInt(parts[0]) || new Date().getFullYear();
    const qNum = parts[1]
      ? parseInt(parts[1].replace("Q", ""))
      : Math.floor(new Date().getMonth() / 3) + 1;
    const startM = (qNum - 1) * 3; // 0-indexed first month of quarter

    const monthNames = [
      "Tháng 1",
      "Tháng 2",
      "Tháng 3",
      "Tháng 4",
      "Tháng 5",
      "Tháng 6",
      "Tháng 7",
      "Tháng 8",
      "Tháng 9",
      "Tháng 10",
      "Tháng 11",
      "Tháng 12",
    ];
    const labels = [
      monthNames[startM],
      monthNames[startM + 1],
      monthNames[startM + 2],
    ];
    const counts = [0, 1, 2].map((offset) => {
      const m = startM + offset;
      return data.filter((item) => {
        if (!item.addedAt) return false;
        const d = new Date(item.addedAt);
        return d.getFullYear() === year && d.getMonth() === m;
      }).length;
    });
    return { labels, counts };
  }

  // ── Năm: tổng theo từng năm, hiện 4 năm gần nhất ────────────────────
  const currentYear = new Date().getFullYear();
  const years = [
    currentYear - 3,
    currentYear - 2,
    currentYear - 1,
    currentYear,
  ];
  const labels = years.map((y) => `${y}`);
  const counts = years.map(
    (y) =>
      data.filter((item) => {
        if (!item.addedAt) return false;
        return new Date(item.addedAt).getFullYear() === y;
      }).length,
  );
  return { labels, counts };
}

// ─── INTERNAL: Pie Chart ───────────────────────────────────────────────────────

function _renderPieChart() {
  const canvas = document.getElementById("chart-pie-publisher");
  if (!canvas || typeof Chart === "undefined") return;

  const { labels, counts, colors, total } = _buildPublisherData();

  if (_pieChart) {
    _pieChart.destroy();
    _pieChart = null;
  }

  _pieChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: counts,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor:
            document.documentElement.getAttribute("data-theme") === "dark"
              ? "#1a2e24"
              : "#ffffff",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "60%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              ` ${ctx.label}: ${ctx.parsed} cuốn (${Math.round((ctx.parsed / total) * 100)}%)`,
          },
        },
      },
    },
  });

  _renderPublisherLegend(labels, counts, colors, total);
}

function _buildPublisherData() {
  const data = store.data || [];
  const map = {};
  data.forEach((m) => {
    const pub = (m.distributor || m.publisher || "").trim() || "Không rõ";
    map[pub] = (map[pub] || 0) + 1;
  });

  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 6);
  const rest = sorted.slice(6);

  const labels = top.map(([name]) => name);
  const counts = top.map(([, cnt]) => cnt);

  if (rest.length > 0) {
    labels.push("Khác");
    counts.push(rest.reduce((sum, [, c]) => sum + c, 0));
  }

  const colors = labels.map((name, i) => _getBrandColor(name, i));
  const total = counts.reduce((s, c) => s + c, 0) || 1;
  return { labels, counts, colors, total };
}

function _renderPublisherLegend(labels, counts, colors, total) {
  const el = document.getElementById("stats-publisher-legend");
  if (!el) return;
  el.innerHTML = labels
    .map((name, i) => {
      const logo = _getBrandLogo(name);
      const logoHtml = logo
        ? `<img class="stats-legend-logo" src="${logo}" alt="" onerror="this.style.display='none'">`
        : `<div class="stats-legend-dot" style="background:${colors[i]}"></div>`;
      return `
        <div class="stats-legend-item">
            ${logoHtml}
            <span class="stats-legend-name" title="${name}">${name}</span>
            <span class="stats-legend-count">${counts[i]} cuốn</span>
            <span class="stats-legend-pct">${Math.round((counts[i] / total) * 100)}%</span>
        </div>`;
    })
    .join("");
}

// ─── HELPER ───────────────────────────────────────────────────────────────────
function _setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
