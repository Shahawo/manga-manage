import { supabase } from '../supabase-client.js';

export function applyAuthMixin(app) {
    Object.assign(app, {
        
    user: null,
        

    async signInWithGoogle() {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            }
        });
        if (error) this.showToast('Lỗi đăng nhập: ' + error.message, 'error');
    },
        

    async logout() {
        await supabase.auth.signOut();
    },
        

    updateAuthUI() {
        const btnSignIn = document.getElementById('google-btn-wrapper');
        const userInfo = document.getElementById('user-info');
        const authElements = document.querySelectorAll('.auth-only');

        if (this.user) {
            if (btnSignIn) btnSignIn.style.display = 'none';
            if (userInfo) {
                userInfo.classList.remove('hidden');
                const meta = this.user.user_metadata || {};
                const avatar = meta.avatar_url || meta.picture || '';
                const avatarEl = document.getElementById('user-avatar');
                const avatarMenu = document.getElementById('user-avatar-menu');
                if (avatarEl) avatarEl.src = avatar;
                if (avatarMenu) avatarMenu.src = avatar;
                const nameEl = document.getElementById('user-name');
                const emailEl = document.getElementById('user-email');
                if (nameEl) nameEl.textContent = meta.full_name || meta.name || this.user.email || 'User';
                if (emailEl) emailEl.textContent = this.user.email || '';
            }
            if (window.feather) { try { feather.replace(); } catch (e) { console.warn('Feather error:', e); } }
            authElements.forEach(el => el.classList.remove('hidden'));

            // Xử lý nút Admin
            const adminBtn = document.getElementById('admin-panel-btn');
            if (adminBtn) {
                if (this.isAdmin) {
                    adminBtn.style.display = 'flex';
                    this.fetchPendingBooks(); // Update badge
                } else {
                    adminBtn.style.display = 'none';
                }
            }
        } else {
            if (btnSignIn) btnSignIn.style.display = 'block';
            if (userInfo) userInfo.classList.add('hidden');
            authElements.forEach(el => el.classList.add('hidden'));
            this.navigateTo('/');
        }
    }
    });
}
