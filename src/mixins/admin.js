import { store } from '../store.js';
import { supabase } from '../supabase-client.js';
import { escapeHTML } from '../utils/security.js';

export async function submitPendingBook(mangaData) {
        if (!store.user) return;
        try {
            await supabase.from('pending_catalog').insert({
                submitted_by: store.user.id,
                submitted_name: store.user.user_metadata?.name || store.user.email,
                submitted_email: store.user.email,
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
        } catch (e) { console.error('Failed to submit pending', e); }
    }

export function loadAdminPanel() {
        if (!store.user || !store.isAdmin) {
            window.app.showToast('Bạn không có quyền truy cập', 'error');
            return;
        }
        window.app.navigateTo('/admin/pending');
    }

export async function fetchPendingBooks(retryCount = 0) {
        const controller = new AbortController();
        const timeout = ms => new Promise((_, reject) => setTimeout(() => { controller.abort(); reject(new Error('Timeout')); }, ms));
        try {
            const { data, error } = await Promise.race([
                supabase.rpc('get_all_pending').abortSignal(controller.signal),
                timeout(15000)
            ]);
            if (error) throw error;
            const rejectedIds = new Set(store.pendingRejectedIds || []);
            const list = data.filter(p => !rejectedIds.has(p.id)).map(p => ({
                ...p,
                coverUrl: p.cover_url,
                giftUrls: p.gift_urls,
                publishDate: p.publish_date,
                scannedIsbn: p.scanned_isbn,
                submittedName: p.submitted_name
            }));
            store.adminCache = list;
            window.app.renderPendingList(list);

            const badge = document.getElementById('nav-admin-badge');
            if (badge) {
                badge.textContent = list.length;
                badge.style.display = list.length > 0 ? 'inline-block' : 'none';
            }
        } catch (e) {
            if (e.name === 'AbortError') return;
            if (retryCount < 1 && e.message === 'Timeout') {
                console.warn('[fetchPendingBooks] Yêu cầu bị kẹt, tự động thử lại...');
                return window.app.fetchPendingBooks(retryCount + 1);
            }
            console.error('Lỗi tải danh sách Pending:', e);
        }
    }

export async function checkDuplicate(pendingBook, retryCount = 0) {
        const controller = new AbortController();
        const timeout = ms => new Promise((_, reject) => setTimeout(() => { controller.abort(); reject(new Error('Timeout')); }, ms));
        try {
            const { data, error } = await Promise.race([
                supabase.from('catalog').select('*')
                    .ilike('series', pendingBook.series)
                    .ilike('title', pendingBook.title)
                    .eq('volume', pendingBook.volume || 0)
                    .abortSignal(controller.signal),
                timeout(10000)
            ]);
            if (error) throw error;
            return data || [];
        } catch (e) {
            if (e.name === 'AbortError') return [];
            if (retryCount < 1 && e.message === 'Timeout') {
                console.warn('[checkDuplicate] Bị kẹt, tự động thử lại...');
                return window.app.checkDuplicate(pendingBook, retryCount + 1);
            }
            return [];
        }
    }

export async function renderPendingList(list) {
        const container = document.getElementById('admin-pending-list');
        if (!container) return;
        container.innerHTML = '';
        if (list.length === 0) {
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
                ? `<span class="pending-isbn-badge">ISBN</span>`
                : '';

            const editionBadge = window.app.getEditionBadge(p.title);
            const badgeStack = (cameraBadge || editionBadge)
                ? `<div class="pending-badge-stack">${cameraBadge}${editionBadge}</div>`
                : '';

            item.innerHTML = `
                <div class="vol-cover" onclick="app.openPendingModal('${p.id}')">
                    ${coverHtml}
                    ${badgeStack}
                </div>
                <div class="vol-info" style="padding:0.5rem 0.65rem 0.6rem;">
                    <h4 style="font-size:1rem; font-weight:600; color:var(--card-text); margin:0 0 0.25rem 0; line-height:1.3;
                                display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
                                cursor:pointer;"
                        onclick="app.openPendingModal('${p.id}')"
                        title="${escapeHTML(p.series || p.title)}">${escapeHTML(p.series || p.title)}</h4>
                    <div style="font-size:0.8rem; color:var(--card-note); font-weight:500;" onclick="app.openPendingModal('${p.id}')">Tập ${escapeHTML(String(p.volume))}</div>
                </div>
            `;
            container.appendChild(item);
        });

        if (window.feather) { try { feather.replace(); } catch (e) { console.warn('Feather error:', e); } }
    }

export async function openPendingModal(id) {
        const p = store.adminCache.find(x => x.id === id);
        if (!p) return;

        window.app._pendingActiveId = id;
        const title = document.getElementById('pending-modal-title');
        // Dùng dấu "-" thống nhất thay vì "—" để tránh thừa khi series đã có "-"
        const seriesLabel = (p.series || '').trim();
        if (title) title.textContent = seriesLabel ? `${seriesLabel} - Tập ${p.volume}` : `Tập ${p.volume}`;

        const modalBody = document.getElementById('pending-modal-body');
        modalBody.innerHTML = '<div style="text-align:center; padding:3rem;"><i data-feather="loader" class="spin" style="width:32px;height:32px;"></i></div>';
        const modal = document.getElementById('pending-modal');
        modal.classList.remove('hidden');
        modal.classList.add('show');
        if (window.feather) { try { feather.replace(); } catch (e) { console.warn('Feather error:', e); } }

        // Fix: Render ngay lập tức để không bị block UI
        const coverUrl = p.coverUrl || '';

        // Danh sách tất cả sách trong kho cho chức năng Gộp
        const datalistOptions = store.data.map(m => `<option value="${m.id}">${m.series} — ${m.title} (Tập ${m.volume || 0})</option>`).join('');

        modalBody.innerHTML = `
            <div id="duplicate-container-${p.id}"></div>
            <div class="form-grid" style="display:flex; gap:2rem; align-items:flex-start;">

                <!-- Cột TRÁI: Form chỉnh sửa -->
                <div class="form-cols" style="flex: 1.5; min-width:0;">
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
                            <input type="number" id="edit-volume-${p.id}" class="input-ctrl" value="${p.volume || ''}" min="0" max="10000" step="0.5" onkeydown="if(event.key==='-') event.preventDefault();" oninvalid="window.app.setCustomValidity('Vui lòng nhập Tập số hợp lệ')" oninput="window.app.setCustomValidity('')">
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
                            <input type="number" id="edit-pages-${p.id}" class="input-ctrl" value="${p.pages || ''}" min="1" max="100000" onkeydown="if(event.key==='-') event.preventDefault();" oninvalid="window.app.setCustomValidity('Số trang phải từ 1 trở lên')" oninput="window.app.setCustomValidity('')">
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
                            <input type="number" id="edit-price-${p.id}" class="input-ctrl" value="${p.price || ''}" min="0" max="2000000000" onkeydown="if(event.key==='-') event.preventDefault();" oninvalid="window.app.setCustomValidity('Giá bìa không được vượt quá 2 tỷ')" oninput="window.app.setCustomValidity('')">
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
                <div class="form-cols cover-col" style="flex: 1;">
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
                                    oninput="app.previewImage(window.app.value, 'cover', 'pending-')">
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

        if (window.feather) { try { feather.replace(); } catch (e) { console.warn('Feather error:', e); } }

        // Khởi tạo hiển thị ảnh bìa và quà tặng
        window.app.previewImage(coverUrl, 'cover', 'pending-');
        if (p.giftUrls && p.giftUrls.length > 0) {
            window.app.renderGiftThumbnails('pending-');
            window.app.previewGiftImage(p.giftUrls[p.giftUrls.length - 1], 'pending-');
        } else {
            window.app.previewGiftImage('', 'pending-');
        }

        // Asynchronously check for duplicates AFTER rendering the modal
        window.app.checkDuplicate(p).then(duplicates => {
            if (window.app._pendingActiveId !== p.id) return; // Modal changed
            if (duplicates && duplicates.length > 0) {
                const dupContainer = document.getElementById(`duplicate-container-${p.id}`);
                if (dupContainer) {
                    dupContainer.innerHTML = `<div class="duplicate-warning" style="margin-bottom:1.5rem; background: rgba(245, 158, 11, 0.1); border: 1px solid #f59e0b; padding: 1rem; border-radius: 10px;">
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
                    if (window.feather) { try { feather.replace(); } catch (e) { console.warn('Feather error:', e); } }
                }
            }
        }).catch(e => console.warn('Lỗi check trùng lặp:', e));
    }

