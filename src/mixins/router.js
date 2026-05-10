import { store } from '../store.js';

export function cancelForm() {
    const editId = document.getElementById('edit-id').value;
    if (editId) {
        const manga = store.data.find(m => m.id === editId);
        if (manga && manga.series) {
            window.app.openSeriesDetail(manga.series); // Fallback until core.js is refactored
            return;
        }
        navigateTo('/');
    } else {
        navigateTo('/add');
    }
}

export function setupRouter() {
    window.addEventListener('popstate', () => router());
    router();
}

export function navigateTo(path, replace = false) {
    if (replace) {
        window.history.replaceState({}, "", path);
    } else {
        if (window.location.pathname !== path) {
            window.history.pushState({}, "", path);
        }
    }
    router();
}

export function router() {
    const path = window.location.pathname;
    const app = window.app; // fallback

    if (!store.user && path !== '/' && path !== '/index.html') {
        app.showToast('Vui lòng đăng nhập để sử dụng tính năng này!', 'error');
        navigateTo('/', true);
        return;
    }

    if (path === '/' || path === '/index.html') {
        app.showView('dashboard');
    } else if (path === '/add') {
        app.showView('add-method');
    } else if (path === '/form') {
        app.showView('form');
    } else if (path === '/search') {
        app.showView('search');
    } else if (path.startsWith('/admin')) {
        if (!store.isAdmin) {
            app.showToast('Bạn không có quyền truy cập khu vực này!', 'error');
            navigateTo('/', true);
            return;
        }
        if (path === '/admin' || path === '/admin/pending') {
            app.showView('admin');
            app.switchAdminTab('pending');
        } else if (path === '/admin/catalog') {
            app.showView('admin');
            app.switchAdminTab('catalog');
        } else if (path === '/admin/feedback') {
            app.showView('admin');
            app.switchAdminTab('feedback');
        } else if (path.startsWith('/admin/series/')) {
            const parts = path.split('/admin/series/');
            if (parts.length > 1) {
                const seriesName = decodeURIComponent(parts[1]);
                app.showView('admin');
                app.switchAdminTab('catalog');
                app.renderAdminSeriesDetail(seriesName);
            } else {
                navigateTo('/', true);
            }
        } else {
            navigateTo('/', true);
        }
    } else if (path.startsWith('/series/')) {
        const parts = path.split('/series/');
        if (parts.length > 1) {
            const seriesName = decodeURIComponent(parts[1]);
            app.renderSeriesDetail(seriesName);
        } else {
            navigateTo('/', true);
        }
    } else {
        navigateTo('/', true);
    }
}
