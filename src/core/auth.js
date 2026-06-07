import { store } from "../store.js";
import { apiFetch } from "../utils/api-client.js";

let tokenClient;

export function initGoogleAuth() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    console.warn("VITE_GOOGLE_CLIENT_ID is not set in .env");
    return;
  }

  if (!window.google) {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setupTokenClient(clientId);
    document.head.appendChild(script);
  } else {
    setupTokenClient(clientId);
  }
}

function setupTokenClient(clientId) {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: "email profile openid",
    callback: async (tokenResponse) => {
      if (tokenResponse && tokenResponse.access_token) {
        try {
          const API_URL =
            import.meta.env.VITE_API_URL || "http://localhost:8787";
          const res = await fetch(`${API_URL}/api/auth/google`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ access_token: tokenResponse.access_token }),
          });
          if (!res.ok) throw new Error("Backend authentication failed");

          const data = await res.json();
          localStorage.setItem("authToken", data.token);
          window.location.reload();
        } catch (e) {
          console.error(e);
          await window.app.customAlert("Lỗi đăng nhập: " + e.message);
        }
      }
    },
  });
}

export async function signInWithGoogle() {
  if (import.meta.env.DEV && !import.meta.env.VITE_GOOGLE_CLIENT_ID) {
    // Mock Login for local development if no client id
    const mockUser = {
      id: "test-user-123",
      email: "test@example.com",
      name: "Dev User",
    };
    localStorage.setItem("mockUser", JSON.stringify(mockUser));
    window.location.reload();
    return;
  }

  if (tokenClient) {
    tokenClient.requestAccessToken();
  } else {
    await window.app.customAlert(
      "Google Auth chưa sẵn sàng hoặc thiếu cấu hình VITE_GOOGLE_CLIENT_ID.",
    );
  }
}

export async function logout() {
  if (import.meta.env.DEV && !import.meta.env.VITE_GOOGLE_CLIENT_ID) {
    localStorage.removeItem("mockUser");
  }
  localStorage.removeItem("authToken");
  window.location.reload();
}

export function updateAuthUI() {
  const btnSignIn = document.getElementById("google-btn-wrapper");
  const userInfo = document.getElementById("user-info");
  const authElements = document.querySelectorAll(".auth-only");

  if (store.user) {
    if (btnSignIn) btnSignIn.style.display = "none";
    if (userInfo) {
      userInfo.classList.remove("hidden");
      const meta = store.user.user_metadata || {};
      const avatar = meta.avatar_url || meta.picture || "";
      const avatarEl = document.getElementById("user-avatar");
      const avatarMenu = document.getElementById("user-avatar-menu");
      if (avatarEl) avatarEl.src = avatar;
      if (avatarMenu) avatarMenu.src = avatar;
      const nameEl = document.getElementById("user-name");
      const emailEl = document.getElementById("user-email");
      if (nameEl)
        nameEl.textContent =
          meta.full_name || meta.name || store.user.email || "User";
      if (emailEl) emailEl.textContent = store.user.email || "";
    }
    if (window.feather) {
      try {
        feather.replace();
      } catch (e) {
        console.warn("Feather error:", e);
      }
    }
    authElements.forEach((el) => el.classList.remove("hidden"));
    
    if (window.app && window.app.updateNavTabs) {
        window.app.updateNavTabs(window.location.pathname);
    }

    // Xử lý nút Admin
    const adminBtn = document.getElementById("admin-panel-btn");
    if (adminBtn) {
      if (store.isAdmin) {
        adminBtn.style.display = "flex";
        if (window.app && window.app.fetchPendingBooks)
          window.app.fetchPendingBooks(); // Update badge
      } else {
        adminBtn.style.display = "none";
      }
    }
  } else {
    if (btnSignIn) btnSignIn.style.display = "block";
    if (userInfo) userInfo.classList.add("hidden");
    authElements.forEach((el) => el.classList.add("hidden"));
    // Đăng xuất → về trang giới thiệu
    if (window.app && window.app.navigateTo) window.app.navigateTo("/about");
  }
}