export function _runAdminApprove() {
        const id = window.app._pendingActiveId;
        if (id) window.app.adminApprove(id);
    }

export function _runAdminReject() {
        const id = window.app._pendingActiveId;
        if (id) window.app.adminReject(id);
    }

export function closePendingModal() {
        const modal = document.getElementById('pending-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('show');
        }
        window.app._pendingActiveId = null;
    }

export function _removePendingFromUI(id) {
        if (!store.adminCache) return;
        store.adminCache = store.adminCache.filter(x => x.id !== id);
        window.app.renderPendingList(store.adminCache);
        const badge = document.getElementById('nav-admin-badge');
        if (badge) {
            badge.textContent = store.adminCache.length;
            badge.style.display = store.adminCache.length > 0 ? 'inline-block' : 'none';
        }
    }

export async function _updatePendingDataBeforeAction(id) {
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
    }

export async function adminApprove(id) {
        if (!confirm('Duyệt và thêm sách này vào kho chung?')) return;
        window.app.showLoading('Đang xử lý...');
        try {
            const payload = await window.app._updatePendingDataBeforeAction(id);
            const { error: rpcErr } = await supabase.rpc('admin_approve_pending', {
                pending_id: id,
                updated_data: payload
            });
            if (rpcErr) throw rpcErr;

            window.app.showToast('Đã duyệt và thêm vào kho!');
            window.app.closePendingModal();
            window.app._removePendingFromUI(id);
            store.fullCatalogCache = null;
        } catch (e) {
            console.error(e);
            window.app.showToast('Lỗi khi duyệt sách!', 'error');
        } finally {
            window.app.hideLoading();
        }
    }

export async function adminReject(id) {
        if (!confirm('Từ chối và xóa bản ghi này?')) return;
        window.app._rememberPendingRejectedId(id);
        window.app.closePendingModal();
        window.app._removePendingFromUI(id);
        window.app.queueTask('ADMIN_REJECT_PENDING', { id, reason: null }, null, {
            message: 'Đã từ chối trên giao diện. Đang đồng bộ ngầm...',
            nonBlocking: false
        });
    }

export async function quickMerge(pendingId, catalogId) {
        if (!confirm('Gộp ISBN vào bản ghi có sẵn này?')) return;
        window.app.showLoading('Đang gộp...');
        try {
            // Sử dụng RPC admin_merge_isbn để tránh lỗi RLS khi update trực tiếp bảng catalog
            const { error: rpcErr } = await supabase.rpc('admin_merge_isbn', {
                pending_id: pendingId,
                target_catalog_id: catalogId
            });
            if (rpcErr) throw rpcErr;

            window.app.showToast('Đã gộp ISBN thành công!');
            window.app.closePendingModal();
            window.app._removePendingFromUI(pendingId);
        } catch (e) {
            console.error(e);
            window.app.showToast('Lỗi khi gộp!', 'error');
        } finally {
            window.app.hideLoading();
        }
    }

export async function adminMerge(pendingId) {
        const inputVal = document.getElementById('merge-search-input').value;
        if (!inputVal) {
            window.app.showToast('Vui lòng chọn hoặc nhập ID của sách để gộp!', 'error');
            return;
        }
        window.app.quickMerge(pendingId, inputVal);
    }

export function showFeedbackModal() {
        const modal = document.getElementById('feedback-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('show');
            document.getElementById('fb-title').value = '';
            document.getElementById('fb-content').value = '';
        }
    }

export function closeFeedbackModal() {
        const modal = document.getElementById('feedback-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('show');
        }
    }

export function submitFeedback() {
        const title = document.getElementById('fb-title').value.trim();
        const body = document.getElementById('fb-content').value.trim();

        if (!body) {
            window.app.showToast('Vui lòng nhập nội dung góp ý!', 'error');
            return;
        }

        const content = title ? `[${title}]\n${body}` : body;

        const payload = {
            user_id: store.user ? store.user.id : null,
            user_name: store.user ? store.user.user_metadata?.full_name : 'Khách',
            user_email: store.user ? store.user.email : '',
            content: content
        };

        // Đóng modal ngay — queue sync ngầm (giống pattern Thêm sách)
        window.app.closeFeedbackModal();
        window.app.queueTask('INSERT_FEEDBACK', payload, null, {
            message: 'Cảm ơn bạn đã góp ý! 🎉',
            nonBlocking: true,  // Không chặn hàng đợi nếu gửi góp ý thất bại
            silent: false
        });
    }

