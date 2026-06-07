import { store } from "../../store.js";

export function onAdminCatalogSearchInput(value) {
  clearTimeout(window.app._adminSearchTimeout);
  window.app._adminSearchTimeout = setTimeout(() => {
    window.app.searchAdminCatalog(1);
  }, 300);
}

export async function searchAdminCatalog(page = 1) {
  if (typeof page !== "number") page = 1;

  const input = document.getElementById("admin-catalog-search");
  if (!input) return;
  const query = input.value.trim().toLowerCase();

  const container = document.getElementById("admin-catalog-list");
  const pagination = document.getElementById("admin-catalog-pagination");

  if (!store.fullCatalogCache) {
    if (container) {
      container.style.columns = "2";
      container.style.columnGap = "1.5rem";
      container.innerHTML = Array(10)
        .fill(
          `
                <div style="break-inside:avoid; margin-bottom:0.75rem; padding:0.65rem 0.75rem; border:1px solid var(--border); border-radius:8px; background:var(--surface); display:flex; align-items:center; gap:0.75rem;">
                    <div class="skeleton" style="width:32px;height:45px;border-radius:4px;flex-shrink:0;"></div>
                    <div style="flex:1;">
                        <div class="skeleton skeleton-text medium" style="margin-bottom:0.25rem;"></div>
                        <div class="skeleton skeleton-text short" style="margin-bottom:0; height:0.75rem;"></div>
                    </div>
                </div>
            `,
        )
        .join("");
    }
    if (pagination) pagination.innerHTML = "";

    if (window.app._catalogFetchController) {
      window.app._catalogFetchController.abort();
    }
    const controller = new AbortController();
    window.app._catalogFetchController = controller;

    try {
      const res = await window.app.executeWithAbort(
        () => window.app.apiFetch("/api/admin/catalog?limit=10000"),
        15000,
        "Timeout",
        3,
        controller,
      );
      const data = res.data;
      const error = res.error;

      if (
        controller.signal.aborted &&
        window.app._catalogFetchController !== controller
      ) {
        return;
      }

      if (error) throw error;
      store.fullCatalogCache = data;
    } catch (e) {
      if (e.name === "AbortError" && !window.app._catalogFetchController)
        return;
      console.error("Lỗi tìm kiếm catalog:", e);
      container.innerHTML =
        '<p style="text-align:center; color:var(--danger); padding:2rem; grid-column:1/-1;">Lỗi khi tải dữ liệu từ Kho chung. Xin hãy F5 tải lại trang.</p>';
      return;
    } finally {
      if (window.app._catalogFetchController === controller) {
        window.app._catalogFetchController = null;
      }
    }
  }

  let matchedItems = store.fullCatalogCache;
  if (query.length > 0) {
    const queryWords = query.split(/[\s\-]+/).filter(Boolean);

    matchedItems = store.fullCatalogCache.filter((c) => {
      const cIsbnStr = c.isbns ? c.isbns.join("").replace(/[\s\-]/g, "") : "";
      const qIsbnStr = query.replace(/[\s\-]/g, "");
      const matchIsbn =
        cIsbnStr && qIsbnStr.length >= 6 && cIsbnStr.includes(qIsbnStr);

      const searchable =
        `${c.title || ""} ${c.series || ""} ${c.volume ? "tập " + c.volume : ""} ${c.author || ""} ${c.translator || ""}`.toLowerCase();
      const matchText =
        queryWords.length > 0 &&
        queryWords.every((w) => searchable.includes(w));

      return matchText || matchIsbn;
    });
  }

  const hasVolumeQuery =
    query.length > 0 &&
    /tập\s*\d|vol\.?\s*\d|volume\s*\d|\bt\s*\d+\b/i.test(query);
  const isSmallResultSet =
    query.length > 0 && matchedItems.length > 0 && matchedItems.length <= 15;
  const showIndividualVolumes = hasVolumeQuery || isSmallResultSet;

  if (showIndividualVolumes) {
    const sorted = [...matchedItems].sort((a, b) => {
      const sc = (a.series || "").localeCompare(b.series || "");
      return sc !== 0 ? sc : (a.volume || 0) - (b.volume || 0);
    });
    const count = sorted.length;
    const limit = 50;
    const start = (page - 1) * limit;
    const pagedItems = sorted.slice(start, start + limit);
    window.app._renderCatalogVolumeResults(pagedItems, count, page);
    return;
  }

  const seriesMap = new Map();
  matchedItems.forEach((c) => {
    const sName = (c.series || "Chưa phân loại").trim();
    if (!seriesMap.has(sName)) {
      seriesMap.set(sName, { series: sName, count: 0, cover: c.cover_url });
    }
    const g = seriesMap.get(sName);
    g.count++;
    if (!g.cover && c.cover_url) g.cover = c.cover_url;
  });

  const groupedSeries = Array.from(seriesMap.values()).sort((a, b) =>
    a.series.localeCompare(b.series),
  );

  const count = groupedSeries.length;
  const limit = 50;
  const start = (page - 1) * limit;
  const pagedData = groupedSeries.slice(start, start + limit);

  store.adminCatalogCache = pagedData;
  window.app.renderAdminCatalogList(pagedData, count, page);
}

