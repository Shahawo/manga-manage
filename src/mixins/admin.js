import { store } from '../store.js';
import { supabase } from '../supabase-client.js';
import { escapeHTML } from '../utils/security.js';

export function loadAdminPanel() {
    if (!store.user || !store.isAdmin) {
        window.app.showToast('Bạn không có quyền truy cập', 'error');
        return;
    }
    window.app.navigateTo('/admin/pending');
}

export function switchAdminTab(tabId) {
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick')?.includes(tabId));
    });
    
    if (tabId === 'pending') {
        window.app.navigateTo('/admin/pending');
    } else if (tabId === 'catalog') {
        window.app.navigateTo('/admin/catalog');
    } else if (tabId === 'feedback') {
        window.app.navigateTo('/admin/feedback');
    } else if (tabId === 'schedule') {
        window.app.navigateTo('/admin/schedule');
    }
}

export function showFeedbackModal() {
    const modal = document.getElementById('feedback-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('show');
    }
}

export function closeFeedbackModal() {
    const modal = document.getElementById('feedback-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('show');
    }
    const txt = document.getElementById('feedback-text');
    if (txt) txt.value = '';
}

export function submitFeedback() {
    const txt = document.getElementById('feedback-text');
    const content = txt ? txt.value.trim() : '';
    if (!content) {
        window.app.showToast('Vui lòng nhập nội dung góp ý!', 'error');
        return;
    }

    const payload = {
        user_name: store.user?.user_metadata?.name || store.user?.email || 'Ẩn danh',
        user_email: store.user?.email || 'guest@anonymous.com',
        content: content,
        status: 'new'
    };

    window.app.queueTask('SUBMIT_FEEDBACK', payload, null, {
        message: 'Cảm ơn góp ý của bạn! Đang gửi lên hệ thống...',
        nonBlocking: true,
        silent: true
    });

    window.app.closeFeedbackModal();
    window.app.showToast('Đã gửi góp ý thành công!');
}

export async function fetchAdminFeedback() {
    try {
        const { data, error } = await window.app.executeWithAbort(
            () => supabase.rpc('get_all_feedback'),
            15000,
            'Lỗi kết nối khi tải góp ý'
        );
        if (error) throw error;
        const list = (data || []).map(fb => ({
            ...fb,
            userName: fb.user_name,
            userEmail: fb.user_email,
            createdAt: fb.created_at
        }));
        window.app.renderFeedbackList(list);
    } catch (e) {
        console.error('Lỗi tải danh sách Góp ý:', e);
    }
}

export function renderFeedbackList(list) {
    const container = document.getElementById('admin-feedback-list');
    if (!container) return;
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
    try {
        const { error } = await window.app.executeWithAbort(
            () => supabase.rpc('admin_delete_feedback', { feedback_id: id }),
            15000,
            'Lỗi kết nối khi xóa góp ý'
        );
        if (!error) {
            window.app.fetchAdminFeedback();
        } else {
            throw error;
        }
    } catch (e) {
        console.error('Lỗi khi xóa góp ý:', e);
        window.app.showToast('Lỗi khi xóa!', 'error');
    }
}