import { store } from '../store.js';
import { supabase } from '../supabase-client.js';

export async function startBarcodeScanner() {
        window.app.navigateTo('/add'); // hide other views
        const modal = document.getElementById('scanner-modal');
        const video = document.getElementById('scanner-video');
        if (!modal || !video) return;
        modal.classList.remove('hidden');
        modal.classList.add('show');

        try {
            window.app.showLoading('Đang tải module máy quét...');
            await window.app.loadLibrary('https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js', 'ZXing');
            window.app.hideLoading();
            if (!store.codeReader) {
                store.codeReader = new ZXing.BrowserMultiFormatReader();
            }
            const videoInputDevices = await store.codeReader.listVideoInputDevices();
            let selectedDeviceId = videoInputDevices[0].deviceId;
            const backCamera = videoInputDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('sau'));
            if (backCamera) selectedDeviceId = backCamera.deviceId;

            store.codeReader.decodeFromVideoDevice(selectedDeviceId, 'scanner-video', (result, err) => {
                if (result) {
                    window.app.onBarcodeDetected(result.text);
                }
            });
        } catch (e) {
            console.error('Camera init error:', e);
            const videoEl = document.getElementById('scanner-video');
            if (videoEl) videoEl.style.display = 'none';
            const frameUi = document.getElementById('scanner-frame-ui');
            if (frameUi) frameUi.style.display = 'none';
            const btnCap = document.getElementById('btn-capture-live');
            if (btnCap) btnCap.style.display = 'none';
            const hintTxt = document.getElementById('scanner-hint-text');
            if (hintTxt) hintTxt.style.display = 'none';
            const fallback = document.getElementById('scanner-fallback');
            if (fallback) fallback.classList.remove('hidden');
        }
    }

export function stopBarcodeScanner() {
        const modal = document.getElementById('scanner-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('show');

            // Phuuc hooi UI mac dinh cho lan mo tiep theo
            const videoEl = document.getElementById('scanner-video');
            if (videoEl) videoEl.style.display = 'block';
            const frameUi = document.getElementById('scanner-frame-ui');
            if (frameUi) frameUi.style.display = 'block';
            const btnCap = document.getElementById('btn-capture-live');
            if (btnCap) btnCap.style.display = 'inline-block';
            const hintTxt = document.getElementById('scanner-hint-text');
            if (hintTxt) hintTxt.style.display = 'block';
            const fallback = document.getElementById('scanner-fallback');
            if (fallback) fallback.classList.add('hidden');
        }
        if (store.codeReader) {
            store.codeReader.reset();
        }
    }

export function handleBarcodeUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = document.createElement('img');
            img.src = event.target.result;
            img.onload = async () => {
                window.app.showLoading('Đang tải module máy quét...');
                await window.app.loadLibrary('https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js', 'ZXing');
                window.app.hideLoading();
                if (!store.codeReader) store.codeReader = new ZXing.BrowserMultiFormatReader();
                window.app.showToast('Đang phân tích mã vạch...', 'info');
                store.codeReader.decodeFromImageElement(img)
                    .then(result => {
                        if (result && result.text) window.app.onBarcodeDetected(result.text);
                    })
                    .catch(err => {
                        console.error(err);
                        window.app.showToast('Lỗi: Hình bị mờ hoặc không có mã ISBN hợp lệ. Hãy chụp rõ ràng!', 'error');
                    });
            };
        };
        reader.readAsDataURL(file);
        e.target.value = ''; // reset so they can pick again
    }

export function captureBarcode() {
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
            window.app.showToast('Đang phân tích ảnh...', 'info');
            store.codeReader.decodeFromImageElement(img)
                .then(result => {
                    if (result && result.text) {
                        window.app.onBarcodeDetected(result.text);
                    }
                })
                .catch(err => {
                    console.error(err);
                    window.app.showToast('Không bắt được Barcode nào, vui lòng chụp lại rõ hơn!', 'error');
                });
        };
    }

export async function onBarcodeDetected(isbn) {
        window.app.stopBarcodeScanner();
        try {
            const { data, error } = await supabase.from('catalog').select('*').contains('isbns', [isbn]);
            if (data && data.length > 0) {
                // map to old format
                const book = data[0];
                book.coverUrl = book.cover_url;
                window.app.showBookPreview(book);
            } else {
                window.app.showToast('Mã ISBN chưa có trong kho chung. Vui lòng điền thông tin để đóng góp!', 'info');
                window.app.navigateTo('/form');
                document.getElementById('manga-form').reset();
                document.getElementById('edit-id').value = '';
                document.getElementById('isbn').value = isbn;
                document.getElementById('manga-form').dataset.pendingIsbn = isbn;
            }
        } catch (e) {
            console.error(e);
            window.app.navigateTo('/form');
        }
    }