export function _renderCatalogVolumeResults(list, count = 0, page = 1) {
  const container = document.getElementById("admin-catalog-list");
  const pagination = document.getElementById("admin-catalog-pagination");
  if (!container) return;
  container.innerHTML = "";
  if (pagination) pagination.innerHTML = "";

  if (list.length === 0) {
    container.innerHTML =
      '<p style="text-align:center; color:var(--text-muted); padding:2rem; grid-column:1/-1;">Không tìm thấy bản ghi nào khớp.</p>';
    return;
  }

  container.style.columns = "2";
  container.style.columnGap = "1.5rem";

  list.forEach((c) => {
    const editionBadge = window.app.getEditionBadge
      ? window.app.getEditionBadge(c.title)
      : "";
    const item = document.createElement("div");
    item.className = "catalog-list-item";
    item.style.cssText =
      "break-inside:avoid; margin-bottom:0.75rem; padding:0.65rem 0.75rem; border:1px solid var(--border); border-radius:8px; background:var(--surface); cursor:pointer; display:flex; align-items:center; justify-content:space-between;";
    item.onclick = () => window.app.openCatalogModal(c.id);

    const coverHtml =
      c.cover_url && c.cover_url.trim()
        ? `<img src="${c.cover_url}" alt="Cover" style="width:32px;height:45px;object-fit:cover;border-radius:4px;flex-shrink:0;border:1px solid var(--border);">`
        : `<div style="width:32px;height:45px;border-radius:4px;flex-shrink:0;background:var(--bg-lighter);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;"><i data-feather="image" style="width:14px;height:14px;opacity:0.4;"></i></div>`;

    item.innerHTML = `
            <div style="flex:1;min-width:0;display:flex;align-items:center;gap:0.75rem;">
                ${coverHtml}
                <div style="display:flex;flex-direction:column;justify-content:center;min-width:0;">
                    <span style="color:var(--text-main);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:0.9rem;">${c.series || ""}</span>
                    <div style="font-size:0.8rem;color:var(--text-muted);margin-top:1px;">Tập ${c.volume || 0}${c.title && c.title !== c.series ? " · " + c.title : ""}</div>
                    ${editionBadge ? `<div style="margin-top:0.2rem;">${editionBadge}</div>` : ""}
                </div>
            </div>
            <i data-feather="edit-2" style="width:15px;height:15px;color:var(--text-muted);flex-shrink:0;margin-left:0.5rem;"></i>
        `;
    container.appendChild(item);
  });
  if (window.feather) {
    try {
      feather.replace();
    } catch (e) {}
  }

  if (pagination && count > 50) {
    const totalPages = Math.ceil(count / 50);
    pagination.innerHTML = `
            <button class="btn btn-outline" style="padding:0.5rem 1rem;" onclick="app.searchAdminCatalog(${page - 1})" ${page <= 1 ? "disabled" : ""}>
                <i data-feather="chevron-left"></i> Trước
            </button>
            <span style="color:var(--text-main);font-weight:500;">Trang ${page} / ${totalPages}</span>
            <button class="btn btn-outline" style="padding:0.5rem 1rem;" onclick="app.searchAdminCatalog(${page + 1})" ${page >= totalPages ? "disabled" : ""}>
                Sau <i data-feather="chevron-right"></i>
            </button>
        `;
    if (window.feather) {
      try {
        feather.replace();
      } catch (e) {}
    }
  }
}

