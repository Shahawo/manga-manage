import { store } from '../store.js';
import { supabase } from '../supabase-client.js';

export async function loadLibrary(url, globalVarName) {
            if (window[globalVarName]) return true;
            if (!store.loadingScripts) store.loadingScripts = {};
            if (store.loadingScripts[url]) return store.loadingScripts[url];
            
            store.loadingScripts[url] = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = url;
                script.onload = () => resolve(true);
                script.onerror = () => reject(new Error(`Failed to load ${url}`));
                document.head.appendChild(script);
            });
            return store.loadingScripts[url];
        }

export function renderDashboard() {
        const grid = document.getElementById('series-grid');
        const emptyState = document.getElementById('empty-state');
        const countBadge = document.getElementById('total-series-count');
        const booksBadge = document.getElementById('total-books-count');
        const thisMonthBadge = document.getElementById('this-month-books-count');
        grid.innerHTML = '';

        if (!store.user) {
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
            if (window.feather) { try { feather.replace(); } catch (e) { console.warn('Feather error:', e); } }
            return;
        }

        if (store.data.length === 0) {
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
            if (window.feather) { try { feather.replace(); } catch (e) { console.warn('Feather error:', e); } }
            return;
        }

        grid.classList.remove('hidden');
        emptyState.classList.add('hidden');

        let seriesList = window.app.getSeriesGroups();
        const filterStatus = document.getElementById('filter-status') ? document.getElementById('filter-status').value : 'all';
        if (filterStatus === '100') {
            seriesList = seriesList.filter(s => s.percent >= 100);
        } else if (filterStatus === 'under100') {
            seriesList = seriesList.filter(s => s.percent < 100);
        }

        countBadge.textContent = `${seriesList.length} series`;
        if (booksBadge) booksBadge.textContent = `${store.data.length} cuốn`;

        // Đếm sách thêm tháng này
        const now = new Date();
        const thisMonthCount = store.data.filter(m => {
            if (!m.addedAt) return false;
            const d = new Date(m.addedAt);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).length;
        if (thisMonthBadge) {
            thisMonthBadge.textContent = `+${thisMonthCount} cuốn tháng này`;
            thisMonthBadge.classList.toggle('hidden', thisMonthCount === 0);
        }

        if (store.viewMode === 'list') {
            grid.classList.add('list-view');
            grid.style.gridTemplateColumns = ''; // Xóa inline style để CSS class .list-view có hiệu lực
            const icon = document.getElementById('icon-view-mode');
            if (icon) icon.setAttribute('data-feather', 'grid');
        } else {
            grid.classList.remove('list-view');
            // Khôi phục số cột đã lưu cho grid view
            const savedCols = (store.settings && store.settings.gridCols) || localStorage.getItem('gridCols') || '6';
            grid.style.gridTemplateColumns = `repeat(${savedCols}, 1fr)`;
            const icon = document.getElementById('icon-view-mode');
            if (icon) icon.setAttribute('data-feather', 'list');
        }

        // ─── PHÂN TRANG DASHBOARD ──────────────────────────────────────────────
        // Áp dụng khi số series > 50 để tránh render quá nhiều DOM nodes
        const DASHBOARD_PAGE_SIZE = 60;
        const dashPage = window.app._dashboardPage || 1;
        const totalDashPages = Math.ceil(seriesList.length / DASHBOARD_PAGE_SIZE);
        const pagedSeries = seriesList.length > DASHBOARD_PAGE_SIZE
            ? seriesList.slice((dashPage - 1) * DASHBOARD_PAGE_SIZE, dashPage * DASHBOARD_PAGE_SIZE)
            : seriesList;

        // Render pagination bar nếu cần
        let paginationEl = document.getElementById('dashboard-pagination');
        if (!paginationEl) {
            paginationEl = document.createElement('div');
            paginationEl.id = 'dashboard-pagination';
            paginationEl.style.cssText = 'display:flex;justify-content:center;align-items:center;gap:0.75rem;padding:1.5rem 0 0.5rem;';
            grid.parentNode.insertBefore(paginationEl, grid.nextSibling);
        }
        if (seriesList.length > DASHBOARD_PAGE_SIZE) {
            paginationEl.innerHTML = `
                <button class="btn btn-outline" style="padding:0.4rem 1rem;" onclick="app._dashboardPage=Math.max(1,(app._dashboardPage||1)-1);app.renderDashboard()" ${dashPage <= 1 ? 'disabled' : ''}>
                    <i data-feather="chevron-left"></i>
                </button>
                <span style="color:var(--text-main);font-weight:500;font-size:0.9rem;">${dashPage} / ${totalDashPages}</span>
                <button class="btn btn-outline" style="padding:0.4rem 1rem;" onclick="app._dashboardPage=Math.min(${totalDashPages},(app._dashboardPage||1)+1);app.renderDashboard()" ${dashPage >= totalDashPages ? 'disabled' : ''}>
                    <i data-feather="chevron-right"></i>
                </button>
                <span style="color:var(--text-muted);font-size:0.8rem;">(${seriesList.length} series)</span>
            `;
        } else {
            paginationEl.innerHTML = '';
        }

        // ─── INTERSECTION OBSERVER LAZY LOADING ───────────────────────────────
        // Disconnect observer cũ nếu có
        if (window.app._dashboardImgObserver) {
            window.app._dashboardImgObserver.disconnect();
        }
        window.app._dashboardImgObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const src = img.dataset.src;
                    if (src) {
                        img.src = src;
                        img.removeAttribute('data-src');
                        img.style.opacity = '0';
                        img.style.transition = 'opacity 0.3s ease';
                        img.onload = () => { img.style.opacity = '1'; };
                    }
                    observer.unobserve(img);
                }
            });
        }, { rootMargin: '200px 0px', threshold: 0.01 });

        pagedSeries.forEach(sg => {
            const hasCover = sg.latestVolume.coverUrl && sg.latestVolume.coverUrl.trim() !== '';
            const safeTitle = sg.title.replace(/'/g, "&#39;").replace(/"/g, "&quot;");

            // Dùng data-src thay vì src để IntersectionObserver kiểm soát thời điểm tải
            // src="data:..." là 1×1 pixel trong suốt — tránh onerror cháy khi src rỗng
            const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            const coverHtml = hasCover
                ? `<img data-src="${sg.latestVolume.coverUrl}" src="${BLANK}" alt="${safeTitle}" class="lazy-cover" style="width:100%;height:100%;object-fit:cover;" onerror="if(window.app.src&&!window.app.src.startsWith('data:')){window.app.outerHTML='<div style=\\'width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.5rem;color:#86efac;font-size:0.85rem;font-weight:500;background:#0f3d21;text-align:center;padding:1rem;\\'><i data-feather=\\'image\\' style=\\'width:40px;height:40px;opacity:0.5;\\'></i><span>Không có bìa</span></div>'}">`
                : `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.5rem;color:#86efac;font-size:0.85rem;font-weight:500;background:#0f3d21;text-align:center;padding:1rem;">
                       <i data-feather="image" style="width:40px;height:40px;opacity:0.5;"></i>
                       <span>Không có bìa</span>
                   </div>`;

            const percentColor = sg.percent < 100 ? '#ea580c' : 'var(--primary)';
            const percentBg = sg.percent < 100 ? '#ffedd5' : 'var(--border)';
            const card = document.createElement('div');
            card.className = 'series-card';
            card.onclick = () => window.app.openSeriesDetail(sg.title);
            card.innerHTML = `
                <div class="series-cover">
                    ${coverHtml}
                </div>
                <div class="series-info">
                    <h3 class="series-title" title="${escapeHTML(sg.title)}">${escapeHTML(sg.title)}</h3>
                    <div class="series-meta">
                        <span><i data-feather="book" style="width:12px;height:12px;margin-right:4px;"></i>${sg.count}/${sg.total} tập</span>
                        <span class="progress-badge" style="font-weight:700; color:${percentColor}; background:${percentBg}; padding:0.15rem 0.5rem; border-radius:99px; font-size:0.75rem;">${sg.percent}%</span>
                    </div>
                </div>
            `;
            grid.appendChild(card);

            // Đăng ký lazy-load cho ảnh bìa của card này
            if (hasCover) {
                const imgEl = card.querySelector('.lazy-cover');
                if (imgEl) window.app._dashboardImgObserver.observe(imgEl);
            }
        });
        if (window.feather) { try { feather.replace(); } catch (e) { console.warn('Feather error:', e); } }
    }