export function showBookPreview(catalogBook) {
        store.scannedBookCache = catalogBook;
        const modal = document.getElementById('book-preview-modal');
        if (!modal) return;

        document.getElementById('preview-title').textContent = catalogBook.title || catalogBook.series || 'Chưa rõ';
        document.getElementById('preview-author').textContent = catalogBook.author || 'Đang cập nhật';
        document.getElementById('preview-publisher').textContent = catalogBook.publisher || '-';
        document.getElementById('preview-isbn').textContent = catalogBook.isbns ? catalogBook.isbns[0] : '';

        const coverEl = document.getElementById('preview-cover');
        if (catalogBook.coverUrl) {
            coverEl.src = catalogBook.coverUrl;
            coverEl.style.display = 'block';
        } else {
            coverEl.style.display = 'none';
        }
        modal.classList.remove('hidden');
        modal.classList.add('show');
    }

export function closeBookPreview() {
        const modal = document.getElementById('book-preview-modal');
        if (modal) modal.classList.add('hidden');
        store.scannedBookCache = null;
    }

export function applyBookToForm() {
        const book = store.scannedBookCache;
        window.app.closeBookPreview();
        window.app.navigateTo('/form');
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
            window.app.previewImage(book.coverUrl, 'cover', 'main-');
        }
        if (book.gift_urls && book.gift_urls.length > 0) {
            setVal('main-giftUrls', book.gift_urls.join('\n'));
            window.app.renderGiftThumbnails('main-');
            window.app.previewGiftImage(book.gift_urls[book.gift_urls.length - 1], 'main-');
        }

        document.getElementById('manga-form').dataset.catalogId = book.id;
    }

export function startCoverScan() {
        window.app.navigateTo('/add');
        const modal = document.getElementById('ai-scan-modal');
        if (!modal) return;
        // Reset trạng thái
        store.aiScanImageDataUrl = null;
        document.getElementById('ai-scan-placeholder').style.display = 'flex';
        document.getElementById('ai-scan-preview-img').style.display = 'none';
        document.getElementById('ai-scan-processing').style.display = 'none';
        document.getElementById('ai-scan-results').style.display = 'none';
        document.getElementById('ai-scan-results-list').innerHTML = '';
        const retryBtn = document.getElementById('ai-scan-retry-btn');
        if (retryBtn) retryBtn.style.display = 'none';
        const fileInput = document.getElementById('ai-cover-file-input');
        if (fileInput) fileInput.value = '';
        modal.classList.remove('hidden');
        modal.classList.add('show');
        if (window.feather) { try { feather.replace(); } catch(e) {} }
    }

export function stopCoverScan() {
        const modal = document.getElementById('ai-scan-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('show');
        }
        store.aiScanImageDataUrl = null;
    }

export function handleCoverScanFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            store.aiScanImageDataUrl = e.target.result;
            // Hiển thị preview ảnh
            const placeholder = document.getElementById('ai-scan-placeholder');
            const previewImg = document.getElementById('ai-scan-preview-img');
            if (placeholder) placeholder.style.display = 'none';
            if (previewImg) {
                previewImg.src = store.aiScanImageDataUrl;
                previewImg.style.display = 'block';
            }
            document.getElementById('ai-scan-results').style.display = 'none';
            // Tự động chạy OCR
            window.app.runCoverOcr();
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    }

export async function runCoverOcr() {
        if (!store.aiScanImageDataUrl) {
            window.app.showToast('Vui lòng chọn ảnh bìa trước!', 'error');
            return;
        }

        // Hiện loading overlay
        const processingEl = document.getElementById('ai-scan-processing');
        const statusEl = document.getElementById('ai-scan-status');
        const retryBtn = document.getElementById('ai-scan-retry-btn');
        if (processingEl) processingEl.style.display = 'flex';
        if (retryBtn) retryBtn.style.display = 'none';

        try {
            const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };
            setStatus('Đang tải trí tuệ nhân tạo (OCR)...');
            await window.app.loadLibrary('https://unpkg.com/tesseract.js@v5/dist/tesseract.min.js', 'Tesseract');

            // Chạy Tesseract OCR — nhận diện tiếng Việt + tiếng Anh
            setStatus('Đang khởi động AI nhận diện chữ...');

            const { data: { text } } = await Tesseract.recognize(
                store.aiScanImageDataUrl,
                'vie+eng',
                {
                    logger: (m) => {
                        if (m.status === 'recognizing text') {
                            setStatus(`Đang đọc chữ... ${Math.round((m.progress || 0) * 100)}%`);
                        } else if (m.status === 'loading language traineddata') {
                            setStatus('Đang tải ngôn ngữ...');
                        }
                    }
                }
            );

            setStatus('Đang tìm kiếm trong kho sách...');
            await window.app.searchCatalogByOcrText(text);
        } catch (err) {
            console.error('[AI Vision] OCR error:', err);
            if (processingEl) processingEl.style.display = 'none';
            if (retryBtn) retryBtn.style.display = 'flex';
            window.app.showToast('Lỗi nhận diện ảnh. Thử lại với ảnh rõ hơn!', 'error');
        }
    }