export function renderAdminCatalogList(list, count = 0, page = 1) {
  const container = document.getElementById("admin-catalog-list");
  const pagination = document.getElementById("admin-catalog-pagination");
  if (!container) return;
  container.innerHTML = "";
  if (pagination) pagination.innerHTML = "";

  if (list.length === 0) {
    container.innerHTML =
      '<p style="text-align:center; color:var(--text-muted); padding:2rem; grid-column:1/-1;">Không tìm thấy bản ghi nào khớp với từ khóa.</p>';
    return;
  }

  container.style.columns = "2";
  container.style.columnGap = "1.5rem";

  list.forEach((g) => {
    const item = document.createElement("div");
    item.className = "catalog-list-item";
    item.style.breakInside = "avoid";
    item.style.marginBottom = "0.75rem";
    item.style.padding = "0.75rem";
    item.style.border = "1px solid var(--border)";
    item.style.borderRadius = "8px";
    item.style.background = "var(--surface)";
    item.style.cursor = "pointer";
    item.style.display = "flex";
    item.style.alignItems = "center";
    item.style.justifyContent = "space-between";
    item.onclick = () => window.app.openAdminSeriesDetail(g.series);

    const coverHtml =
      g.cover && g.cover.trim() !== ""
        ? `<img src="${g.cover}" alt="Cover" style="width:36px;height:50px;object-fit:cover;border-radius:4px;flex-shrink:0;border:1px solid var(--border);">`
        : `<div style="width:36px;height:50px;border-radius:4px;flex-shrink:0;background:var(--bg-lighter);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;"><i data-feather="image" style="width:16px;height:16px;opacity:0.5;"></i></div>`;

    item.innerHTML = `
            <div style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:0.75rem;">
                ${coverHtml}
                <div style="display:flex; flex-direction:column; justify-content:center; overflow:hidden;">
                    <span style="color:var(--text-main); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size: 0.95rem;">${g.series}</span>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">${g.count} cuốn trong kho</div>
                </div>
            </div>
            <i data-feather="chevron-right" style="width:18px;height:18px; color:var(--text-muted); flex-shrink:0; margin-left:0.5rem;"></i>
        `;
    container.appendChild(item);
  });
  if (window.feather) {
    try {
      feather.replace();
    } catch (e) {
      console.warn("Feather error:", e);
    }
  }

  if (pagination && count > 0) {
    const limit = 50;
    const totalPages = Math.ceil(count / limit);
    pagination.innerHTML = `
            <button class="btn btn-outline" style="padding: 0.5rem 1rem;" onclick="app.searchAdminCatalog(${page - 1})" ${page <= 1 ? "disabled" : ""}>
                <i data-feather="chevron-left"></i> Trước
            </button>
            <span style="color:var(--text-main); font-weight:500;">Trang ${page} / ${totalPages}</span>
            <button class="btn btn-outline" style="padding: 0.5rem 1rem;" onclick="app.searchAdminCatalog(${page + 1})" ${page >= totalPages ? "disabled" : ""}>
                Sau <i data-feather="chevron-right"></i>
            </button>
        `;
    if (window.feather) {
      try {
        feather.replace();
      } catch (e) {
        console.warn("Feather error:", e);
      }
    }
  }
}

export function openAdminSeriesDetail(seriesName) {
  if (!seriesName || seriesName === "Chưa phân loại") return;
  window.app.navigateTo("/admin/series/" + encodeURIComponent(seriesName));
}