export function toggleViewMode() {
        store.viewMode = store.viewMode === 'grid' ? 'list' : 'grid';
        localStorage.setItem('viewMode', store.viewMode);
        window.app._dashboardPage = 1; // Reset về trang 1 khi đổi view mode
        window.app.renderDashboard();
    }

export function toggleDetailViewMode() {
        store.detailViewMode = store.detailViewMode === 'grid' ? 'list' : 'grid';
        localStorage.setItem('detailViewMode', store.detailViewMode);
        window.app.renderSeriesDetail(store.currentSeries);
    }

export function toggleCustomDropdown(id) {
        // Close others first
        document.querySelectorAll('.custom-select-container .user-dropdown').forEach(d => {
            if (d.id !== id) d.classList.add('hidden');
        });
        const menu = document.getElementById(id);
        if (menu) menu.classList.toggle('hidden');
    }

export function setFilter(value, label) {
        document.getElementById('filter-status').value = value;
        document.getElementById('filter-status-label').textContent = label;
        document.getElementById('filter-dropdown').classList.add('hidden');
        window.app._dashboardPage = 1; // Reset về trang 1 khi đổi filter
        window.app.renderDashboard();
    }

export function setSort(value, label) {
        document.getElementById('sort-order').value = value;
        document.getElementById('sort-order-label').textContent = label;
        document.getElementById('sort-dropdown').classList.add('hidden');
        localStorage.setItem('defaultSort', value);
        window.app._dashboardPage = 1; // Reset về trang 1 khi đổi sắp xếp
        window.app.renderDashboard();
    }

