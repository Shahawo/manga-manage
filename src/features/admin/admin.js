import { store } from "../../store.js";
import { escapeHTML } from "../../utils/security.js";

export function loadAdminPanel() {
  if (!store.user || !store.isAdmin) {
    window.app.showToast("Bạn không có quyền truy cập", "error");
    return;
  }
  window.app.navigateTo("/admin/pending");
}

export function switchAdminTab(tabId) {
  const adminTabs = document.querySelector(".admin-tabs");
  if (adminTabs) adminTabs.style.display = "flex";

  document.querySelectorAll(".admin-tab-btn").forEach((btn) => {
    btn.classList.toggle(
      "active",
      btn.getAttribute("onclick")?.includes(tabId),
    );
  });

  document.querySelectorAll(".admin-tab-content").forEach((container) => {
    if (container.id === `admin-${tabId}-container`) {
      container.classList.remove("hidden");
      container.classList.add("active");
    } else {
      container.classList.add("hidden");
      container.classList.remove("active");
    }
  });

  if (tabId === "pending") {
    if (window.app.fetchPendingBooks) window.app.fetchPendingBooks();
  } else if (tabId === "catalog") {
    if (window.app.searchAdminCatalog) window.app.searchAdminCatalog();
  } else if (tabId === "feedback") {
    if (window.app.fetchAdminFeedback) window.app.fetchAdminFeedback();
  } else if (tabId === "schedule") {
    if (window.app.adminScheduleLoad) window.app.adminScheduleLoad();
  }
}

export function showFeedbackModal() {
  const modal = document.getElementById("feedback-modal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("show");
  }
}

export function closeFeedbackModal() {
  const modal = document.getElementById("feedback-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("show");
  }
  const txt = document.getElementById("feedback-text");
  if (txt) txt.value = "";
}

export function submitFeedback() {
  const txt = document.getElementById("feedback-text");
  const content = txt ? txt.value.trim() : "";
  if (!content) {
    window.app.showToast("Vui lòng nhập nội dung góp ý!", "error");
    return;
  }

  const payload = {
    user_name:
      store.user?.user_metadata?.name || store.user?.email || "Ẩn danh",
    user_email: store.user?.email || "guest@anonymous.com",
    content: content,
    status: "new",
  };

  window.app.queueTask("SUBMIT_FEEDBACK", payload, null, {
    message: "Cảm ơn góp ý của bạn! Đang gửi lên hệ thống...",
    nonBlocking: true,
    silent: true,
  });

  window.app.closeFeedbackModal();
  window.app.showToast("Đã gửi góp ý thành công!");
}

export async function fetchAdminFeedback() {
  try {
    const res = await window.app.withTimeout(
      () => window.app.apiFetch("/api/admin/feedback"),
      5000,
      "Quá hạn tải feedback",
    );
    const data = res.data;
    const error = res.error;
    if (error) throw error;
    const list = (data || []).map((fb) => ({
      ...fb,
      userName: fb.user_name,
      userEmail: fb.user_email,
      createdAt: fb.created_at,
    }));
    window.app.renderFeedbackList(list);
  } catch (e) {
    console.error("Lỗi tải danh sách Góp ý:", e);
  }
}

export function renderFeedbackList(list) {
  const container = document.getElementById("admin-feedback-list");
  if (!container) return;
  if (!list || list.length === 0) {
    container.innerHTML =
      '<p style="text-align:center; padding:2rem; color:var(--text-muted);">Chưa có góp ý nào từ người dùng.</p>';
    return;
  }

  container.innerHTML = list
    .map((fb) => {
      const safeName = escapeHTML(fb.userName || "Ẩn danh");
      const safeEmail = escapeHTML(fb.userEmail || "");
      const safeContent = escapeHTML(fb.content || "").replace(/\n/g, "<br>");
      const initials =
        safeName !== "Ẩn danh"
          ? safeName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .substring(0, 2)
          : "?";
      return `
            <div class="feedback-card">
                <div class="fb-header">
                    <div class="fb-user-info">
                        <div class="fb-avatar">${initials}</div>
                        <div class="fb-meta">
                            <div class="fb-name">${safeName}</div>
                            <div class="fb-email">${safeEmail}</div>
                        </div>
                    </div>
                    <div class="fb-actions">
                        <div class="fb-delete-btn" onclick="app.deleteFeedback('${fb.id}')" title="Xóa góp ý">
                            <i data-feather="trash-2" style="width:18px; height:18px;"></i>
                        </div>
                    </div>
                </div>
                <div class="fb-content-bubble">
                    ${safeContent}
                </div>
                <div class="fb-footer">
                    <span>Trạng thái: <strong>${fb.status === "new" ? "Mới" : "Đã xem"}</strong></span>
                    <div class="fb-date">${new Date(fb.createdAt).toLocaleString("vi-VN")}</div>
                </div>
            </div>
        `;
    })
    .join("");
  if (window.feather) {
    try {
      feather.replace();
    } catch (e) {
      console.warn("Feather error:", e);
    }
  }
}

export async function deleteFeedback(id) {
  if (!(await window.app.customConfirm("Xóa góp ý này?"))) return;
  try {
    const res = await window.app.withTimeout(
      () =>
        window.app.apiFetch(`/api/admin/feedback/${id}`, { method: "DELETE" }),
      5000,
      "Yêu cầu xoá quá hạn",
    );
    const error = res.error;
    if (!error) {
      window.app.fetchAdminFeedback();
    } else {
      throw error;
    }
  } catch (e) {
    console.error("Lỗi khi xóa góp ý:", e);
    window.app.showToast("Lỗi khi xóa!", "error");
  }
}

export async function runStorageCleanup() {
  if (
    !(await window.app.customConfirm(
      "Bạn có chắc chắn muốn dọn rác R2 không? Thao tác này sẽ quét toàn bộ ảnh trên R2 và xóa vĩnh viễn các ảnh không còn được sử dụng trong CSDL (chỉ xóa ảnh đã tải lên quá 1 giờ để tránh lỗi).",
    ))
  )
    return;

  try {
    window.app.showLoading("Đang quét và dọn rác R2...");
    const res = await window.app.withTimeout(
      () =>
        window.app.apiFetch(`/api/admin/storage/cleanup`, { method: "POST" }),
      120000,
      "Quá trình dọn rác mất quá nhiều thời gian",
    );
    const error = res.error;
    if (!error) {
      const data = res.data || {};
      const msg = `Hoàn tất! Đã quét ${data.total_objects} file. Đã xóa vĩnh viễn ${data.deleted_count} file rác.`;
      window.app.showToast(msg);
      if (data.deleted_count > 0) {
        console.debug("[Storage GC] Đã xóa:", data.deleted_keys);
      }
    } else {
      throw error;
    }
  } catch (e) {
    console.error("Lỗi khi dọn rác R2:", e);
    window.app.showToast("Lỗi khi dọn rác R2: " + (e.message || ""), "error");
  } finally {
    window.app.hideLoading();
  }
}
