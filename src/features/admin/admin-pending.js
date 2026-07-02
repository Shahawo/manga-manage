import { store } from "../../store.js";
import { escapeHTML } from "../../utils/security.js";

export async function submitPendingBook(mangaData) {
  if (!store.user) return;
  try {
    await window.app.apiFetch("/api/admin/pending", {
      method: "POST",
      body: JSON.stringify({
        submitted_by: store.user.id,
        submitted_name: store.user.user_metadata?.name || store.user.email,
        submitted_email: store.user.email,
        linked_manga_id: mangaData.linked_manga_id,
        scanned_isbn: mangaData.scanned_isbn,
        series: mangaData.series,
        title: mangaData.title,
        volume: mangaData.volume,
        isbn: mangaData.isbn,
        author: mangaData.author,
        translator: mangaData.translator,
        publisher: mangaData.publisher,
        distributor: mangaData.distributor,
        publish_date: mangaData.publish_date,
        pages: mangaData.pages,
        size: mangaData.size,
        price: mangaData.price,
        cover_url: mangaData.cover_url,
        note: mangaData.note,
        gift_urls: mangaData.gift_urls,
      }),
    });
  } catch (e) {
    console.error("Failed to submit pending", e);
  }
}

export async function fetchPendingBooks() {
  const container = document.getElementById("admin-pending-list");
  if (container) {
    container.innerHTML = Array(8)
      .fill(
        `
            <div class="skeleton-volume-card volume-card" style="border: 1px solid var(--border); box-shadow: var(--shadow-sm);">
                <div class="skeleton skeleton-volume-cover" style="height: 200px;"></div>
                <div style="padding: 0.5rem;">
                    <div class="skeleton skeleton-text medium"></div>
                    <div class="skeleton skeleton-text short"></div>
                </div>
            </div>
        `,
      )
      .join("");
  }

  try {
    const res = await window.app.apiFetch("/api/admin/pending");
    if (res.error) throw res.error;
    const data = res.data;
    const rejectedIds = new Set(store.pendingRejectedIds || []);
    const list = data
      .filter((p) => !rejectedIds.has(p.id))
      .map((p) => {
        let parsedGifts = [];
        try { parsedGifts = JSON.parse(p.gift_urls || '[]'); } catch(e) {}
        if (!Array.isArray(parsedGifts)) parsedGifts = [];
        return {
          ...p,
          coverUrl: p.cover_url,
          giftUrls: parsedGifts,
          publishDate: p.publish_date,
          scannedIsbn: p.scanned_isbn,
          submittedName: p.submitted_name,
        };
      });
    store.adminCache = list;
    window.app.renderPendingList(list);

    const badge = document.getElementById("nav-admin-badge");
    if (badge) {
      badge.textContent = list.length;
      badge.style.display = list.length > 0 ? "inline-block" : "none";
    }
  } catch (e) {
    if (e.name === "AbortError") return;
    console.error("Lỗi tải danh sách Pending:", e);
  }
}

export async function checkDuplicate(pendingBook) {
  try {
    const res = await window.app.apiFetch("/api/admin/catalog?limit=1000");
    if (res.error) throw res.error;
    const data = res.data.filter(
      (b) =>
        b.series?.toLowerCase() === pendingBook.series?.toLowerCase() &&
        b.title?.toLowerCase() === pendingBook.title?.toLowerCase() &&
        (b.volume || 0) === (pendingBook.volume || 0),
    );
    return data || [];
  } catch (e) {
    return [];
  }
}