export function openSeriesDetail(seriesName) {
        if (!seriesName) return;
        window.app.navigateTo('/series/' + encodeURIComponent(seriesName));
    }

export function renderSeriesDetail(seriesName, page = 1) {
        if (typeof page !== 'number') page = 1;
        store.currentSeries = seriesName;
        // Bảo vệ XSS: sử dụng textContent thay vì innerHTML
        document.getElementById('detail-series-title').textContent = seriesName;

        const specialKeywords = /bản đặc biệt|đặc biệt|giới hạn|sưu tầm|collector|limited|special/i;
        const isSpecial = (title) => specialKeywords.test(title || '');

        const allVolumes = store.data
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

        let total = Math.max(owned, Math.ceil(maxVol));
        if (store.seriesMetadata && store.seriesMetadata[seriesName] && store.seriesMetadata[seriesName].total_volumes > 0) {
            total = Math.max(total, store.seriesMetadata[seriesName].total_volumes);
        }
        if (store.userSeriesSettings && store.userSeriesSettings[seriesName] && store.userSeriesSettings[seriesName].target_volumes > 0) {
            total = Math.max(owned, store.userSeriesSettings[seriesName].target_volumes);
        }
        const percent = total > 0 ? Math.round((owned / total) * 100) : 0;

        // Escape title for string argument
        const safeSeriesName = seriesName.replace(/'/g, "\\'");
        const badgeEl = document.getElementById('detail-volume-count');
        badgeEl.textContent = `Sở hữu ${owned}/${total} tập (${percent}%)`;

        if (percent >= 100) {
            badgeEl.style.background = 'var(--primary)';
            badgeEl.style.color = '#fff';
            badgeEl.style.border = '1px solid var(--primary)';
        } else {
            const orangeColor = 'rgba(234, 88, 12, 0.25)'; // Màu cam nhạt
            const emptyColor = 'var(--surface)'; // Dùng màu nền mờ nhạt
            badgeEl.style.background = `linear-gradient(to right, ${orangeColor} ${percent}%, ${emptyColor} ${percent}%)`;
            badgeEl.style.color = 'var(--text-main)';
            badgeEl.style.border = '1px solid var(--border)';
        }

        const btnEditTarget = document.getElementById('btn-edit-target');
        if (btnEditTarget) {
            btnEditTarget.onclick = () => app.editSeriesTarget(seriesName);
        }

        if (!store.detailViewMode) store.detailViewMode = localStorage.getItem('detailViewMode') || 'grid';

        const list = document.getElementById('volumes-list');
        list.className = store.detailViewMode === 'list' ? 'detail-grid list-view' : 'detail-grid';

        const icon = document.getElementById('icon-detail-view-mode');
        if (icon) icon.setAttribute('data-feather', store.detailViewMode === 'list' ? 'grid' : 'list');

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
            const editionBadge = window.app.getEditionBadge(v.title);

            const item = document.createElement('div');
            item.className = 'volume-card';
            item.innerHTML = `
                <div class="vol-cover" onclick="app.showModal('${v.id}')">
                    ${coverHtml}
                </div>
                <div class="vol-info">
                    <div class="vol-top">
                        <div style="display:flex; align-items:center;">
                            <h4 class="vol-title">Tập ${escapeHTML(v.volume)}</h4>
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
                    ${v.note ? `<div class="vol-note-italic" onclick="app.showModal('${v.id}')">${escapeHTML(v.note)}</div>` : `<div onclick="app.showModal('${v.id}')" style="height:1.2rem"></div>`}
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
                    <button class="btn btn-outline" style="padding: 0.5rem 1rem;" onclick="app.renderSeriesDetail('${safeSeriesName}', ${page - 1})" ${page <= 1 ? 'disabled' : ''}>
                        <i data-feather="chevron-left"></i> Trước
                    </button>
                    <span style="color:var(--text-main); font-weight:500;">Trang ${page} / ${totalPages}</span>
                    <button class="btn btn-outline" style="padding: 0.5rem 1rem;" onclick="app.renderSeriesDetail('${safeSeriesName}', ${page + 1})" ${page >= totalPages ? 'disabled' : ''}>
                        Sau <i data-feather="chevron-right"></i>
                    </button>
                `;
            } else {
                pagination.innerHTML = '';
            }
        }

        window.app.showView('detail');
        if (window.feather) { try { feather.replace(); } catch (e) { console.warn('Feather error:', e); } }
    }

