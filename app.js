import { supabase } from './supabase-client.js';

const app = {
    data: [],
    currentSeries: null,
    user: null,
    viewMode: localStorage.getItem('viewMode') || 'grid',

    

    async signInWithGoogle() {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            }
        });
        if (error) alert('Lỗi đăng nhập: ' + error.message);
    },

    async logout() {
        await supabase.auth.signOut();
    },

    updateAuthUI() {
        const btnSignIn = document.getElementById('google-btn-wrapper');
        const userInfo = document.getElementById('user-info');
        const authElements = document.querySelectorAll('.auth-only');
        
        if (this.user) {
            if(btnSignIn) btnSignIn.style.display = 'none';
            if (userInfo) {
                userInfo.classList.remove('hidden');
                const meta = this.user.user_metadata || {};
                const avatar = meta.avatar_url || meta.picture || '';
                const avatarEl = document.getElementById('user-avatar');
                const avatarMenu = document.getElementById('user-avatar-menu');
                if(avatarEl) avatarEl.src = avatar;
                if(avatarMenu) avatarMenu.src = avatar;
                const nameEl = document.getElementById('user-name');
                const emailEl = document.getElementById('user-email');
                if(nameEl) nameEl.textContent = meta.full_name || meta.name || this.user.email || 'User';
                if(emailEl) emailEl.textContent = this.user.email || '';
            }
            if (window.feather) { try { feather.replace(); } catch(e) { console.warn('Feather error:', e); } }
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
            if(btnSignIn) btnSignIn.style.display = 'block';
            if(userInfo) userInfo.classList.add('hidden');
            authElements.forEach(el => el.classList.add('hidden'));
            this.showView('dashboard');
        }
    },

    // ─── CÀI ĐẶT (SETTINGS) ──────────────────────────────────────────────────
    settings: {
        gridCols: localStorage.getItem('setting_gridCols') || '6',
        fontSize: localStorage.getItem('setting_fontSize') || 'normal'
    },

    setSetting(key, value) {
        this.settings[key] = value;
        localStorage.setItem(`setting_${key}`, value);
        this.applySettings();
    },

    applySettings() {
        // Cột Grid
        document.documentElement.style.setProperty('--grid-cols', this.settings.gridCols);
        document.querySelectorAll('.settings-chip[id^="chip-"]').forEach(el => {
            if(!el.id.includes('fs')) el.classList.remove('active');
        });
        const chipGrid = document.getElementById(`chip-${this.settings.gridCols}`);
        if(chipGrid) chipGrid.classList.add('active');

        // Cỡ chữ
        let fsValue = '1rem';
        if(this.settings.fontSize === 'small') fsValue = '14px';
        if(this.settings.fontSize === 'large') fsValue = '18px';
        if(this.settings.fontSize === 'xlarge') fsValue = '20px';
        if(this.settings.fontSize === 'normal') fsValue = '16px';
        document.documentElement.style.fontSize = fsValue;
        document.documentElement.style.setProperty('--fs-base', fsValue);
        
        document.querySelectorAll('.settings-chip[id^="chip-fs-"]').forEach(el => el.classList.remove('active'));
        const chipFs = document.getElementById(`chip-fs-${this.settings.fontSize}`);
        if(chipFs) chipFs.classList.add('active');
    },

    // ─── KHỞI ĐỘNG ────────────────────────────────────────────────────────────
    async init() {
        this.loadTheme();
        this.applySettings();
        
        // Khôi phục session từ localStorage ngay khi khởi động (tránh phải đăng nhập lại sau F5)
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession?.user) {
            this.user = existingSession.user;
            try {
                const { data } = await supabase.rpc('is_admin');
                this.isAdmin = !!data;
            } catch(e) { this.isAdmin = false; }
            this.updateAuthUI();
            await this.loadData();
        }

        // Lắng nghe thay đổi auth (đăng nhập mới, đăng xuất, refresh token)
        supabase.auth.onAuthStateChange(async (event, session) => {
            const newUser = session?.user || null;
            // Bỏ qua INITIAL_SESSION nếu đã xử lý ở trên
            if (event === 'INITIAL_SESSION') return;
            this.user = newUser;
            if (this.user) {
                try {
                    const { data } = await supabase.rpc('is_admin');
                    this.isAdmin = !!data;
                } catch(e) { this.isAdmin = false; }
                this.updateAuthUI();
                await this.loadData();
            } else {
                this.isAdmin = false;
                this.updateAuthUI();
                this.data = [];
                this.renderDashboard();
            }
        });

        // Apply saved settings
        const savedCols = localStorage.getItem('gridCols') || '6';
        const grid = document.getElementById('series-grid');
        if (grid && this.viewMode === 'grid') {
            grid.style.gridTemplateColumns = `repeat(${savedCols}, 1fr)`;
        }
        const savedFontSize = localStorage.getItem('fontSize') || 'normal';
        this.applyFontSize(savedFontSize);
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

        this.updateSeriesSuggestions();
        this.setupPriceInput();
        this.renderDashboard();
        this.setupSearch();

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
    },

    // ─── LOADING UI ───────────────────────────────────────────────────────────
    showLoading(msg = 'Đang xử lý...') {
        let el = document.getElementById('loading-overlay');
        if (!el) {
            el = document.createElement('div');
            el.id = 'loading-overlay';
            el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;z-index:9999;';
            el.innerHTML = `<div style="background:var(--card-bg,#fff);border-radius:12px;padding:1.5rem 2.5rem;display:flex;align-items:center;gap:1rem;box-shadow:0 8px 30px rgba(0,0,0,0.2);font-weight:600;color:var(--card-text);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 1s linear infinite"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                <span>${msg}</span>
            </div>`;
            document.body.appendChild(el);
            const style = document.createElement('style');
            style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
            document.head.appendChild(style);
        }
        el.querySelector('span').textContent = msg;
        el.style.display = 'flex';
    },

    hideLoading() {
        const el = document.getElementById('loading-overlay');
        if (el) el.style.display = 'none';
    },

    // ─── THEME ────────────────────────────────────────────────────────────────
    loadTheme() {
        const theme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', theme);
        this.updateThemeIcon(theme);
    },

    toggleTheme() {
        let theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        this.updateThemeIcon(theme);
    },

    updateThemeIcon(theme) {
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
        if (window.feather) { try { feather.replace(); } catch(e) { console.warn('Feather error:', e); } }
    },

    // ─── USER MENU ────────────────────────────────────────────────────
    toggleUserMenu() {
        const menu = document.getElementById('user-menu');
        if (menu) menu.classList.toggle('hidden');
    },

    // ─── SETTINGS ────────────────────────────────────────────────────
    showSettings() {
        const overlay = document.getElementById('settings-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            // Sync current settings to UI
            const cols = localStorage.getItem('gridCols') || '6';
            document.querySelectorAll('.settings-chip').forEach(c => c.classList.remove('active'));
            const chip = document.getElementById(`chip-${cols}`);
            if (chip) chip.classList.add('active');

            const fontSize = localStorage.getItem('fontSize') || 'normal';
            const fsChip = document.getElementById(`chip-fs-${fontSize}`);
            if (fsChip) fsChip.classList.add('active');

            const showProgress = localStorage.getItem('showProgress') !== 'false';
            const progressSwitch = document.getElementById('progress-switch');
            if (progressSwitch) progressSwitch.classList.toggle('active', showProgress);

            if (window.feather) { try { feather.replace(); } catch(e) { console.warn('Feather error:', e); } }
        }
    },
    closeSettings() {
        const overlay = document.getElementById('settings-overlay');
        if (overlay) overlay.style.display = 'none';
    },
    setSetting(key, value) {
        localStorage.setItem(key, value);
        if (key === 'gridCols') {
            this.applyGridCols(value);
            // Refresh only gridCols chips
            document.querySelectorAll('[id^="chip-"]').forEach(c => {
                if (!c.id.startsWith('chip-fs')) c.classList.remove('active');
            });
            const chip = document.getElementById(`chip-${value}`);
            if (chip) chip.classList.add('active');
        }
        if (key === 'fontSize') {
            this.applyFontSize(value);
            document.querySelectorAll('[id^="chip-fs-"]').forEach(c => c.classList.remove('active'));
            const chip = document.getElementById(`chip-fs-${value}`);
            if (chip) chip.classList.add('active');
        }
    },
    toggleSetting(key) {
        const current = localStorage.getItem(key) !== 'false';
        localStorage.setItem(key, String(!current));
        const sw = document.getElementById(`${key === 'showProgress' ? 'progress' : key}-switch`);
        if (sw) sw.classList.toggle('active', !current);
        this.renderDashboard();
    },
    applyGridCols(cols) {
        const grid = document.getElementById('series-grid');
        if (grid) grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        this.renderDashboard();
    },
    applyFontSize(size) {
        const map = { small: '0.875rem', normal: '1rem', large: '1.1rem', xlarge: '1.2rem' };
        document.documentElement.style.setProperty('--fs-base', map[size] || '1rem');
    },


    // ─── DATA — FETCH API ─────────────────────────────────────────────────────
    async loadData() {
        try {
            const { data, error } = await supabase.from('manga').select('*').order('added_at', { ascending: false });
            if (error) throw error;
            this.data = data.map(m => ({
                id: m.id,
                series: m.series,
                title: m.title,
                volume: m.volume,
                isbn: m.isbn,
                author: m.author,
                translator: m.translator,
                publisher: m.publisher,
                distributor: m.distributor,
                publishDate: m.publish_date,
                pages: m.pages,
                size: m.size,
                price: m.price,
                note: m.note,
                coverUrl: m.cover_url,
                giftUrls: m.gift_urls || [],
                catalogId: m.catalog_id,
                addedAt: m.added_at
            }));
            this.renderDashboard();
        } catch (err) {
            console.error('Lỗi tải dữ liệu:', err);
            this.data = [];
            this.renderDashboard();
            if (this.user) {
                const msg = err?.code === '42P01'
                    ? 'Chưa tạo bảng dữ liệu! Vui lòng chạy file sql/schema.sql trong Supabase.'
                    : 'Không thể kết nối server! (' + (err?.message || 'unknown') + ')';
                this.showToast(msg, 'error');
            }
        }
    },

    // ─── EXPORT / IMPORT ──────────────────────────────────────────────────────
    exportData() {
        if (this.data.length === 0) {
            alert('Thư viện đang trống, không có dữ liệu để sao lưu!');
            return;
        }
        const dataStr = JSON.stringify(this.data, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const date = new Date();
        const strDate = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
        const a = document.createElement('a');
        a.href = url;
        a.download = `manga_backup_${strDate}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (!Array.isArray(importedData)) {
                    alert('File không đúng định dạng dữ liệu Kệ Truyện!');
                    return;
                }
                if (!confirm(`Chuẩn bị phục hồi ${importedData.length} cuốn.\n\n⚠️ Dữ liệu hiện tại sẽ bị GHI ĐÈ. Tiếp tục?`)) return;

                this.showLoading('Đang nhập dữ liệu...');
                // Import via Supabase JS
                const cleanData = importedData.map(m => ({
                    user_id: this.user.id,
                    series: m.series,
                    title: m.title,
                    volume: parseFloat(m.volume) || null,
                    isbn: m.isbn,
                    author: m.author,
                    translator: m.translator,
                    publisher: m.publisher,
                    distributor: m.distributor,
                    publish_date: m.publishDate || m.publish_date || null,
                    pages: parseInt(m.pages) || null,
                    size: m.size,
                    price: parseInt(m.price) || null,
                    note: m.note,
                    cover_url: m.coverUrl || m.cover_url,
                    gift_urls: Array.isArray(m.giftUrls) ? m.giftUrls : (m.giftUrl ? [m.giftUrl] : []),
                    added_at: m.addedAt || m.added_at || new Date().toISOString()
                }));

                const { error: deleteErr } = await supabase.from('manga').delete().eq('user_id', this.user.id);
                if (deleteErr) throw deleteErr;

                const { error: insertErr } = await supabase.from('manga').insert(cleanData);
                if (insertErr) throw insertErr;
                
                const result = { success: true, imported: cleanData.length };
                if (result.success) {
                    await this.loadData();
                    this.updateSeriesSuggestions();
                    this.showView('dashboard');
                    this.showToast(`Đã nhập thành công ${result.imported} cuốn! 🎉`);
                } else {
                    alert('Lỗi khi nhập dữ liệu: ' + result.error);
                }
            } catch (err) {
                alert('Có lỗi khi đọc file JSON.');
            } finally {
                this.hideLoading();
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    },

    // ─── TOAST NOTIFICATION ───────────────────────────────────────────────────
    showToast(msg, type = 'success') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;z-index:10000;display:flex;flex-direction:column;gap:0.5rem;';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        const bg = type === 'error' ? '#ef4444' : '#16a34a';
        toast.style.cssText = `background:${bg};color:#fff;padding:0.75rem 1.25rem;border-radius:10px;font-weight:600;font-size:0.9rem;box-shadow:0 4px 15px rgba(0,0,0,0.2);transform:translateX(120%);transition:transform 0.3s cubic-bezier(0.16,1,0.3,1);max-width:320px;`;
        toast.textContent = msg;
        container.appendChild(toast);
        requestAnimationFrame(() => { toast.style.transform = 'translateX(0)'; });
        setTimeout(() => {
            toast.style.transform = 'translateX(120%)';
            setTimeout(() => toast.remove(), 350);
        }, 3500);
    },

    // ─── SERIES SUGGESTIONS ───────────────────────────────────────────────────
    updateSeriesSuggestions() {
        const datalist = document.getElementById('series-suggestions');
        if (!datalist) return;
        const uniqueSeries = [...new Set(this.data.map(m => m.series))]
            .filter(s => s)
            .map(s => String(s).trim())
            .filter(s => s);
        uniqueSeries.sort((a, b) => a.localeCompare(b, 'vi'));
        datalist.innerHTML = uniqueSeries.map(s => `<option value="${s}">`).join('');
    },

    generateId() {
        return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    },

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
            this.showView('dashboard');
        } else {
            // Dang them moi → ve trang chon phuong thuc
            this.showView('add-method');
        }
    },

    showView(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active', 'hidden'));
        document.querySelectorAll('.view').forEach(v => {
            if (v.id === `view-${viewId}`) v.classList.add('active');
            else v.classList.add('hidden');
        });
        if (window.feather) { try { feather.replace(); } catch(e) { console.warn('Feather error:', e); } }

        if (viewId === 'dashboard') {
            this.renderDashboard();
            document.getElementById('searchInput').value = '';
        } else if (viewId === 'form') {
            document.getElementById('manga-form').reset();
            document.getElementById('edit-id').value = '';
            document.querySelector('#view-form h2').textContent = 'Thêm sách mới';
            this.previewImage('', 'cover', 'main-');
            const giftUrls = document.getElementById('main-giftUrls');
            if (giftUrls) giftUrls.value = '';
            const giftInput = document.getElementById('main-giftUrlInput');
            if (giftInput) giftInput.value = '';
            const thumbs = document.getElementById('main-gift-thumbnails');
            if (thumbs) thumbs.innerHTML = '';
            this.previewGiftImage('', 'main-');
            this.switchImgTab('cover', 'main-');
            const datePicker = document.querySelector("#publishDate");
            if (datePicker && datePicker._flatpickr) datePicker._flatpickr.clear();
            if (window.feather) { try { feather.replace(); } catch(e) { console.warn('Feather error:', e); } }
        }
    },

    // ─── SERIES GROUPS ────────────────────────────────────────────────────────
    getSeriesGroups() {
        const groups = {};
        this.data.forEach(manga => {
            if (!groups[manga.series]) {
                groups[manga.series] = {
                    title: manga.series,
                    latestVolume: manga,
                    uniqueVolumes: new Set(),
                    maxVolume: Number(manga.volume) || 0
                };
            }
            const volNum = Number(manga.volume) || 0;
            groups[manga.series].uniqueVolumes.add(volNum);
            const latestVolNum = Number(groups[manga.series].latestVolume.volume) || 0;
            if (volNum > latestVolNum) groups[manga.series].latestVolume = manga;
            if (volNum > groups[manga.series].maxVolume) groups[manga.series].maxVolume = volNum;
        });

        const sortEl = document.getElementById('sort-order');
        const sortOrder = sortEl ? sortEl.value : 'az';
        return Object.values(groups).map(g => {
            const count = g.uniqueVolumes.size;
            const total = Math.max(count, Math.ceil(g.maxVolume));
            const percent = total > 0 ? Math.round((count / total) * 100) : 0;
            return {
                title: g.title || 'Không có tên Series',
                latestVolume: g.latestVolume,
                count: count,
                maxVolume: g.maxVolume,
                total: total,
                percent: percent
            };
        }).sort((a, b) => {
            const titleA = a.title;
            const titleB = b.title;
            return sortOrder === 'za'
                ? titleB.localeCompare(titleA, 'vi')
                : titleA.localeCompare(titleB, 'vi');
        });
    },

    // ─── DASHBOARD ────────────────────────────────────────────────────────────
    renderDashboard() {
        const grid = document.getElementById('series-grid');
        const emptyState = document.getElementById('empty-state');
        const countBadge = document.getElementById('total-series-count');
        const booksBadge = document.getElementById('total-books-count');
        const thisMonthBadge = document.getElementById('this-month-books-count');
        grid.innerHTML = '';

        if (!this.user) {
            grid.classList.add('hidden');
            emptyState.classList.remove('hidden');
            emptyState.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 2.5rem 1rem; text-align:center;">
                    <div style="background: linear-gradient(135deg, var(--primary), #0ea5e9); width:80px; height:80px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-bottom:1.5rem; box-shadow: 0 10px 25px rgba(2, 132, 199, 0.3);">
                        <i data-feather="book-open" style="width:36px;height:36px;color:white;stroke-width:1.5;"></i>
                    </div>
                    <h2 style="font-weight:700; font-size: 1.7rem; margin-bottom:0.75rem; color:var(--text);">Vũ trụ Truyện tranh của bạn</h2>
                    <p style="color:var(--text-light); max-width: 420px; line-height: 1.6; margin-bottom: 2rem;">Không gian lưu trữ hoàn toàn riêng tư. Bạn cần phải đăng nhập tài khoản Google để mã hóa và truy cập vào kệ truyện của riêng mình.</p>
                    <button onclick="app.signInWithGoogle()" style="display:inline-flex;align-items:center;gap:0.6rem;padding:0.65rem 1.5rem;border:1.5px solid #dadce0;border-radius:99px;background:#fff;cursor:pointer;font-size:0.95rem;font-weight:500;font-family:inherit;color:#3c4043;box-shadow:0 1px 4px rgba(0,0,0,0.08);transition:all 0.2s;">
                        <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                        Đăng nhập bằng Google
                    </button>
                </div>
            `;
            
            countBadge.textContent = '0 series';
            if (booksBadge) booksBadge.textContent = '0 cuốn';
            if (thisMonthBadge) thisMonthBadge.classList.add('hidden');
            if (window.feather) { try { feather.replace(); } catch(e) { console.warn('Feather error:', e); } }
            return;
        }

        if (this.data.length === 0) {
            grid.classList.add('hidden');
            emptyState.classList.remove('hidden');
            emptyState.innerHTML = `
                <i data-feather="inbox" style="width:48px;height:48px;color:initial;stroke-width:1;margin-bottom:1rem;opacity:0.5;"></i>
                <h3 style="margin-bottom:0.5rem;font-weight:500;">Kệ sách trống trơn</h3>
                <p>Hãy thêm cuốn sách đầu tiên của bạn</p>
                <button class="btn btn-primary" onclick="app.showAddMethod()" style="margin-top:1.5rem;">
                    <i data-feather="plus"></i> Thêm sách
                </button>
            `;
            countBadge.textContent = '0 series';
            if (booksBadge) booksBadge.textContent = '0 cuốn';
            if (thisMonthBadge) thisMonthBadge.classList.add('hidden');
            if (window.feather) { try { feather.replace(); } catch(e) { console.warn('Feather error:', e); } }
            return;
        }

        grid.classList.remove('hidden');
        emptyState.classList.add('hidden');

        let seriesList = this.getSeriesGroups();
        const filterStatus = document.getElementById('filter-status') ? document.getElementById('filter-status').value : 'all';
        if (filterStatus === '100') {
            seriesList = seriesList.filter(s => s.percent >= 100);
        } else if (filterStatus === 'under100') {
            seriesList = seriesList.filter(s => s.percent < 100);
        }

        countBadge.textContent = `${seriesList.length} series`;
        if (booksBadge) booksBadge.textContent = `${this.data.length} cuốn`;

        // Đếm sách thêm tháng này
        const now = new Date();
        const thisMonthCount = this.data.filter(m => {
            if (!m.addedAt) return false;
            const d = new Date(m.addedAt);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).length;
        if (thisMonthBadge) {
            thisMonthBadge.textContent = `+${thisMonthCount} cuốn tháng này`;
            thisMonthBadge.classList.toggle('hidden', thisMonthCount === 0);
        }

        if (this.viewMode === 'list') {
            grid.classList.add('list-view');
            const icon = document.getElementById('icon-view-mode');
            if (icon) icon.setAttribute('data-feather', 'grid');
        } else {
            grid.classList.remove('list-view');
            const icon = document.getElementById('icon-view-mode');
            if (icon) icon.setAttribute('data-feather', 'list');
        }

        seriesList.forEach(sg => {
            const coverUrl = sg.latestVolume.coverUrl || 'https://via.placeholder.com/200x300.png?text=No+Cover';
            const percentColor = sg.percent < 100 ? '#ea580c' : 'var(--primary)';
            const percentBg = sg.percent < 100 ? '#ffedd5' : 'var(--border)';
            const card = document.createElement('div');
            card.className = 'series-card';
            card.onclick = () => this.openSeriesDetail(sg.title);
            card.innerHTML = `
                <div class="series-cover">
                    <img src="${coverUrl}" alt="${sg.title}" loading="lazy">
                </div>
                <div class="series-info">
                    <h3 class="series-title" title="${sg.title}">${sg.title}</h3>
                    <div class="series-meta">
                        <span><i data-feather="book" style="width:12px;height:12px;margin-right:4px;"></i>${sg.count}/${sg.total} tập</span>
                        <span class="progress-badge" style="font-weight:700; color:${percentColor}; background:${percentBg}; padding:0.15rem 0.5rem; border-radius:99px; font-size:0.75rem;">${sg.percent}%</span>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
        if (window.feather) { try { feather.replace(); } catch(e) { console.warn('Feather error:', e); } }
    },

    toggleViewMode() {
        this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
        localStorage.setItem('viewMode', this.viewMode);
        this.renderDashboard();
    },

    toggleDetailViewMode() {
        this.detailViewMode = this.detailViewMode === 'grid' ? 'list' : 'grid';
        localStorage.setItem('detailViewMode', this.detailViewMode);
        this.openSeriesDetail(this.currentSeries);
    },

    toggleCustomDropdown(id) {
        // Close others first
        document.querySelectorAll('.custom-select-container .user-dropdown').forEach(d => {
            if (d.id !== id) d.classList.add('hidden');
        });
        const menu = document.getElementById(id);
        if (menu) menu.classList.toggle('hidden');
    },

    setFilter(value, label) {
        document.getElementById('filter-status').value = value;
        document.getElementById('filter-status-label').textContent = label;
        document.getElementById('filter-dropdown').classList.add('hidden');
        this.renderDashboard();
    },

    setSort(value, label) {
        document.getElementById('sort-order').value = value;
        document.getElementById('sort-order-label').textContent = label;
        document.getElementById('sort-dropdown').classList.add('hidden');
        localStorage.setItem('defaultSort', value);
        this.renderDashboard();
    },

    // ─── SERIES DETAIL ────────────────────────────────────────────────────────
    openSeriesDetail(seriesName, page = 1) {
        if (typeof page !== 'number') page = 1;
        this.currentSeries = seriesName;
        document.getElementById('detail-series-title').textContent = seriesName;

        const specialKeywords = /bản đặc biệt|đặc biệt|giới hạn|sưu tầm|collector|limited|special/i;
        const isSpecial = (title) => specialKeywords.test(title || '');

        const allVolumes = this.data
            .filter(m => m.series === seriesName)
            .sort((a, b) => {
                const volDiff = (Number(a.volume) || 0) - (Number(b.volume) || 0);
                if (volDiff !== 0) return volDiff;
                // Cùng số tập: bản thường trước, bản đặc biệt sau
                return isSpecial(a.title) - isSpecial(b.title);
            });

        const uniqueVolNumbers = new Set(allVolumes.map(v => Number(v.volume) || 0));
        const maxVol = Math.max(0, ...uniqueVolNumbers);
        const owned = uniqueVolNumbers.size;
        const total = Math.max(owned, Math.ceil(maxVol));
        const percent = total > 0 ? Math.round((owned / total) * 100) : 0;

        document.getElementById('detail-volume-count').textContent = `Sở hữu ${owned}/${total} tập (${percent}%)`;

        if (!this.detailViewMode) this.detailViewMode = localStorage.getItem('detailViewMode') || 'grid';

        const list = document.getElementById('volumes-list');
        list.className = this.detailViewMode === 'list' ? 'detail-grid list-view' : 'detail-grid';
        
        const icon = document.getElementById('icon-detail-view-mode');
        if (icon) icon.setAttribute('data-feather', this.detailViewMode === 'list' ? 'grid' : 'list');

        list.innerHTML = '';

        const limit = 100;
        const totalItems = allVolumes.length;
        const start = (page - 1) * limit;
        const pagedVolumes = allVolumes.slice(start, start + limit);

        pagedVolumes.forEach(v => {
            const hasCover = v.coverUrl && v.coverUrl.trim() !== '';
            const coverHtml = hasCover
                ? `<img src="${v.coverUrl}" alt="Cover" loading="lazy" style="width:100%;height:100%;object-fit:cover;">`
                : `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.5rem;color:#86efac;font-size:0.75rem;font-weight:500;background:#0f3d21;text-align:center;padding:0.75rem;">
                       <i data-feather="image" style="width:32px;height:32px;opacity:0.5;"></i>
                       <span>Không có ảnh bìa</span>
                   </div>`;
            const editionBadge = this.getEditionBadge(v.title);

            const item = document.createElement('div');
            item.className = 'volume-card';
            item.innerHTML = `
                <div class="vol-cover" onclick="app.showModal('${v.id}')">
                    ${coverHtml}
                </div>
                <div class="vol-info">
                    <div class="vol-top">
                        <div style="display:flex; align-items:center;">
                            <h4 class="vol-title">Tập ${v.volume}</h4>
                            ${editionBadge}
                        </div>
                        <div style="display:flex; gap:0.25rem;">
                            <button class="btn-dots btn-edit" onclick="event.stopPropagation(); app.editVolume('${v.id}')" title="Sửa">
                                <i data-feather="edit-2" style="width:14px;height:14px"></i>
                            </button>
                            <button class="btn-dots btn-delete" onclick="event.stopPropagation(); app.deleteVolume('${v.id}')" title="Xóa">
                                <i data-feather="trash-2" style="width:14px;height:14px;color:var(--danger)"></i>
                            </button>
                        </div>
                    </div>
                    ${v.note ? `<div class="vol-note-italic" onclick="app.showModal('${v.id}')">${v.note}</div>` : `<div onclick="app.showModal('${v.id}')" style="height:1.2rem"></div>`}
                </div>
            `;
            list.appendChild(item);
        });

        const pagination = document.getElementById('series-detail-pagination');
        if (pagination) {
            if (totalItems > limit) {
                const totalPages = Math.ceil(totalItems / limit);
                // Handle single quote in seriesName by escaping it for HTML attribute if needed. 
                // Since it's passed as a string, let's use backticks or replace quotes to avoid syntax errors in the inline handler.
                // A safer way is to store it globally or escape it properly:
                const safeSeriesName = seriesName.replace(/'/g, "\\'");
                pagination.innerHTML = `
                    <button class="btn btn-outline" style="padding: 0.5rem 1rem;" onclick="app.openSeriesDetail('${safeSeriesName}', ${page - 1})" ${page <= 1 ? 'disabled' : ''}>
                        <i data-feather="chevron-left"></i> Trước
                    </button>
                    <span style="color:var(--text-main); font-weight:500;">Trang ${page} / ${totalPages}</span>
                    <button class="btn btn-outline" style="padding: 0.5rem 1rem;" onclick="app.openSeriesDetail('${safeSeriesName}', ${page + 1})" ${page >= totalPages ? 'disabled' : ''}>
                        Sau <i data-feather="chevron-right"></i>
                    </button>
                `;
            } else {
                pagination.innerHTML = '';
            }
        }

        this.showView('detail');
        if (window.feather) { try { feather.replace(); } catch(e) { console.warn('Feather error:', e); } }
    },

    getEditionBadge(title) {
        if (!title) return '';
        const t = title.toLowerCase();
        if (t.includes('sưu tầm') || t.includes('collector')) return `<span class="edition-badge badge-collector">Sưu Tầm</span>`;
        if (t.includes('giới hạn') || t.includes('limited')) return `<span class="edition-badge badge-limited">Giới Hạn</span>`;
        if (t.includes('đặc biệt') || t.includes('special')) return `<span class="edition-badge badge-special">Đặc Biệt</span>`;
        return '';
    },

    toggleDots(e, id) {
        e.stopPropagation();
        document.querySelectorAll('.kebab-menu').forEach(m => {
            if (m.id !== `menu-${id}`) m.classList.add('hidden');
        });
        const menu = document.getElementById(`menu-${id}`);
        if (menu) menu.classList.toggle('hidden');
    },

    // ─── MODAL CHI TIẾT ───────────────────────────────────────────────────────
    showModal(id) {
        const manga = this.data.find(m => m.id === id);
        if (!manga) return;

        const giftsArray = Array.isArray(manga.giftUrls)
            ? manga.giftUrls
            : (manga.giftUrl ? [manga.giftUrl] : []);

        const hasGifts = giftsArray.length > 0;
        const coverUrl = manga.coverUrl || '';
        const fDate = manga.publishDate
            ? new Date(manga.publishDate + 'T00:00:00').toLocaleDateString('vi-VN')
            : null;

        const allImages = [coverUrl, ...giftsArray].filter(Boolean);

        document.getElementById('modal-body').innerHTML = `
            <div class="modal-cover">
                <img id="modal-cover-img" src="${allImages[0] || 'https://via.placeholder.com/300x435.png?text=No+Cover'}" alt="Cover"
                    onerror="this.src='https://via.placeholder.com/300x435.png?text=No+Image'">
                ${allImages.length > 1 ? `
                <button class="modal-gallery-btn btn-left" onclick="app.toggleModalImage(-1)"><i data-feather="chevron-left"></i></button>
                <button class="modal-gallery-btn btn-right" onclick="app.toggleModalImage(1)"><i data-feather="chevron-right"></i></button>
                ` : ''}
            </div>
            <div class="modal-info">
                <div class="minfo-group full-width">
                    <span class="minfo-label">Tiêu đề</span>
                    <span class="minfo-val">${manga.title}</span>
                </div>
                ${manga.isbn ? `<div class="minfo-group"><span class="minfo-label">ISBN</span><span class="minfo-val">${manga.isbn.split(/[,;|/\n]/)[0].trim()}</span></div>` : ''}
                <div class="minfo-group"><span class="minfo-label">Tập số</span><span class="minfo-val">${manga.volume}</span></div>
                ${manga.publisher ? `<div class="minfo-group"><span class="minfo-label">Nhà xuất bản</span><span class="minfo-val">${manga.publisher}</span></div>` : ''}
                ${manga.distributor ? `<div class="minfo-group"><span class="minfo-label">Nhà phát hành</span><span class="minfo-val">${manga.distributor}</span></div>` : ''}
                ${manga.price ? `<div class="minfo-group"><span class="minfo-label">Giá bìa</span><span class="minfo-val">${new Intl.NumberFormat('vi-VN').format(manga.price)} <ins style="text-decoration:underline">đ</ins></span></div>` : ''}
                ${fDate ? `<div class="minfo-group"><span class="minfo-label">Ngày phát hành</span><span class="minfo-val">${fDate}</span></div>` : ''}
                ${manga.author ? `<div class="minfo-group"><span class="minfo-label">Tác giả</span><span class="minfo-val">${manga.author.replace(/\n/g, ', ')}</span></div>` : ''}
                ${manga.translator ? `<div class="minfo-group"><span class="minfo-label">Dịch giả</span><span class="minfo-val">${manga.translator}</span></div>` : ''}
                ${manga.size ? `<div class="minfo-group"><span class="minfo-label">Kích thước</span><span class="minfo-val">${manga.size}</span></div>` : ''}
                ${manga.pages ? `<div class="minfo-group"><span class="minfo-label">Số trang</span><span class="minfo-val">${manga.pages} trang</span></div>` : ''}
                ${manga.note ? `<div class="minfo-group full-width"><span class="minfo-label">Chú thích</span><span class="minfo-val">${manga.note}</span></div>` : ''}
            </div>
        `;
        document.getElementById('volume-modal').classList.add('show');
        if (window.feather) { try { feather.replace(); } catch(e) { console.warn('Feather error:', e); } }

        this.currentModalImages = allImages;
        this.currentModalImageIndex = 0;
    },

    toggleModalImage(dir) {
        if (!this.currentModalImages || this.currentModalImages.length < 2) return;
        this.currentModalImageIndex = (this.currentModalImageIndex + dir + this.currentModalImages.length) % this.currentModalImages.length;
        document.getElementById('modal-cover-img').src = this.currentModalImages[this.currentModalImageIndex];
    },

    closeModal() {
        document.getElementById('volume-modal').classList.remove('show');
    },

    // ─── EDIT ─────────────────────────────────────────────────────────────────
    editVolume(id) {
        const manga = this.data.find(m => m.id === id);
        if (!manga) return;

        this.showView('form');
        document.getElementById('edit-id').value = manga.id;
        document.querySelector('#view-form h2').textContent = 'Sửa thông tin truyện';

        const setVal = (fid, val) => document.getElementById(fid).value = (val !== undefined && val !== null) ? val : '';

        setVal('series', manga.series);
        setVal('title', manga.title);
        setVal('volume', manga.volume);
        setVal('isbn', manga.isbn);
        setVal('author', manga.author);
        setVal('translator', manga.translator);
        setVal('publisher', manga.publisher);
        setVal('distributor', manga.distributor);

        const dp = document.querySelector("#publishDate");
        if (dp && dp._flatpickr) dp._flatpickr.setDate(manga.publishDate);
        else setVal('publishDate', manga.publishDate);

        setVal('pages', manga.pages);
        setVal('size', manga.size);
        setVal('price', manga.price ? new Intl.NumberFormat('vi-VN').format(manga.price) : '');
        setVal('note', manga.note);
        setVal('main-coverUrl', manga.coverUrl);

        const giftsArray = Array.isArray(manga.giftUrls)
            ? manga.giftUrls
            : (manga.giftUrl ? [manga.giftUrl] : []);
        setVal('main-giftUrls', giftsArray.join('\n'));

        this.previewImage(manga.coverUrl, 'cover', 'main-');
        const giftInput = document.getElementById('main-giftUrlInput');
        if (giftInput) giftInput.value = '';
        this.renderGiftThumbnails('main-');
        if (giftsArray.length > 0) this.previewGiftImage(giftsArray[0], 'main-');
        else this.previewGiftImage('', 'main-');
        this.switchImgTab('cover', 'main-');
    },

    // ─── DELETE ───────────────────────────────────────────────────────────────
    async deleteVolume(id) {
        const manga = this.data.find(m => m.id === id);
        if (!manga) return;
        if (!confirm(`Xóa "${manga.title} - Tập ${manga.volume}"?\nHành động này không thể hoàn tác.`)) return;

        // Optimistic UI Update: Xóa khỏi mảng cục bộ ngay lập tức
        this.data = this.data.filter(m => m.id !== id);
        this.updateSeriesSuggestions();

        const isSearchView = document.getElementById('view-search').classList.contains('active');
        const isDetailView = document.getElementById('view-detail').classList.contains('active');
        
        if (isSearchView) {
            this.renderSearch(document.getElementById('searchInput').value);
        } else if (isDetailView) {
            const remaining = this.data.filter(m => m.series === manga.series);
            if (remaining.length > 0) this.openSeriesDetail(manga.series);
            else this.showView('dashboard');
        } else {
            this.showView('dashboard');
        }
        try {
            const { error } = await supabase.from('manga').delete().eq('id', id);
            if (error) throw error;
            this.showToast('Đã xóa thành công!');
        } catch (error) {
            console.error('Lỗi khi xóa:', error);
            this.showToast('Lỗi đồng bộ khi xóa, đang tải lại dữ liệu!', 'error');
            this.loadData(true);
        }
    },

    // ─── XỬ LÝ ẢNH (BÌA & QUÀ TẶNG) ──────────────────────────────────────────
    switchImgTab(tabId, prefix = 'main-') {
        // Find the tabs container related to this prefix
        const coverTabBtn = document.querySelector(`[onclick="app.switchImgTab('cover', '${prefix}')"]`);
        const giftTabBtn = document.querySelector(`[onclick="app.switchImgTab('gift', '${prefix}')"]`);
        if (coverTabBtn && giftTabBtn) {
            coverTabBtn.classList.remove('active');
            giftTabBtn.classList.remove('active');
        }
        
        const btn = document.querySelector(`[onclick="app.switchImgTab('${tabId}', '${prefix}')"]`);
        if(btn) btn.classList.add('active');

        const coverTab = document.getElementById(`${prefix}tab-cover`);
        const giftTab = document.getElementById(`${prefix}tab-gift`);
        if (coverTab && giftTab) {
            coverTab.classList.remove('active');
            coverTab.classList.add('hidden');
            giftTab.classList.remove('active');
            giftTab.classList.add('hidden');

            const activeTab = document.getElementById(`${prefix}tab-${tabId}`);
            if(activeTab) {
                activeTab.classList.remove('hidden');
                activeTab.classList.add('active');
            }
        }
    },

    previewImage(url, type = 'cover', prefix = 'main-') {
        const boxId = type === 'cover' ? `${prefix}cover-preview-box` : `${prefix}gift-preview-box`;
        const box = document.getElementById(boxId);
        if (!box) return;

        if (url && (url.startsWith('http') || url.startsWith('data:'))) {
            box.innerHTML = `<img src="${url}" alt="Preview" onerror="this.onerror=null;this.parentElement.innerHTML='<p style=color:var(--danger)>Lỗi tải ảnh</p>'">`;
        } else {
            box.innerHTML = type === 'cover'
                ? `<i data-feather="image"></i><span>Xem trước ảnh bìa</span>`
                : `<i data-feather="gift"></i><span>Xem trước quà tặng</span>`;
            if (window.feather) { try { feather.replace(); } catch(e) { console.warn('Feather error:', e); } }
        }
    },

    compressImageToBlob(file, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = event => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const max_size = 1200;
                    if (width > height) {
                        if (width > max_size) { height *= max_size / width; width = max_size; }
                    } else {
                        if (height > max_size) { width *= max_size / height; height = max_size; }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob(blob => resolve(blob), 'image/jpeg', quality);
                };
                img.onerror = () => reject(new Error('Không thể đọc file ảnh này. File có thể bị lỗi.'));
            };
            reader.onerror = error => reject(error);
        });
    },

    async handleFileUpload(inputElem, type, prefix = 'main-') {
        if (!inputElem.files || inputElem.files.length === 0) return;
        try {
            const file = inputElem.files[0];
            const fileExt = 'jpg'; // always jpeg after compression
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `covers/${fileName}`;

            this.showLoading('Đang nén và tải ảnh lên...');
            const compressedBlob = await this.compressImageToBlob(file);
            
            const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('Yêu cầu tải ảnh quá hạn (Timeout)')), ms));
            
            const { error: uploadError } = await Promise.race([
                supabase.storage.from('manga_covers').upload(filePath, compressedBlob, { contentType: 'image/jpeg' }),
                timeout(15000)
            ]);
            
            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('manga_covers').getPublicUrl(filePath);
            
            const targetInput = document.getElementById(`${prefix}coverUrl`);
            if (targetInput) targetInput.value = data.publicUrl;
            this.previewImage(data.publicUrl, 'cover', prefix);
        } catch (e) {
            console.error('Lỗi tải ảnh:', e);
            this.showToast(e.message === 'Yêu cầu tải ảnh quá hạn (Timeout)' ? 'Lỗi mạng: Thời gian tải ảnh quá lâu!' : 'Lỗi tải ảnh lên server!', 'error');
        } finally {
            this.hideLoading();
        }
        inputElem.value = '';
    },

    addGiftUrl(prefix = 'main-') {
        const input = document.getElementById(`${prefix}giftUrlInput`);
        const url = input ? input.value.trim() : '';
        if (!url) return;
        const urlsObj = document.getElementById(`${prefix}giftUrls`);
        if(!urlsObj) return;
        const existing = urlsObj.value.trim();
        urlsObj.value = existing ? existing + '\n' + url : url;
        input.value = '';
        this.renderGiftThumbnails(prefix);
        this.previewGiftImage(url, prefix);
    },

    previewGiftImage(url, prefix = 'main-') {
        const box = document.getElementById(`${prefix}gift-preview-box`);
        if (!box) return;
        if (url && (url.startsWith('http') || url.startsWith('data:'))) {
            box.innerHTML = `<img src="${url}" alt="Gift preview" onerror="this.onerror=null;this.parentElement.innerHTML='<p style=color:var(--danger)>Lỗi tải ảnh</p>'">`;
        } else {
            box.innerHTML = `<i data-feather="gift"></i><span>Xem trước quà tặng</span>`;
            if (window.feather) { try { feather.replace(); } catch(e) { console.warn('Feather error:', e); } }
        }
    },

    async handleGiftFileUpload(inputElem, prefix = 'main-') {
        if (!inputElem.files || inputElem.files.length === 0) return;
        try {
            this.showLoading('Đang nén và tải quà tặng lên...');
            const urlsObj = document.getElementById(`${prefix}giftUrls`);
            const lines = urlsObj.value.trim() ? urlsObj.value.trim().split('\n') : [];
            let lastUrl = null;
            
            for (let i = 0; i < inputElem.files.length; i++) {
                const file = inputElem.files[i];
                const fileExt = 'jpg';
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `gifts/${fileName}`;
                
                const compressedBlob = await this.compressImageToBlob(file);
                const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('Yêu cầu tải ảnh quá hạn (Timeout)')), ms));
                const { error: uploadError } = await Promise.race([
                    supabase.storage.from('manga_covers').upload(filePath, compressedBlob, { contentType: 'image/jpeg' }),
                    timeout(15000)
                ]);
                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from('manga_covers').getPublicUrl(filePath);
                lines.push(data.publicUrl);
                lastUrl = data.publicUrl;
            }
            urlsObj.value = lines.join('\n');
            this.renderGiftThumbnails(prefix);
            if (lastUrl) this.previewGiftImage(lastUrl, prefix);
        } catch (e) {
            console.error('Lỗi tải quà tặng:', e);
            this.showToast(e.message === 'Yêu cầu tải ảnh quá hạn (Timeout)' ? 'Lỗi mạng: Thời gian tải ảnh quá lâu!' : 'Lỗi tải ảnh quà tặng lên server!', 'error');
        } finally {
            this.hideLoading();
        }
        inputElem.value = '';
    },

    removeGiftUrl(index, prefix = 'main-') {
        const urlsObj = document.getElementById(`${prefix}giftUrls`);
        if (!urlsObj) return;
        const urls = urlsObj.value.trim().split('\n').filter(u => u.trim() !== '');
        urls.splice(index, 1);
        urlsObj.value = urls.join('\n');
        this.renderGiftThumbnails(prefix);
        if (urls.length > 0) this.previewGiftImage(urls[urls.length - 1], prefix);
        else this.previewGiftImage('', prefix);
    },

    renderGiftThumbnails(prefix = 'main-') {
        const container = document.getElementById(`${prefix}gift-thumbnails`);
        if (!container) return;
        const urlsObj = document.getElementById(`${prefix}giftUrls`);
        if (!urlsObj) return;
        const urls = urlsObj.value.trim().split('\n').filter(u => u.trim() !== '');
        container.innerHTML = '';
        let dragSrcIndex = null;

        urls.forEach((url, index) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'position:relative; width:60px; height:80px; border-radius:6px; overflow:hidden; border:2px solid var(--border); flex-shrink:0; cursor:grab; user-select:none; transition: opacity 0.2s, transform 0.15s;';
            wrap.draggable = true;
            wrap.dataset.index = index;
            wrap.title = 'Nhấn để xem lớn | Kéo để sắp xếp';
            wrap.addEventListener('click', () => this.previewGiftImage(url, prefix));
            wrap.addEventListener('dragstart', e => {
                dragSrcIndex = index;
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => wrap.style.opacity = '0.4', 0);
            });
            wrap.addEventListener('dragend', () => {
                wrap.style.opacity = '1';
                container.querySelectorAll('[data-index]').forEach(el => el.style.transform = '');
            });
            wrap.addEventListener('dragover', e => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                wrap.style.transform = 'scale(1.08)';
            });
            wrap.addEventListener('dragleave', () => { wrap.style.transform = ''; });
            wrap.addEventListener('drop', e => {
                e.preventDefault();
                wrap.style.transform = '';
                if (dragSrcIndex === null || dragSrcIndex === index) return;
                const allUrls = urlsObj.value.trim().split('\n').filter(u => u.trim() !== '');
                const [moved] = allUrls.splice(dragSrcIndex, 1);
                allUrls.splice(index, 0, moved);
                urlsObj.value = allUrls.join('\n');
                dragSrcIndex = null;
                this.renderGiftThumbnails(prefix);
            });
            wrap.innerHTML = `
                <img src="${url.trim()}" style="width:100%;height:100%;object-fit:contain;pointer-events:none;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                <div style="display:none; width:100%; height:100%; background:#fee2e2; color:#ef4444; align-items:center; justify-content:center; font-size:0.75rem; text-align:center; padding:2px; font-weight:600;">Lỗi</div>
                <button type="button" class="delete-gift-btn" style="width:18px;height:18px;top:2px;right:2px;" onclick="event.stopPropagation();app.removeGiftUrl(${index}, '${prefix}')" title="Xoá">
                    <i data-feather="x" style="width:10px;height:10px;"></i>
                </button>
            `;
            container.appendChild(wrap);
        });
        if (window.feather) { try { feather.replace(); } catch(e) { console.warn('Feather error:', e); } }
    },

    previewManyImages() { this.renderGiftThumbnails(); },

    // ─── FORM SUBMIT ──────────────────────────────────────────────────────────
    async handleFormSubmit(e) {
        e.preventDefault();
        const getVal = (id) => document.getElementById(id).value.trim();
        const editId = document.getElementById('edit-id').value;

        const mangaData = {
            user_id: this.user.id,
            series: getVal('series'),
            title: getVal('title'),
            volume: parseFloat(getVal('volume')),
            isbn: getVal('isbn'),
            author: getVal('author'),
            translator: getVal('translator'),
            publisher: getVal('publisher'),
            distributor: getVal('distributor'),
            publish_date: getVal('publishDate') || null,
            pages: parseInt(getVal('pages')) || null,
            size: getVal('size'),
            price: parseInt(getVal('price').replace(/[^\d]/g, '')) || null,
            note: getVal('note'),
            cover_url: getVal('main-coverUrl'),
            gift_urls: getVal('main-giftUrls').split('\n').map(s => s.trim()).filter(s => s !== '')
        };

        const formEl = document.getElementById('manga-form');
        if (!editId && formEl.dataset.catalogId) {
            mangaData.catalog_id = formEl.dataset.catalogId;
        }

        if (!mangaData.series || !mangaData.title) {
            this.showToast('Vui lòng nhập Tên Series và Tiêu đề!', 'error');
            return;
        }

        const isRegularEdition = !mangaData.title.toLowerCase().includes(' - bản ');
        if (isRegularEdition) {
            const isDuplicate = this.data.some(m => 
                m.series === mangaData.series && 
                m.volume === mangaData.volume && 
                m.id !== editId &&
                !m.title.toLowerCase().includes(' - bản ')
            );
            
            if (isDuplicate) {
                this.showToast(`Tập ${mangaData.volume} (Bản thường) đã tồn tại trong series này!`, 'error');
                return;
            }
        }

        this.showLoading(editId ? 'Đang cập nhật...' : 'Đang lưu...');
        try {
            // Hàm tiện ích tạo timeout 15 giây
            const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('Yêu cầu quá hạn (Timeout)')), ms));

            if (editId) {
                // Sử dụng Promise.race để tự động ngắt nếu mạng treo
                const { data, error } = await Promise.race([
                    supabase.from('manga').update(mangaData).eq('id', editId).select(),
                    timeout(15000)
                ]);
                
                if (error) throw error;
                if (!data || data.length === 0) throw new Error('Không tìm thấy bản ghi để cập nhật');
                
                const updatedRow = data[0];
                
                // Update local cache
                const idx = this.data.findIndex(m => m.id === editId);
                if (idx !== -1) {
                    this.data[idx] = {
                        id: updatedRow.id,
                        series: updatedRow.series,
                        title: updatedRow.title,
                        volume: updatedRow.volume,
                        isbn: updatedRow.isbn,
                        author: updatedRow.author,
                        translator: updatedRow.translator,
                        publisher: updatedRow.publisher,
                        distributor: updatedRow.distributor,
                        publishDate: updatedRow.publish_date,
                        pages: updatedRow.pages,
                        size: updatedRow.size,
                        price: updatedRow.price,
                        note: updatedRow.note,
                        coverUrl: updatedRow.cover_url,
                        giftUrls: updatedRow.gift_urls || [],
                        catalogId: updatedRow.catalog_id,
                        addedAt: updatedRow.added_at
                    };
                }
            } else {
                // Sử dụng Promise.race cho thêm mới
                const { data, error } = await Promise.race([
                    supabase.from('manga').insert(mangaData).select(),
                    timeout(15000)
                ]);
                
                if (error) throw error;
                if (!data || data.length === 0) throw new Error('Không có dữ liệu trả về sau khi thêm');
                
                const insertedRow = data[0];
                
                // Add to local cache
                this.data.unshift({
                    id: insertedRow.id,
                    series: insertedRow.series,
                    title: insertedRow.title,
                    volume: insertedRow.volume,
                    isbn: insertedRow.isbn,
                    author: insertedRow.author,
                    translator: insertedRow.translator,
                    publisher: insertedRow.publisher,
                    distributor: insertedRow.distributor,
                    publishDate: insertedRow.publish_date,
                    pages: insertedRow.pages,
                    size: insertedRow.size,
                    price: insertedRow.price,
                    note: insertedRow.note,
                    coverUrl: insertedRow.cover_url,
                    giftUrls: insertedRow.gift_urls || [],
                    catalogId: insertedRow.catalog_id,
                    addedAt: insertedRow.added_at
                });

                // Submit to pending if new and no catalogId
                if (!mangaData.catalog_id) {
                    const pendingData = { ...mangaData, scanned_isbn: formEl.dataset.pendingIsbn || mangaData.isbn, linked_manga_id: insertedRow.id };
                    this.submitPendingBook(pendingData);
                }
            }

            // Cleanup form state
            delete formEl.dataset.catalogId;
            delete formEl.dataset.pendingIsbn;

            // Skip full reload to save time, just update UI
            this.updateSeriesSuggestions();
            this.showToast(editId ? 'Đã cập nhật thành công!' : 'Đã thêm sách thành công! 🎉');

            if (this.currentSeries === mangaData.series) {
                this.openSeriesDetail(this.currentSeries);
            } else {
                this.showView('dashboard');
            }
        } catch (err) {
            console.error('Lỗi khi lưu form:', err);
            this.showToast(err.message === 'Yêu cầu quá hạn (Timeout)' ? 'Lỗi mạng: Thời gian phản hồi quá lâu!' : 'Lỗi khi lưu dữ liệu!', 'error');
        } finally {
            this.hideLoading();
        }
    },

    // ─── PRICE INPUT ──────────────────────────────────────────────────────────
    setupPriceInput() {
        const priceInput = document.getElementById('price');
        if (!priceInput) return;
        priceInput.addEventListener('blur', function () {
            let val = this.value.replace(/[^\d]/g, '');
            if (!val) { this.value = ''; return; }
            let num = parseInt(val, 10);
            if (num < 1000 && num > 0) num = num * 1000;
            if (num > 2000000000) num = 2000000000; // Ngăn lỗi Supabase (Integer limit)
            this.value = new Intl.NumberFormat('vi-VN').format(num);
        });
        priceInput.addEventListener('focus', function () {
            this.value = this.value.replace(/\./g, '');
        });
    },

    async autoFill() {
        const seriesName = document.getElementById('series').value.trim();
        if (!seriesName) {
            alert('Vui lòng nhập Tên Series rồi click Tự động điền!');
            return;
        }
        document.getElementById('title').value = `${seriesName} - Tập `;

        try {
            const { data, error } = await supabase.from('catalog').select('*').ilike('series', `%${seriesName}%`).limit(1);
            if (data && data.length > 0) {
                const res = data[0];
                if (res.author) document.getElementById('author').value = res.author;
                if (res.translator) document.getElementById('translator').value = res.translator;
                if (res.publisher) document.getElementById('publisher').value = res.publisher;
                if (res.distributor) document.getElementById('distributor').value = res.distributor;
                if (res.size) document.getElementById('size').value = res.size;
                if (res.price) {
                    document.getElementById('price').value = new Intl.NumberFormat('vi-VN').format(res.price);
                }
                // Không tự động điền "chú thích" (note) và "quà tặng" (gift_urls) vì chúng thường dành riêng cho từng tập
                this.showToast('Đã điền tự động dữ liệu chung của Series!');
            } else {
                this.showToast('Chưa có dữ liệu tham khảo cho Series này.', 'info');
            }
        } catch (err) {
            console.error('autofill error', err);
            this.showToast('Lỗi khi tải thông tin tự động điền.', 'error');
        }
    },

    // ─── SEARCH ───────────────────────────────────────────────────────────────
    setupSearch() {
        const input = document.getElementById('searchInput');
        input.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase().trim();
            if (q.length > 0) this.renderSearch(q);
            else this.showView('dashboard');
        });
    },

    renderSearch(query) {
        const list = document.getElementById('search-results-list');
        list.innerHTML = '';
        document.getElementById('search-query-display').textContent = query;

        let hasMultipleIsbnMatch = false;
        const queryWords = query.toLowerCase().split(/[\s\-]+/).filter(Boolean);

        const matchedItems = this.data.filter(m => {
            const mIsbnStr = (m.isbn || '').replace(/[\s\-]/g, '');
            const qIsbnStr = query.replace(/[\s\-]/g, '');
            const matchIsbn = mIsbnStr && qIsbnStr.length >= 6 && mIsbnStr.includes(qIsbnStr);
            
            if (matchIsbn && m.isbn.split(/[,;|/\n]/).length > 1) {
                hasMultipleIsbnMatch = true;
            }

            const searchable = `${m.title || ''} ${m.series || ''} ${m.volume ? 'tập ' + m.volume : ''} ${m.author || ''} ${m.translator || ''}`.toLowerCase();
            const matchText = queryWords.length > 0 && queryWords.every(w => searchable.includes(w));

            return matchText || matchIsbn || (m.isbn && m.isbn.toLowerCase().includes(query));
        });

        if (matchedItems.length === 0) {
            list.className = '';
            list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:3rem;">Không tìm thấy kết quả nào.</p>';
            this.showView('search');
            return;
        }

        list.className = 'detail-grid';
        if (hasMultipleIsbnMatch) {
            const note = document.createElement('div');
            note.style.cssText = "grid-column: 1 / -1; background: #fffbeb; color: #b45309; padding: 0.75rem 1rem; border-radius: 8px; font-size: 0.9rem; border: 1px solid #fde68a; display: flex; align-items: center; gap: 0.4rem;";
            note.innerHTML = `<i data-feather="info" style="width:16px;height:16px;flex-shrink:0;"></i><span>Một cuốn sách có thể chứa nhiều mã ISBN.</span>`;
            list.appendChild(note);
        }

        matchedItems.forEach(v => {
            const coverUrl = v.coverUrl || 'https://via.placeholder.com/200x300.png?text=No+Cover';
            const editionBadge = this.getEditionBadge(v.title);

            const item = document.createElement('div');
            item.className = 'volume-card';
            item.innerHTML = `
                <div class="vol-cover" onclick="app.showModal('${v.id}')">
                    <img src="${coverUrl}" alt="Cover" loading="lazy">
                    ${editionBadge}
                </div>
                <div class="vol-info">
                    <div class="vol-top" style="align-items:flex-start;">
                        <div style="flex:1; min-width:0; padding-right:0.5rem;">
                            <h4 class="vol-title" title="${v.title || v.series}" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.95rem;">${v.title || v.series}</h4>
                            <div style="font-size:0.85rem; font-weight:600; color:var(--primary); margin-top:2px;">Tập ${v.volume}</div>
                        </div>
                        <div style="display:flex; gap:0.25rem; flex-shrink:0;">
                            <button class="btn-dots btn-edit" onclick="event.stopPropagation(); app.editVolume('${v.id}')" title="Sửa">
                                <i data-feather="edit-2" style="width:14px;height:14px"></i>
                            </button>
                            <button class="btn-dots btn-delete" onclick="event.stopPropagation(); app.deleteVolume('${v.id}')" title="Xóa">
                                <i data-feather="trash-2" style="width:14px;height:14px;color:var(--danger)"></i>
                            </button>
                        </div>
                    </div>
                    ${v.note ? `<div class="vol-note-italic" onclick="app.showModal('${v.id}')">${v.note}</div>` : `<div onclick="app.showModal('${v.id}')" style="height:1.2rem"></div>`}
                </div>
            `;
            list.appendChild(item);
        });
        this.showView('search');
        if (window.feather) { try { feather.replace(); } catch(e) { console.warn('Feather error:', e); } }
    }
