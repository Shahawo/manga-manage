import { store } from "../../store.js";
import { escapeHTML } from "../../utils/security.js";

// ─── TOAST NOTIFICATION ───────────────────────────────────────────────────
export function showToast(msg, type = "success") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.style.cssText =
      "position:fixed;bottom:1.5rem;right:1.5rem;z-index:10000;display:flex;flex-direction:column;gap:0.5rem;";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  const bg =
    type === "error" ? "#ef4444" : type === "info" ? "#d97706" : "#16a34a";
  toast.style.cssText = `background:${bg};color:#fff;padding:0.75rem 1.25rem;border-radius:10px;font-weight:600;font-size:0.9rem;box-shadow:0 4px 15px rgba(0,0,0,0.2);transform:translateX(120%);transition:transform 0.3s cubic-bezier(0.16,1,0.3,1);max-width:320px;`;
  toast.textContent = msg;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.transform = "translateX(0)";
  });
  setTimeout(() => {
    toast.style.transform = "translateX(120%)";
    setTimeout(() => toast.remove(), 350);
  }, 3500);
}

// ─── SERIES SUGGESTIONS ───────────────────────────────────────────────────
export function updateSeriesSuggestions() {
  const datalist = document.getElementById("series-suggestions");
  if (!datalist) return;
  const uniqueSeries = [...new Set(store.data.map((m) => m.series))]
    .filter((s) => s)
    .map((s) => String(s).trim())
    .filter((s) => s);
  uniqueSeries.sort((a, b) => a.localeCompare(b, "vi"));
  datalist.innerHTML = uniqueSeries
    .map((s) => `<option value="${escapeHTML(s)}">`)
    .join("");
}

export function generateId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

export function showView(viewId) {
  // Track view hiện tại để tránh abort khi ở form
  store.currentView = viewId;
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active", "hidden"));
  document.querySelectorAll(".view").forEach((v) => {
    if (v.id === `view-${viewId}`) v.classList.add("active");
    else v.classList.add("hidden");
  });
  if (window.feather) {
    try {
      feather.replace();
    } catch (e) {
      console.warn("Feather error:", e);
    }
  }

  if (viewId === "dashboard") {
    window.app.renderDashboard();
    document.getElementById("searchInput").value = "";
  } else if (viewId === "form") {
    document.getElementById("manga-form").reset();
    document.getElementById("edit-id").value = "";
    document.querySelector("#view-form h2").textContent = "Thêm sách mới";
    window.app.previewImage("", "cover", "main-");
    const giftUrls = document.getElementById("main-giftUrls");
    if (giftUrls) giftUrls.value = "";
    const giftInput = document.getElementById("main-giftUrlInput");
    if (giftInput) giftInput.value = "";
    const thumbs = document.getElementById("main-gift-thumbnails");
    if (thumbs) thumbs.innerHTML = "";
    window.app.previewGiftImage("", "main-");
    window.app.switchImgTab("cover", "main-");
    const datePicker = document.querySelector("#publishDate");
    if (datePicker && datePicker._flatpickr) datePicker._flatpickr.clear();
    if (window.feather) {
      try {
        feather.replace();
      } catch (e) {
        console.warn("Feather error:", e);
      }
    }
  }
}

// ─── SERIES GROUPS ────────────────────────────────────────────────────────
export function getSeriesGroups() {
  const groups = {};
  store.data.forEach((manga) => {
    if (!groups[manga.series]) {
      groups[manga.series] = {
        title: manga.series,
        latestVolume: manga,
        uniqueVolumes: new Set(),
        maxVolume: Number(manga.volume) || 0,
      };
    }
    const volNum = Number(manga.volume) || 0;
    groups[manga.series].uniqueVolumes.add(volNum);
    const latestVolNum = Number(groups[manga.series].latestVolume.volume) || 0;
    if (volNum > latestVolNum) groups[manga.series].latestVolume = manga;
    if (volNum > groups[manga.series].maxVolume)
      groups[manga.series].maxVolume = volNum;
  });

  const sortEl = document.getElementById("sort-order");
  const sortOrder = sortEl ? sortEl.value : "az";
  return Object.values(groups)
    .map((g) => {
      const count = g.uniqueVolumes.size;
      let total = Math.max(count, Math.ceil(g.maxVolume));

      if (
        store.seriesMetadata &&
        store.seriesMetadata[g.title] &&
        store.seriesMetadata[g.title].total_volumes > 0
      ) {
        total = Math.max(total, store.seriesMetadata[g.title].total_volumes);
      }
      if (
        store.userSeriesSettings &&
        store.userSeriesSettings[g.title] &&
        store.userSeriesSettings[g.title].target_volumes > 0
      ) {
        total = Math.max(
          count,
          store.userSeriesSettings[g.title].target_volumes,
        );
      }

      const percent = total > 0 ? Math.round((count / total) * 100) : 0;
      const statusValue = (store.userSeriesSettings && store.userSeriesSettings[g.title] && store.userSeriesSettings[g.title].status) || 'collecting';
      return {
        title: g.title || "Không có tên Series",
        latestVolume: g.latestVolume,
        count: count,
        maxVolume: g.maxVolume,
        total: total,
        percent: percent,
        status: statusValue
      };
    })
    .sort((a, b) => {
      const titleA = a.title;
      const titleB = b.title;
      return sortOrder === "za"
        ? titleB.localeCompare(titleA, "vi")
        : titleA.localeCompare(titleB, "vi");
    });
}
// ─── SKELETON LOADERS ─────────────────────────────────────────────────────
export function renderSeriesSkeletons(containerId, isListView = false) {
  const grid = document.getElementById(containerId);
  if (!grid) return;

  grid.innerHTML = "";
  grid.classList.remove("hidden");

  if (isListView) {
    grid.classList.add("list-view");
  } else {
    grid.classList.remove("list-view");
  }

  let html = "";
  for (let i = 0; i < 12; i++) {
    html += `
                <div class="skeleton-series-card">
                    <div class="skeleton-series-cover skeleton"></div>
                    <div class="skeleton-series-info">
                        <div class="skeleton-title skeleton"></div>
                        <div class="skeleton-text short skeleton" style="margin-top:auto;"></div>
                    </div>
                </div>
            `;
  }
  grid.innerHTML = html;
}

export function renderVolumeSkeletons(containerId, isListView = false) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (isListView) {
    container.classList.add("list-view");
  } else {
    container.classList.remove("list-view");
  }

  let html = "";
  for (let i = 0; i < 6; i++) {
    html += `
                <div class="skeleton-volume-card">
                    <div class="skeleton-volume-cover skeleton"></div>
                    <div class="skeleton-volume-info">
                        <div class="skeleton-text medium skeleton"></div>
                        <div class="skeleton-text short skeleton" style="margin-top:auto;"></div>
                    </div>
                </div>
            `;
  }
  container.innerHTML = html;
}