export async function searchCatalogByOcrText(rawText) {
        const processingEl = document.getElementById('ai-scan-processing');
        const retryBtn = document.getElementById('ai-scan-retry-btn');

        try {
            // Làm sạch text OCR: loại ký tự đặc biệt, giữ chữ + số + khoảng trắng
            const cleaned = rawText
                .replace(/[^\w\sÀ-ỹà-ỹĂăÂâĐđÊêÔôƠơƯư]/gi, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            // Tách thành từng từ có nghĩa (dài >= 3 ký tự)
            const words = cleaned.split(' ')
                .map(w => w.trim())
                .filter(w => w.length >= 3)
                .slice(0, 20); // Tối đa 20 từ đầu tiên

            if (words.length === 0) {
                if (processingEl) processingEl.style.display = 'none';
                if (retryBtn) retryBtn.style.display = 'flex';
                window.app.showToast('Không đọc được chữ từ ảnh. Thử chụp rõ hơn!', 'error');
                return;
            }

            // Tìm trong catalog — thử từng cụm 3 từ liên tiếp
            let results = [];
            const searchPhrases = [];

            // Cụm 3 từ liên tiếp
            for (let i = 0; i < Math.min(words.length - 2, 5); i++) {
                searchPhrases.push(words.slice(i, i + 3).join(' '));
            }
            // Cụm 2 từ liên tiếp
            for (let i = 0; i < Math.min(words.length - 1, 8); i++) {
                searchPhrases.push(words.slice(i, i + 2).join(' '));
            }

            // Gọi Supabase catalog với các cụm tìm kiếm song song
            const searchPromises = searchPhrases.slice(0, 6).map(phrase =>
                supabase.from('catalog').select('*')
                    .or(`series.ilike.%${phrase}%,title.ilike.%${phrase}%`)
                    .limit(5)
            );

            const searchResults = await Promise.all(searchPromises);
            const seen = new Set();
            searchResults.forEach(res => {
                if (res.data) {
                    res.data.forEach(item => {
                        if (!seen.has(item.id)) {
                            seen.add(item.id);
                            results.push(item);
                        }
                    });
                }
            });

            if (processingEl) processingEl.style.display = 'none';
            if (retryBtn) retryBtn.style.display = 'flex';

            if (results.length === 0) {
                window.app.showToast('Không tìm thấy sách phù hợp trong kho. Hãy nhập thủ công!', 'info');
                document.getElementById('ai-scan-results').style.display = 'none';
                return;
            }

            // Hiển thị kết quả để chọn
            window.app._showAiScanResults(results);
        } catch (err) {
            console.error('[AI Vision] Search error:', err);
            if (processingEl) processingEl.style.display = 'none';
            if (retryBtn) retryBtn.style.display = 'flex';
            window.app.showToast('Lỗi tìm kiếm catalog. Vui lòng thử lại!', 'error');
        }
    }

export function _showAiScanResults(results) {
        const container = document.getElementById('ai-scan-results');
        const list = document.getElementById('ai-scan-results-list');
        if (!container || !list) return;

        list.innerHTML = '';
        results.forEach(book => {
            const div = document.createElement('div');
            div.className = 'ai-result-item';
            div.onclick = () => {
                book.coverUrl = book.cover_url;
                window.app.stopCoverScan();
                window.app.showBookPreview(book);
            };
            div.innerHTML = `
                ${book.cover_url
                    ? `<img src="${book.cover_url}" class="ai-result-cover" onerror="window.app.style.display='none'">`
                    : `<div class="ai-result-cover" style="display:flex;align-items:center;justify-content:center;"><i data-feather="book" style="width:20px;height:20px;color:#6b7280;"></i></div>`
                }
                <div class="ai-result-info">
                    <div class="ai-result-title">${book.series || book.title || 'Không rõ'}</div>
                    <div class="ai-result-meta">${book.title || ''} ${book.volume ? '• Tập ' + book.volume : ''}</div>
                    <div class="ai-result-meta">${[book.author, book.publisher].filter(Boolean).join(' · ')}</div>
                </div>
                <span class="ai-result-badge">Chọn</span>
            `;
            list.appendChild(div);
        });

        container.style.display = 'block';
        if (window.feather) { try { feather.replace(); } catch(e) {} }
        window.app.showToast(`Tìm thấy ${results.length} kết quả — chọn cuốn phù hợp!`, 'info');
    }