,
    // ─── ADD METHOD & SCANNER ────────────────────────────────────────────────
    scannerStream: null,
    codeReader: null,
    scannedBookCache: null,
    adminCache: [],
    adminCatalogCache: [],

    showAddMethod() {
        this.showView('add-method');
    },

    async startBarcodeScanner() {
        this.showView('add-method'); // hide other views
        const modal = document.getElementById('scanner-modal');
        const video = document.getElementById('scanner-video');
        if(!modal || !video) return;
        modal.classList.remove('hidden');
        modal.classList.add('show');

        try {
            if(!this.codeReader) {
                this.codeReader = new ZXing.BrowserMultiFormatReader();
            }
            const videoInputDevices = await this.codeReader.listVideoInputDevices();
            let selectedDeviceId = videoInputDevices[0].deviceId;
            const backCamera = videoInputDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('sau'));
            if(backCamera) selectedDeviceId = backCamera.deviceId;

            this.codeReader.decodeFromVideoDevice(selectedDeviceId, 'scanner-video', (result, err) => {
                if(result) {
                    this.onBarcodeDetected(result.text);
                }
            });
        } catch (e) {
            console.error('Camera init error:', e);
            const videoEl = document.getElementById('scanner-video');
            if(videoEl) videoEl.style.display = 'none';
            const frameUi = document.getElementById('scanner-frame-ui');
            if(frameUi) frameUi.style.display = 'none';
            const btnCap = document.getElementById('btn-capture-live');
            if(btnCap) btnCap.style.display = 'none';
            const hintTxt = document.getElementById('scanner-hint-text');
            if(hintTxt) hintTxt.style.display = 'none';
            const fallback = document.getElementById('scanner-fallback');
            if(fallback) fallback.classList.remove('hidden');
        }
    },

    stopBarcodeScanner() {
        const modal = document.getElementById('scanner-modal');
        if(modal) {
            modal.classList.add('hidden');
            modal.classList.remove('show');
            
            // Phuuc hooi UI mac dinh cho lan mo tiep theo
            const videoEl = document.getElementById('scanner-video');
            if(videoEl) videoEl.style.display = 'block';
            const frameUi = document.getElementById('scanner-frame-ui');
            if(frameUi) frameUi.style.display = 'block';
            const btnCap = document.getElementById('btn-capture-live');
            if(btnCap) btnCap.style.display = 'inline-block';
            const hintTxt = document.getElementById('scanner-hint-text');
            if(hintTxt) hintTxt.style.display = 'block';
            const fallback = document.getElementById('scanner-fallback');
            if(fallback) fallback.classList.add('hidden');
        }
        if(this.codeReader) {
            this.codeReader.reset();
        }
    },

    handleBarcodeUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = document.createElement('img');
            img.src = event.target.result;
            img.onload = () => {
                if(!this.codeReader) this.codeReader = new ZXing.BrowserMultiFormatReader();
                this.showToast('Đang phân tích mã vạch...', 'info');
                this.codeReader.decodeFromImageElement(img)
                    .then(result => {
                        if(result && result.text) this.onBarcodeDetected(result.text);
                    })
                    .catch(err => {
                        console.error(err);
                        this.showToast('Lỗi: Hình bị mờ hoặc không có mã ISBN hợp lệ. Hãy chụp rõ ràng!', 'error');
                    });
            };
        };
        reader.readAsDataURL(file);
        e.target.value = ''; // reset so they can pick again
    },

    captureBarcode() {
        const video = document.getElementById('scanner-video');
        if (!video || !video.videoWidth) return;
        
        // Tạo canvas lấy frame từ video
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Tạo img element để đưa vào ZXing
        const img = document.createElement('img');
        img.src = canvas.toDataURL('image/png');
        
        img.onload = () => {
            this.showToast('Đang phân tích ảnh...', 'info');
            this.codeReader.decodeFromImageElement(img)
                .then(result => {
                    if(result && result.text) {
                        this.onBarcodeDetected(result.text);
                    }
                })
                .catch(err => {
                    console.error(err);
                    this.showToast('Không bắt được Barcode nào, vui lòng chụp lại rõ hơn!', 'error');
                });
        };
    },

    async onBarcodeDetected(isbn) {
        this.stopBarcodeScanner();
        try {
            const { data, error } = await supabase.from('catalog').select('*').contains('isbns', [isbn]);
            if(data && data.length > 0) {
                // map to old format
                const book = data[0];
                book.coverUrl = book.cover_url;
                this.showBookPreview(book);
            } else {
                alert('Mã ISBN chưa có trong kho chung. Vui lòng điền thông tin để đóng góp!');
                this.showView('form');
                document.getElementById('manga-form').reset();
                document.getElementById('edit-id').value = '';
                document.getElementById('isbn').value = isbn;
                document.getElementById('manga-form').dataset.pendingIsbn = isbn;
            }
        } catch (e) {
            console.error(e);
            this.showView('form');
        }
    },

    showBookPreview(catalogBook) {
        this.scannedBookCache = catalogBook;
        const modal = document.getElementById('book-preview-modal');
        if(!modal) return;
        
        document.getElementById('preview-title').textContent = catalogBook.title || catalogBook.series || 'Chưa rõ';
        document.getElementById('preview-author').textContent = catalogBook.author || 'Đang cập nhật';
        document.getElementById('preview-publisher').textContent = catalogBook.publisher || '-';
        document.getElementById('preview-isbn').textContent = catalogBook.isbns ? catalogBook.isbns[0] : '';
        
        const coverEl = document.getElementById('preview-cover');
        if(catalogBook.coverUrl) {
            coverEl.src = catalogBook.coverUrl;
            coverEl.style.display = 'block';
        } else {
            coverEl.style.display = 'none';
        }
        modal.classList.remove('hidden');
        modal.classList.add('show');
    },

    closeBookPreview() {
        const modal = document.getElementById('book-preview-modal');
        if(modal) modal.classList.add('hidden');
        this.scannedBookCache = null;
    },

    applyBookToForm() {
        const book = this.scannedBookCache;
        this.closeBookPreview();
        this.showView('form');
        document.getElementById('manga-form').reset();
        document.getElementById('edit-id').value = '';
        
        const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
        setVal('series', book.series);
        setVal('title', book.title);
        setVal('volume', book.volume);
        setVal('isbn', book.isbns ? book.isbns.join(', ') : '');
        setVal('author', book.author);
        setVal('translator', book.translator);
        setVal('publisher', book.publisher);
        setVal('distributor', book.distributor);
        setVal('size', book.size);
        setVal('main-coverUrl', book.coverUrl);
        setVal('note', book.note);
        if (book.coverUrl) {
            this.previewImage(book.coverUrl, 'cover', 'main-');
        }
        if (book.gift_urls && book.gift_urls.length > 0) {
            setVal('main-giftUrls', book.gift_urls.join('\n'));
            this.renderGiftThumbnails('main-');
            this.previewGiftImage(book.gift_urls[book.gift_urls.length - 1], 'main-');
        }
        
        document.getElementById('manga-form').dataset.catalogId = book.id;
    },

    async submitPendingBook(mangaData) {
        if(!this.user) return;
        try {
            await supabase.from('pending_catalog').insert({
                submitted_by: this.user.id,
                submitted_name: this.user.user_metadata?.name || this.user.email,
                submitted_email: this.user.email,
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
                gift_urls: mangaData.gift_urls
            });
        } catch(e) { console.error('Failed to submit pending', e); }
    },

    // ─── ADMIN PANEL ─────────────────────────────────────────────────────────
    loadAdminPanel() {
        if(!this.user || !this.isAdmin) {
            alert('Bạn không có quyền truy cập');
            return;
        }
        this.showView('admin');
        this.switchAdminTab('pending');
    },

    async fetchPendingBooks() {
        try {
            const { data, error } = await supabase.rpc('get_all_pending');
            if (error) throw error;
            const list = data.map(p => ({...p, coverUrl: p.cover_url, giftUrls: p.gift_urls, publishDate: p.publish_date, submittedName: p.submitted_name}));
            this.adminCache = list;
            this.renderPendingList(list);
            
            const badge = document.getElementById('nav-admin-badge');
            if(badge) {
                badge.textContent = list.length;
                badge.style.display = list.length > 0 ? 'inline-block' : 'none';
            }
        } catch (e) {
            console.error(e);
        }
    },

    async checkDuplicate(pendingBook) {
        try {
            const { data } = await supabase.from('catalog').select('*')
                .ilike('series', pendingBook.series)
                .ilike('title', pendingBook.title)
                .eq('volume', pendingBook.volume || 0);
            return data || [];
        } catch (e) { return []; }
    },

    async renderPendingList(list) {
        const container = document.getElementById('admin-pending-list');
        if(!container) return;
        container.innerHTML = '';
        if(list.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:2rem; grid-column:1/-1;">Không có sách nào chờ duyệt.</p>';
            return;
        }

        list.forEach(p => {
            const hasCover = p.coverUrl && p.coverUrl.trim() !== '';
            const coverHtml = hasCover
                ? `<img src="${p.coverUrl}" alt="${p.title}" loading="lazy" style="width:100%;height:100%;object-fit:cover;">`
                : `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.5rem;color:#86efac;font-size:0.75rem;font-weight:500;background:#0f3d21;text-align:center;padding:0.75rem;">
                       <i data-feather="image" style="width:32px;height:32px;opacity:0.5;"></i>
                       <span>Không có ảnh bìa</span>
                   </div>`;

            const item = document.createElement('div');
            item.className = 'volume-card';

            const cameraBadge = p.scannedIsbn
                ? `<span class="edition-badge" style="background:#f59e0b; color:white; font-size:0.65rem; padding:2px 7px; border-radius:6px;">📷 ISBN</span>`
                : '';

            const editionBadge = this.getEditionBadge(p.title);

            item.innerHTML = `
                <div class="vol-cover" onclick="app.openPendingModal('${p.id}')">
                    ${coverHtml}
                    ${cameraBadge}
                    ${editionBadge}
                </div>
                <div class="vol-info" style="padding:0.5rem 0.65rem 0.6rem;">
                    <h4 style="font-size:1rem; font-weight:600; color:var(--card-text); margin:0 0 0.25rem 0; line-height:1.3;
                                display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
                                cursor:pointer;"
                        onclick="app.openPendingModal('${p.id}')"
                        title="${p.series || p.title}">${p.series || p.title}</h4>
                    <div style="font-size:0.8rem; color:var(--card-note); font-weight:500;" onclick="app.openPendingModal('${p.id}')">Tập ${p.volume}</div>
                </div>
            `;
            container.appendChild(item);
        });

        if (window.feather) { try { feather.replace(); } catch(e) { console.warn('Feather error:', e); } }
    },

    async openPendingModal(id) {
        const p = this.adminCache.find(x => x.id === id);
        if(!p) return;

        this._pendingActiveId = id;
        const title = document.getElementById('pending-modal-title');
        // Dùng dấu "-" thống nhất thay vì "—" để tránh thừa khi series đã có "-"
        const seriesLabel = (p.series || '').trim();
        if(title) title.textContent = seriesLabel ? `${seriesLabel} - Tập ${p.volume}` : `Tập ${p.volume}`;

        const modalBody = document.getElementById('pending-modal-body');
        modalBody.innerHTML = '<div style="text-align:center; padding:3rem;"><i data-feather="loader" class="spin" style="width:32px;height:32px;"></i></div>';
        const modal = document.getElementById('pending-modal');
        modal.classList.remove('hidden');
        modal.classList.add('show');
        if (window.feather) { try { feather.replace(); } catch(e) { console.warn('Feather error:', e); } }

        const duplicates = await this.checkDuplicate(p);
        const coverUrl = p.coverUrl || '';

        // Danh sách tất cả sách trong kho cho chức năng Gộp
        const datalistOptions = this.data.map(m => `<option value="${m.id}">${m.series} — ${m.title} (Tập ${m.volume || 0})</option>`).join('');

        let dupHtml = '';
        if(duplicates.length > 0) {
            dupHtml = `<div class="duplicate-warning" style="margin-bottom:1.5rem; background: rgba(245, 158, 11, 0.1); border: 1px solid #f59e0b; padding: 1rem; border-radius: 10px;">
                <strong style="color:#d97706; display:block; margin-bottom:0.5rem;">⚠️ Phát hiện ${duplicates.length} bản có thể trùng lặp:</strong>
                <div style="display:flex; flex-direction:column; gap:0.5rem;">
                ${duplicates.map(d => `
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; background:var(--surface); padding:8px 12px; border-radius:6px; border:1px solid var(--border);">
                        <span><strong>[${d.series}]</strong> ${d.title} - Tập ${d.volume}</span>
                        <button class="btn btn-outline" style="padding:4px 10px; font-size:0.75rem; min-height:auto;" onclick="app.quickMerge('${p.id}', '${d.id}')">
                            <i data-feather="git-merge" style="width:12px; height:12px;"></i> Gộp nhanh
                        </button>
                    </div>
                `).join('')}
                </div>
            </div>`;
        }

        modalBody.innerHTML = `
            ${dupHtml}
            <div class="form-grid" style="display:flex; gap:2rem; align-items:flex-start;">

                <!-- Cột TRÁI: Form chỉnh sửa -->
                <div class="form-cols" style="flex:1; min-width:0;">
                    <div class="form-group">
                        <label>Series</label>
                        <input type="text" id="edit-series-${p.id}" class="input-ctrl" value="${p.series || ''}">
                    </div>
                    <div class="form-group">
                        <label>Tên sách cụ thể</label>
                        <input type="text" id="edit-title-${p.id}" class="input-ctrl" value="${p.title || ''}">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Tập số</label>
                            <input type="number" id="edit-volume-${p.id}" class="input-ctrl" value="${p.volume || ''}" min="0" max="10000" step="0.5" onkeydown="if(event.key==='-') event.preventDefault();" oninvalid="this.setCustomValidity('Vui lòng nhập Tập số hợp lệ')" oninput="this.setCustomValidity('')">
                        </div>
                        <div class="form-group">
                            <label>ISBN <span style="font-size:0.8rem; color:var(--primary); font-weight:600;">${p.scannedIsbn ? '(Quét: ' + p.scannedIsbn + ')' : ''}</span></label>
                            <textarea id="edit-isbn-${p.id}" class="input-ctrl" rows="2">${p.isbn || p.scannedIsbn || ''}</textarea>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Tác giả</label>
                            <textarea id="edit-author-${p.id}" class="input-ctrl" rows="2">${p.author || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Dịch giả</label>
                            <input type="text" id="edit-translator-${p.id}" class="input-ctrl" value="${p.translator || ''}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Nhà xuất bản</label>
                            <select id="edit-publisher-${p.id}" class="input-ctrl">
                                <option value="">-- Chọn NXB --</option>
                                ${["Hồng Đức", "Kim Đồng", "Lao động", "Trẻ", "Văn học"].map(o => `<option value="${o}" ${p.publisher === o ? 'selected' : ''}>${o}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Nhà phát hành</label>
                            <select id="edit-distributor-${p.id}" class="input-ctrl">
                                <option value="">-- Chọn NPH --</option>
                                ${["IPM", "Kim Đồng", "Trẻ"].map(o => `<option value="${o}" ${p.distributor === o ? 'selected' : ''}>${o}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Ngày phát hành</label>
                            <input type="date" id="edit-publishDate-${p.id}" class="input-ctrl" value="${p.publishDate || ''}">
                        </div>
                        <div class="form-group">
                            <label>Số trang</label>
                            <input type="number" id="edit-pages-${p.id}" class="input-ctrl" value="${p.pages || ''}" min="1" max="100000" onkeydown="if(event.key==='-') event.preventDefault();" oninvalid="this.setCustomValidity('Số trang phải từ 1 trở lên')" oninput="this.setCustomValidity('')">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Kích thước</label>
                            <select id="edit-size-${p.id}" class="input-ctrl">
                                <option value="">-- Chọn kích thước --</option>
                                ${["11.3 x 17.6 cm", "12 x 18 cm", "13 x 18 cm", "14.5 x 20.5 cm"].map(o => `<option value="${o}" ${p.size === o ? 'selected' : ''}>${o}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Giá tiền (VNĐ)</label>
                            <input type="number" id="edit-price-${p.id}" class="input-ctrl" value="${p.price || ''}" min="0" max="2000000000" onkeydown="if(event.key==='-') event.preventDefault();" oninvalid="this.setCustomValidity('Giá bìa không được vượt quá 2 tỷ')" oninput="this.setCustomValidity('')">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Ghi chú</label>
                        <textarea id="edit-note-${p.id}" class="input-ctrl" rows="2">${p.note || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Gửi bởi</label>
                        <input type="text" class="input-ctrl" value="${p.submittedName || 'Ẩn danh'}" disabled style="opacity:0.6;">
                    </div>
                </div>

                <!-- Cột PHẢI: ảnh bìa + Gộp ISBN -->
                <!-- Cột PHẢI: ảnh bìa + Gộp ISBN -->
                <div class="form-cols cover-col" style="width:280px; flex-shrink:0;">
                    <div class="image-tabs">
                        <button type="button" class="img-tab-btn active" onclick="app.switchImgTab('cover', 'pending-')">Ảnh bìa</button>
                        <button type="button" class="img-tab-btn" onclick="app.switchImgTab('gift', 'pending-')">Quà tặng kèm</button>
                    </div>

                    <!-- Tab Ảnh bìa -->
                    <div id="pending-tab-cover" class="img-tab-content active">
                        <div class="form-group">
                            <div style="display:flex; gap:0.5rem; align-items:center;">
                                <input type="text" id="pending-coverUrl" class="input-ctrl"
                                    placeholder="https://... hoặc tải File" value="${coverUrl}"
                                    oninput="app.previewImage(this.value, 'cover', 'pending-')">
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

                    <!-- Tab Quà tặng -->
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
                        <!-- Ảnh xem trước lớn -->
                        <div class="cover-preview-box" id="pending-gift-preview-box" style="position:relative;">
                            <i data-feather="gift"></i>
                            <span>Xem trước quà tặng</span>
                        </div>
                        <!-- Danh sách thumbnail -->
                        <div id="pending-gift-thumbnails"
                            style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-top:1rem;"></div>
                        <!-- Ẩn text chứa mảng URL -->
                        <textarea id="pending-giftUrls" class="hidden">${p.giftUrls ? p.giftUrls.join('\n') : ''}</textarea>
                    </div>

                    <!-- Gộp ISBN -->
                    <div style="background: var(--background); border:1px solid var(--border); border-radius:10px; padding:1rem;">
                        <p style="font-size:0.8rem; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted); margin-bottom:0.5rem;">Gộp ISBN vào sách có sẵn</p>
                        <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.75rem;">Nếu sách này đã có trong kho, chọn bín dưới để bổ sung ISBN thay vì tạo mới.</p>
                        <input list="all-books-datalist-${p.id}" id="merge-search-input" class="input-ctrl" placeholder="Tìm tên sách..." style="margin-bottom:0.5rem; font-size:0.85rem;">
                        <datalist id="all-books-datalist-${p.id}">${datalistOptions}</datalist>
                        <button class="btn btn-outline" onclick="app.adminMerge('${p.id}')" style="width:100%; justify-content:center; font-size:0.85rem;">
                            <i data-feather="git-merge"></i> Tiến hành Gộp
                        </button>
                    </div>
                </div>
            </div>
        `;

        if (window.feather) { try { feather.replace(); } catch(e) { console.warn('Feather error:', e); } }

        // Khởi tạo hiển thị ảnh bìa và quà tặng
        this.previewImage(coverUrl, 'cover', 'pending-');
        if (p.giftUrls && p.giftUrls.length > 0) {
            this.renderGiftThumbnails('pending-');
            this.previewGiftImage(p.giftUrls[p.giftUrls.length - 1], 'pending-');
        } else {
            this.previewGiftImage('', 'pending-');
        }
    },

    _runAdminApprove() {
        const id = this._pendingActiveId;
        if(id) this.adminApprove(id);
    },

    _runAdminReject() {
        const id = this._pendingActiveId;
        if(id) this.adminReject(id);
    },

    closePendingModal() {
        const modal = document.getElementById('pending-modal');
        if(modal) {
            modal.classList.add('hidden');
            modal.classList.remove('show');
        }
        this._pendingActiveId = null;
    },

    _removePendingFromUI(id) {
        if (!this.adminCache) return;
        this.adminCache = this.adminCache.filter(x => x.id !== id);
        this.renderPendingList(this.adminCache);
        const badge = document.getElementById('nav-admin-badge');
        if(badge) {
            badge.textContent = this.adminCache.length;
            badge.style.display = this.adminCache.length > 0 ? 'inline-block' : 'none';
        }
    },

    async _updatePendingDataBeforeAction(id) {
        const giftStr = document.getElementById('pending-giftUrls')?.value || '';
        const giftUrls = giftStr.split('\n').map(s => s.trim()).filter(s => s !== '');

        const payload = {
            series: document.getElementById(`edit-series-${id}`).value,
            title: document.getElementById(`edit-title-${id}`).value,
            volume: parseFloat(document.getElementById(`edit-volume-${id}`).value) || 0,
            isbn: document.getElementById(`edit-isbn-${id}`).value,
            author: document.getElementById(`edit-author-${id}`).value,
            translator: document.getElementById(`edit-translator-${id}`).value,
            publisher: document.getElementById(`edit-publisher-${id}`).value,
            distributor: document.getElementById(`edit-distributor-${id}`).value,
            publish_date: document.getElementById(`edit-publishDate-${id}`).value || null,
            pages: parseInt(document.getElementById(`edit-pages-${id}`).value) || 0,
            size: document.getElementById(`edit-size-${id}`).value,
            price: parseInt(document.getElementById(`edit-price-${id}`).value) || 0,
            cover_url: document.getElementById(`pending-coverUrl`).value,
            note: document.getElementById(`edit-note-${id}`).value,
            gift_urls: giftUrls
        };
        await supabase.from('pending_catalog').update(payload).eq('id', id);
        return payload;
    },

    async adminApprove(id) {
        if(!confirm('Duyệt và thêm sách này vào kho chung?')) return;
        this.showLoading('Đang xử lý...');
        try {
            const payload = await this._updatePendingDataBeforeAction(id);
            const { error: rpcErr } = await supabase.rpc('admin_approve_pending', {
                pending_id: id,
                updated_data: payload
            });
            if (rpcErr) throw rpcErr;

            this.showToast('Đã duyệt và thêm vào kho!');
            this.closePendingModal();
            this._removePendingFromUI(id);
            this.fullCatalogCache = null;
        } catch(e) {
            console.error(e);
            this.showToast('Lỗi khi duyệt sách!', 'error');
        } finally {
            this.hideLoading();
        }
    },

    async adminReject(id) {
        if(!confirm('Từ chối và xóa bản ghi này?')) return;
        this.showLoading('Đang xử lý...');
        try {
            const { error: rpcErr } = await supabase.rpc('admin_reject_pending', {
                pending_id: id,
                reason: null
            });
            if(rpcErr) throw rpcErr;

            this.showToast('Đã từ chối bản ghi!');
            this.closePendingModal();
            this._removePendingFromUI(id);
        } catch(e) {
            console.error(e);
            this.showToast('Lỗi khi xóa bản ghi!', 'error');
        } finally {
            this.hideLoading();
        }
    },

    async quickMerge(pendingId, catalogId) {
        if(!confirm('Gộp ISBN vào bản ghi có sẵn này?')) return;
        this.showLoading('Đang gộp...');
        try {
            // Sử dụng RPC admin_merge_isbn để tránh lỗi RLS khi update trực tiếp bảng catalog
            const { error: rpcErr } = await supabase.rpc('admin_merge_isbn', {
                pending_id: pendingId,
                target_catalog_id: catalogId
            });
            if(rpcErr) throw rpcErr;
            
            this.showToast('Đã gộp ISBN thành công!');
            this.closePendingModal();
            this._removePendingFromUI(pendingId);
        } catch(e) {
            console.error(e);
            this.showToast('Lỗi khi gộp!', 'error');
        } finally {
            this.hideLoading();
        }
    },

    async adminMerge(pendingId) {
        const inputVal = document.getElementById('merge-search-input').value;
        if(!inputVal) {
            alert('Vui lòng chọn hoặc nhập ID của sách để gộp!');
            return;
        }
        this.quickMerge(pendingId, inputVal);
    },


    // ─── FEEDBACK ─────────────────────────────────────────────────────────────
    showFeedbackModal() {
        const modal = document.getElementById('feedback-modal');
        if(modal) {
            modal.classList.remove('hidden');
            modal.classList.add('show');
            document.getElementById('fb-title').value = '';
            document.getElementById('fb-content').value = '';
        }
    },

    closeFeedbackModal() {
        const modal = document.getElementById('feedback-modal');
        if(modal) {
            modal.classList.add('hidden');
            modal.classList.remove('show');
        }
    },

    async submitFeedback() {
        const title = document.getElementById('fb-title').value.trim();
        const body = document.getElementById('fb-content').value.trim();
        
        if(!body) {
            this.showToast('Vui lòng nhập nội dung góp ý!', 'error');
            return;
        }

        const content = title ? `[${title}]\n${body}` : body;

        const payload = {
            user_id: this.user ? this.user.id : null,
            user_name: this.user ? this.user.user_metadata?.full_name : 'Khách',
            user_email: this.user ? this.user.email : '',
            content: content
        };

        this.showLoading('Đang gửi góp ý...');
        try {
            const { error } = await supabase.from('feedback').insert(payload);
            if (error) throw error;
            this.showToast('Cảm ơn bạn đã góp ý! 🎉');
            this.closeFeedbackModal();
        } catch (e) {
            console.error('Lỗi khi gửi góp ý:', e);
            this.showToast('Đã có lỗi xảy ra, vui lòng thử lại sau.', 'error');
        } finally {
            this.hideLoading();
        }
    },

    // --- ADMIN TABS & FEEDBACK VIEW ---
    switchAdminTab(tabId) {
        document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.admin-tab-content').forEach(c => {
            c.classList.remove('active');
            c.classList.add('hidden');
        });

        document.getElementById(`tab-btn-${tabId}`).classList.add('active');
        const container = document.getElementById(`admin-${tabId}-container`);
        container.classList.remove('hidden');
        container.classList.add('active');

        if(tabId === 'feedback') this.fetchAdminFeedback();
        else if(tabId === 'pending') this.fetchPendingBooks();
        else if(tabId === 'catalog') this.searchAdminCatalog(1); // Auto load all when switching tab
    },

    // ─── ADMIN CATALOG MANAGER ───────────────────────────────────────────────
    onAdminCatalogSearchInput(value) {
        clearTimeout(this._adminSearchTimeout);
        this._adminSearchTimeout = setTimeout(() => {
            this.searchAdminCatalog(1);
        }, 300);
    },

    async searchAdminCatalog(page = 1) {
        if (typeof page !== 'number') page = 1;
        
        const input = document.getElementById('admin-catalog-search');
        if (!input) return;
        const query = input.value.trim().toLowerCase();

        const container = document.getElementById('admin-catalog-list');
        const pagination = document.getElementById('admin-catalog-pagination');
        
        if (!this.fullCatalogCache) {
            container.innerHTML = '<div style="text-align:center; padding:3rem; grid-column:1/-1;"><i data-feather="loader" class="spin" style="width:32px;height:32px;"></i><p>Đang tải dữ liệu Kho chung...</p></div>';
            if (pagination) pagination.innerHTML = '';
            if (window.feather) { try { feather.replace(); } catch(e) { console.warn('Feather error:', e); } }

            try {
                const { data, error } = await supabase.from('catalog').select('*').limit(10000).order('series', { ascending: true }).order('volume', { ascending: true });
                if (error) throw error;
                this.fullCatalogCache = data;
            } catch (e) {
                console.error('Lỗi tìm kiếm catalog:', e);
                container.innerHTML = '<p style="text-align:center; color:var(--danger); padding:2rem; grid-column:1/-1;">Lỗi khi tải dữ liệu từ Kho chung.</p>';
                return;
            }
        }

        let matchedItems = this.fullCatalogCache;
        if (query.length > 0) {
            const queryWords = query.split(/[\s\-]+/).filter(Boolean);
            
            matchedItems = this.fullCatalogCache.filter(c => {
                const cIsbnStr = c.isbns ? c.isbns.join('').replace(/[\s\-]/g, '') : '';
                const qIsbnStr = query.replace(/[\s\-]/g, '');
                const matchIsbn = cIsbnStr && qIsbnStr.length >= 6 && cIsbnStr.includes(qIsbnStr);
                
                const searchable = `${c.title || ''} ${c.series || ''} ${c.volume ? 'tập ' + c.volume : ''} ${c.author || ''} ${c.translator || ''}`.toLowerCase();
                const matchText = queryWords.length > 0 && queryWords.every(w => searchable.includes(w));

                return matchText || matchIsbn;
            });
        }

        const count = matchedItems.length;
        const limit = 100;
        const start = (page - 1) * limit;
        const pagedData = matchedItems.slice(start, start + limit);

        this.adminCatalogCache = pagedData;
        this.renderAdminCatalogList(pagedData, count, page);
    },

    renderAdminCatalogList(list, count = 0, page = 1) {
        const container = document.getElementById('admin-catalog-list');
        const pagination = document.getElementById('admin-catalog-pagination');
        if(!container) return;
        container.innerHTML = '';
        if(pagination) pagination.innerHTML = '';

        if(list.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:2rem; grid-column:1/-1;">Không tìm thấy bản ghi nào khớp với từ khóa.</p>';
            return;
        }

        container.style.columns = '2';
        container.style.columnGap = '1.5rem';

        list.forEach(c => {
            const editionBadge = this.getEditionBadge(c.title);
            const item = document.createElement('div');
            item.className = 'catalog-list-item';
            item.style.breakInside = 'avoid';
            item.style.marginBottom = '0.75rem';
            item.style.padding = '0.75rem';
            item.style.border = '1px solid var(--border)';
            item.style.borderRadius = '8px';
            item.style.background = 'var(--surface)';
            item.style.cursor = 'pointer';
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.justifyContent = 'space-between';
            item.onclick = () => this.openCatalogModal(c.id);

            const coverHtml = (c.cover_url && c.cover_url.trim() !== '') 
                ? `<img src="${c.cover_url}" alt="Cover" style="width:32px;height:45px;object-fit:cover;border-radius:4px;flex-shrink:0;border:1px solid var(--border);">`
                : `<div style="width:32px;height:45px;border-radius:4px;flex-shrink:0;background:var(--bg-lighter);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;"><i data-feather="image" style="width:16px;height:16px;opacity:0.5;"></i></div>`;

            item.innerHTML = `
                <div style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:0.75rem;">
                    ${coverHtml}
                    <div style="display:flex; flex-direction:column; justify-content:center; overflow:hidden;">
                        <span style="color:var(--text-main); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size: 0.95rem;">${c.title || 'Không có tiêu đề'}</span>
                        ${editionBadge ? `<div style="margin-top:0.25rem;">${editionBadge}</div>` : ''}
                    </div>
                </div>
                <i data-feather="edit-2" style="width:16px;height:16px; color:var(--text-muted); flex-shrink:0; margin-left:0.5rem;"></i>
            `;
            container.appendChild(item);
        });
        if (window.feather) { try { feather.replace(); } catch(e) { console.warn('Feather error:', e); } }

        if (pagination && count > 0) {
            const totalPages = Math.ceil(count / 100);
            pagination.innerHTML = `
                <button class="btn btn-outline" style="padding: 0.5rem 1rem;" onclick="app.searchAdminCatalog(${page - 1})" ${page <= 1 ? 'disabled' : ''}>
                    <i data-feather="chevron-left"></i> Trước
                </button>
                <span style="color:var(--text-main); font-weight:500;">Trang ${page} / ${totalPages}</span>
                <button class="btn btn-outline" style="padding: 0.5rem 1rem;" onclick="app.searchAdminCatalog(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>
                    Sau <i data-feather="chevron-right"></i>
                </button>
            `;
            if (window.feather) { try { feather.replace(); } catch(e) { console.warn('Feather error:', e); } }
        }
    },

    openCatalogModal(id) {
        const c = this.adminCatalogCache.find(x => x.id === id);
        if(!c) return;

        const modal = document.getElementById('catalog-modal');
        if(modal) {
            modal.classList.remove('hidden');
            modal.classList.add('show');
        }

        const title = document.getElementById('catalog-modal-title');
        const seriesLabel = (c.series || '').trim();
        if(title) title.textContent = seriesLabel ? `Sửa: ${seriesLabel} - Tập ${c.volume || 0}` : `Sửa: Tập ${c.volume || 0}`;

        const modalBody = document.getElementById('catalog-modal-body');
        const coverUrl = c.cover_url || '';
        const isbnsText = c.isbns ? c.isbns.join(', ') : '';

        modalBody.innerHTML = `
            <div class="form-grid" style="display:flex; gap:2rem; align-items:flex-start;">
                <!-- Cột TRÁI: Form chỉnh sửa -->
                <div class="form-cols" style="flex:1; min-width:0;">
                    <input type="hidden" id="edit-cat-id" value="${c.id}">
                    <div class="form-group">
                        <label>Series</label>
                        <input type="text" id="edit-cat-series" class="input-ctrl" value="${c.series || ''}">
                    </div>
                    <div class="form-group">
                        <label>Tên sách cụ thể</label>
                        <input type="text" id="edit-cat-title" class="input-ctrl" value="${c.title || ''}">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Tập số</label>
                            <input type="number" id="edit-cat-volume" class="input-ctrl" value="${c.volume || ''}" min="0" max="10000" step="0.5">
                        </div>
                        <div class="form-group">
                            <label>ISBN</label>
                            <textarea id="edit-cat-isbn" class="input-ctrl" rows="2">${isbnsText}</textarea>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Tác giả</label>
                            <textarea id="edit-cat-author" class="input-ctrl" rows="2">${c.author || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Dịch giả</label>
                            <input type="text" id="edit-cat-translator" class="input-ctrl" value="${c.translator || ''}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Nhà xuất bản</label>
                            <select id="edit-cat-publisher" class="input-ctrl">
                                <option value="">-- Chọn NXB --</option>
                                ${["Hồng Đức", "Kim Đồng", "Lao động", "Trẻ", "Văn học"].map(o => `<option value="${o}" ${c.publisher === o ? 'selected' : ''}>${o}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Nhà phát hành</label>
                            <select id="edit-cat-distributor" class="input-ctrl">
                                <option value="">-- Chọn NPH --</option>
                                ${["IPM", "Kim Đồng", "Trẻ"].map(o => `<option value="${o}" ${c.distributor === o ? 'selected' : ''}>${o}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Ngày phát hành</label>
                            <input type="date" id="edit-cat-publishDate" class="input-ctrl" value="${c.publish_date || ''}">
                        </div>
                        <div class="form-group">
                            <label>Số trang</label>
                            <input type="number" id="edit-cat-pages" class="input-ctrl" value="${c.pages || ''}" min="1" max="100000">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Kích thước</label>
                            <select id="edit-cat-size" class="input-ctrl">
                                <option value="">-- Chọn kích thước --</option>
                                ${["11.3 x 17.6 cm", "12 x 18 cm", "13 x 18 cm", "14.5 x 20.5 cm"].map(o => `<option value="${o}" ${c.size === o ? 'selected' : ''}>${o}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Giá tiền (VNĐ)</label>
                            <input type="number" id="edit-cat-price" class="input-ctrl" value="${c.price || ''}" min="0" max="2000000000">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Ghi chú</label>
                        <textarea id="edit-cat-note" class="input-ctrl" rows="2">${c.note || ''}</textarea>
                    </div>
                </div>

                <!-- Cột PHẢI: ảnh bìa -->
                <div class="form-cols cover-col" style="width:280px; flex-shrink:0;">
                    <div class="image-tabs">
                        <button type="button" class="img-tab-btn active" onclick="app.switchImgTab('cover', 'cat-')">Ảnh bìa</button>
                        <button type="button" class="img-tab-btn" onclick="app.switchImgTab('gift', 'cat-')">Quà tặng kèm</button>
                    </div>

                    <!-- Tab Ảnh bìa -->
                    <div id="cat-tab-cover" class="img-tab-content active">
                        <div class="form-group">
                            <div style="display:flex; gap:0.5rem; align-items:center;">
                                <input type="text" id="cat-coverUrl" class="input-ctrl"
                                    placeholder="https://... hoặc tải File" value="${coverUrl}"
                                    oninput="app.previewImage(this.value, 'cover', 'cat-')">
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

                    <!-- Tab Quà tặng -->
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
                        <!-- Ảnh xem trước lớn -->
                        <div class="cover-preview-box" id="cat-gift-preview-box" style="position:relative;">
                            <i data-feather="gift"></i>
                            <span>Xem trước quà tặng</span>
                        </div>
                        <!-- Danh sách thumbnail -->
                        <div id="cat-gift-thumbnails"
                            style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-top:1rem;"></div>
                        <!-- Ẩn text chứa mảng URL -->
                        <textarea id="cat-giftUrls" class="hidden">${c.gift_urls ? c.gift_urls.join('\n') : ''}</textarea>
                    </div>
                </div>
            </div>
        `;
        if (window.feather) { try { feather.replace(); } catch(e) { console.warn('Feather error:', e); } }

        // Khởi tạo hiển thị ảnh bìa và quà tặng
        this.previewImage(coverUrl, 'cover', 'cat-');
        if (c.gift_urls && c.gift_urls.length > 0) {
            this.renderGiftThumbnails('cat-');
            this.previewGiftImage(c.gift_urls[c.gift_urls.length - 1], 'cat-');
        } else {
            this.previewGiftImage('', 'cat-');
        }
    },

    closeCatalogModal() {
        const modal = document.getElementById('catalog-modal');
        if(modal) {
            modal.classList.add('hidden');
            modal.classList.remove('show');
        }
    },

    async adminUpdateCatalog() {
        if(!confirm('Lưu thay đổi vào Kho chung? Dữ liệu này sẽ áp dụng cho tất cả người dùng dùng tính năng Tự động điền.')) return;
        const id = document.getElementById('edit-cat-id').value;
        if(!id) return;

        const giftStr = document.getElementById('cat-giftUrls')?.value || '';
        const giftUrls = giftStr.split('\n').map(s => s.trim()).filter(s => s !== '');
        
        const isbnStr = document.getElementById('edit-cat-isbn').value;
        const isbns = isbnStr.split(/[,;|\/\s\n]+/).map(s => s.trim()).filter(s => s !== '');

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
            gift_urls: giftUrls
        };

        this.showLoading('Đang cập nhật Kho chung...');
        try {
            const { error: rpcErr } = await supabase.rpc('admin_update_catalog', {
                catalog_id: id,
                updated_data: payload
            });
            if(rpcErr) throw rpcErr;

            this.showToast('Cập nhật Kho chung thành công!');
            this.closeCatalogModal();
            this.fullCatalogCache = null;
            // Refresh list
            this.searchAdminCatalog();
        } catch(e) {
            console.error(e);
            this.showToast('Lỗi khi cập nhật Kho chung!', 'error');
        } finally {
            this.hideLoading();
        }
    },

    async adminDeleteCatalog() {
        if(!confirm('Xóa vĩnh viễn sách này khỏi Kho chung? Các sách của người dùng đã thêm sẽ không bị ảnh hưởng, nhưng họ không thể dùng Tự động điền sách này nữa.')) return;
        const id = document.getElementById('edit-cat-id').value;
        if(!id) return;

        this.showLoading('Đang xóa khỏi Kho...');
        try {
            const { error: rpcErr } = await supabase.rpc('admin_delete_catalog', {
                catalog_id: id
            });
            if(rpcErr) throw rpcErr;

            this.showToast('Đã xóa sách khỏi Kho chung!');
            this.closeCatalogModal();
            // Remove from cache and re-render
            if (this.fullCatalogCache) this.fullCatalogCache = this.fullCatalogCache.filter(c => c.id !== id);
            this.adminCatalogCache = this.adminCatalogCache.filter(c => c.id !== id);
            this.renderAdminCatalogList(this.adminCatalogCache);
        } catch(e) {
            console.error(e);
            this.showToast('Lỗi khi xóa khỏi Kho chung!', 'error');
        } finally {
            this.hideLoading();
        }
    },

    async fetchAdminFeedback() {
        try {
            const { data, error } = await supabase.rpc('get_all_feedback');
            if(error) throw error;
            this.renderAdminFeedback(data);
        } catch(e) {
            console.error(e);
        }
    },

    renderFeedbackList(list) {
        const container = document.getElementById('admin-feedback-list');
        if(!list || list.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:2rem; color:var(--text-muted);">Chưa có góp ý nào từ người dùng.</p>';
            return;
        }

        container.innerHTML = list.map(fb => {
            const initials = fb.userName ? fb.userName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : '?';
            return `
                <div class="feedback-card">
                    <div class="fb-header">
                        <div class="fb-user-info">
                            <div class="fb-avatar">${initials}</div>
                            <div class="fb-meta">
                                <div class="fb-name">${fb.userName}</div>
                                <div class="fb-email">${fb.userEmail}</div>
                            </div>
                        </div>
                        <div class="fb-actions">
                            <div class="fb-delete-btn" onclick="app.deleteFeedback('${fb.id}')" title="Xóa góp ý">
                                <i data-feather="trash-2" style="width:18px; height:18px;"></i>
                            </div>
                        </div>
                    </div>
                    <div class="fb-content-bubble">
                        ${fb.content.replace(/\n/g, '<br>')}
                    </div>
                    <div class="fb-footer">
                        <span>Trạng thái: <strong>${fb.status === 'new' ? 'Mới' : 'Đã xem'}</strong></span>
                        <div class="fb-date">${new Date(fb.createdAt).toLocaleString('vi-VN')}</div>
                    </div>
                </div>
            `;
        }).join('');
        if (window.feather) { try { feather.replace(); } catch(e) { console.warn('Feather error:', e); } }
    },

    async deleteFeedback(id) {
        if(!confirm('Xóa góp ý này?')) return;
        const { error } = await supabase.rpc('admin_delete_feedback', { feedback_id: id });
        if(!error) {
            this.fetchAdminFeedback();
        } else alert('Lỗi khi xóa!');
    }
};

// Expose to global scope (ES module scope fix)
window.app = app;

// Khởi chạy
document.addEventListener('DOMContentLoaded', () => { app.init(); });

// Đóng menu khi click ngoài
document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown-wrapper')) {
        document.querySelectorAll('.kebab-menu').forEach(m => m.classList.add('hidden'));
    }
});