export async function editSeriesTarget(seriesName) {
        if (!store.user) {
            window.app.showToast('Bạn cần đăng nhập để thiết lập mục tiêu cá nhân!', 'error');
            return;
        }

        let currentTarget = 0;
        if (store.userSeriesSettings && store.userSeriesSettings[seriesName]) {
            currentTarget = store.userSeriesSettings[seriesName].target_volumes || 0;
        }

        const input = prompt(`Thiết lập tổng số tập mục tiêu cá nhân cho bộ "${seriesName}"\n\n(Nhập 0 để sử dụng số tập mặc định của Kho hệ thống)`, currentTarget);
        if (input === null) return;

        const targetVol = parseInt(input);
        if (isNaN(targetVol) || targetVol < 0) {
            window.app.showToast('Vui lòng nhập một số hợp lệ!', 'error');
            return;
        }

        // --- Optimistic UI Update ---
        if (!store.userSeriesSettings) store.userSeriesSettings = {};
        store.userSeriesSettings[seriesName] = {
            user_id: store.user.id,
            series: seriesName,
            target_volumes: targetVol
        };

        // Cập nhật giao diện ngay lập tức
        const isDetailView = document.getElementById('view-detail').classList.contains('active');
        if (isDetailView && store.currentSeries === seriesName) {
            window.app.renderSeriesDetail(seriesName);
        } else {
            window.app.navigateTo('/');
        }

        // --- Đẩy vào Hàng đợi đồng bộ ---
        window.app.queueTask('UPSERT_TARGET', {
            user_id: store.user.id,
            series: seriesName,
            target_volumes: targetVol,
            updated_at: new Date().toISOString()
        });
    }

export function getEditionBadge(title) {
        if (!title) return '';
        const t = title.toLowerCase();
        if (t.includes('sưu tầm') || t.includes('collector')) return `<span class="edition-badge badge-collector">Sưu Tầm</span>`;
        if (t.includes('giới hạn') || t.includes('limited')) return `<span class="edition-badge badge-limited">Giới Hạn</span>`;
        if (t.includes('đặc biệt') || t.includes('special')) return `<span class="edition-badge badge-special">Đặc Biệt</span>`;
        return '';
    }

export function toggleDots(e, id) {
        e.stopPropagation();
        document.querySelectorAll('.kebab-menu').forEach(m => {
            if (m.id !== `menu-${id}`) m.classList.add('hidden');
        });
        const menu = document.getElementById(`menu-${id}`);
        if (menu) menu.classList.toggle('hidden');
    }