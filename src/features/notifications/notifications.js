import { store } from "../../store.js";
import { queueTask } from "../../core/api.js";

function _esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function toggleNotifications() {
  const dropdown = document.getElementById("notifications-dropdown");
  if (!dropdown) return;
  
  const isHidden = dropdown.classList.contains("hidden");
  
  // Đóng các dropdown khác nếu có (ví dụ user menu)
  const userMenu = document.getElementById("user-menu");
  if (userMenu && !userMenu.classList.contains("hidden")) {
    userMenu.classList.add("hidden");
  }

  if (isHidden) {
    dropdown.classList.remove("hidden");
    renderNotifications();
  } else {
    dropdown.classList.add("hidden");
  }
}

// Đóng khi click ngoài
document.addEventListener("click", (e) => {
  const dropdown = document.getElementById("notifications-dropdown");
  const wrapper = document.getElementById("nav-notifications-wrapper");
  if (!dropdown || !wrapper) return;
  
  if (!dropdown.classList.contains("hidden") && !wrapper.contains(e.target)) {
    dropdown.classList.add("hidden");
  }
});

export function renderNotifications() {
  const listEl = document.getElementById("notifications-list");
  if (!listEl) return;

  const notifications = store.notifications || [];
  
  if (notifications.length === 0) {
    listEl.innerHTML = `<div style="padding: 2rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">Bạn không có thông báo nào.</div>`;
    return;
  }

  listEl.innerHTML = notifications.map(n => {
    const isReadClass = n.is_read ? 'read' : 'unread';
    const dotHtml = n.is_read ? '' : `<div class="notif-dot"></div>`;
    const coverUrl = n.cover_url || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    
    return `
      <div class="notif-item ${isReadClass}" onclick="app.markNotificationRead('${n.schedule_id}', '${n.event_type}', this)">
        <img src="${_esc(coverUrl)}" alt="Cover" />
        <div class="notif-content">
          <p>${n.message}</p>
        </div>
        ${dotHtml}
      </div>
    `;
  }).join('');
}

export function updateNotificationBadge() {
  const badge = document.getElementById("notification-badge");
  if (!badge) return;
  
  const count = store.unreadCount || 0;
  if (count > 0) {
    badge.textContent = count > 9 ? "9+" : count;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

export function markNotificationRead(schedule_id, event_type, el) {
  const notif = store.notifications.find(n => n.schedule_id === schedule_id && n.event_type === event_type);
  if (!notif || notif.is_read) return; // Nếu đã đọc thì bỏ qua

  // Update store
  notif.is_read = 1;
  store.unreadCount = Math.max(0, store.unreadCount - 1);
  updateNotificationBadge();

  // Update DOM immediately
  if (el) {
    el.classList.remove("unread");
    el.classList.add("read");
    const dot = el.querySelector(".notif-dot");
    if (dot) dot.remove();
  }

  // Gửi vào hàng đợi đồng bộ ngầm
  queueTask("MARK_NOTIFICATION_READ", { schedule_id, event_type }, null, { silent: true });
}
