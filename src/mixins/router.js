import { supabase } from '../supabase-client.js';

export function applyRouterMixin(app) {
    Object.assign(app, {
        

    // ─── NAVIGATION ───────────────────────────────────────────────────────────
    cancelForm() {
        const editId = document.getElementById('edit-id').value;
        if (editId) {
            // Dang sua sach → ve trang series
            const manga = this.data.find(m => m.id === editId);
            if (manga && manga.series) {
                this.openSeriesDetail(manga.series);
                return;
            }
            this.navigateTo('/');
        } else {
            // Dang them moi → ve trang chon phuong thuc
            this.navigateTo('/add');
        }
    },

    // ─── ROUTER (HISTORY API) ─────────────────────────────────────────────────
    setupRouter() {
        window.addEventListener('popstate', () => this.router());
        // Trigger routing immediately on load
        this.router();
    },

    navigateTo(path, replace = false) {
        if (replace) {
            window.history.replaceState({}, "", path);
        } else {
            if (window.location.pathname !== path) {
                window.history.pushState({}, "", path);
            }
        }
        this.router();
    },
        

    router() {
        const path = window.location.pathname;

        // Chặn truy cập nếu chưa đăng nhập (ngoại trừ trang chủ)
        if (!this.user && path !== '/' && path !== '/index.html') {
            this.showToast('Vui lòng đăng nhập để sử dụng tính năng này!', 'error');
            this.navigateTo('/', true);
            return;
        }

        if (path === '/' || path === '/index.html') {
            this.showView('dashboard');
        } else if (path === '/add') {
            this.showView('add-method');
        } else if (path === '/form') {
            this.showView('form');
        } else if (path === '/search') {
            this.showView('search');
        } else if (path.startsWith('/admin')) {
            if (!this.isAdmin) {
                this.showToast('Bạn không có quyền truy cập khu vực này!', 'error');
                this.navigateTo('/', true);
                return;
            }
            if (path === '/admin' || path === '/admin/pending') {
                this.showView('admin');
                this.switchAdminTab('pending');
            } else if (path === '/admin/catalog') {
                this.showView('admin');
                this.switchAdminTab('catalog');
            } else if (path === '/admin/feedback') {
                this.showView('admin');
                this.switchAdminTab('feedback');
            } else if (path.startsWith('/admin/series/')) {
                const parts = path.split('/admin/series/');
                if (parts.length > 1) {
                    const seriesName = decodeURIComponent(parts[1]);
                    this.showView('admin');
                    this.switchAdminTab('catalog');
                    this.renderAdminSeriesDetail(seriesName);
                } else {
                    this.navigateTo('/', true);
                }
            } else {
                this.navigateTo('/', true);
            }
        } else if (path.startsWith('/series/')) {
            const parts = path.split('/series/');
            if (parts.length > 1) {
                const seriesName = decodeURIComponent(parts[1]);
                this.renderSeriesDetail(seriesName);
            } else {
                this.navigateTo('/', true);
            }
        } else {
            this.navigateTo('/', true);
        }
    }
    });
}
