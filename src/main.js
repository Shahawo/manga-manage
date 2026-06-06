import { store } from "./store.js";
import * as settings from "./core/settings.js";
import * as router from "./core/router.js";
import * as ui from "./core/ui.js";

import * as auth from "./core/auth.js";
import * as api from "./core/api.js";
import * as apiClient from "./utils/api-client.js";
import * as manga from "./features/manga/manga.js";
import * as dashboard from "./features/manga/dashboard.js";
import * as ui_modal from "./core/uiModal.js";
import * as form from "./features/manga/form.js";
import * as scanner from "./features/manga/scanner.js";
import * as admin from "./features/admin/admin.js";
import * as adminCatalog from "./features/admin/admin-catalog.js";
import * as adminPending from "./features/admin/admin-pending.js";
import * as adminSchedule from "./features/admin/admin-schedule.js";
import * as stats from "./features/stats/stats.js";
import * as schedule from "./features/schedule/schedule.js";
import * as scheduleImport from "./features/schedule/schedule-import.js";

// Nạp HTML bằng Vite
import adminHtml from "./views/admin.html?raw";
import formHtml from "./views/form.html?raw";
import modalsHtml from "./views/modals.html?raw";
import dashboardHtml from "./views/dashboard.html?raw";
import detailHtml from "./views/detail.html?raw";
import addMethodHtml from "./views/add-method.html?raw";
import searchHtml from "./views/search.html?raw";
import aboutHtml from "./views/about.html?raw";
import statsHtml from "./views/stats.html?raw";
import scheduleHtml from "./views/schedule.html?raw";
import comingSoonHtml from "./views/coming-soon.html?raw";

// Bơm HTML vào DOM trước khi khởi tạo
const mainContainer = document.querySelector("main.container");
if (mainContainer) {
  mainContainer.insertAdjacentHTML("beforeend", dashboardHtml);
  mainContainer.insertAdjacentHTML("beforeend", detailHtml);
  mainContainer.insertAdjacentHTML("beforeend", addMethodHtml);
  mainContainer.insertAdjacentHTML("beforeend", searchHtml);
  mainContainer.insertAdjacentHTML("beforeend", aboutHtml);
  mainContainer.insertAdjacentHTML("beforeend", statsHtml);
  mainContainer.insertAdjacentHTML("beforeend", scheduleHtml);
  mainContainer.insertAdjacentHTML("beforeend", comingSoonHtml);

  mainContainer.insertAdjacentHTML("beforeend", adminHtml);
  mainContainer.insertAdjacentHTML("beforeend", formHtml);
  mainContainer.insertAdjacentHTML("beforeend", modalsHtml);
}

// Fix active view immediately based on URL before auth/data loading
const path = window.location.pathname;
let initialView = "dashboard";
if (path === "/about") initialView = "about";
else if (path === "/schedule") initialView = "schedule";
else if (path === "/stats") initialView = "stats";
else if (path.startsWith("/admin")) initialView = "admin";
else if (path === "/add") initialView = "add-method";
else if (path === "/form") initialView = "form";
else if (path === "/search") initialView = "search";
else if (path.startsWith("/series/")) initialView = "detail";

store.currentView = initialView;

document.querySelectorAll(".view").forEach((v) => {
  if (v.id === `view-${initialView}`) {
    v.classList.add("active");
    v.classList.remove("hidden");
  } else {
    v.classList.remove("active");
    v.classList.add("hidden");
  }
});

const authToken = localStorage.getItem("authToken");

if (authToken) {
  if (initialView === "stats") {
    stats.renderStats(true);
  } else if (initialView === "dashboard") {
    manga.renderSeriesSkeletons("series-grid", store.viewMode === "list");
  } else if (initialView === "admin") {
    const container = document.getElementById("admin-pending-list");
    if (container) {
      container.innerHTML = Array(8).fill(`
            <div class="skeleton-volume-card volume-card" style="border: 1px solid var(--border); box-shadow: var(--shadow-sm);">
                <div class="skeleton skeleton-volume-cover" style="height: 200px;"></div>
                <div style="padding: 0.5rem;">
                    <div class="skeleton skeleton-text medium"></div>
                    <div class="skeleton skeleton-text short"></div>
                </div>
            </div>
        `).join('');
    }
  }
}

if (initialView === "schedule") {
  const body = document.getElementById("schedule-body");
  if (body) {
    const skeletonCards = Array(4).fill(`
            <div class="schedule-card" style="border:1px solid var(--border); box-shadow:none;">
                <div class="skeleton" style="width:100%; aspect-ratio:2/3;"></div>
                <div style="padding:0.75rem;">
                    <div class="skeleton skeleton-text medium" style="margin-bottom:0.5rem;"></div>
                    <div class="skeleton skeleton-text short" style="margin-bottom:0.25rem;"></div>
                    <div class="skeleton skeleton-text short" style="width:40%;"></div>
                </div>
            </div>
        `).join('');

    body.innerHTML = `
            <div class="schedule-day-group">
                <div class="schedule-date-col" style="opacity:0.5;">
                    <div class="skeleton skeleton-text short" style="margin-bottom:0.5rem;"></div>
                    <div class="skeleton skeleton-text" style="width:2.5rem; height:2.5rem; border-radius:8px;"></div>
                </div>
                <div class="schedule-cards-grid">${skeletonCards}</div>
            </div>
            <div class="schedule-day-group" style="opacity:0.6;">
                <div class="schedule-date-col" style="opacity:0.5;">
                    <div class="skeleton skeleton-text short" style="margin-bottom:0.5rem;"></div>
                    <div class="skeleton skeleton-text" style="width:2.5rem; height:2.5rem; border-radius:8px;"></div>
                </div>
                <div class="schedule-cards-grid">${skeletonCards}</div>
            </div>
        `;
  }
}

const app = {
  ...settings,
  ...router,
  ...ui,
  ...auth,
  ...api,
  ...apiClient,
  ...manga,
  ...dashboard,
  ...ui_modal,
  ...form,
  ...scanner,
  ...admin,
  ...adminCatalog,
  ...adminPending,
  ...adminSchedule,
  ...stats,
  ...schedule,
  ...scheduleImport,
};
window.app = app;

// We must extract init manually to be called after all mixins
app.init();
app.initGoogleAuth();

// Highlight nav tab immediately
app.updateNavTabs(window.location.pathname);
