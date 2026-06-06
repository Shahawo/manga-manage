/**
 * schedule-import.js
 * Import tool for release_calendar:
 *  - Tab A: Fetch từ PocketBase API của Tana.moe (pb.tana.moe)
 *  - Tab B: Parse CSV / JSON paste
 *
 * Cả hai đều có preview + checkbox chọn từng dòng trước khi import.
 */

import { store } from "../../store.js";

// ─── Constants ──────────────────────────────────────────────────────────────
const TANA_API = "https://pb.tana.moe/api/collections/books/records";
const TANA_IMAGE = "https://image.tana.moe";
const EDITION_MAP = {
  "": "standard",
  standard: "standard",
  special: "special",
  collector: "collector",
  limited: "limited",
};

// Module state
let _tanaRows = []; // parsed rows from Tana fetch
let _csvRows = []; // parsed rows from CSV/JSON

// ─── Panel toggle & tab switching ───────────────────────────────────────────
export function toggleImportPanel() {
  const panel = document.getElementById("admin-import-panel");
  if (!panel) return;
  const isHidden = panel.classList.toggle("hidden");
  if (!isHidden) {
    // Pre-fill tháng input với tháng admin đang xem
    const monthInput = document.getElementById("tana-import-month");
    if (monthInput && !monthInput.value) {
      // Read from admin schedule state via the label text
      const label =
        document.getElementById("admin-schedule-month-label")?.textContent ??
        "";
      const m = label.match(/Tháng (\d+)\/(\d+)/);
      if (m) {
        const mo = String(m[1]).padStart(2, "0");
        monthInput.value = `${m[2]}-${mo}`;
      }
    }
    if (window.feather) feather.replace();
  }
}

export function switchImportTab(tab) {
  document.querySelectorAll(".import-tab-btn").forEach((btn) => {
    btn.style.color = "var(--text-muted)";
    btn.style.fontWeight = "500";
    btn.style.borderBottom = "2px solid transparent";
  });
  document
    .querySelectorAll(".import-tab-content")
    .forEach((c) => c.classList.add("hidden"));

  const activeBtn = document.getElementById(`import-tab-btn-${tab}`);
  const activePanel = document.getElementById(`import-panel-${tab}`);
  if (activeBtn) {
    activeBtn.style.color = "var(--primary)";
    activeBtn.style.fontWeight = "600";
    activeBtn.style.borderBottom = "2px solid var(--primary)";
  }
  if (activePanel) activePanel.classList.remove("hidden");
}

// ─── Helpers: Preview row renderer ──────────────────────────────────────────
function _renderPreviewRow(row, index, prefix) {
  const volText = row.volume
    ? `Tập ${row.volume % 1 === 0 ? parseInt(row.volume) : row.volume}`
    : "—";
  const priceText = row.price
    ? `${Number(row.price).toLocaleString("vi-VN")}đ`
    : "—";
  const dateText = row.release_date ?? "?";
  const editionLabel =
    { special: "🔶 Đặc Biệt", collector: "🔷 Sưu Tầm", limited: "💜 Giới Hạn" }[
      row.edition
    ] ?? "";

  return `
    <div style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0.6rem;border:1px solid var(--border);border-radius:6px;background:var(--surface);">
        <input type="checkbox" class="${prefix}-row-check" data-index="${index}" checked
            onchange="app.${prefix}UpdateCount()"
            style="width:15px;height:15px;flex-shrink:0;cursor:pointer;">
        ${
          row.cover_url
            ? `<img src="${row.cover_url}" alt="" style="width:28px;height:40px;object-fit:cover;border-radius:3px;flex-shrink:0;" onerror="this.style.display='none'">`
            : `<div style="width:28px;height:40px;background:var(--border);border-radius:3px;flex-shrink:0;"></div>`
        }
        <div style="flex:1;min-width:0;font-size:0.82rem;">
            <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${row.series ? `<span style="color:var(--text-muted)">[${row.series}]</span> ` : ""}${row.title} ${editionLabel}
            </div>
            <div style="color:var(--text-muted);margin-top:1px;">
                ${dateText} · ${volText} · ${row.publisher ?? "?"} · ${priceText}
            </div>
        </div>
    </div>`;
}

function _updateCount(prefix) {
  const checked = document.querySelectorAll(
    `.${prefix}-row-check:checked`,
  ).length;
  const total = document.querySelectorAll(`.${prefix}-row-check`).length;
  const el = document.getElementById(`${prefix}-selected-count`);
  if (el) el.textContent = `(${checked}/${total} đã chọn)`;
}

// ─── TANA.MOE FETCH ──────────────────────────────────────────────────────────

