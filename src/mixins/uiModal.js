import { store } from '../store.js';
import { supabase } from '../supabase-client.js';
import { escapeHTML } from '../utils/security.js';

export function showModal(id) {
        const manga = store.data.find(m => m.id === id);
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
                    onerror="window.app.src='https://via.placeholder.com/300x435.png?text=No+Image'">
                ${allImages.length > 1 ? `
                <button class="modal-gallery-btn btn-left" onclick="app.toggleModalImage(-1)"><i data-feather="chevron-left"></i></button>
                <button class="modal-gallery-btn btn-right" onclick="app.toggleModalImage(1)"><i data-feather="chevron-right"></i></button>
                ` : ''}
            </div>
            <div class="modal-info">
                <div class="minfo-group full-width">
                    <span class="minfo-label">Tiêu đề</span>
                    <span class="minfo-val">${escapeHTML(manga.title)}</span>
                </div>
                ${manga.isbn ? `<div class="minfo-group"><span class="minfo-label">ISBN</span><span class="minfo-val">${escapeHTML(manga.isbn.split(/[,;|/\n]/)[0].trim())}</span></div>` : ''}
                <div class="minfo-group"><span class="minfo-label">Tập số</span><span class="minfo-val">${escapeHTML(manga.volume)}</span></div>
                ${manga.publisher ? `<div class="minfo-group"><span class="minfo-label">Nhà xuất bản</span><span class="minfo-val">${escapeHTML(manga.publisher)}</span></div>` : ''}
                ${manga.distributor ? `<div class="minfo-group"><span class="minfo-label">Nhà phát hành</span><span class="minfo-val">${escapeHTML(manga.distributor)}</span></div>` : ''}
                ${manga.price ? `<div class="minfo-group"><span class="minfo-label">Giá bìa</span><span class="minfo-val">${new Intl.NumberFormat('vi-VN').format(manga.price)} <ins style="text-decoration:underline">đ</ins></span></div>` : ''}
                ${fDate ? `<div class="minfo-group"><span class="minfo-label">Ngày phát hành</span><span class="minfo-val">${fDate}</span></div>` : ''}
                ${manga.author ? `<div class="minfo-group"><span class="minfo-label">Tác giả</span><span class="minfo-val">${escapeHTML(manga.author.replace(/\n/g, ', '))}</span></div>` : ''}
                ${manga.translator ? `<div class="minfo-group"><span class="minfo-label">Dịch giả</span><span class="minfo-val">${escapeHTML(manga.translator)}</span></div>` : ''}
                ${manga.size ? `<div class="minfo-group"><span class="minfo-label">Kích thước</span><span class="minfo-val">${escapeHTML(manga.size)}</span></div>` : ''}
                ${manga.pages ? `<div class="minfo-group"><span class="minfo-label">Số trang</span><span class="minfo-val">${escapeHTML(manga.pages)} trang</span></div>` : ''}
                ${manga.note ? `<div class="minfo-group full-width"><span class="minfo-label">Chú thích</span><span class="minfo-val">${escapeHTML(manga.note)}</span></div>` : ''}
            </div>
        `;
        document.getElementById('volume-modal').classList.add('show');
        if (window.feather) { try { feather.replace(); } catch (e) { console.warn('Feather error:', e); } }

        window.app.currentModalImages = allImages;
        window.app.currentModalImageIndex = 0;
    }

export function toggleModalImage(dir) {
        if (!window.app.currentModalImages || window.app.currentModalImages.length < 2) return;
        window.app.currentModalImageIndex = (window.app.currentModalImageIndex + dir + window.app.currentModalImages.length) % window.app.currentModalImages.length;
        document.getElementById('modal-cover-img').src = window.app.currentModalImages[window.app.currentModalImageIndex];
    }

export function closeModal() {
        document.getElementById('volume-modal').classList.remove('show');
    }

export function editVolume(id) {
        const manga = store.data.find(m => m.id === id);
        if (!manga) return;

        window.app.navigateTo('/form');
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

        window.app.previewImage(manga.coverUrl, 'cover', 'main-');
        const giftInput = document.getElementById('main-giftUrlInput');
        if (giftInput) giftInput.value = '';
        window.app.renderGiftThumbnails('main-');
        if (giftsArray.length > 0) window.app.previewGiftImage(giftsArray[0], 'main-');
        else window.app.previewGiftImage('', 'main-');
        window.app.switchImgTab('cover', 'main-');
    }

export async function deleteVolume(id) {
        const manga = store.data.find(m => m.id === id);
        if (!manga) return;
        if (!confirm(`Xóa "${manga.title} - Tập ${manga.volume}"?\nHành động này không thể hoàn tác.`)) return;

        // Optimistic UI Update: Xóa khỏi mảng cục bộ ngay lập tức
        store.data = store.data.filter(m => m.id !== id);
        window.app.updateSeriesSuggestions();

        const isSearchView = document.getElementById('view-search').classList.contains('active');
        const isDetailView = document.getElementById('view-detail').classList.contains('active');

        if (isSearchView) {
            window.app.renderSearch(document.getElementById('searchInput').value);
        } else if (isDetailView) {
            const remaining = store.data.filter(m => m.series === manga.series);
            if (remaining.length > 0) window.app.openSeriesDetail(manga.series);
            else window.app.navigateTo('/');
        } else {
            window.app.navigateTo('/');
        }
        window.app.queueTask('DELETE_MANGA', { id }, null, {
            message: 'Đã xóa khỏi kệ. Đang đồng bộ với database...'
        });
    }