export function switchAdminTab(tabId) {
        document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.admin-tab-content').forEach(c => {
            c.classList.remove('active');
            c.classList.add('hidden');
        });

        document.getElementById(`tab-btn-${tabId}`).classList.add('active');
        const container = document.getElementById(`admin-${tabId}-container`);
        container.classList.remove('hidden');
        container.classList.add('active');

        // Reset catalog views & tabs when switching tabs
        const mainView = document.getElementById('admin-catalog-main-view');
        const detailView = document.getElementById('admin-series-detail-view');
        const adminTabs = document.querySelector('.admin-tabs');
        if (mainView) mainView.classList.remove('hidden');
        if (detailView) detailView.classList.add('hidden');
        if (adminTabs) adminTabs.style.display = '';

        if (tabId === 'feedback') window.app.fetchAdminFeedback();
        else if (tabId === 'pending') window.app.fetchPendingBooks();
        else if (tabId === 'catalog') window.app.searchAdminCatalog(1); // Auto load all when switching tab
        else if (tabId === 'schedule') window.app.adminScheduleLoad();
    }

export function onAdminCatalogSearchInput(value) {
        clearTimeout(window.app._adminSearchTimeout);
        window.app._adminSearchTimeout = setTimeout(() => {
            window.app.searchAdminCatalog(1);
        }, 300);
    }

export async function searchAdminCatalog(page = 1) {
        if (typeof page !== 'number') page = 1;

        const input = document.getElementById('admin-catalog-search');
        if (!input) return;
        const query = input.value.trim().toLowerCase();

        const container = document.getElementById('admin-catalog-list');
        const pagination = document.getElementById('admin-catalog-pagination');

        if (!store.fullCatalogCache) {
            window.app.renderSeriesSkeletons('admin-catalog-list', true);
            if (pagination) pagination.innerHTML = '';

            let fullData = null;
            let lastError = null;

            for (let i = 0; i < 3; i++) {
                try {
                    const controller = new AbortController();
                    // Lưu controller để có thể abort từ bên ngoài khi chuyển tab
                    window.app._catalogFetchController = controller;

                    // Dùng AbortSignal.timeout thay vì setTimeout để không bị browser throttle khi ẩn tab
                    const timeoutMs = i === 0 ? 15000 : (i === 1 ? 20000 : 25000);
                    let timeoutId;
                    const timeoutPromise = new Promise((_, reject) => {
                        timeoutId = setTimeout(() => {
                            controller.abort();
                            reject(new Error('Timeout'));
                        }, timeoutMs);
                    });

                    const { data, error } = await Promise.race([
                        supabase.from('catalog').select('*')
                            .limit(10000).order('series', { ascending: true }).order('volume', { ascending: true })
                            .abortSignal(controller.signal),
                        timeoutPromise
                    ]);
                    clearTimeout(timeoutId);

                    // Nếu bị abort do chuyển tab → dừng hẳn, không retry
                    if (controller.signal.aborted && window.app._catalogFetchController !== controller) {
                        return; // Tab bị ẩn đã hủy fetch này, thoát yên tĩnh
                    }

                    if (error) throw error;
                    fullData = data;
                    window.app._catalogFetchController = null;
                    break;
                } catch (e) {
                    lastError = e;
                    // Nếu bị abort do chuyển tab → dừng hẳn
                    if (e.name === 'AbortError' && !window.app._catalogFetchController) return;
                    console.warn(`Lần thử tải Kho chung thứ ${i + 1} thất bại:`, e);
                    if (i < 2) await new Promise(r => setTimeout(r, 1500));
                }
            }

            if (!fullData) {
                console.error('Lỗi tìm kiếm catalog sau 3 lần thử:', lastError);
                container.innerHTML = '<p style="text-align:center; color:var(--danger); padding:2rem; grid-column:1/-1;">Lỗi khi tải dữ liệu từ Kho chung. Xin hãy F5 tải lại trang.</p>';
                return;
            }
            store.fullCatalogCache = fullData;
        }

        let matchedItems = store.fullCatalogCache;
        if (query.length > 0) {
            const queryWords = query.split(/[\s\-]+/).filter(Boolean);

            matchedItems = store.fullCatalogCache.filter(c => {
                const cIsbnStr = c.isbns ? c.isbns.join('').replace(/[\s\-]/g, '') : '';
                const qIsbnStr = query.replace(/[\s\-]/g, '');
                const matchIsbn = cIsbnStr && qIsbnStr.length >= 6 && cIsbnStr.includes(qIsbnStr);

                const searchable = `${c.title || ''} ${c.series || ''} ${c.volume ? 'tập ' + c.volume : ''} ${c.author || ''} ${c.translator || ''}`.toLowerCase();
                const matchText = queryWords.length > 0 && queryWords.every(w => searchable.includes(w));

                return matchText || matchIsbn;
            });
        }

        // ─── CHẾ ĐỘ HIỂN THỊ THÔNG MINH ──────────────────────────────────────
        // Nếu query chứa chỉ định tập cụ thể ("tập N", "vol N") HOẶC kết quả ít
        // → hiển thị từng cuốn trực tiếp thay vì nhóm theo series
        const hasVolumeQuery = query.length > 0 && /tập\s*\d|vol\.?\s*\d|volume\s*\d|\bt\s*\d+\b/i.test(query);
        const isSmallResultSet = query.length > 0 && matchedItems.length > 0 && matchedItems.length <= 15;
        const showIndividualVolumes = hasVolumeQuery || isSmallResultSet;

        if (showIndividualVolumes) {
            // --- HIỂN THỊ TỪNG TẬP RIÊNG LẺ ---
            const sorted = [...matchedItems].sort((a, b) => {
                const sc = (a.series || '').localeCompare(b.series || '');
                return sc !== 0 ? sc : (a.volume || 0) - (b.volume || 0);
            });
            const count = sorted.length;
            const limit = 50;
            const start = (page - 1) * limit;
            const pagedItems = sorted.slice(start, start + limit);
            window.app._renderCatalogVolumeResults(pagedItems, count, page);
            return;
        }

        // --- GROUP BY SERIES (mặc định) ---
        const seriesMap = new Map();
        matchedItems.forEach(c => {
            const sName = (c.series || 'Chưa phân loại').trim();
            if (!seriesMap.has(sName)) {
                seriesMap.set(sName, { series: sName, count: 0, cover: c.cover_url });
            }
            const g = seriesMap.get(sName);
            g.count++;
            if (!g.cover && c.cover_url) g.cover = c.cover_url; // Lấy cover đầu tiên có
        });

        // Chuyển Map thành mảng và sắp xếp theo tên Series
        const groupedSeries = Array.from(seriesMap.values()).sort((a, b) => a.series.localeCompare(b.series));

        const count = groupedSeries.length;
        const limit = 50; // Hiện 50 series mỗi trang
        const start = (page - 1) * limit;
        const pagedData = groupedSeries.slice(start, start + limit);

        store.adminCatalogCache = pagedData; // Lưu cache mảng group
        window.app.renderAdminCatalogList(pagedData, count, page);
    }