export async function fetchFromTana() {
  const monthInput = document.getElementById("tana-import-month");
  const statusEl = document.getElementById("tana-fetch-status");
  const previewArea = document.getElementById("tana-preview-area");
  const previewTable = document.getElementById("tana-preview-table");
  const btn = document.getElementById("tana-fetch-btn");

  if (!monthInput?.value) {
    window.app.showToast("Chọn tháng cần fetch!", "error");
    return;
  }

  const [year, month] = monthInput.value.split("-").map(Number);
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  btn.disabled = true;
  statusEl.textContent = "Đang fetch...";
  statusEl.style.color = "var(--text-muted)";
  previewArea?.classList.add("hidden");
  _tanaRows = [];

  try {
    // Fetch ALL books for the month using pagination
    let page = 1;
    let totalPages = 1;
    const allItems = [];

    while (page <= totalPages) {
      const filter = encodeURIComponent(
        `publishDate >= '${from}' && publishDate <= '${to}'`,
      );
      const expand = encodeURIComponent(
        "publication.release.title,publication.release.publisher,assets_via_book,publication.assets_via_publication",
      );
      const sort = encodeURIComponent("+publishDate,+publication.volume");
      const url = `${TANA_API}?page=${page}&perPage=200&filter=${filter}&expand=${expand}&sort=${sort}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = await res.json();

      allItems.push(...json.items);
      totalPages = json.totalPages;
      page++;
    }

    if (!allItems.length) {
      statusEl.textContent = `Không có dữ liệu cho tháng ${month}/${year}`;
      statusEl.style.color = "var(--danger)";
      return;
    }

    // Map Tana data → our release_calendar schema
    _tanaRows = allItems
      .map((item) => {
        const pub = item.expand?.publication;
        const release = pub?.expand?.release;
        const title = release?.expand?.title;
        const publisher = release?.expand?.publisher;

        // Cover URL: Use assets via reverse relation from PocketBase
        let cover_url = null;
        let asset = null;
        if (item.expand?.assets_via_book?.length > 0) {
          asset = item.expand.assets_via_book.sort(
            (a, b) => a.priority - b.priority,
          )[0];
        } else if (pub?.expand?.assets_via_publication?.length > 0) {
          asset = pub.expand.assets_via_publication.sort(
            (a, b) => a.priority - b.priority,
          )[0];
        }
        if (asset && asset.image) {
          cover_url = `https://pb.tana.moe/api/files/${asset.collectionId}/${asset.id}/${asset.image}`;
        }

        // Release date: strip time portion
        const release_date = item.publishDate
          ? item.publishDate.split(" ")[0]
          : null;

        // Edition mapping
        const rawEdition = (item.edition ?? "").toLowerCase();
        const edition = EDITION_MAP[rawEdition] ?? "standard";

        // Volume mapping (Tana stores volume as vol * 10000 to handle decimals)
        const volume = pub?.volume ? pub.volume / 10000 : null;

        return {
          release_date,
          title: pub?.name ?? title?.name ?? "(Không có tên)",
          series: title?.name ?? null,
          volume: volume,
          publisher: publisher?.name ?? release?.publisher ?? null,
          price: item.price ?? null,
          cover_url,
          edition,
          note: item.note ?? null,
          _tana_id: item.id, // keep for dedup display
        };
      })
      .filter((r) => r.release_date); // drop rows without date

    // Render preview
    previewTable.innerHTML = _tanaRows
      .map((r, i) => _renderPreviewRow(r, i, "tana"))
      .join("");
    document.getElementById("tana-select-all").checked = true;
    _updateCount("tana");
    previewArea.classList.remove("hidden");
    statusEl.textContent = `Tìm thấy ${_tanaRows.length} cuốn.`;
    statusEl.style.color = "var(--success, #059669)";
    if (window.feather) feather.replace();
  } catch (e) {
    console.error("[import-tana] fetch error:", e);
    statusEl.textContent = `Lỗi: ${e.message}`;
    statusEl.style.color = "var(--danger)";
  } finally {
    btn.disabled = false;
  }
}

export function tanaUpdateCount() {
  _updateCount("tana");
}

export function tanaToggleAll(checked) {
  document
    .querySelectorAll(".tana-row-check")
    .forEach((cb) => (cb.checked = checked));
  _updateCount("tana");
}

export async function importSelectedTana() {
  const checked = [...document.querySelectorAll(".tana-row-check:checked")];
  if (!checked.length) {
    window.app.showToast("Chưa chọn entry nào!", "error");
    return;
  }

  const rows = checked.map((cb) => {
    const r = { ..._tanaRows[parseInt(cb.dataset.index)] };
    delete r._tana_id;
    return r;
  });

  await _batchInsert(rows, "tana");
}

// ─── CSV / JSON IMPORT ───────────────────────────────────────────────────────

const CSV_HEADERS = [
  "release_date",
  "series",
  "title",
  "volume",
  "publisher",
  "price",
  "cover_url",
  "edition",
  "note",
];

