import { store } from "../store.js";

export function applySettings() {
  // Cột Grid
  document.documentElement.style.setProperty(
    "--grid-cols",
    store.settings.gridCols,
  );
  document.querySelectorAll('.settings-chip[id^="chip-"]').forEach((el) => {
    if (!el.id.includes("fs")) el.classList.remove("active");
  });
  const chipGrid = document.getElementById(`chip-${store.settings.gridCols}`);
  if (chipGrid) chipGrid.classList.add("active");

  // Cỡ chữ
  let fsValue = "1rem";
  if (store.settings.fontSize === "small") fsValue = "14px";
  if (store.settings.fontSize === "large") fsValue = "18px";
  if (store.settings.fontSize === "xlarge") fsValue = "20px";
  if (store.settings.fontSize === "normal") fsValue = "16px";
  document.documentElement.style.fontSize = fsValue;
  document.documentElement.style.setProperty("--fs-base", fsValue);

  document
    .querySelectorAll('.settings-chip[id^="chip-fs-"]')
    .forEach((el) => el.classList.remove("active"));
  const chipFs = document.getElementById(`chip-fs-${store.settings.fontSize}`);
  if (chipFs) chipFs.classList.add("active");
}

export function toggleUserMenu() {
  const menu = document.getElementById("user-menu");
  if (menu) menu.classList.toggle("hidden");
}

export function showSettings() {
  const overlay = document.getElementById("settings-overlay");
  if (overlay) {
    overlay.style.display = "flex";
    // Sync current settings to UI
    const cols =
      store.settings.gridCols || localStorage.getItem("gridCols") || "6";
    document
      .querySelectorAll(".settings-chip")
      .forEach((c) => c.classList.remove("active"));
    const chip = document.getElementById(`chip-${cols}`);
    if (chip) chip.classList.add("active");

    const fontSize =
      store.settings.fontSize || localStorage.getItem("fontSize") || "normal";
    const fsChip = document.getElementById(`chip-fs-${fontSize}`);
    if (fsChip) fsChip.classList.add("active");

    const showProgress = localStorage.getItem("showProgress") !== "false";
    const progressSwitch = document.getElementById("progress-switch");
    if (progressSwitch) progressSwitch.classList.toggle("active", showProgress);

    if (window.feather) {
      try {
        feather.replace();
      } catch (e) {
        console.warn("Feather error:", e);
      }
    }
  }
}

export function closeSettings() {
  const overlay = document.getElementById("settings-overlay");
  if (overlay) overlay.style.display = "none";
}

export function setSetting(key, value) {
  store.settings[key] = value;
  localStorage.setItem(key, value);
  localStorage.removeItem(`setting_${key}`);
  if (key === "gridCols") {
    document.documentElement.style.setProperty("--grid-cols", value);
    // Refresh only gridCols chips
    document.querySelectorAll('[id^="chip-"]').forEach((c) => {
      if (!c.id.startsWith("chip-fs")) c.classList.remove("active");
    });
    const chip = document.getElementById(`chip-${value}`);
    if (chip) chip.classList.add("active");
  }
  if (key === "fontSize") {
    applyFontSize(value);
    document
      .querySelectorAll('[id^="chip-fs-"]')
      .forEach((c) => c.classList.remove("active"));
    const chip = document.getElementById(`chip-fs-${value}`);
    if (chip) chip.classList.add("active");
  }
}

export function toggleSetting(key) {
  const current = localStorage.getItem(key) !== "false";
  localStorage.setItem(key, String(!current));
  const sw = document.getElementById(
    `${key === "showProgress" ? "progress" : key}-switch`,
  );
  if (sw) sw.classList.toggle("active", !current);
  if (window.app && window.app.renderDashboard) window.app.renderDashboard();
}

export function applyFontSize(size) {
  const map = {
    small: "0.875rem",
    normal: "1rem",
    large: "1.1rem",
    xlarge: "1.2rem",
  };
  document.documentElement.style.setProperty("--fs-base", map[size] || "1rem");
}
