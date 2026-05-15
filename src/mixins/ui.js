import { store } from '../store.js';
import { supabase } from '../supabase-client.js';
import { escapeHTML } from '../utils/security.js';


        

    // ─── KHỞI ĐỘNG ────────────────────────────────────────────────────────────
    export async function init() {
        window.app.loadTheme();
        window.app.applySettings();

        // Khôi phục session từ localStorage ngay khi khởi động (tránh phải đăng nhập lại sau F5)
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession?.user) {
            store.user = existingSession.user;
            try {
                const { data } = await supabase.rpc('is_admin');
                store.isAdmin = !!data;
            } catch (e) { store.isAdmin = false; }
            window.app.updateAuthUI();
            await window.app.loadData();
        }

        // Lắng nghe thay đổi auth (đăng nhập mới, đăng xuất, refresh token)
        supabase.auth.onAuthStateChange(async (event, session) => {
            const newUser = session?.user || null;
            // Bỏ qua INITIAL_SESSION nếu đã xử lý ở trên
            if (event === 'INITIAL_SESSION') return;
            store.user = newUser;
            if (store.user) {
                try {
                    const { data } = await supabase.rpc('is_admin');
                    store.isAdmin = !!data;
                } catch (e) { store.isAdmin = false; }
                window.app.updateAuthUI();
                await window.app.loadData();
                window.app.router();
            } else {
                store.isAdmin = false;
                window.app.updateAuthUI();
                store.data = [];
                window.app.navigateTo('/about', true);
            }
        });

        // ─── PAGE VISIBILITY API ─────
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                // Tab visible: chạy queue ngay + khởi động lại interval
                window.app.processSyncQueue();
                window.app._startSyncInterval();

                // Nếu đang ở tab Admin Kho chung và cache bị xóa do chuyển tab → tự fetch lại
                if (store.currentView === 'admin' && !store.fullCatalogCache) {
                    setTimeout(() => window.app.searchAdminCatalog(1), 300);
                }
            } else {
                // Tab hidden: dừng interval để không tốn CPU/pin (đặc biệt trên mobile/Safari)
                window.app._stopSyncInterval();
            }
        });

        // Tự động chạy queue khi có mạng lại hoặc window focus
        window.addEventListener('online', () => window.app.processSyncQueue());
        window.addEventListener('focus', () => window.app.processSyncQueue());

        // Hàm khởi động interval (10s) — chỉ chạy khi tab visible
        window.app._startSyncInterval = () => {
            if (window.app._syncIntervalId) return; // Tránh tạo nhiều interval
            window.app._syncIntervalId = setInterval(() => window.app.processSyncQueue(), 10000);
        };

        // Hàm dừng interval khi tab ẩn
        window.app._stopSyncInterval = () => {
            if (window.app._syncIntervalId) {
                clearInterval(window.app._syncIntervalId);
                window.app._syncIntervalId = null;
            }
        };

        // Khởi động interval ngay khi init (tab đang visible)
        if (!document.hidden) {
            window.app._startSyncInterval();
        }

        // Đánh dấu đây là lần sync đầu sau khi tải trang
        // → dùng để suppress toast "Đồng bộ hoàn tất" khi F5 (sách đã hiển thị qua queue-aware merge)
        window.app._isPageLoad = true;

        // Chạy thử queue lúc mới init
        setTimeout(() => window.app.processSyncQueue(), 2000);

        // Apply saved settings
        const savedCols = store.settings.gridCols || '6';
        const grid = document.getElementById('series-grid');
        if (grid && window.app.viewMode === 'grid') {
            grid.style.gridTemplateColumns = `repeat(${savedCols}, 1fr)`;
        }
        const savedFontSize = store.settings.fontSize || 'normal';
        window.app.applyFontSize(savedFontSize);
        const savedSort = localStorage.getItem('defaultSort');
        if (savedSort) {
            const sortEl = document.getElementById('sort-order');
            if (sortEl) {
                sortEl.value = savedSort;
                const labelEl = document.getElementById('sort-order-label');
                if (labelEl) {
                    labelEl.textContent = savedSort === 'za' ? 'Z → A' : 'A → Z';
                }
            }
        }

        document.addEventListener('click', (e) => {
            const wrapper = document.getElementById('user-info');
            const menu = document.getElementById('user-menu');
            if (wrapper && menu && !wrapper.contains(e.target)) {
                menu.classList.add('hidden');
            }
            // Close custom dropdowns
            document.querySelectorAll('.custom-select-container').forEach(container => {
                if (!container.contains(e.target)) {
                    const dropdown = container.querySelector('.user-dropdown');
                    if (dropdown) dropdown.classList.add('hidden');
                }
            });
        });

        window.app.updateSeriesSuggestions();
        window.app.setupPriceInput();
        window.app.setupRouter();
        window.app.setupSearch();

        if (window.flatpickr) {
            flatpickr("#publishDate", {
                dateFormat: "Y-m-d",
                altInput: true,
                altFormat: "d/m/Y",
                allowInput: true,
                parseDate: (datestr, format) => {
                    const fp = window.flatpickr;
                    if (datestr.includes('/')) {
                        const parts = datestr.split('/');
                        if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
                    } else if (datestr.includes('-')) {
                        const parts = datestr.split('-');
                        if (parts.length === 3) {
                            if (parts[0].length === 4) return new Date(datestr);
                            return new Date(parts[2], parts[1] - 1, parts[0]);
                        }
                    }
                    return fp.parseDate(datestr, format);
                }
            });
        }
    } // ─── LOADING UI ───────────────────────────────────────────────────────────
    export function showLoading(msg = 'Đang xử lý...') {
        let el = document.getElementById('loading-overlay');
        if (!el) {
            el = document.createElement('div');
            el.id = 'loading-overlay';
            el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;z-index:9999;';
            el.innerHTML = `<div style="background:var(--card-bg,#fff);border-radius:12px;padding:1.5rem 2.5rem;display:flex;align-items:center;gap:1rem;box-shadow:0 8px 30px rgba(0,0,0,0.2);font-weight:600;color:var(--card-text);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 1s linear infinite"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                <span>${escapeHTML(msg)}</span>
            </div>`;
            document.body.appendChild(el);
            const style = document.createElement('style');
            style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
            document.head.appendChild(style);
        }
        el.querySelector('span').textContent = msg;
        el.style.display = 'flex';
    }    export function hideLoading() {
        const el = document.getElementById('loading-overlay');
        if (el) el.style.display = 'none';
    } // ─── THEME ────────────────────────────────────────────────────────────────
    export function loadTheme() {
        const theme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', theme);
        window.app.updateThemeIcon(theme);
    }    export function toggleTheme() {
        let theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        window.app.updateThemeIcon(theme);
    }    export function updateThemeIcon(theme) {
        // Sync dropdown toggle (toggle = current state ON/OFF)
        const toggleDot = document.getElementById('theme-toggle-dot');
        // Label shows what you'll switch TO (reversed)
        const themeLabel = document.getElementById('theme-label-menu');
        const themeIcon = document.getElementById('theme-icon-menu');
        const themeSwitchSettings = document.getElementById('dark-mode-switch');

        if (toggleDot) toggleDot.classList.toggle('on', theme === 'dark');
        if (themeLabel) {
            // Dark is active → label says "Giao diện Sáng" (click to go light)
            // Light is active → label says "Giao diện Tối" (click to go dark)
            themeLabel.textContent = theme === 'dark' ? 'Giao diện Sáng' : 'Giao diện Tối';
        }
        if (themeIcon) {
            // Show icon of what you'll switch TO
            themeIcon.setAttribute('data-feather', theme === 'dark' ? 'sun' : 'moon');
        }
        if (themeSwitchSettings) themeSwitchSettings.classList.toggle('active', theme === 'dark');
        if (window.feather) { try { feather.replace(); } catch (e) { console.warn('Feather error:', e); } }
    }
    