import { store } from '../store.js';
import { supabase } from '../supabase-client.js';

export async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin,
        }
    });
    if (error) window.app.showToast('Lỗi đăng nhập: ' + error.message, 'error');
}

export async function logout() {
    await supabase.auth.signOut();
}

export function updateAuthUI() {
    const btnSignIn = document.getElementById('google-btn-wrapper');
    const userInfo = document.getElementById('user-info');
    const authElements = document.querySelectorAll('.auth-only');

    if (store.user) {
        if (btnSignIn) btnSignIn.style.display = 'none';
        if (userInfo) {
            userInfo.classList.remove('hidden');
            const meta = store.user.user_metadata || {};
            const avatar = meta.avatar_url || meta.picture || '';
            const avatarEl = document.getElementById('user-avatar');
            const avatarMenu = document.getElementById('user-avatar-menu');
            if (avatarEl) avatarEl.src = avatar;
            if (avatarMenu) avatarMenu.src = avatar;
            const nameEl = document.getElementById('user-name');
            const emailEl = document.getElementById('user-email');
            if (nameEl) nameEl.textContent = meta.full_name || meta.name || store.user.email || 'User';
            if (emailEl) emailEl.textContent = store.user.email || '';
        }
        if (window.feather) { try { feather.replace(); } catch (e) { console.warn('Feather error:', e); } }
        authElements.forEach(el => el.classList.remove('hidden'));

        // Xử lý nút Admin
        const adminBtn = document.getElementById('admin-panel-btn');
        if (adminBtn) {
            if (store.isAdmin) {
                adminBtn.style.display = 'flex';
                if (window.app && window.app.fetchPendingBooks) window.app.fetchPendingBooks(); // Update badge
            } else {
                adminBtn.style.display = 'none';
            }
        }
    } else {
        if (btnSignIn) btnSignIn.style.display = 'block';
        if (userInfo) userInfo.classList.add('hidden');
        authElements.forEach(el => el.classList.add('hidden'));
        if (window.app && window.app.navigateTo) window.app.navigateTo('/');
    }
}