export async function renderAdminSeriesDetail(seriesName, page = 1) {
  if (!seriesName || seriesName === "Chưa phân loại") return;

  window.app._adminCurrentSeries = seriesName;

  const mainView = document.getElementById("admin-catalog-main-view");
  const detailView = document.getElementById("admin-series-detail-view");
  if (mainView) mainView.classList.add("hidden");
  if (detailView) detailView.classList.remove("hidden");

  const adminTabs = document.querySelector(".admin-tabs");
  if (adminTabs) adminTabs.style.display = "none";

  document.getElementById("admin-series-detail-title").textContent = seriesName;
  const totalInput = document.getElementById("admin-series-total-volumes");
  totalInput.value = "";
  totalInput.placeholder = "";

  const listContainer = document.getElementById("admin-series-volumes-list");
  window.app.renderVolumeSkeletons("admin-series-volumes-list");

  if (window.feather) {
    try {
      feather.replace();
    } catch (e) {
      console.warn("Feather error:", e);
    }
  }

  if (!store.fullCatalogCache) {
    if (window.feather) {
      try {
        feather.replace();
      } catch (e) {}
    }
    try {
      const res = await window.app.executeWithAbort(
        () => window.app.apiFetch("/api/admin/catalog?limit=10000"),
        15000,
        "Timeout",
      );
      const data = res.data;
      const error = res.error;
      if (error) throw error;
      store.fullCatalogCache = data;
    } catch (e) {
      if (e.name === "AbortError") return;
      console.error("[Admin Series] Lỗi tải cache:", e);
      listContainer.innerHTML =
        '<p style="text-align:center; color:var(--danger); padding:2rem; grid-column:1/-1;">Không thể tải dữ liệu. Vui lòng thử lại.</p>';
      totalInput.placeholder = "...";
      return;
    }
  }

  try {
    const editionOrder = (title) => {
      const t = (title || "").toLowerCase();
      if (t.includes("sưu tầm") || t.includes("collector")) return 3;
      if (t.includes("giới hạn") || t.includes("limited")) return 2;
      if (t.includes("đặc biệt") || t.includes("special")) return 1;
      return 0;
    };
    const volumes = store.fullCatalogCache
      .filter((c) => c.series === seriesName)
      .sort((a, b) => {
        const volDiff = (a.volume || 0) - (b.volume || 0);
        if (volDiff !== 0) return volDiff;
        return editionOrder(a.title) - editionOrder(b.title);
      });
    const count = volumes.length;
    const maxVolume = volumes.reduce(
      (max, c) => Math.max(max, c.volume || 0),
      0,
    );
    totalInput.placeholder = "";
    if (maxVolume > 0) totalInput.value = maxVolume;

    const limit = 100;
    const start = (page - 1) * limit;
    const pagedVolumes = volumes.slice(start, start + limit);

    listContainer.innerHTML = "";
    if (volumes.length === 0) {
      listContainer.innerHTML =
        '<p style="text-align:center; grid-column:1/-1;">Không có sách nào thuộc series này.</p>';
      totalInput.placeholder = "";
      return;
    }

    window.app
      .apiFetch(
        `/api/admin/series-metadata?series=${encodeURIComponent(seriesName)}`,
      )
      .then((res) => {
        if (res.data && res.data.total_volumes)
          totalInput.value = res.data.total_volumes;
      })
      .catch(() => {});

    pagedVolumes.forEach((c) => {
      const editionBadge = window.app.getEditionBadge(c.title);
      const item = document.createElement("div");
      item.className = "catalog-list-item";
      item.style.breakInside = "avoid";
      item.style.padding = "0.5rem 0.75rem";
      item.style.border = "1px solid var(--border)";
      item.style.borderRadius = "8px";
      item.style.background = "var(--surface)";
      item.style.cursor = "pointer";
      item.style.display = "flex";
      item.style.alignItems = "center";
      item.style.justifyContent = "space-between";
      item.onclick = () => window.app.openCatalogModal(c.id);

      const coverHtml =
        c.cover_url && c.cover_url.trim() !== ""
          ? `<img src="${c.cover_url}" alt="Cover" style="width:32px;height:45px;object-fit:cover;border-radius:4px;flex-shrink:0;border:1px solid var(--border);">`
          : `<div style="width:32px;height:45px;border-radius:4px;flex-shrink:0;background:var(--bg-lighter);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;"><i data-feather="image" style="width:16px;height:16px;opacity:0.5;"></i></div>`;

      item.innerHTML = `
                <div style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:0.75rem;">
                    ${coverHtml}
                    <div style="display:flex; flex-direction:column; justify-content:center; overflow:hidden;">
                        <span style="color:var(--text-main); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size: 0.95rem;">${c.title || c.series}</span>
                        <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Tập ${c.volume || 0}</div>
                        ${editionBadge ? `<div style="margin-top:0.25rem;">${editionBadge}</div>` : ""}
                    </div>
                </div>
                <i data-feather="edit-2" style="width:16px;height:16px; color:var(--text-muted); flex-shrink:0; margin-left:0.5rem;"></i>
            `;
      listContainer.appendChild(item);
    });
    if (window.feather) {
      try {
        feather.replace();
      } catch (e) {
        console.warn("Feather error:", e);
      }
    }

    const pagination = document.getElementById(
      "admin-series-detail-pagination",
    );
    if (pagination) {
      pagination.innerHTML = "";
      if (count > limit) {
        const totalPages = Math.ceil(count / limit);
        pagination.innerHTML = `
                    <button class="btn btn-outline" style="padding: 0.5rem 1rem;" onclick="app.renderAdminSeriesDetail('${seriesName.replace(/'/g, "\\'")}', ${page - 1})" ${page <= 1 ? "disabled" : ""}>
                        <i data-feather="chevron-left"></i> Trước
                    </button>
                    <span style="color:var(--text-main); font-weight:500;">Trang ${page} / ${totalPages}</span>
                    <button class="btn btn-outline" style="padding: 0.5rem 1rem;" onclick="app.renderAdminSeriesDetail('${seriesName.replace(/'/g, "\\'")}', ${page + 1})" ${page >= totalPages ? "disabled" : ""}>
                        Sau <i data-feather="chevron-right"></i>
                    </button>
                `;
        if (window.feather) {
          try {
            feather.replace();
          } catch (e) {
            console.warn("Feather error:", e);
          }
        }
      }
    }
  } catch (renderErr) {
    console.error("[openAdminSeriesDetail] Lỗi render volumes:", renderErr);
    listContainer.innerHTML =
      '<p style="text-align:center; color:var(--danger); padding:2rem; grid-column:1/-1;">Đã xảy ra lỗi khi tải danh sách tập. Vui lòng thử lại.</p>';
    totalInput.placeholder = "...";
  }
}

