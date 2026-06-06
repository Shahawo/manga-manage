import { store } from "../store.js";

export function cancelForm() {
  const editId = document.getElementById("edit-id").value;
  if (editId) {
    const manga = store.data.find((m) => m.id === editId);
    if (manga && manga.series) {
      window.app.openSeriesDetail(manga.series);
      return;
    }
    navigateTo("/");
  } else {
    navigateTo("/add");
  }
}

export function setupRouter() {
  window.addEventListener("popstate", () => router());
  router();
}

export function navigateTo(path, replace = false) {
  if (replace) {
    window.history.replaceState({}, "", path);
  } else {
    const currentFull = window.location.pathname + window.location.search;
    if (currentFull !== path) {
      window.history.pushState({}, "", path);
    }
  }
  router();
}

// Các route công khai (không cần đăng nhập)
const PUBLIC_ROUTES = ["/about", "/schedule", "/stats", "/library"];

export function router() {
  const path = window.location.pathname;
  const app = window.app;

  // ─── Public routes — luôn accessible ────────────────────────────────
  if (path === "/about") {
    app.showView("about");
    app.updateNavTabs(path);
    // Hiện CTA đăng nhập nếu chưa login
    const cta = document.getElementById("about-cta");
    if (cta) cta.style.display = store.user ? "none" : "block";
    return;
  }

  if (path === "/schedule") {
    app.showView("schedule");
    app.updateNavTabs("/schedule");
    app.renderCalendar();
    return;
  }

  if (path === "/stats") {
    app.showView("stats");
    app.updateNavTabs("/stats");
    app.renderStats();
    return;
  }

  // ─── Chưa đăng nhập → chỉ redirect /about khi vào các route cần auth ─────────
  // '/library' được phép: hiện dashboard với empty state (không có dữ liệu)
  if (!store.user && path !== "/library" && path !== "/index.html") {
    navigateTo("/about", true);
    return;
  }

  // ─── Authenticated routing ─────────────────────────────────────────
  if (path === "/" || path === "/index.html") {
    // / redirect về /library (canonical path cho Kho Truyện)
    navigateTo("/library", true);
    return;
  } else if (path === "/library") {
    app.showView("dashboard");
    app.updateNavTabs("/library");
  } else if (path === "/add") {
    app.showView("add-method");
    app.updateNavTabs("/library");
  } else if (path === "/form") {
    app.showView("form");
    app.updateNavTabs("/library");

    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get("id");
    if (editId) {
      if (store.data && store.data.length > 0) {
        setTimeout(() => window.app.populateEditForm(editId), 0);
      } else {
        window.app._pendingEditId = editId;
      }
    } else {
      document.getElementById("edit-id").value = "";
      const formEl = document.getElementById("manga-form");
      if (formEl) formEl.reset();
      const heading = document.querySelector("#view-form h2");
      if (heading) heading.textContent = "Thêm sách mới";
      if (window.app.previewImage)
        window.app.previewImage("", "cover", "main-");
      const giftUrlsEl = document.getElementById("main-giftUrls");
      if (giftUrlsEl) giftUrlsEl.value = "";
      if (window.app.renderGiftThumbnails)
        window.app.renderGiftThumbnails("main-");
      if (window.app.switchImgTab) window.app.switchImgTab("cover", "main-");
    }
  } else if (path === "/search") {
    app.showView("search");
    app.updateNavTabs("/library");
  } else if (path.startsWith("/admin")) {
    if (!store.isAdmin) {
      app.showToast("Bạn không có quyền truy cập khu vực này!", "error");
      navigateTo("/about", true); // ← đổi từ / sang /about
      return;
    }
    if (path === "/admin" || path === "/admin/pending") {
      app.showView("admin");
      app.switchAdminTab("pending");
    } else if (path === "/admin/catalog") {
      app.showView("admin");
      app.switchAdminTab("catalog");
    } else if (path === "/admin/feedback") {
      app.showView("admin");
      app.switchAdminTab("feedback");
    } else if (path === "/admin/schedule") {
      app.showView("admin");
      app.switchAdminTab("schedule");
    } else if (path.startsWith("/admin/series/")) {
      const parts = path.split("/admin/series/");
      if (parts.length > 1) {
        const seriesName = decodeURIComponent(parts[1]);
        app.showView("admin");
        app.switchAdminTab("catalog");
        app.renderAdminSeriesDetail(seriesName);
      } else {
        navigateTo("/", true);
      }
    } else {
      navigateTo("/", true);
    }
    app.updateNavTabs(path);
  } else if (path.startsWith("/series/")) {
    const parts = path.split("/series/");
    if (parts.length > 1) {
      const seriesName = decodeURIComponent(parts[1]);
      app.renderSeriesDetail(seriesName);
    } else {
      navigateTo("/library", true);
    }
    app.updateNavTabs("/library");
  } else {
    navigateTo("/", true);
  }
}

/**
 * Cập nhật trạng thái active của nav tabs và hiện/ẩn search bar.
 * Được gọi từ router() sau mỗi lần điều hướng.
 */
export function updateNavTabs(activePath) {
  const tabMap = {
    "tab-about": "/about",
    "tab-dashboard": "/library",
    "tab-schedule": "/schedule",
    "tab-stats": "/stats",
  };

  Object.entries(tabMap).forEach(([id, tabPath]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const isActive =
      activePath === tabPath ||
      (tabPath === "/library" &&
        (activePath === "/" ||
          activePath === "/index.html" ||
          activePath === "/add" ||
          activePath === "/form" ||
          activePath === "/search" ||
          activePath.startsWith("/series/")));
    el.classList.toggle("nav-tab--active", isActive);
  });

  // Hiện search row + nút Thêm sách chỉ khi đang ở Tủ truyện
  const isDashboard =
    activePath === "/library" ||
    activePath === "/" ||
    activePath === "/index.html" ||
    activePath === "/add" ||
    activePath === "/form" ||
    activePath === "/search" ||
    activePath.startsWith("/series/");

  // Toggle search row (nằm dưới navbar)
  const searchRow = document.getElementById("nav-search-row");
  if (searchRow) searchRow.style.display = isDashboard ? "" : "none";

  // Toggle schedule toolbar (nằm dưới navbar)
  const scheduleToolbar = document.getElementById("schedule-toolbar");
  if (scheduleToolbar)
    scheduleToolbar.style.display = activePath === "/schedule" ? "" : "none";

  const addBtn = document.getElementById("btn-add-book");
  if (addBtn) {
    if (!isDashboard) {
      addBtn.classList.add("hidden");
    } else if (store.user) {
      addBtn.classList.remove("hidden");
    }
  }

  if (window.feather) {
    try {
      feather.replace();
    } catch (e) {}
  }
}