export function _renderCatalogVolumeResults(list, count = 0, page = 1) {
        const container = document.getElementById('admin-catalog-list');
        const pagination = document.getElementById('admin-catalog-pagination');
        if (!container) return;
        container.innerHTML = '';
        if (pagination) pagination.innerHTML = '';

        if (list.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:2rem; grid-column:1/-1;">Không tìm thấy bản ghi nào khớp.</p>';
            return;
        }

        container.style.columns = '2';
        container.style.columnGap = '1.5rem';

        list.forEach(c => {
            const editionBadge = window.app.getEditionBadge ? window.app.getEditionBadge(c.title) : '';
            const item = document.createElement('div');
            item.className = 'catalog-list-item';
            item.style.cssText = 'break-inside:avoid; margin-bottom:0.75rem; padding:0.65rem 0.75rem; border:1px solid var(--border); border-radius:8px; background:var(--surface); cursor:pointer; display:flex; align-items:center; justify-content:space-between;';
            item.onclick = () => window.app.openCatalogModal(c.id);

            const coverHtml = (c.cover_url && c.cover_url.trim())
                ? `<img src="${c.cover_url}" alt="Cover" style="width:32px;height:45px;object-fit:cover;border-radius:4px;flex-shrink:0;border:1px solid var(--border);">`
                : `<div style="width:32px;height:45px;border-radius:4px;flex-shrink:0;background:var(--bg-lighter);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;"><i data-feather="image" style="width:14px;height:14px;opacity:0.4;"></i></div>`;

            item.innerHTML = `
                <div style="flex:1;min-width:0;display:flex;align-items:center;gap:0.75rem;">
                    ${coverHtml}
                    <div style="display:flex;flex-direction:column;justify-content:center;min-width:0;">
                        <span style="color:var(--text-main);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:0.9rem;">${c.series || ''}</span>
                        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:1px;">Tập ${c.volume || 0}${c.title && c.title !== c.series ? ' · ' + c.title : ''}</div>
                        ${editionBadge ? `<div style="margin-top:0.2rem;">${editionBadge}</div>` : ''}
                    </div>
                </div>
                <i data-feather="edit-2" style="width:15px;height:15px;color:var(--text-muted);flex-shrink:0;margin-left:0.5rem;"></i>
            `;
            container.appendChild(item);
        });
        if (window.feather) { try { feather.replace(); } catch (e) { } }

        if (pagination && count > 50) {
            const totalPages = Math.ceil(count / 50);
            pagination.innerHTML = `
                <button class="btn btn-outline" style="padding:0.5rem 1rem;" onclick="app.searchAdminCatalog(${page - 1})" ${page <= 1 ? 'disabled' : ''}>
                    <i data-feather="chevron-left"></i> Trước
                </button>
                <span style="color:var(--text-main);font-weight:500;">Trang ${page} / ${totalPages}</span>
                <button class="btn btn-outline" style="padding:0.5rem 1rem;" onclick="app.searchAdminCatalog(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>
                    Sau <i data-feather="chevron-right"></i>
                </button>
            `;
            if (window.feather) { try { feather.replace(); } catch (e) { } }
        }
    }

export function renderAdminCatalogList(list, count = 0, page = 1) {
        const container = document.getElementById('admin-catalog-list');
        const pagination = document.getElementById('admin-catalog-pagination');
        if (!container) return;
        container.innerHTML = '';
        if (pagination) pagination.innerHTML = '';

        if (list.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:2rem; grid-column:1/-1;">Không tìm thấy bản ghi nào khớp với từ khóa.</p>';
            return;
        }

        container.style.columns = '2';
        container.style.columnGap = '1.5rem';

        list.forEach(g => {
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
            item.onclick = () => window.app.openAdminSeriesDetail(g.series);

            const coverHtml = (g.cover && g.cover.trim() !== '')
                ? `<img src="${g.cover}" alt="Cover" style="width:36px;height:50px;object-fit:cover;border-radius:4px;flex-shrink:0;border:1px solid var(--border);">`
                : `<div style="width:36px;height:50px;border-radius:4px;flex-shrink:0;background:var(--bg-lighter);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;"><i data-feather="image" style="width:16px;height:16px;opacity:0.5;"></i></div>`;

            item.innerHTML = `
                <div style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:0.75rem;">
                    ${coverHtml}
                    <div style="display:flex; flex-direction:column; justify-content:center; overflow:hidden;">
                        <span style="color:var(--text-main); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size: 0.95rem;">${g.series}</span>
                        <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">${g.count} cuốn trong kho</div>
                    </div>
                </div>
                <i data-feather="chevron-right" style="width:18px;height:18px; color:var(--text-muted); flex-shrink:0; margin-left:0.5rem;"></i>
            `;
            container.appendChild(item);
        });
        if (window.feather) { try { feather.replace(); } catch (e) { console.warn('Feather error:', e); } }

        if (pagination && count > 0) {
            const limit = 50;
            const totalPages = Math.ceil(count / limit);
            pagination.innerHTML = `
                <button class="btn btn-outline" style="padding: 0.5rem 1rem;" onclick="app.searchAdminCatalog(${page - 1})" ${page <= 1 ? 'disabled' : ''}>
                    <i data-feather="chevron-left"></i> Trước
                </button>
                <span style="color:var(--text-main); font-weight:500;">Trang ${page} / ${totalPages}</span>
                <button class="btn btn-outline" style="padding: 0.5rem 1rem;" onclick="app.searchAdminCatalog(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>
                    Sau <i data-feather="chevron-right"></i>
                </button>
            `;
            if (window.feather) { try { feather.replace(); } catch (e) { console.warn('Feather error:', e); } }
        }
    }