export function closeAdminSeriesDetail() {
  window.app._adminCurrentSeries = null;
  window.app.navigateTo("/admin/catalog");
}

export async function saveAdminSeriesMetadata() {
  if (!window.app._adminCurrentSeries) return;
  const totalInput = document.getElementById("admin-series-total-volumes");
  const val = totalInput.value.trim();

  const num = parseFloat(val);
  if (isNaN(num) || num < 0) {
    window.app.showToast("Số tập không hợp lệ!", "error");
    return;
  }

  window.app.showLoading("Đang lưu thông tin...");
  try {
    const res = await window.app.executeWithAbort(
      () =>
        window.app.apiFetch("/api/admin/series-metadata", {
          method: "PUT",
          body: JSON.stringify({
            series: window.app._adminCurrentSeries,
            total_volumes: num,
          }),
        }),
      15000,
      "Lỗi kết nối khi lưu thông tin series",
    );
    const error = res.error;

    if (error) throw error;
    window.app.showToast(
      `Đã lưu tổng số tập cho "${window.app._adminCurrentSeries}" thành công!`,
    );
    totalInput.blur();
  } catch (e) {
    console.error("Lỗi khi lưu series metadata:", e);
    window.app.showToast("Lỗi khi lưu dữ liệu. Vui lòng thử lại.", "error");
  } finally {
    window.app.hideLoading();
  }
}

