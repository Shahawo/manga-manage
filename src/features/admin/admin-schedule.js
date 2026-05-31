import { store } from '../../store.js';

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

export async function adminScheduleLoad() {
    _adminScheduleUpdateLabel();
    const { year, month } = _adminScheduleState;
    const firstDay = `${year}-${String(month).padStart(2,'0')}-01`;
    const lastDay = (() => {
        const d = new Date(year, month, 0);
        return `${year}-${String(month).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    })();

    const list = document.getElementById('admin-release-list');
    if (list) list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">Đang tải...</p>';

    try {
        const res = await window.app.executeWithAbort(
            () => window.app.apiFetch(`/api/admin/schedule?start=${firstDay}&end=${lastDay}`),
            5000,
            'Quá hạn tải lịch phát hành'
        );
        const data = res.data;
        const error = res.error;

        if (error) throw error;
        window.app.renderAdminReleaseList(data ?? []);
    } catch (err) {
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
                    ${e.cover_url ? `<img src="${e.cover_url}" alt="" style="width:36px;height:52px;object-fit:cover;border-radius:4px;flex-shrink:0;border:1px solid var(--border);" onerror="this.outerHTML='<div style=\\'width:36px;height:52px;border-radius:4px;background:var(--border);flex-shrink:0;\\'></div>'">` : '<div style="width:36px;height:52px;border-radius:4px;background:var(--border);flex-shrink:0;"></div>'}
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
        window.app.executeWithAbort(
            () => window.app.apiFetch(`/api/admin/schedule/${id}`),
            5000,
            'Quá hạn tải thông tin'
        ).then((res) => {
            const data = res.data;
            const error = res.error;
            if (error || !data) return;
            document.getElementById('admin-release-date').value = data.release_date ?? '';
            document.getElementById('admin-release-title').value = data.title ?? '';
            document.getElementById('admin-release-series').value = data.series ?? '';
            document.getElementById('admin-release-volume').value = data.volume ?? '';
            document.getElementById('admin-release-publisher').value = data.publisher ?? '';
            document.getElementById('admin-release-price').value = data.price ?? '';
            document.getElementById('admin-release-cover').value = data.cover_url ?? '';
            document.getElementById('admin-release-edition').value = data.edition ?? 'standard';
            document.getElementById('admin-release-note').value = data.note ?? '';
        }).catch(err => {
            console.error('Lỗi tải chi tiết entry:', err);
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
        const res = await window.app.executeWithAbort(
            () => window.app.apiFetch('/api/admin/import', { method: 'POST', body: JSON.stringify(entryData) }),
            8000,
            'Quá hạn lưu thông tin'
        );
        const error = res.error;
        if (error) throw error;

        const result = res.data;
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
        const res = await window.app.executeWithAbort(
            () => window.app.apiFetch(`/api/admin/schedule/${id}`, { method: 'DELETE' }),
            5000,
            'Yêu cầu xoá quá hạn'
        );
        const error = res.error;
        if (error) throw error;
        window.app.showToast('Đã xóa entry!');
        window.app.adminScheduleLoad();
    } catch (e) {
        window.app.showToast('Lỗi khi xóa: ' + e.message, 'error');
    } finally {
        window.app.hideLoading();
    }
}