export function openAdminSeriesDetail(seriesName) {
        if (!seriesName || seriesName === 'Chưa phân loại') return;
        window.app.navigateTo('/admin/series/' + encodeURIComponent(seriesName));
    }

export async function renderAdminSeriesDetail(seriesName, page = 1) {
        if (!seriesName || seriesName === 'Chưa phân loại') return;

        // Lưu current series để save sau này
        window.app._adminCurrentSeries = seriesName;

        // Chuyển UI
        const mainView = document.getElementById('admin-catalog-main-view');
        const detailView = document.getElementById('admin-series-detail-view');
        if (mainView) mainView.classList.add('hidden');
        if (detailView) detailView.classList.remove('hidden');

        // Ẩn admin-tabs khi xem series detail
        const adminTabs = document.querySelector('.admin-tabs');
        if (adminTabs) adminTabs.style.display = 'none';

        // Bảo vệ XSS: sử dụng textContent
        document.getElementById('admin-series-detail-title').textContent = seriesName;
        const totalInput = document.getElementById('admin-series-total-volumes');
        totalInput.value = '';
        totalInput.placeholder = '';

        const listContainer = document.getElementById('admin-series-volumes-list');
        window.app.renderVolumeSkeletons('admin-series-volumes-list');

        if (window.feather) { try { feather.replace(); } catch (e) { console.warn('Feather error:', e); } }

        // ─── GUARD: fullCatalogCache có thể bị null nếu tab switch giữa chừng ──
        if (!store.fullCatalogCache) {
            if (window.feather) { try { feather.replace(); } catch (e) { } }
            let success = false;
            for (let i = 0; i < 2; i++) {
                try {
                    const controller = new AbortController();
                    const timeoutMs = 15000;
                    let timeoutId;
                    const timeoutPromise = new Promise((_, reject) => {
                        timeoutId = setTimeout(() => {
                            controller.abort();
                            reject(new Error('Timeout'));
                        }, timeoutMs);
                    });

                    const { data, error } = await Promise.race([
                        supabase.from('catalog').select('*')
                            .limit(10000).order('series', { ascending: true }).order('volume', { ascending: true })
                            .abortSignal(controller.signal),
                        timeoutPromise
                    ]);
                    
                    clearTimeout(timeoutId);
                    if (error) throw error;
                    
                    store.fullCatalogCache = data;
                    success = true;
                    break;
                } catch (e) {
                    if (e.name === 'AbortError') return;
                    console.warn(`[Admin Series] Lỗi tải cache lần ${i + 1}:`, e);
                }
            }
            if (!success) {
                listContainer.innerHTML = '<p style="text-align:center; color:var(--danger); padding:2rem; grid-column:1/-1;">Không thể tải dữ liệu. Vui lòng thử lại.</p>';
                totalInput.placeholder = '...';
                return;
            }
        }

        // ─── RENDER VOLUMES NGAY LẬP TỨC từ cache (không await gì cả) ──────────
        // series_metadata được fetch NGẦM sau khi render — không block UI
        try {
            const editionOrder = (title) => {
                const t = (title || '').toLowerCase();
                if (t.includes('sưu tầm') || t.includes('collector')) return 3;
                if (t.includes('giới hạn') || t.includes('limited')) return 2;
                if (t.includes('đặc biệt') || t.includes('special')) return 1;
                return 0;
            };
            const volumes = store.fullCatalogCache.filter(c => c.series === seriesName).sort((a, b) => {
                const volDiff = (a.volume || 0) - (b.volume || 0);
                if (volDiff !== 0) return volDiff;
                // Cùng số tập: thường → đặc biệt → giới hạn → sưu tầm
                return editionOrder(a.title) - editionOrder(b.title);
            });
            const count = volumes.length;
            const maxVolume = volumes.reduce((max, c) => Math.max(max, c.volume || 0), 0);
            totalInput.placeholder = '';
            if (maxVolume > 0) totalInput.value = maxVolume; // Tạm thời điền tập lớn nhất

            const limit = 100;
            const start = (page - 1) * limit;
            const pagedVolumes = volumes.slice(start, start + limit);

            listContainer.innerHTML = '';
            if (volumes.length === 0) {
                listContainer.innerHTML = '<p style="text-align:center; grid-column:1/-1;">Không có sách nào thuộc series này.</p>';
                totalInput.placeholder = '';
                return;
            }

            // Fetch series_metadata ngầm, cập nhật totalInput khi xong (không await)
            supabase.from('series_metadata').select('total_volumes').eq('series', seriesName).maybeSingle()
                .then(({ data }) => {
                    if (data && data.total_volumes) totalInput.value = data.total_volumes;
                }).catch(() => { });

            pagedVolumes.forEach(c => {
                const editionBadge = window.app.getEditionBadge(c.title);
                const item = document.createElement('div');
                item.className = 'catalog-list-item';
                item.style.breakInside = 'avoid';
                item.style.padding = '0.5rem 0.75rem';
                item.style.border = '1px solid var(--border)';
                item.style.borderRadius = '8px';
                item.style.background = 'var(--surface)';
                item.style.cursor = 'pointer';
                item.style.display = 'flex';
                item.style.alignItems = 'center';
                item.style.justifyContent = 'space-between';
                item.onclick = () => window.app.openCatalogModal(c.id);

                const coverHtml = (c.cover_url && c.cover_url.trim() !== '')
                    ? `<img src="${c.cover_url}" alt="Cover" style="width:32px;height:45px;object-fit:cover;border-radius:4px;flex-shrink:0;border:1px solid var(--border);">`
                    : `<div style="width:32px;height:45px;border-radius:4px;flex-shrink:0;background:var(--bg-lighter);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;"><i data-feather="image" style="width:16px;height:16px;opacity:0.5;"></i></div>`;

                item.innerHTML = `
                    <div style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:0.75rem;">
                        ${coverHtml}
                        <div style="display:flex; flex-direction:column; justify-content:center; overflow:hidden;">
                            <span style="color:var(--text-main); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size: 0.95rem;">${c.title || c.series}</span>
                            <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Tập ${c.volume || 0}</div>
                            ${editionBadge ? `<div style="margin-top:0.25rem;">${editionBadge}</div>` : ''}
                        </div>
                    </div>
                    <i data-feather="edit-2" style="width:16px;height:16px; color:var(--text-muted); flex-shrink:0; margin-left:0.5rem;"></i>
                `;
                listContainer.appendChild(item);
            });
            if (window.feather) { try { feather.replace(); } catch (e) { console.warn('Feather error:', e); } }

            // Pagination cho detail
            const pagination = document.getElementById('admin-series-detail-pagination');
            if (pagination) {
                pagination.innerHTML = '';
                if (count > limit) {
                    const totalPages = Math.ceil(count / limit);
                    pagination.innerHTML = `
                        <button class="btn btn-outline" style="padding: 0.5rem 1rem;" onclick="app.renderAdminSeriesDetail('${seriesName.replace(/'/g, "\\'")}', ${page - 1})" ${page <= 1 ? 'disabled' : ''}>
                            <i data-feather="chevron-left"></i> Trước
                        </button>
                        <span style="color:var(--text-main); font-weight:500;">Trang ${page} / ${totalPages}</span>
                        <button class="btn btn-outline" style="padding: 0.5rem 1rem;" onclick="app.renderAdminSeriesDetail('${seriesName.replace(/'/g, "\\'")}', ${page + 1})" ${page >= totalPages ? 'disabled' : ''}>
                            Sau <i data-feather="chevron-right"></i>
                        </button>
                    `;
                    if (window.feather) { try { feather.replace(); } catch (e) { console.warn('Feather error:', e); } }
                }
            }
        } catch (renderErr) {
            console.error('[openAdminSeriesDetail] Lỗi render volumes:', renderErr);
            listContainer.innerHTML = '<p style="text-align:center; color:var(--danger); padding:2rem; grid-column:1/-1;">Đã xảy ra lỗi khi tải danh sách tập. Vui lòng thử lại.</p>';
            totalInput.placeholder = '...';
        }
    }

