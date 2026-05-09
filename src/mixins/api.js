import { supabase } from '../supabase-client.js';

export function applyApiMixin(app) {
    Object.assign(app, {
        
    data: [],
        
    seriesMetadata: {},
        
    userSeriesSettings: {},
        
    currentSeries: null,
        
    currentView: 'dashboard',
        
    viewMode: localStorage.getItem('viewMode') || 'grid',
        
    storageBucket: 'covers',
        

    // ─── HELPER: Background Sync Queue (Optimistic UI) ────────────────────────
    syncQueue: JSON.parse(localStorage.getItem('manga_sync_queue') || '[]'),
    pendingRejectedIds: JSON.parse(localStorage.getItem('manga_pending_rejected_ids') || '[]'),
        
    isSyncing: false,
        

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },
        

    queueTask(type, payload, optimisticId = null, options = {}) {
        const task = {
            id: this.generateUUID(), // ID của task
            type, // 'INSERT_MANGA', 'UPDATE_MANGA', 'DELETE_MANGA', 'UPSERT_TARGET', 'INSERT_PENDING', 'ADMIN_REJECT_PENDING'
            payload,
            optimisticId,
            timestamp: Date.now(),
            nonBlocking: !!options.nonBlocking,
            silent: !!options.silent,
            retryAt: options.retryAt || 0,
            attempts: options.attempts || 0
        };
        this.syncQueue.push(task);
        localStorage.setItem('manga_sync_queue', JSON.stringify(this.syncQueue));

        // Hiện thông báo non-blocking
        if (!options.silent) {
            this.showToast(options.message || 'Đã lưu offline. Đang đồng bộ ngầm...', 'success');
        }

        // Kích hoạt tiến trình ngầm ngay lập tức
        setTimeout(() => this.processSyncQueue(), 500);
    },
        

    async processSyncQueue() {
        if (this.isSyncing || this.syncQueue.length === 0) return;
        if (!navigator.onLine) return; // Không có mạng thì dừng

        this.isSyncing = true;
        let hasSuccess = false;

        // Xử lý từng task một
        while (this.syncQueue.length > 0) {
            const now = Date.now();
            const readyIndex = this.syncQueue.findIndex(t => !t.retryAt || t.retryAt <= now);
            if (readyIndex === -1) {
                break;
            }
            if (readyIndex > 0) {
                const [readyTask] = this.syncQueue.splice(readyIndex, 1);
                this.syncQueue.unshift(readyTask);
                localStorage.setItem('manga_sync_queue', JSON.stringify(this.syncQueue));
            }
            const task = this.syncQueue[0]; // Lấy task đầu tiên đã sẵn sàng
            try {
                if (task.type === 'INSERT_MANGA') {
                    const { error } = await this.withTimeout(
                        supabase.from('manga').insert(task.payload),
                        15000,
                        'Đồng bộ thêm sách quá hạn'
                    );
                    if (error) throw error;
                }
                else if (task.type === 'UPDATE_MANGA') {
                    const { error } = await this.withTimeout(
                        supabase.from('manga').update(task.payload).eq('id', task.payload.id),
                        15000,
                        'Đồng bộ cập nhật sách quá hạn'
                    );
                    if (error) throw error;
                }
                else if (task.type === 'DELETE_MANGA') {
                    const { error } = await this.withTimeout(
                        supabase.from('manga').delete().eq('id', task.payload.id),
                        15000,
                        'Đồng bộ xoá sách quá hạn'
                    );
                    if (error) throw error;
                }
                else if (task.type === 'UPSERT_TARGET') {
                    const { error } = await this.withTimeout(
                        supabase.from('user_series_settings').upsert(task.payload, { onConflict: 'user_id, series' }),
                        15000,
                        'Đồng bộ mục tiêu quá hạn'
                    );
                    if (error) throw error;
                }
                else if (task.type === 'INSERT_PENDING') {
                    const { error } = await this.withTimeout(
                        supabase.from('pending_catalog').insert(task.payload),
                        15000,
                        'Đồng bộ đóng góp kho chung quá hạn'
                    );
                    if (error) throw error;
                }
                else if (task.type === 'ADMIN_REJECT_PENDING') {
                    const { error } = await this.withTimeout(
                        supabase.rpc('admin_reject_pending', {
                            pending_id: task.payload.id,
                            reason: task.payload.reason || null
                        }),
                        15000,
                        'Đồng bộ từ chối sách quá hạn'
                    );
                    if (error) throw error;
                }
                else if (task.type === 'INSERT_FEEDBACK') {
                    const { error } = await this.withTimeout(
                        supabase.from('feedback').insert(task.payload),
                        15000,
                        'Đồng bộ gửi góp ý quá hạn'
                    );
                    if (error) throw error;
                }
                else if (task.type === 'ADMIN_UPDATE_CATALOG') {
                    const { error } = await this.withTimeout(
                        supabase.rpc('admin_update_catalog', {
                            catalog_id: task.payload.id,
                            updated_data: task.payload.data
                        }),
                        15000,
                        'Đồng bộ cập nhật Kho chung quá hạn'
                    );
                    if (error) throw error;
                }
                else if (task.type === 'ADMIN_DELETE_CATALOG') {
                    const { error } = await this.withTimeout(
                        supabase.rpc('admin_delete_catalog', {
                            catalog_id: task.payload.id
                        }),
                        15000,
                        'Đồng bộ xóa Kho chung quá hạn'
                    );
                    if (error) throw error;
                }

                // Xử lý xong -> xóa khỏi queue
                this.syncQueue.shift();
                localStorage.setItem('manga_sync_queue', JSON.stringify(this.syncQueue));
                if (task.type === 'ADMIN_REJECT_PENDING') {
                    this._clearPendingRejectedId(task.payload.id);
                }
                hasSuccess = true;

            } catch (err) {
                console.warn('[Sync Queue] Lỗi đồng bộ task:', task.id, err);
                if (task.type === 'ADMIN_REJECT_PENDING') {
                    task.attempts = (task.attempts || 0) + 1;
                    const retryDelay = Math.min(30000, 5000 * task.attempts);
                    task.retryAt = Date.now() + retryDelay;
                    localStorage.setItem('manga_sync_queue', JSON.stringify(this.syncQueue));
                    setTimeout(() => this.processSyncQueue(), retryDelay + 250);
                    break;
                }
                const isNonBlockingTask = task.nonBlocking || task.type === 'INSERT_PENDING';
                if (isNonBlockingTask) {
                    this.syncQueue.shift();
                    localStorage.setItem('manga_sync_queue', JSON.stringify(this.syncQueue));
                    const isSilentTask = task.silent || task.type === 'INSERT_PENDING';
                    if (!isSilentTask) {
                        this.showToast(err.message || 'Một tác vụ nền chưa đồng bộ được.', 'error');
                    }
                    continue;
                }
                // Giữ lại trong queue để thử lại sau
                break;
            }
        }

        this.isSyncing = false;
        if (hasSuccess && this.syncQueue.length === 0) {
            // Nếu đây là lần sync đầu tiên sau khi tải trang (F5), không cần hiện toast
            // vì user đã thấy sách rồi (queue-aware merge trong loadData đã hiển thị).
            // Chỉ hiện toast cho các sync do user thực hiện sau đó.
            if (!this._isPageLoad) {
                this.showToast('Đồng bộ dữ liệu ngầm hoàn tất!', 'success');
            }
            this._isPageLoad = false; // Reset flag sau lần sync đầu

            // ─── AUTO-RECONCILE: Đồng bộ lại UI từ server sau khi queue hoàn tất ────
            if (this.user) {
                const savedView = this.currentView;
                const savedSeries = this.currentSeries;
                try {
                    await this.loadData();
                    if (savedView === 'detail' && savedSeries) {
                        this.openSeriesDetail(savedSeries);
                    } else if (savedView === 'admin') {
                        this.fetchPendingBooks();
                    }
                } catch (e) {
                    console.warn('[Auto-reconcile] Không thể tải lại dữ liệu:', e);
                }
            }
        } else if (!hasSuccess) {
            // Sync chạy nhưng không có task nào thành công → reset page load flag để lần sau vẫn hiện toast bình thường
            this._isPageLoad = false;
        }
    },
        


    _rememberPendingRejectedId(id) {
        if (!id) return;
        if (!this.pendingRejectedIds.includes(id)) {
            this.pendingRejectedIds.push(id);
            localStorage.setItem('manga_pending_rejected_ids', JSON.stringify(this.pendingRejectedIds));
        }
    },
        

    _clearPendingRejectedId(id) {
        if (!id || !this.pendingRejectedIds.includes(id)) return;
        this.pendingRejectedIds = this.pendingRejectedIds.filter(x => x !== id);
        localStorage.setItem('manga_pending_rejected_ids', JSON.stringify(this.pendingRejectedIds));
    },
        



    // Wrapper chính: chạy request với controller được theo dõi, tự thử lại 1 lần
    async withRetry(buildRequest, { retries = 2 } = {}) {
        let lastError = null;
        for (let attempt = 0; attempt < retries; attempt++) {
            const controller = new AbortController();
            try {
                const result = await buildRequest(controller.signal);
                return result;
            } catch (err) {
                lastError = err;
                console.warn(`[withRetry] Lần ${attempt + 1}/${retries} thất bại:`, err.message);
                if (attempt < retries - 1) await new Promise(r => setTimeout(r, 800));
            }
        }
        throw lastError;
    },

    withTimeout(promise, ms = 15000, message = 'Yêu cầu quá hạn, vui lòng thử lại!') {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
        ]);
    },
        


    // ─── DATA — FETCH API ─────────────────────────────────────────────────────
    async loadData(forceSkeleton = false) {
        if (!this.data || this.data.length === 0 || forceSkeleton) {
            this.renderSeriesSkeletons('series-grid', this.viewMode === 'list');
            const emptyState = document.getElementById('empty-state');
            if (emptyState) emptyState.classList.add('hidden');
        }
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const { data, error } = await supabase.from('manga').select('*').order('added_at', { ascending: false }).abortSignal(controller.signal);
            
            if (error) throw error;
            let fetchedData = data.map(m => ({
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

            // ─── QUEUE-AWARE MERGE ────────────────────────────────────────────
            // Sau khi fetch từ Supabase, áp dụng ngay các pending task còn trong
            // syncQueue vào data trước khi render. Đây là pattern "optimistic local-first"
            // của các app chuyên nghiệp (WhatsApp Web, Slack, Notion):
            //   - INSERT pending → hiện sách ngay dù chưa sync lên DB
            //   - UPDATE pending → áp thay đổi ngay
            //   - DELETE pending → ẩn sách ngay
            // → Sách xuất hiện NGAY SAU F5, không cần chờ sync chạy xong.
            if (this.syncQueue && this.syncQueue.length > 0) {
                const fetchedIds = new Set(fetchedData.map(m => m.id));
                this.syncQueue.forEach(task => {
                    if (task.type === 'INSERT_MANGA') {
                        if (!fetchedIds.has(task.payload.id)) {
                            fetchedData.unshift({
                                id: task.payload.id,
                                series: task.payload.series,
                                title: task.payload.title,
                                volume: task.payload.volume,
                                isbn: task.payload.isbn,
                                author: task.payload.author,
                                translator: task.payload.translator,
                                publisher: task.payload.publisher,
                                distributor: task.payload.distributor,
                                publishDate: task.payload.publish_date,
                                pages: task.payload.pages,
                                size: task.payload.size,
                                price: task.payload.price,
                                note: task.payload.note,
                                coverUrl: task.payload.cover_url,
                                giftUrls: task.payload.gift_urls || [],
                                catalogId: task.payload.catalog_id,
                                addedAt: task.payload.added_at || new Date().toISOString()
                            });
                            fetchedIds.add(task.payload.id);
                        }
                    } else if (task.type === 'UPDATE_MANGA') {
                        const idx = fetchedData.findIndex(m => m.id === task.payload.id);
                        if (idx !== -1) {
                            fetchedData[idx] = {
                                ...fetchedData[idx],
                                series: task.payload.series,
                                title: task.payload.title,
                                volume: task.payload.volume,
                                isbn: task.payload.isbn,
                                author: task.payload.author,
                                translator: task.payload.translator,
                                publisher: task.payload.publisher,
                                distributor: task.payload.distributor,
                                publishDate: task.payload.publish_date,
                                pages: task.payload.pages,
                                size: task.payload.size,
                                price: task.payload.price,
                                note: task.payload.note,
                                coverUrl: task.payload.cover_url,
                                giftUrls: task.payload.gift_urls || [],
                            };
                        }
                    } else if (task.type === 'DELETE_MANGA') {
                        fetchedData = fetchedData.filter(m => m.id !== task.payload.id);
                    }
                });
            }
            this.data = fetchedData;

            // Fetch extra tracking data
            try {
                const [metaRes, userRes] = await Promise.all([
                    supabase.from('series_metadata').select('*').abortSignal(controller.signal),
                    supabase.from('user_series_settings').select('*').abortSignal(controller.signal)
                ]);
                this.seriesMetadata = {};
                if (metaRes.data) metaRes.data.forEach(x => this.seriesMetadata[x.series] = x);
                this.userSeriesSettings = {};
                if (userRes.data) userRes.data.forEach(x => this.userSeriesSettings[x.series] = x);
            } catch (err) {
                console.warn('Không thể tải metadata tracking:', err);
            }
            
            clearTimeout(timeoutId);
            this.renderDashboard();

            // Nếu là admin, prefetch catalog ngầm để khi vào tab "ỬQuản lý Kho" không phải chờ "Đang tải..."
            if (this.isAdmin && !this.fullCatalogCache && !this._isFetchingCatalog) {
                // Delay nhỏ để ưu tiên render dashboard trước
                setTimeout(() => this._prefetchCatalogCache(), 1500);
            }
        } catch (err) {
            console.error('Lỗi tải dữ liệu:', err);
            if (!this.data) this.data = [];
            this.renderDashboard();
            if (this.user) {
                const msg = err?.code === '42P01'
                    ? 'Chưa tạo bảng dữ liệu! Vui lòng chạy file sql/schema.sql trong Supabase.'
                    : 'Không thể kết nối server! (' + (err?.message || 'unknown') + ')';
                this.showToast(msg, 'error');
            }
        }
    },


    // ─── ADMIN CATALOG PREFETCH ────────────────────────────────────────────────
    // Chạy ngầm khi admin load trang chính, để khi vào Kho chung thì hiển thị ngay
    async _prefetchCatalogCache() {
        if (this.fullCatalogCache || this._isFetchingCatalog) return;
        this._isFetchingCatalog = true;
        try {
            const controller = new AbortController();
            this._catalogFetchController = controller;
            const { data, error } = await supabase.from('catalog').select('*')
                .limit(10000)
                .order('series', { ascending: true })
                .order('volume', { ascending: true })
                .abortSignal(controller.signal);
            if (!error && data) {
                this.fullCatalogCache = data;
                console.debug(`[Prefetch] Catalog cache đã tải xong ngầm: ${data.length} mục`);
            }
        } catch (e) {
            // Silent failure — sẽ fetch lại khi user vào tab Kho chung
            console.debug('[Prefetch] Catalog prefetch thất bại (im lặng):', e.message);
        } finally {
            this._catalogFetchController = null;
            this._isFetchingCatalog = false;
        }
    },


    // ─── EXPORT / IMPORT ──────────────────────────────────────────────────────
    exportData() {

        if (this.data.length === 0) {
            this.showToast('Thư viện đang trống, không có dữ liệu để sao lưu!', 'error');
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
                    this.showToast('File không đúng định dạng dữ liệu Kệ Truyện!', 'error');
                    return;
                }
                if (!confirm(`Chuẩn bị phục hồi ${importedData.length} cuốn.\n\n⚠️ Dữ liệu hiện tại sẽ bị GHI ĐÈ. Tiếp tục?`)) return;

                this.showLoading('Đang nhập dữ liệu...');
                // Import via Supabase JS
                const cleanData = importedData.map(m => {
                    const record = {
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
                        catalog_id: m.catalogId || m.catalog_id || null,
                        added_at: m.addedAt || m.added_at || new Date().toISOString()
                    };
                    // Giữ lại ID cũ nếu là chuẩn UUID (từ bản backup Supabase)
                    if (m.id && typeof m.id === 'string' && m.id.length === 36 && m.id.includes('-')) {
                        record.id = m.id;
                    }
                    return record;
                });

                const { error: deleteErr } = await supabase.from('manga').delete().eq('user_id', this.user.id);
                if (deleteErr) throw deleteErr;

                const { error: insertErr } = await supabase.from('manga').insert(cleanData);
                if (insertErr) throw insertErr;

                const result = { success: true, imported: cleanData.length };
                if (result.success) {
                    await this.loadData();
                    this.updateSeriesSuggestions();
                    this.navigateTo('/');
                    this.showToast(`Đã nhập thành công ${result.imported} cuốn! 🎉`);
                } else {
                    this.showToast('Lỗi khi nhập dữ liệu: ' + result.error, 'error');
                }
            } catch (err) {
                this.showToast('Có lỗi khi đọc file JSON.', 'error');
            } finally {
                this.hideLoading();
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }
    });
}