function _parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2)
    throw new Error("CSV cần ít nhất 2 dòng (header + data)");

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines
    .slice(1)
    .map((line, li) => {
      if (!line.trim()) return null;
      // Simple CSV split (không hỗ trợ quoted commas — đủ cho use case này)
      const vals = line.split(",");
      const obj = {};
      header.forEach((h, i) => {
        obj[h] = vals[i]?.trim() ?? null;
      });
      if (!obj.title) throw new Error(`Dòng ${li + 2}: thiếu cột 'title'`);
      if (!obj.release_date)
        throw new Error(`Dòng ${li + 2}: thiếu cột 'release_date'`);
      obj.volume = obj.volume ? parseFloat(obj.volume) || null : null;
      obj.price = obj.price ? parseInt(obj.price) || null : null;
      obj.edition = EDITION_MAP[obj.edition?.toLowerCase()] ?? "standard";
      return obj;
    })
    .filter(Boolean);
}

function _parseJson(text) {
  const arr = JSON.parse(text);
  if (!Array.isArray(arr)) throw new Error("JSON phải là array []");
  return arr.map((item, i) => {
    if (!item.title) throw new Error(`Item [${i}]: thiếu trường 'title'`);
    if (!item.release_date)
      throw new Error(`Item [${i}]: thiếu trường 'release_date'`);
    return {
      release_date: item.release_date,
      series: item.series ?? null,
      title: item.title,
      volume: item.volume ? parseFloat(item.volume) || null : null,
      publisher: item.publisher ?? null,
      price: item.price ? parseInt(item.price) || null : null,
      cover_url: item.cover_url ?? null,
      edition: EDITION_MAP[(item.edition ?? "").toLowerCase()] ?? "standard",
      note: item.note ?? null,
    };
  });
}

export function parseCsvImport() {
  const input = document.getElementById("csv-import-input")?.value?.trim();
  const statusEl = document.getElementById("csv-parse-status");
  const previewArea = document.getElementById("csv-preview-area");
  const previewTable = document.getElementById("csv-preview-table");

  if (!input) {
    window.app.showToast("Paste dữ liệu vào trước!", "error");
    return;
  }
  _csvRows = [];

  try {
    if (input.startsWith("[") || input.startsWith("{")) {
      _csvRows = _parseJson(input.startsWith("{") ? `[${input}]` : input);
    } else {
      _csvRows = _parseCsv(input);
    }

    previewTable.innerHTML = _csvRows
      .map((r, i) => _renderPreviewRow(r, i, "csv"))
      .join("");
    document.getElementById("csv-select-all").checked = true;
    _updateCount("csv");
    previewArea.classList.remove("hidden");
    statusEl.textContent = `Parse OK — ${_csvRows.length} dòng.`;
    statusEl.style.color = "var(--success, #059669)";
    if (window.feather) feather.replace();
  } catch (e) {
    statusEl.textContent = `Lỗi parse: ${e.message}`;
    statusEl.style.color = "var(--danger)";
    previewArea.classList.add("hidden");
  }
}

export function csvUpdateCount() {
  _updateCount("csv");
}

export function csvToggleAll(checked) {
  document
    .querySelectorAll(".csv-row-check")
    .forEach((cb) => (cb.checked = checked));
  _updateCount("csv");
}

export async function importSelectedCsv() {
  const checked = [...document.querySelectorAll(".csv-row-check:checked")];
  if (!checked.length) {
    window.app.showToast("Chưa chọn entry nào!", "error");
    return;
  }

  const rows = checked.map((cb) => _csvRows[parseInt(cb.dataset.index)]);
  await _batchInsert(rows, "csv");
}

// ─── Shared: Batch insert ───────────────────────────────────────────────────
async function _batchInsert(rows, source) {
  window.app.showLoading(`Đang import ${rows.length} entry...`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  // Insert in batches of 20 using admin_upsert_release RPC
  for (const row of rows) {
    try {
      const res = await window.app.apiFetch("/api/schedule/admin/import", {
        method: "POST",
        body: JSON.stringify(row),
      });
      if (res.error === "duplicate") {
        skipCount++;
      } else {
        successCount++;
      }
    } catch (e) {
      console.warn("[import] row error:", row.title, e.message);
      errorCount++;
    }
  }

  window.app.hideLoading();

  const msg = `Import xong! ✅ ${successCount} thêm · ⏭ ${skipCount} trùng · ❌ ${errorCount} lỗi`;
  window.app.showToast(msg, errorCount > 0 ? "error" : "success");

  if (successCount > 0) {
    // Reload the admin list to show new entries
    window.app.adminScheduleLoad();

    // Reset preview
    if (source === "tana") {
      document.getElementById("tana-preview-area")?.classList.add("hidden");
      _tanaRows = [];
    } else {
      document.getElementById("csv-preview-area")?.classList.add("hidden");
      document.getElementById("csv-import-input").value = "";
      _csvRows = [];
    }
  }
}