export function closeAdminSeriesDetail() {
        window.app._adminCurrentSeries = null;
        window.app.navigateTo('/admin/catalog');
    }

export async function saveAdminSeriesMetadata() {
        if (!window.app._adminCurrentSeries) return;
        const totalInput = document.getElementById('admin-series-total-volumes');
        const val = totalInput.value.trim();

        const num = parseFloat(val);
        if (isNaN(num) || num < 0) {
            window.app.showToast('Số tập không hợp lệ!', 'error');
            return;
        }

        window.app.showLoading('Đang lưu thông tin...');
        try {
            const { error } = await supabase.from('series_metadata').upsert({
                series: window.app._adminCurrentSeries,
                total_volumes: num,
                status: 'ongoing',
                updated_at: new Date().toISOString()
            });

            if (error) throw error;
            window.app.showToast(`Đã lưu tổng số tập cho "${window.app._adminCurrentSeries}" thành công!`);
            // Mất focus cái input để tránh Enter liên tục
            totalInput.blur();
        } catch (e) {
            console.error('Lỗi khi lưu series metadata:', e);
            window.app.showToast('Lỗi khi lưu dữ liệu. Vui lòng thử lại.', 'error');
        } finally {
            window.app.hideLoading();
        }
    }

export function openCatalogModal(id) {
        // Must search fullCatalogCache (individual volumes) — adminCatalogCache holds grouped series data (no id)
        const c = store.fullCatalogCache ? store.fullCatalogCache.find(x => x.id === id) : null;
        if (!c) return;

        const modal = document.getElementById('catalog-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('show');
        }

        const title = document.getElementById('catalog-modal-title');
        const seriesLabel = (c.series || '').trim();
        if (title) title.textContent = seriesLabel ? `Sửa: ${seriesLabel} - Tập ${c.volume || 0}` : `Sửa: Tập ${c.volume || 0}`;

        const modalBody = document.getElementById('catalog-modal-body');
        const coverUrl = c.cover_url || '';
        const isbnsText = c.isbns ? c.isbns.join(', ') : '';

        modalBody.innerHTML = `
            <div class="form-grid" style="display:flex; gap:2rem; align-items:flex-start;">
                <!-- Cột TRÁI: Form chỉnh sửa -->
                <div class="form-cols" style="flex: 1.5; min-width:0;">
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
                <div class="form-cols cover-col" style="flex: 1;">
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
                                    oninput="app.previewImage(window.app.value, 'cover', 'cat-')">
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
        if (window.feather) { try { feather.replace(); } catch (e) { console.warn('Feather error:', e); } }

        // Khởi tạo hiển thị ảnh bìa và quà tặng
        window.app.previewImage(coverUrl, 'cover', 'cat-');
        if (c.gift_urls && c.gift_urls.length > 0) {
            window.app.renderGiftThumbnails('cat-');
            window.app.previewGiftImage(c.gift_urls[c.gift_urls.length - 1], 'cat-');
        } else {
            window.app.previewGiftImage('', 'cat-');
        }
    }

export function closeCatalogModal() {
        const modal = document.getElementById('catalog-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('show');
        }
    }

export function adminUpdateCatalog() {
        if (!confirm('Lưu thay đổi vào Kho chung? Dữ liệu này sẽ áp dụng cho tất cả người dùng dùng tính năng Tự động điền.')) return;
        const id = document.getElementById('edit-cat-id').value;
        if (!id) return;

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

        // Cập nhật fullCatalogCache ngay (optimistic) — giống pattern Thêm sách
        if (store.fullCatalogCache) {
            const idx = store.fullCatalogCache.findIndex(c => c.id === id);
            if (idx !== -1) {
                store.fullCatalogCache[idx] = { ...store.fullCatalogCache[idx], ...payload };
            }
        }

        // Đóng modal và refresh list ngay từ cache đã cập nhật
        window.app.closeCatalogModal();
        window.app.searchAdminCatalog();

        // Queue task sync ngầm — không block UI
        window.app.queueTask('ADMIN_UPDATE_CATALOG', { id, data: payload }, null, {
            message: 'Cập nhật Kho chung thành công!',
            nonBlocking: false,
            silent: false
        });
    }

export function adminDeleteCatalog() {
        if (!confirm('Xóa vĩnh viễn sách này khỏi Kho chung? Các sách của người dùng đã thêm sẽ không bị ảnh hưởng, nhưng họ không thể dùng Tự động điền sách này nữa.')) return;
        const id = document.getElementById('edit-cat-id').value;
        if (!id) return;

        // Xóa khỏi fullCatalogCache ngay (optimistic)
        if (store.fullCatalogCache) {
            store.fullCatalogCache = store.fullCatalogCache.filter(c => c.id !== id);
        }

        // Đóng modal, quay lại danh sách series ngay
        window.app.closeCatalogModal();
        window.app.closeAdminSeriesDetail();
        window.app.searchAdminCatalog(1);

        // Queue task sync ngầm — không block UI
        window.app.queueTask('ADMIN_DELETE_CATALOG', { id }, null, {
            message: 'Đã xóa sách khỏi Kho chung!',
            nonBlocking: false,
            silent: false
        });
    }

export async function fetchAdminFeedback(retryCount = 0) {
        const controller = new AbortController();
        const timeout = ms => new Promise((_, reject) => setTimeout(() => { controller.abort(); reject(new Error('Timeout')); }, ms));
        try {
            const { data, error } = await Promise.race([
                supabase.rpc('get_all_feedback').abortSignal(controller.signal),
                timeout(15000)
            ]);
            if (error) throw error;
            const list = (data || []).map(fb => ({
                ...fb,
                userName: fb.user_name,
                userEmail: fb.user_email,
                createdAt: fb.created_at
            }));
            window.app.renderFeedbackList(list);
        } catch (e) {
            if (e.name === 'AbortError') return;
            if (retryCount < 1 && e.message === 'Timeout') {
                console.warn('[fetchAdminFeedback] Yêu cầu bị kẹt, tự động thử lại...');
                return window.app.fetchAdminFeedback(retryCount + 1);
            }
            console.error('Lỗi tải danh sách Góp ý:', e);
        }
    }

export function renderFeedbackList(list) {
        const container = document.getElementById('admin-feedback-list');
        if (!list || list.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:2rem; color:var(--text-muted);">Chưa có góp ý nào từ người dùng.</p>';
            return;
        }

        container.innerHTML = list.map(fb => {
            const safeName = escapeHTML(fb.userName || 'Ẩn danh');
            const safeEmail = escapeHTML(fb.userEmail || '');
            const safeContent = escapeHTML(fb.content || '').replace(/\n/g, '<br>');
            const initials = safeName !== 'Ẩn danh' ? safeName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : '?';
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
                        <span>Trạng thái: <strong>${fb.status === 'new' ? 'Mới' : 'Đã xem'}</strong></span>
                        <div class="fb-date">${new Date(fb.createdAt).toLocaleString('vi-VN')}</div>
                    </div>
                </div>
            `;
        }).join('');
        if (window.feather) { try { feather.replace(); } catch (e) { console.warn('Feather error:', e); } }
    }

