import { store } from '../store.js';
import { supabase } from '../supabase-client.js';

export function switchImgTab(tabId, prefix = 'main-') {
        // Find the tabs container related to this prefix
        const coverTabBtn = document.querySelector(`[onclick="app.switchImgTab('cover', '${prefix}')"]`);
        const giftTabBtn = document.querySelector(`[onclick="app.switchImgTab('gift', '${prefix}')"]`);
        if (coverTabBtn && giftTabBtn) {
            coverTabBtn.classList.remove('active');
            giftTabBtn.classList.remove('active');
        }

        const btn = document.querySelector(`[onclick="app.switchImgTab('${tabId}', '${prefix}')"]`);
        if (btn) btn.classList.add('active');

        const coverTab = document.getElementById(`${prefix}tab-cover`);
        const giftTab = document.getElementById(`${prefix}tab-gift`);
        if (coverTab && giftTab) {
            coverTab.classList.remove('active');
            coverTab.classList.add('hidden');
            giftTab.classList.remove('active');
            giftTab.classList.add('hidden');

            const activeTab = document.getElementById(`${prefix}tab-${tabId}`);
            if (activeTab) {
                activeTab.classList.remove('hidden');
                activeTab.classList.add('active');
            }
        }
    }

export function previewImage(url, type = 'cover', prefix = 'main-') {
        const boxId = type === 'cover' ? `${prefix}cover-preview-box` : `${prefix}gift-preview-box`;
        const box = document.getElementById(boxId);
        if (!box) return;

        if (url && (url.startsWith('http') || url.startsWith('data:'))) {
            box.innerHTML = `<img src="${url}" alt="Preview" onerror="window.app.onerror=null;window.app.parentElement.innerHTML='<p style=color:var(--danger)>Lỗi tải ảnh</p>'">`;
        } else {
            box.innerHTML = type === 'cover'
                ? `<i data-feather="image"></i><span>Xem trước ảnh bìa</span>`
                : `<i data-feather="gift"></i><span>Xem trước quà tặng</span>`;
            if (window.feather) { try { feather.replace(); } catch (e) { console.warn('Feather error:', e); } }
        }
    }

export function compressImageToBlob(file, quality = 0.85) {
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
                    canvas.width = Math.round(width);
                    canvas.height = Math.round(height);
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, Math.round(width), Math.round(height));

                    // Ưu tiên WebP (nhẹ hơn JPEG 25-35%), fallback JPEG nếu browser cũ
                    const supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp');
                    if (supportsWebP) {
                        canvas.toBlob(blob => resolve({ blob, format: 'webp' }), 'image/webp', quality);
                    } else {
                        canvas.toBlob(blob => resolve({ blob, format: 'jpeg' }), 'image/jpeg', quality);
                    }
                };
                img.onerror = () => reject(new Error('Không thể đọc file ảnh này. File có thể bị lỗi.'));
            };
            reader.onerror = error => reject(error);
        });
    }

export async function handleFileUpload(inputElem, type, prefix = 'main-') {
        if (!inputElem.files || inputElem.files.length === 0) return;
        try {
            const file = inputElem.files[0];
            window.app.showLoading('Đang nén và tải ảnh lên...');
            const { blob, format } = await window.app.compressImageToBlob(file);

            const fileExt = format === 'webp' ? 'webp' : 'jpg';
            const contentType = format === 'webp' ? 'image/webp' : 'image/jpeg';
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `covers/${fileName}`;

            const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('Yêu cầu tải ảnh quá hạn (Timeout)')), ms));

            const { error: uploadError } = await Promise.race([
                supabase.storage.from(store.storageBucket).upload(filePath, blob, { contentType }),
                timeout(15000)
            ]);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from(store.storageBucket).getPublicUrl(filePath);

            const targetInput = document.getElementById(`${prefix}coverUrl`);
            if (targetInput) targetInput.value = data.publicUrl;
            window.app.previewImage(data.publicUrl, 'cover', prefix);
            console.debug(`[Upload] Ảnh bìa đã upload dạng ${format.toUpperCase()}: ${filePath}`);
        } catch (e) {
            console.error('Lỗi tải ảnh:', e);
            window.app.showToast(e.message === 'Yêu cầu tải ảnh quá hạn (Timeout)' ? 'Lỗi mạng: Thời gian tải ảnh quá lâu!' : 'Lỗi tải ảnh lên server!', 'error');
        } finally {
            window.app.hideLoading();
        }
        inputElem.value = '';
    }

export function addGiftUrl(prefix = 'main-') {
        const input = document.getElementById(`${prefix}giftUrlInput`);
        const url = input ? input.value.trim() : '';
        if (!url) return;
        const urlsObj = document.getElementById(`${prefix}giftUrls`);
        if (!urlsObj) return;
        const existing = urlsObj.value.trim();
        urlsObj.value = existing ? existing + '\n' + url : url;
        input.value = '';
        window.app.renderGiftThumbnails(prefix);
        window.app.previewGiftImage(url, prefix);
    }