export async function renderPendingList(list) {
  const container = document.getElementById("admin-pending-list");
  if (!container) return;
  container.innerHTML = "";
  if (list.length === 0) {
    container.innerHTML =
      '<p style="text-align:center; color:var(--text-muted); padding:2rem; grid-column:1/-1;">Không có sách nào chờ duyệt.</p>';
    return;
  }

  list.forEach((p) => {
    const hasCover = p.coverUrl && p.coverUrl.trim() !== "";
    const coverHtml = hasCover
      ? `<img src="${p.coverUrl}" alt="${p.title}" loading="lazy" style="width:100%;height:100%;object-fit:cover;">`
      : `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.5rem;color:#86efac;font-size:0.75rem;font-weight:500;background:#0f3d21;text-align:center;padding:0.75rem;">
                   <i data-feather="image" style="width:32px;height:32px;opacity:0.5;"></i>
                   <span>Không có ảnh bìa</span>
               </div>`;

    const item = document.createElement("div");
    item.className = "volume-card";

    const cameraBadge = p.scannedIsbn
      ? `<span class="pending-isbn-badge">ISBN</span>`
      : "";

    const editionBadge = window.app.getEditionBadge(p.title);
    const badgeStack =
      cameraBadge || editionBadge
        ? `<div class="pending-badge-stack">${cameraBadge}${editionBadge}</div>`
        : "";

    item.innerHTML = `
            <div class="vol-cover" onclick="app.openPendingModal('${p.id}')">
                ${coverHtml}
                ${badgeStack}
            </div>
            <div class="vol-info" style="padding:0.5rem 0.65rem 0.6rem;">
                <h4 style="font-size:1rem; font-weight:600; color:var(--card-text); margin:0 0 0.25rem 0; line-height:1.3;
                            display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
                            cursor:pointer;"
                    onclick="app.openPendingModal('${p.id}')"
                    title="${escapeHTML(p.series || p.title)}">${escapeHTML(p.series || p.title)}</h4>
                <div style="font-size:0.8rem; color:var(--card-note); font-weight:500;" onclick="app.openPendingModal('${p.id}')">Tập ${escapeHTML(String(p.volume))}</div>
            </div>
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
}

export async function openPendingModal(id) {
  const p = store.adminCache.find((x) => x.id === id);
  if (!p) return;

  window.app._pendingActiveId = id;
  const title = document.getElementById("pending-modal-title");
  const seriesLabel = (p.series || "").trim();
  if (title)
    title.textContent = seriesLabel
      ? `${seriesLabel} - Tập ${p.volume}`
      : `Tập ${p.volume}`;

  const modalBody = document.getElementById("pending-modal-body");
  modalBody.innerHTML =
    '<div style="text-align:center; padding:3rem;"><i data-feather="loader" class="spin" style="width:32px;height:32px;"></i></div>';
  const modal = document.getElementById("pending-modal");
  modal.classList.remove("hidden");
  modal.classList.add("show");
  if (window.feather) {
    try {
      feather.replace();
    } catch (e) {
      console.warn("Feather error:", e);
    }
  }

  const coverUrl = p.coverUrl || "";
  const safeData = store.data || [];
  const datalistOptions = safeData
    .map(
      (m) =>
        `<option value="${m.id}">${m.series} — ${m.title} (Tập ${m.volume || 0})</option>`,
    )
    .join("");

  modalBody.innerHTML = `
        <div id="duplicate-container-${p.id}"></div>
        <div class="form-grid" style="display:flex; gap:2rem; align-items:flex-start;">
            <div class="form-cols" style="flex: 1.5; min-width:0;">
                <div class="form-group">
                    <label>Series</label>
                    <input type="text" id="edit-series-${p.id}" class="input-ctrl" value="${p.series || ""}">
                </div>
                <div class="form-group">
                    <label>Tên sách cụ thể</label>
                    <input type="text" id="edit-title-${p.id}" class="input-ctrl" value="${p.title || ""}">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Tập số</label>
                        <input type="number" id="edit-volume-${p.id}" class="input-ctrl" value="${p.volume || ""}" min="0" max="10000" step="0.5" onkeydown="if(event.key==='-') event.preventDefault();" oninvalid="window.app.setCustomValidity('Vui lòng nhập Tập số hợp lệ')" oninput="window.app.setCustomValidity('')">
                    </div>
                    <div class="form-group">
                        <label>ISBN <span style="font-size:0.8rem; color:var(--primary); font-weight:600;">${p.scannedIsbn ? "(Quét: " + p.scannedIsbn + ")" : ""}</span></label>
                        <textarea id="edit-isbn-${p.id}" class="input-ctrl" rows="2">${p.isbn || p.scannedIsbn || ""}</textarea>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Tác giả</label>
                        <textarea id="edit-author-${p.id}" class="input-ctrl" rows="2">${p.author || ""}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Dịch giả</label>
                        <input type="text" id="edit-translator-${p.id}" class="input-ctrl" value="${p.translator || ""}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Nhà xuất bản</label>
                        <select id="edit-publisher-${p.id}" class="input-ctrl">
                            <option value="">-- Chọn NXB --</option>
                            ${["Hồng Đức", "Kim Đồng", "Lao động", "Trẻ", "Văn học"].map((o) => `<option value="${o}" ${p.publisher === o ? "selected" : ""}>${o}</option>`).join("")}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Nhà phát hành</label>
                        <select id="edit-distributor-${p.id}" class="input-ctrl">
                            <option value="">-- Chọn NPH --</option>
                            ${["IPM", "Kim Đồng", "Trẻ"].map((o) => `<option value="${o}" ${p.distributor === o ? "selected" : ""}>${o}</option>`).join("")}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Ngày phát hành</label>
                        <input type="date" id="edit-publishDate-${p.id}" class="input-ctrl" value="${p.publishDate || ""}">
                    </div>
                    <div class="form-group">
                        <label>Số trang</label>
                        <input type="number" id="edit-pages-${p.id}" class="input-ctrl" value="${p.pages || ""}" min="1" max="100000" onkeydown="if(event.key==='-') event.preventDefault();" oninvalid="window.app.setCustomValidity('Số trang phải từ 1 trở lên')" oninput="window.app.setCustomValidity('')">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Kích thước</label>
                        <select id="edit-size-${p.id}" class="input-ctrl">
                            <option value="">-- Chọn kích thước --</option>
                            ${["11.3 x 17.6 cm", "12 x 18 cm", "13 x 18 cm", "14.5 x 20.5 cm"].map((o) => `<option value="${o}" ${p.size === o ? "selected" : ""}>${o}</option>`).join("")}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Giá tiền (VNĐ)</label>
                        <input type="number" id="edit-price-${p.id}" class="input-ctrl" value="${p.price || ""}" min="0" max="2000000000" onkeydown="if(event.key==='-') event.preventDefault();" oninvalid="window.app.setCustomValidity('Giá bìa không được vượt quá 2 tỷ')" oninput="window.app.setCustomValidity('')">
                    </div>
                </div>
                <div class="form-group">
                    <label>Ghi chú</label>
                    <textarea id="edit-note-${p.id}" class="input-ctrl" rows="2">${p.note || ""}</textarea>
                </div>
                <div class="form-group">
                    <label>Gửi bởi</label>
                    <input type="text" class="input-ctrl" value="${p.submittedName || "Ẩn danh"}" disabled style="opacity:0.6;">
                </div>
            </div>

            <div class="form-cols cover-col" style="flex: 1;">
                <div class="image-tabs">
                    <button type="button" class="img-tab-btn active" onclick="app.switchImgTab('cover', 'pending-')">Ảnh bìa</button>
                    <button type="button" class="img-tab-btn" onclick="app.switchImgTab('gift', 'pending-')">Quà tặng kèm</button>
                </div>

                <div id="pending-tab-cover" class="img-tab-content active">
                    <div class="form-group">
                        <div style="display:flex; gap:0.5rem; align-items:center;">
                            <input type="text" id="pending-coverUrl" class="input-ctrl"
                                placeholder="https://... hoặc tải File" value="${coverUrl}"
                                oninput="app.previewImage(window.app.value, 'cover', 'pending-')">
                            <input type="file" id="pending-coverFile" accept="image/*" style="display:none"
                                onchange="app.handleFileUpload(this, 'cover', 'pending-')">
                            <button type="button" class="btn btn-outline"
                                style="padding:0.6rem 1rem; flex-shrink:0;" title="Tải ảnh lên từ máy"
                                onclick="document.getElementById('pending-coverFile').click()">
                                <i data-feather="upload"></i>
                            </button>
                        </div>
                        <p class="help-text">Dán link hoặc tải file ảnh bìa.</p>
                    </div>
                    <div class="cover-preview-box" id="pending-cover-preview-box" style="position:relative;">
                        <i data-feather="image"></i>
                        <span>Xem trước ảnh bìa</span>
                    </div>
                </div>

                <div id="pending-tab-gift" class="img-tab-content hidden">
                    <div class="form-group">
                        <div style="display:flex; gap:0.5rem; align-items:center;">
                            <input type="text" id="pending-giftUrlInput" class="input-ctrl"
                                placeholder="https://... hoặc tải File">
                            <input type="file" id="pending-giftFiles" accept="image/*" multiple style="display:none"
                                onchange="app.handleGiftFileUpload(this, 'pending-')">
                            <button type="button" class="btn btn-outline"
                                style="padding:0.6rem 1rem; flex-shrink:0;" title="Tải ảnh lên từ máy"
                                onclick="document.getElementById('pending-giftFiles').click()">
                                <i data-feather="upload"></i>
                            </button>
                            <button type="button" class="btn btn-primary"
                                style="padding:0.6rem 1rem; flex-shrink:0;" title="Thêm ảnh này"
                                onclick="app.addGiftUrl('pending-')">
                                <i data-feather="plus"></i>
                            </button>
                        </div>
                        <p class="help-text">Dán link hoặc tải file, rồi nhấn + để thêm.</p>
                    </div>
                    <div class="cover-preview-box" id="pending-gift-preview-box" style="position:relative;">
                        <i data-feather="gift"></i>
                        <span>Xem trước quà tặng</span>
                    </div>
                    <div id="pending-gift-thumbnails"
                        style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-top:1rem;"></div>
                    <textarea id="pending-giftUrls" class="hidden">${p.giftUrls ? p.giftUrls.join("\n") : ""}</textarea>
                </div>

                <div style="background: var(--background); border:1px solid var(--border); border-radius:10px; padding:1rem;">
                    <p style="font-size:0.8rem; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted); margin-bottom:0.5rem;">Gộp ISBN vào sách có sẵn</p>
                    <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.75rem;">Nếu sách này đã có trong kho, chọn bên dưới để bổ sung ISBN thay vì tạo mới.</p>
                    <input list="all-books-datalist-${p.id}" id="merge-search-input" class="input-ctrl" placeholder="Tìm tên sách..." style="margin-bottom:0.5rem; font-size:0.85rem;">
                    <datalist id="all-books-datalist-${p.id}">${datalistOptions}</datalist>
                    <button class="btn btn-outline" onclick="app.adminMerge('${p.id}')" style="width:100%; justify-content:center; font-size:0.85rem;">
                        <i data-feather="git-merge"></i> Tiến hành Gộp
                    </button>
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

  window.app.previewImage(coverUrl, "cover", "pending-");
  if (p.giftUrls && p.giftUrls.length > 0) {
    window.app.renderGiftThumbnails("pending-");
    window.app.previewGiftImage(p.giftUrls[p.giftUrls.length - 1], "pending-");
  } else {
    window.app.previewGiftImage("", "pending-");
  }

  window.app
    .checkDuplicate(p)
    .then((duplicates) => {
      if (window.app._pendingActiveId !== p.id) return;
      if (duplicates && duplicates.length > 0) {
        const dupContainer = document.getElementById(
          `duplicate-container-${p.id}`,
        );
        if (dupContainer) {
          dupContainer.innerHTML = `<div class="duplicate-warning" style="margin-bottom:1.5rem; background: rgba(245, 158, 11, 0.1); border: 1px solid #f59e0b; padding: 1rem; border-radius: 10px;">
                    <strong style="color:#d97706; display:block; margin-bottom:0.5rem;">⚠️ Phát hiện ${duplicates.length} bản có thể trùng lặp:</strong>
                    <div style="display:flex; flex-direction:column; gap:0.5rem;">
                    ${duplicates
                      .map(
                        (d) => `
                        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; background:var(--surface); padding:8px 12px; border-radius:6px; border:1px solid var(--border);">
                            <span><strong>[${d.series}]</strong> ${d.title} - Tập ${d.volume}</span>
                            <button class="btn btn-outline" style="padding:4px 10px; font-size:0.75rem; min-height:auto;" onclick="app.quickMerge('${p.id}', '${d.id}')">
                                <i data-feather="git-merge" style="width:12px; height:12px;"></i> Gộp nhanh
                            </button>
                        </div>
                    `,
                      )
                      .join("")}
                    </div>
                </div>`;
          if (window.feather) {
            try {
              feather.replace();
            } catch (e) {
              console.warn("Feather error:", e);
            }
          }
        }
      }
    })
    .catch((e) => console.warn("Lỗi check trùng lặp:", e));
}

export function _runAdminApprove() {
  const id = window.app._pendingActiveId;
  if (id) window.app.adminApprove(id);
}

export function _runAdminReject() {
  const id = window.app._pendingActiveId;
  if (id) window.app.adminReject(id);
}

export function closePendingModal() {
  const modal = document.getElementById("pending-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("show");
  }
  window.app._pendingActiveId = null;
}

export function _removePendingFromUI(id) {
  if (!store.adminCache) return;
  store.adminCache = store.adminCache.filter((x) => x.id !== id);
  window.app.renderPendingList(store.adminCache);
  const badge = document.getElementById("nav-admin-badge");
  if (badge) {
    badge.textContent = store.adminCache.length;
    badge.style.display = store.adminCache.length > 0 ? "inline-block" : "none";
  }
}

export async function _updatePendingDataBeforeAction(id) {
  const giftStr = document.getElementById("pending-giftUrls")?.value || "";
  const giftUrls = giftStr
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s !== "");

  const payload = {
    series: document.getElementById(`edit-series-${id}`).value,
    title: document.getElementById(`edit-title-${id}`).value,
    volume: parseFloat(document.getElementById(`edit-volume-${id}`).value) || 0,
    isbn: document.getElementById(`edit-isbn-${id}`).value,
    author: document.getElementById(`edit-author-${id}`).value,
    translator: document.getElementById(`edit-translator-${id}`).value,
    publisher: document.getElementById(`edit-publisher-${id}`).value,
    distributor: document.getElementById(`edit-distributor-${id}`).value,
    publish_date:
      document.getElementById(`edit-publishDate-${id}`).value || null,
    pages: parseInt(document.getElementById(`edit-pages-${id}`).value) || 0,
    size: document.getElementById(`edit-size-${id}`).value,
    price: parseInt(document.getElementById(`edit-price-${id}`).value) || 0,
    cover_url: document.getElementById(`pending-coverUrl`).value,
    note: document.getElementById(`edit-note-${id}`).value,
    gift_urls: JSON.stringify(giftUrls),
  };
  const res = await window.app.apiFetch(`/api/admin/pending/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (res.error) throw res.error;
  return payload;
}

export async function adminApprove(id) {
  if (!(await window.app.customConfirm("Duyệt và thêm sách này vào kho chung?"))) return;
  window.app.showLoading("Đang xử lý...");
  try {
    const payload = await window.app._updatePendingDataBeforeAction(id);
    const res = await window.app.apiFetch(`/api/admin/pending/${id}/approve`, {
      method: "POST",
    });
    if (res.error) throw res.error;

    window.app.showToast("Đã duyệt và thêm vào kho!");
    window.app.closePendingModal();
    window.app._removePendingFromUI(id);
    store.fullCatalogCache = null;
  } catch (e) {
    console.error(e);
    window.app.showToast("Lỗi khi duyệt sách!", "error");
  } finally {
    window.app.hideLoading();
  }
}

export async function adminReject(id) {
  if (!(await window.app.customConfirm("Từ chối và xóa bản ghi này?"))) return;
  window.app._rememberPendingRejectedId(id);
  window.app.closePendingModal();
  window.app._removePendingFromUI(id);
  window.app.queueTask("ADMIN_REJECT_PENDING", { id, reason: null }, null, {
    message: "Đã từ chối trên giao diện. Đang đồng bộ ngầm...",
    nonBlocking: false,
  });
}

export async function quickMerge(pendingId, catalogId) {
  if (!(await window.app.customConfirm("Gộp ISBN vào bản ghi có sẵn này?"))) return;
  window.app.showLoading("Đang gộp...");
  try {
    const res = await window.app.apiFetch("/api/admin/pending/merge", {
      method: "POST",
      body: JSON.stringify({ pending_id: pendingId, catalog_id: catalogId }),
    });
    if (res.error) throw res.error;

    window.app.showToast("Đã gộp ISBN thành công!");
    window.app.closePendingModal();
    window.app._removePendingFromUI(pendingId);
  } catch (e) {
    console.error(e);
    window.app.showToast("Lỗi khi gộp!", "error");
  } finally {
    window.app.hideLoading();
  }
}

export async function adminMerge(pendingId) {
  const inputVal = document.getElementById("merge-search-input").value;
  if (!inputVal) {
    window.app.showToast(
      "Vui lòng chọn hoặc nhập ID của sách để gộp!",
      "error",
    );
    return;
  }
  window.app.quickMerge(pendingId, inputVal);
}