export function openCatalogModal(id) {
  const c = store.fullCatalogCache
    ? store.fullCatalogCache.find((x) => x.id === id)
    : null;
  if (!c) return;

  const modal = document.getElementById("catalog-modal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("show");
  }

  const title = document.getElementById("catalog-modal-title");
  const seriesLabel = (c.series || "").trim();
  if (title)
    title.textContent = seriesLabel
      ? `Sửa: ${seriesLabel} - Tập ${c.volume || 0}`
      : `Sửa: Tập ${c.volume || 0}`;

  const modalBody = document.getElementById("catalog-modal-body");
  const coverUrl = c.cover_url || "";
  const isbnsText = c.isbns ? c.isbns.join(", ") : "";

  modalBody.innerHTML = `
        <div class="form-grid" style="display:flex; gap:2rem; align-items:flex-start;">
            <div class="form-cols" style="flex: 1.5; min-width:0;">
                <input type="hidden" id="edit-cat-id" value="${c.id}">
                <div class="form-group">
                    <label>Series</label>
                    <input type="text" id="edit-cat-series" class="input-ctrl" value="${c.series || ""}">
                </div>
                <div class="form-group">
                    <label>Tên sách cụ thể</label>
                    <input type="text" id="edit-cat-title" class="input-ctrl" value="${c.title || ""}">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Tập số</label>
                        <input type="number" id="edit-cat-volume" class="input-ctrl" value="${c.volume || ""}" min="0" max="10000" step="0.5">
                    </div>
                    <div class="form-group">
                        <label>ISBN</label>
                        <textarea id="edit-cat-isbn" class="input-ctrl" rows="2">${isbnsText}</textarea>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Tác giả</label>
                        <textarea id="edit-cat-author" class="input-ctrl" rows="2">${c.author || ""}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Dịch giả</label>
                        <input type="text" id="edit-cat-translator" class="input-ctrl" value="${c.translator || ""}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Nhà xuất bản</label>
                        <select id="edit-cat-publisher" class="input-ctrl">
                            <option value="">-- Chọn NXB --</option>
                            ${["Hồng Đức", "Kim Đồng", "Lao động", "Trẻ", "Văn học"].map((o) => `<option value="${o}" ${c.publisher === o ? "selected" : ""}>${o}</option>`).join("")}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Nhà phát hành</label>
                        <select id="edit-cat-distributor" class="input-ctrl">
                            <option value="">-- Chọn NPH --</option>
                            ${["IPM", "Kim Đồng", "Trẻ"].map((o) => `<option value="${o}" ${c.distributor === o ? "selected" : ""}>${o}</option>`).join("")}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Ngày phát hành</label>
                        <input type="date" id="edit-cat-publishDate" class="input-ctrl" value="${c.publish_date || ""}">
                    </div>
                    <div class="form-group">
                        <label>Số trang</label>
                        <input type="number" id="edit-cat-pages" class="input-ctrl" value="${c.pages || ""}" min="1" max="100000">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Kích thước</label>
                        <select id="edit-cat-size" class="input-ctrl">
                            <option value="">-- Chọn kích thước --</option>
                            ${["11.3 x 17.6 cm", "12 x 18 cm", "13 x 18 cm", "14.5 x 20.5 cm"].map((o) => `<option value="${o}" ${c.size === o ? "selected" : ""}>${o}</option>`).join("")}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Giá tiền (VNĐ)</label>
                        <input type="number" id="edit-cat-price" class="input-ctrl" value="${c.price || ""}" min="0" max="2000000000">
                    </div>
                </div>
                <div class="form-group">
                    <label>Ghi chú</label>
                    <textarea id="edit-cat-note" class="input-ctrl" rows="2">${c.note || ""}</textarea>
                </div>
            </div>

            <div class="form-cols cover-col" style="flex: 1;">
                <div class="image-tabs">
                    <button type="button" class="img-tab-btn active" onclick="app.switchImgTab('cover', 'cat-')">Ảnh bìa</button>
                    <button type="button" class="img-tab-btn" onclick="app.switchImgTab('gift', 'cat-')">Quà tặng kèm</button>
                </div>

                <div id="cat-tab-cover" class="img-tab-content active">
                    <div class="form-group">
                        <div style="display:flex; gap:0.5rem; align-items:center;">
                            <input type="text" id="cat-coverUrl" class="input-ctrl"
                                placeholder="https://... hoặc tải File" value="${coverUrl}"
                                oninput="app.previewImage(window.app.value, 'cover', 'cat-')">
                            <input type="file" id="cat-coverFile" accept="image/*" style="display:none"
                                onchange="app.handleFileUpload(this, 'cover', 'cat-')">
                            <button type="button" class="btn btn-outline"
                                style="padding:0.6rem 1rem; flex-shrink:0;" title="Tải ảnh lên từ máy"
                                onclick="document.getElementById('cat-coverFile').click()">
                                <i data-feather="upload"></i>
                            </button>
                        </div>
                        <p class="help-text">Dán link hoặc tải file ảnh bìa.</p>
                    </div>
                    <div class="cover-preview-box" id="cat-cover-preview-box" style="position:relative;">
                        <i data-feather="image"></i>
                        <span>Xem trước ảnh bìa</span>
                    </div>
                </div>

                <div id="cat-tab-gift" class="img-tab-content hidden">
                    <div class="form-group">
                        <div style="display:flex; gap:0.5rem; align-items:center;">
                            <input type="text" id="cat-giftUrlInput" class="input-ctrl"
                                placeholder="https://... hoặc tải File">
                            <input type="file" id="cat-giftFiles" accept="image/*" multiple style="display:none"
                                onchange="app.handleGiftFileUpload(this, 'cat-')">
                            <button type="button" class="btn btn-outline"
                                style="padding:0.6rem 1rem; flex-shrink:0;" title="Tải ảnh lên từ máy"
                                onclick="document.getElementById('cat-giftFiles').click()">
                                <i data-feather="upload"></i>
                            </button>
                            <button type="button" class="btn btn-primary"
                                style="padding:0.6rem 1rem; flex-shrink:0;" title="Thêm ảnh này"
                                onclick="app.addGiftUrl('cat-')">
                                <i data-feather="plus"></i>
                            </button>
                        </div>
                        <p class="help-text">Dán link hoặc tải file, rồi nhấn + để thêm.</p>
                    </div>
                    <div class="cover-preview-box" id="cat-gift-preview-box" style="position:relative;">
                        <i data-feather="gift"></i>
                        <span>Xem trước quà tặng</span>
                    </div>
                    <div id="cat-gift-thumbnails"
                        style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-top:1rem;"></div>
                    <textarea id="cat-giftUrls" class="hidden">${c.gift_urls ? c.gift_urls.join("\n") : ""}</textarea>
                </div>
            </div>
        </div>
    `;
  if (window.feather) {
    try {
      feather.replace();
    } catch (e) {
      console.warn("Feather error:", e);
    }
  }

  window.app.previewImage(coverUrl, "cover", "cat-");
  if (c.gift_urls && c.gift_urls.length > 0) {
    window.app.renderGiftThumbnails("cat-");
    window.app.previewGiftImage(c.gift_urls[c.gift_urls.length - 1], "cat-");
  } else {
    window.app.previewGiftImage("", "cat-");
  }
}