export function previewGiftImage(url, prefix = 'main-') {
        const box = document.getElementById(`${prefix}gift-preview-box`);
        if (!box) return;
        if (url && (url.startsWith('http') || url.startsWith('data:'))) {
            box.innerHTML = `<img src="${url}" alt="Gift preview" onerror="window.app.onerror=null;window.app.parentElement.innerHTML='<p style=color:var(--danger)>Lỗi tải ảnh</p>'">`;
        } else {
            box.innerHTML = `<i data-feather="gift"></i><span>Xem trước quà tặng</span>`;
            if (window.feather) { try { feather.replace(); } catch (e) { console.warn('Feather error:', e); } }
        }
    }

export async function handleGiftFileUpload(inputElem, prefix = 'main-') {
        if (!inputElem.files || inputElem.files.length === 0) return;
        try {
            window.app.showLoading('Đang nén và tải quà tặng lên...');
            const urlsObj = document.getElementById(`${prefix}giftUrls`);
            const lines = urlsObj.value.trim() ? urlsObj.value.trim().split('\n') : [];
            let lastUrl = null;

            for (let i = 0; i < inputElem.files.length; i++) {
                const file = inputElem.files[i];
                const { blob, format } = await window.app.compressImageToBlob(file);
                const fileExt = format === 'webp' ? 'webp' : 'jpg';
                const contentType = format === 'webp' ? 'image/webp' : 'image/jpeg';
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `gifts/${fileName}`;

                const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('Yêu cầu tải ảnh quá hạn (Timeout)')), ms));
                const { error: uploadError } = await Promise.race([
                    supabase.storage.from(store.storageBucket).upload(filePath, blob, { contentType }),
                    timeout(15000)
                ]);
                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from(store.storageBucket).getPublicUrl(filePath);
                lines.push(data.publicUrl);
                lastUrl = data.publicUrl;
                console.debug(`[Upload] Ảnh quà tặng đã upload dạng ${format.toUpperCase()}: ${filePath}`);
            }
            urlsObj.value = lines.join('\n');
            window.app.renderGiftThumbnails(prefix);
            if (lastUrl) window.app.previewGiftImage(lastUrl, prefix);
        } catch (e) {
            console.error('Lỗi tải quà tặng:', e);
            window.app.showToast(e.message === 'Yêu cầu tải ảnh quá hạn (Timeout)' ? 'Lỗi mạng: Thời gian tải ảnh quá lâu!' : 'Lỗi tải ảnh quà tặng lên server!', 'error');
        } finally {
            window.app.hideLoading();
        }
        inputElem.value = '';
    }

export function removeGiftUrl(index, prefix = 'main-') {
        const urlsObj = document.getElementById(`${prefix}giftUrls`);
        if (!urlsObj) return;
        const urls = urlsObj.value.trim().split('\n').filter(u => u.trim() !== '');
        urls.splice(index, 1);
        urlsObj.value = urls.join('\n');
        window.app.renderGiftThumbnails(prefix);
        if (urls.length > 0) window.app.previewGiftImage(urls[urls.length - 1], prefix);
        else window.app.previewGiftImage('', prefix);
    }

export function renderGiftThumbnails(prefix = 'main-') {
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
            wrap.addEventListener('click', () => window.app.previewGiftImage(url, prefix));
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
                window.app.renderGiftThumbnails(prefix);
            });
            wrap.innerHTML = `
                <img src="${url.trim()}" style="width:100%;height:100%;object-fit:contain;pointer-events:none;" onerror="window.app.style.display='none';window.app.nextElementSibling.style.display='flex'">
                <div style="display:none; width:100%; height:100%; background:#fee2e2; color:#ef4444; align-items:center; justify-content:center; font-size:0.75rem; text-align:center; padding:2px; font-weight:600;">Lỗi</div>
                <button type="button" class="delete-gift-btn" style="width:18px;height:18px;top:2px;right:2px;" onclick="event.stopPropagation();app.removeGiftUrl(${index}, '${prefix}')" title="Xoá">
                    <i data-feather="x" style="width:10px;height:10px;"></i>
                </button>
            `;
            container.appendChild(wrap);
        });
        if (window.feather) { try { feather.replace(); } catch (e) { console.warn('Feather error:', e); } }
    }

export function previewManyImages() { window.app.renderGiftThumbnails(); }