export async function deleteFeedback(id) {
        if (!confirm('Xóa góp ý này?')) return;
        const { error } = await supabase.rpc('admin_delete_feedback', { feedback_id: id });
        if (!error) {
            window.app.fetchAdminFeedback();
        } else window.app.showToast('Lỗi khi xóa!', 'error');
    }

// ═══════════════════════════════════════════════════════════════════
// ADMIN: LỊCH PHÁT HÀNH — CRUD Functions
// ═══════════════════════════════════════════════════════════════════

/** Internal state cho Admin schedule tab */
const _adminScheduleState = {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
};

const MONTHS_VI_SHORT = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];

function _adminScheduleUpdateLabel() {
    const el = document.getElementById('admin-schedule-month-label');
    if (el) el.textContent = `Tháng ${_adminScheduleState.month}/${_adminScheduleState.year}`;
}

export function adminScheduleChangeMonth(delta) {
    let m = _adminScheduleState.month + delta;
    let y = _adminScheduleState.year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    _adminScheduleState.month = m;
    _adminScheduleState.year = y;
    _adminScheduleUpdateLabel();
    window.app.adminScheduleLoad();
}

export async function adminScheduleLoad(retryCount = 0) {
    _adminScheduleUpdateLabel();
    const { year, month } = _adminScheduleState;
    const firstDay = `${year}-${String(month).padStart(2,'0')}-01`;
    const lastDay = (() => {
        const d = new Date(year, month, 0);
        return `${year}-${String(month).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    })();

    const list = document.getElementById('admin-release-list');
    if (list && retryCount === 0) list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">Đang tải...</p>';

    const controller = new AbortController();
    const timeout = ms => new Promise((_, reject) => setTimeout(() => { controller.abort(); reject(new Error('Timeout')); }, ms));

    try {
        const { data, error } = await Promise.race([
            supabase.from('release_calendar').select('*')
                .gte('release_date', firstDay)
                .lte('release_date', lastDay)
                .order('release_date', { ascending: true })
                .order('title', { ascending: true })
                .abortSignal(controller.signal),
            timeout(10000)
        ]);

        if (error) throw error;
        window.app.renderAdminReleaseList(data ?? []);
    } catch (err) {
        if (err.name === 'AbortError') return;
        if (retryCount < 1 && err.message === 'Timeout') {
            console.warn('[adminScheduleLoad] Yêu cầu bị kẹt, tự động thử lại...');
            return window.app.adminScheduleLoad(retryCount + 1);
        }
        if (list) list.innerHTML = `<p style="text-align:center;color:var(--danger);padding:2rem;">Lỗi: ${err.message}</p>`;
    }
}

export function renderAdminReleaseList(entries) {
    const list = document.getElementById('admin-release-list');
    if (!list) return;

    if (!entries.length) {
        list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">Chưa có entry nào trong tháng này.</p>';
        return;
    }

    const EDITION_LABELS = { standard: null, special: 'Đặc Biệt', collector: 'Sưu Tầm', limited: 'Giới Hạn' };

    list.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:0.5rem;">
            ${entries.map(e => {
                const edLabel = EDITION_LABELS[e.edition] ?? e.edition;
                const dateStr = e.release_date ? new Date(e.release_date + 'T00:00:00').toLocaleDateString('vi-VN') : '?';
                const volText = e.volume ? ` — Tập ${e.volume % 1 === 0 ? parseInt(e.volume) : e.volume}` : '';
                const priceText = e.price ? ` · ${e.price.toLocaleString('vi-VN')}đ` : '';
                return `
                <div style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem;border:1px solid var(--border);border-radius:8px;background:var(--surface);">
                    ${e.cover_url ? `<img src="${e.cover_url}" alt="" style="width:36px;height:52px;object-fit:cover;border-radius:4px;flex-shrink:0;border:1px solid var(--border);">` : '<div style="width:36px;height:52px;border-radius:4px;background:var(--border);flex-shrink:0;"></div>'}
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.series ? `[${e.series}] ` : ''}${e.title}${volText}</div>
                        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">
                            ${dateStr} · ${e.publisher || '?'}${priceText}
                            ${edLabel ? ` · <span style="color:var(--primary);font-weight:600;">${edLabel}</span>` : ''}
                        </div>
                    </div>
                    <div style="display:flex;gap:0.4rem;flex-shrink:0;">
                        <button class="btn btn-icon" title="Sửa" onclick="app.openAdminReleaseForm('${e.id}')" style="width:32px;height:32px;padding:0;min-width:unset;border:1px solid var(--border);">
                            <i data-feather="edit-2" style="width:14px;height:14px;"></i>
                        </button>
                        <button class="btn btn-icon" title="Xóa" onclick="app.deleteAdminRelease('${e.id}')" style="width:32px;height:32px;padding:0;min-width:unset;border:1px solid var(--border);color:var(--danger);">
                            <i data-feather="trash-2" style="width:14px;height:14px;"></i>
                        </button>
                    </div>
                </div>`;
            }).join('')}
        </div>`;
    if (window.feather) { try { feather.replace(); } catch(e) {} }
}

export function openAdminReleaseForm(id = null) {
    const form = document.getElementById('admin-release-form');
    const titleEl = document.getElementById('admin-release-form-title');
    if (!form) return;

    // Reset form fields
    document.getElementById('admin-release-id').value = id ?? '';
    document.getElementById('admin-release-date').value = '';
    document.getElementById('admin-release-title').value = '';
    document.getElementById('admin-release-series').value = '';
    document.getElementById('admin-release-volume').value = '';
    document.getElementById('admin-release-publisher').value = '';
    document.getElementById('admin-release-price').value = '';
    document.getElementById('admin-release-cover').value = '';
    document.getElementById('admin-release-edition').value = 'standard';
    document.getElementById('admin-release-note').value = '';

    if (id) {
        // Populate from existing data
        titleEl.textContent = 'Sửa entry';
        const { data } = supabase
            .from('release_calendar')
            .select('*')
            .eq('id', id)
            .single()
            .then(({ data }) => {
                if (!data) return;
                document.getElementById('admin-release-date').value = data.release_date ?? '';
                document.getElementById('admin-release-title').value = data.title ?? '';
                document.getElementById('admin-release-series').value = data.series ?? '';
                document.getElementById('admin-release-volume').value = data.volume ?? '';
                document.getElementById('admin-release-publisher').value = data.publisher ?? '';
                document.getElementById('admin-release-price').value = data.price ?? '';
                document.getElementById('admin-release-cover').value = data.cover_url ?? '';
                document.getElementById('admin-release-edition').value = data.edition ?? 'standard';
                document.getElementById('admin-release-note').value = data.note ?? '';
            });
    } else {
        titleEl.textContent = 'Thêm entry mới';
        // Pre-fill date với ngày đầu tháng hiện tại đang xem
        const { year, month } = _adminScheduleState;
        document.getElementById('admin-release-date').value = `${year}-${String(month).padStart(2,'0')}-01`;
    }

    form.classList.remove('hidden');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function closeAdminReleaseForm() {
    const form = document.getElementById('admin-release-form');
    if (form) form.classList.add('hidden');
}

export async function saveAdminRelease() {
    const id = document.getElementById('admin-release-id').value?.trim() || null;
    const release_date = document.getElementById('admin-release-date').value;
    const title = document.getElementById('admin-release-title').value.trim();
    const series = document.getElementById('admin-release-series').value.trim() || null;
    const volume = parseFloat(document.getElementById('admin-release-volume').value) || null;
    const publisher = document.getElementById('admin-release-publisher').value.trim() || null;
    const price = parseInt(document.getElementById('admin-release-price').value) || null;
    const cover_url = document.getElementById('admin-release-cover').value.trim() || null;
    const edition = document.getElementById('admin-release-edition').value;
    const note = document.getElementById('admin-release-note').value.trim() || null;

    if (!release_date) { window.app.showToast('Vui lòng chọn ngày phát hành!', 'error'); return; }
    if (!title) { window.app.showToast('Vui lòng nhập tiêu đề sách!', 'error'); return; }

    const entryData = { release_date, title, series, volume, publisher, price, cover_url, edition, note };
    if (id) entryData.id = id;

    try {
        window.app.showLoading('Đang lưu...');
        const { data, error } = await supabase.rpc('admin_upsert_release', { entry_data: entryData });
        if (error) throw error;

        const result = data;
        if (result?.error === 'duplicate') {
            window.app.showToast('Entry trùng lặp (title + ngày đã tồn tại)!', 'error');
            return;
        }

        window.app.showToast(id ? 'Đã cập nhật entry!' : 'Đã thêm entry mới!');
        window.app.closeAdminReleaseForm();
        window.app.adminScheduleLoad();
    } catch (e) {
        console.error('[admin-schedule] save error:', e);
        window.app.showToast('Lỗi khi lưu: ' + e.message, 'error');
    } finally {
        window.app.hideLoading();
    }
}

export async function deleteAdminRelease(id) {
    if (!confirm('Xóa entry này khỏi lịch phát hành?')) return;
    try {
        window.app.showLoading('Đang xóa...');
        const { error } = await supabase.rpc('admin_delete_release', { release_id: id });
        if (error) throw error;
        window.app.showToast('Đã xóa entry!');
        window.app.adminScheduleLoad();
    } catch (e) {
        window.app.showToast('Lỗi khi xóa: ' + e.message, 'error');
    } finally {
        window.app.hideLoading();
    }
}