export function closeCatalogModal() {
  const modal = document.getElementById("catalog-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("show");
  }
}

export async function adminUpdateCatalog() {
  if (
    !(await window.app.customConfirm(
      "Lưu thay đổi vào Kho chung? Dữ liệu này sẽ áp dụng cho tất cả người dùng dùng tính năng Tự động điền.",
    ))
  )
    return;
  const id = document.getElementById("edit-cat-id").value;
  if (!id) return;

  const giftStr = document.getElementById("cat-giftUrls")?.value || "";
  const giftUrls = giftStr
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s !== "");

  const isbnStr = document.getElementById("edit-cat-isbn").value;
  const isbns = isbnStr
    .split(/[,;|\/\s\n]+/)
    .map((s) => s.trim())
    .filter((s) => s !== "");

  const payload = {
    series: document.getElementById(`edit-cat-series`).value,
    title: document.getElementById(`edit-cat-title`).value,
    volume: parseFloat(document.getElementById(`edit-cat-volume`).value) || 0,
    isbns: isbns,
    author: document.getElementById(`edit-cat-author`).value,
    translator: document.getElementById(`edit-cat-translator`).value,
    publisher: document.getElementById(`edit-cat-publisher`).value,
    distributor: document.getElementById(`edit-cat-distributor`).value,
    publish_date: document.getElementById(`edit-cat-publishDate`).value || null,
    pages: parseInt(document.getElementById(`edit-cat-pages`).value) || 0,
    size: document.getElementById(`edit-cat-size`).value,
    price: parseInt(document.getElementById(`edit-cat-price`).value) || 0,
    cover_url: document.getElementById(`cat-coverUrl`).value,
    note: document.getElementById(`edit-cat-note`).value,
    gift_urls: giftUrls,
  };

  if (store.fullCatalogCache) {
    const idx = store.fullCatalogCache.findIndex((c) => c.id === id);
    if (idx !== -1) {
      store.fullCatalogCache[idx] = {
        ...store.fullCatalogCache[idx],
        ...payload,
      };
    }
  }

  window.app.closeCatalogModal();
  window.app.searchAdminCatalog();

  window.app.queueTask("ADMIN_UPDATE_CATALOG", { id, data: payload }, null, {
    message: "Cập nhật Kho chung thành công!",
    nonBlocking: false,
    silent: false,
  });
}

export async function adminDeleteCatalog() {
  if (
    !(await window.app.customConfirm(
      "Xóa vĩnh viễn sách này khỏi Kho chung? Các sách của người dùng đã thêm sẽ không bị ảnh hưởng, nhưng họ không thể dùng Tự động điền sách này nữa.",
    ))
  )
    return;
  const id = document.getElementById("edit-cat-id").value;
  if (!id) return;

  if (store.fullCatalogCache) {
    store.fullCatalogCache = store.fullCatalogCache.filter((c) => c.id !== id);
  }

  window.app.closeCatalogModal();
  window.app.closeAdminSeriesDetail();
  window.app.searchAdminCatalog(1);

  window.app.queueTask("ADMIN_DELETE_CATALOG", { id }, null, {
    message: "Đã xóa sách khỏi Kho chung!",
    nonBlocking: false,
    silent: false,
  });
}