export async function handleFormSubmit(e) {
        e.preventDefault();
        try {
            const getVal = (id) => document.getElementById(id).value.trim();
            const editId = document.getElementById('edit-id').value;

            const mangaData = {
                user_id: store.user.id,
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
                window.app.showToast('Vui lòng nhập Tên Series và Tiêu đề!', 'error');
                return;
            }

            const isRegularEdition = !mangaData.title.toLowerCase().includes(' - bản ');
            if (isRegularEdition) {
                const isDuplicate = store.data.some(m =>
                    m.series === mangaData.series &&
                    m.volume === mangaData.volume &&
                    m.id !== editId &&
                    !m.title.toLowerCase().includes(' - bản ')
                );

                if (isDuplicate) {
                    window.app.showToast(`Tập ${mangaData.volume} (Bản thường) đã tồn tại trong series này!`, 'error');
                    return;
                }
            }

            // --- Optimistic UI Update ---
            let optimisticId = editId || window.app.generateUUID();

            const localManga = {
                id: optimisticId,
                series: mangaData.series,
                title: mangaData.title,
                volume: mangaData.volume,
                isbn: mangaData.isbn,
                author: mangaData.author,
                translator: mangaData.translator,
                publisher: mangaData.publisher,
                distributor: mangaData.distributor,
                publishDate: mangaData.publish_date,
                pages: mangaData.pages,
                size: mangaData.size,
                price: mangaData.price,
                note: mangaData.note,
                coverUrl: mangaData.cover_url,
                giftUrls: mangaData.gift_urls || [],
                catalogId: mangaData.catalog_id,
                addedAt: new Date().toISOString()
            };

            if (editId) {
                const idx = store.data.findIndex(m => m.id === editId);
                if (idx !== -1) {
                    // Giữ lại ngày thêm gốc
                    localManga.addedAt = store.data[idx].addedAt;
                    store.data[idx] = localManga;
                }
                window.app.queueTask('UPDATE_MANGA', { ...mangaData, id: editId });
            } else {
                store.data.unshift(localManga);
                // Gán luôn ID thật (vì DB xài uuid default gen_random_uuid() nên gửi lên ID luôn)
                const insertData = { ...mangaData, id: optimisticId };
                window.app.queueTask('INSERT_MANGA', insertData, optimisticId);

                if (!mangaData.catalog_id) {
                    window.app.queueTask('INSERT_PENDING', {
                        submitted_by: store.user.id,
                        submitted_name: store.user.user_metadata?.full_name || store.user.user_metadata?.name || store.user.email,
                        submitted_email: store.user.email,
                        linked_manga_id: optimisticId,
                        scanned_isbn: formEl.dataset.pendingIsbn || mangaData.isbn,
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
                    }, null, { silent: true, nonBlocking: true });
                }
            }

            // Cleanup form state
            delete formEl.dataset.catalogId;
            delete formEl.dataset.pendingIsbn;

            window.app.updateSeriesSuggestions();

            // Render UI lập tức
            if (store.currentSeries === mangaData.series) {
                window.app.openSeriesDetail(store.currentSeries);
            } else {
                window.app.navigateTo('/');
            }
        } catch (err) {
            console.error('Lỗi khi submit form:', err);
            // Nếu là abort error do chuyển tab, vẫn lưu dữ liệu
            if (err.name === 'AbortError') {
                window.app.showToast('Form đã được lưu offline. Quay lại tab để tiếp tục!', 'info');
            } else {
                window.app.showToast('Lỗi khi lưu: ' + (err.message || 'unknown'), 'error');
            }
        }
    }

export function setupPriceInput() {
        const priceInput = document.getElementById('price');
        if (!priceInput) return;
        priceInput.addEventListener('blur', function () {
            let val = window.app.value.replace(/[^\d]/g, '');
            if (!val) { window.app.value = ''; return; }
            let num = parseInt(val, 10);
            if (num < 1000 && num > 0) num = num * 1000;
            if (num > 2000000000) num = 2000000000; // Ngăn lỗi Supabase (Integer limit)
            window.app.value = new Intl.NumberFormat('vi-VN').format(num);
        });
        priceInput.addEventListener('focus', function () {
            window.app.value = window.app.value.replace(/\./g, '');
        });
    }

export async function autoFill() {
        const seriesName = document.getElementById('series').value.trim();
        if (!seriesName) {
            window.app.showToast('Vui lòng nhập Tên Series rồi nhấn Tự động điền!', 'error');
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
                window.app.showToast('Đã điền tự động dữ liệu chung của Series!');
            } else {
                window.app.showToast('Chưa có dữ liệu tham khảo cho Series này trong Kho chung.', 'info');
            }
        } catch (err) {
            console.error('autofill error', err);
            window.app.showToast('Lỗi khi tải thông tin tự động điền.', 'error');
        }
    }

export function setupSearch() {
        const input = document.getElementById('searchInput');
        input.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase().trim();
            if (q.length > 0) window.app.renderSearch(q);
            else window.app.navigateTo('/');
        });
    }

export function renderSearch(query) {
        const list = document.getElementById('search-results-list');
        list.innerHTML = '';
        document.getElementById('search-query-display').textContent = query;

        let hasMultipleIsbnMatch = false;
        const queryWords = query.toLowerCase().split(/[\s\-]+/).filter(Boolean);

        const matchedItems = store.data.filter(m => {
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
            window.app.navigateTo('/search');
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
            const editionBadge = window.app.getEditionBadge(v.title);

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
        window.app.navigateTo('/search');
        if (window.feather) { try { feather.replace(); } catch (e) { console.warn('Feather error:', e); } }
    }

export function showAddMethod() {
        window.app.navigateTo('/add');
    }