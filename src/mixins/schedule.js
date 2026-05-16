/**
 * schedule.js — Lịch Phát Hành Module
 * Handles fetch, render, navigation, filter for the /schedule view.
 * Data source: Supabase public.release_calendar (anon read, no auth required)
 */

import { supabase } from '../supabase-client.js';
import { store } from '../store.js';

// ─── Internal state ──────────────────────────────────────────────────────────
const calendarState = {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1, // 1-indexed
    allReleases: [],        // all fetched for current month (unfiltered)
    filteredReleases: [],   // after publisher filter applied
    selectedPublishers: [], // active publisher filter values
    pickerYear: null,       // temp year in picker UI
    pickerMonth: null,      // temp month in picker UI (1-indexed)
    releaseDates: [],       // sorted list of release dates for quick-nav
};

// Vietnamese month names & weekday names
const MONTHS_VI = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
const WEEKDAYS_VI = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

const EDITION_LABELS = {
    'standard': null,
    'special': 'Bản Đặc Biệt',
    'collector': 'Bản Sưu Tầm',
    'limited': 'Bản Giới Hạn',
};

// ─── Entry point ─────────────────────────────────────────────────────────────

/** Called from router when entering /schedule */
export async function renderCalendar() {
    calendarState.year = new Date().getFullYear();
    calendarState.month = new Date().getMonth() + 1;
    calendarState.selectedPublishers = [];

    _updateMonthLabel();
    _initMonthPicker();
    await _fetchAndRender();
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function _fetchAndRender() {
    _setLoading(true);

    const firstDay = `${calendarState.year}-${String(calendarState.month).padStart(2, '0')}-01`;
    const lastDay = _getLastDay(calendarState.year, calendarState.month);

    const { data, error } = await supabase
        .from('release_calendar')
        .select('*')
        .gte('release_date', firstDay)
        .lte('release_date', lastDay)
        .order('release_date', { ascending: true })
        .order('title', { ascending: true });

    _setLoading(false);

    if (error) {
        console.error('[schedule] fetch error:', error);
        _renderError(error.message);
        return;
    }

    calendarState.allReleases = data ?? [];
    calendarState.selectedPublishers = [];

    _buildPublisherFilter(calendarState.allReleases);
    _applyFilterAndRender();
}

function _getLastDay(year, month) {
    // Get last day of the month
    const d = new Date(year, month, 0); // month is 1-indexed, Date uses 0-indexed
    return `${year}-${String(month).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Filter ───────────────────────────────────────────────────────────────────

function _applyFilterAndRender() {
    if (calendarState.selectedPublishers.length === 0) {
        calendarState.filteredReleases = [...calendarState.allReleases];
    } else {
        calendarState.filteredReleases = calendarState.allReleases.filter(r =>
            calendarState.selectedPublishers.includes(r.publisher)
        );
    }
    _render(calendarState.filteredReleases);
}

// ─── Render ───────────────────────────────────────────────────────────────────

function _render(releases) {
    const body = document.getElementById('schedule-body');
    if (!body) return;

    if (!releases || releases.length === 0) {
        body.innerHTML = `
            <div class="schedule-empty">
                <i data-feather="calendar" style="width:48px;height:48px;color:var(--text-muted);margin-bottom:1rem;"></i>
                <h3>Không có sách phát hành tháng này</h3>
                <p style="color:var(--text-muted);">Hãy quay lại sau hoặc chuyển sang tháng khác.</p>
            </div>`;
        if (window.feather) feather.replace();
        _showQuickNav(false);
        return;
    }

    // Group by date
    const groups = _groupByDate(releases);
    calendarState.releaseDates = Object.keys(groups).sort();

    // Build user's series max volume map for "Mua tiếp" logic
    const userSeriesMap = _buildUserSeriesMap();

    const html = calendarState.releaseDates.map(dateStr => {
        const books = groups[dateStr];
        const dateObj = new Date(dateStr + 'T00:00:00');
        const weekday = WEEKDAYS_VI[dateObj.getDay()];
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');

        const cardsHtml = books.map(b => _renderCard(b, userSeriesMap)).join('');

        return `
            <div class="schedule-day-group release-day" id="rday-${dateStr}" data-date="${dateStr}">
                <div class="schedule-date-col">
                    <div class="schedule-date-weekday">${weekday}</div>
                    <div class="schedule-date-num">${day}</div>
                    <div class="schedule-date-month">${month}</div>
                </div>
                <div class="schedule-cards-grid">${cardsHtml}</div>
            </div>`;
    }).join('');

    body.innerHTML = html;

    // Lazy load images
    _initLazyImages(body);

    if (window.feather) feather.replace();

    _showQuickNav(true);
    _updateQuickNavButtons();
    _highlightNearestDay();
}

function _renderCard(book, userSeriesMap) {
    const coverSrc = book.cover_url || '';
    const priceText = book.price ? book.price.toLocaleString('vi-VN') + ' đ' : '';
    const volText = book.volume ? `Tập ${book.volume % 1 === 0 ? parseInt(book.volume) : book.volume}` : '';
    const editionLabel = EDITION_LABELS[book.edition] ?? null;

    // "Mua tiếp" badge logic (only for logged-in users)
    let badge = '';
    if (editionLabel) {
        badge = `<span class="schedule-badge schedule-badge-edition">${editionLabel}</span>`;
    }

    // Check if this is the "next volume" for logged-in user
    let buyNextBadge = '';
    if (store.user && book.series && book.volume && userSeriesMap[book.series] !== undefined) {
        const maxUserVol = userSeriesMap[book.series];
        // Next volume = user has vol N and release is vol N+1 (allowing for .5 specials)
        if (book.volume === maxUserVol + 1 || book.volume === Math.floor(maxUserVol) + 1) {
            buyNextBadge = `<span class="schedule-badge schedule-badge-buynext">Mua tiếp</span>`;
        }
    }

    const imgPlaceholder = `data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7`;

    return `
        <div class="schedule-card">
            <div class="schedule-card-cover-wrap">
                ${badge}
                <img class="schedule-card-cover lazy-img"
                     data-src="${_esc(coverSrc)}"
                     src="${imgPlaceholder}"
                     alt="${_esc(book.title)}"
                     loading="lazy"
                     onerror="this.style.display='none'">
                ${!coverSrc ? `<div class="schedule-card-no-cover"><i data-feather="book" style="width:32px;height:32px;color:var(--text-muted);"></i><span>${_esc(book.title)}</span></div>` : ''}
            </div>
            <div class="schedule-card-info">
                <div class="schedule-card-title" title="${_esc(book.title)}">${_esc(book.title)}</div>
                ${volText ? `<div class="schedule-card-vol">${volText}</div>` : ''}
                ${priceText ? `<div class="schedule-card-price">${priceText}</div>` : ''}
                ${buyNextBadge}
            </div>
        </div>`;
}

function _groupByDate(releases) {
    return releases.reduce((acc, r) => {
        const d = r.release_date;
        if (!acc[d]) acc[d] = [];
        acc[d].push(r);
        return acc;
    }, {});
}

/** Build map: series → max volume user owns */
function _buildUserSeriesMap() {
    if (!store.user || !store.data?.length) return {};
    const map = {};
    for (const item of store.data) {
        const s = item.series;
        const v = parseFloat(item.volume) || 0;
        if (!map[s] || v > map[s]) map[s] = v;
    }
    return map;
}

function _esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _renderError(msg) {
    const body = document.getElementById('schedule-body');
    if (body) body.innerHTML = `<div class="schedule-empty"><i data-feather="alert-circle" style="width:48px;height:48px;color:var(--danger);margin-bottom:1rem;"></i><h3>Lỗi tải dữ liệu</h3><p style="color:var(--text-muted);">${_esc(msg)}</p></div>`;
    if (window.feather) feather.replace();
}

// ─── Publisher filter ─────────────────────────────────────────────────────────

function _buildPublisherFilter(releases) {
    const publishers = [...new Set(releases.map(r => r.publisher).filter(Boolean))].sort();
    const dropdown = document.getElementById('schedule-publisher-dropdown');
    const label = document.getElementById('schedule-publisher-label');
    if (!dropdown) return;

    if (publishers.length === 0) {
        dropdown.innerHTML = '<div style="padding:0.75rem 1rem;color:var(--text-muted);font-size:0.85rem;">Không có dữ liệu</div>';
        return;
    }

    const allItem = `<button class="udrop-item schedule-publisher-item" onclick="app.scheduleSelectPublisher('')">
        <span>Tất cả nhà xuất bản</span>
    </button>`;
    const items = publishers.map(p => `
        <button class="udrop-item schedule-publisher-item" data-pub="${_esc(p)}" onclick="app.scheduleSelectPublisher('${_esc(p)}')">
            <span>${_esc(p)}</span>
        </button>`).join('');

    dropdown.innerHTML = allItem + items;
    if (label) label.textContent = 'Chọn nhà xuất bản';
    calendarState.selectedPublishers = [];
}

export function scheduleSelectPublisher(publisher) {
    // Toggle publisher in selectedPublishers
    if (!publisher) {
        calendarState.selectedPublishers = [];
    } else {
        const idx = calendarState.selectedPublishers.indexOf(publisher);
        if (idx >= 0) {
            calendarState.selectedPublishers.splice(idx, 1);
        } else {
            calendarState.selectedPublishers.push(publisher);
        }
    }

    // Update label
    const label = document.getElementById('schedule-publisher-label');
    if (label) {
        label.textContent = calendarState.selectedPublishers.length === 0
            ? 'Chọn nhà xuất bản'
            : calendarState.selectedPublishers.length === 1
                ? calendarState.selectedPublishers[0]
                : `${calendarState.selectedPublishers.length} NXB đã chọn`;
    }

    // Update active state in dropdown
    document.querySelectorAll('.schedule-publisher-item').forEach(btn => {
        const pub = btn.dataset.pub ?? '';
        const isActive = pub ? calendarState.selectedPublishers.includes(pub) : calendarState.selectedPublishers.length === 0;
        btn.classList.toggle('udrop-item--active', isActive);
    });

    _applyFilterAndRender();

    // Close dropdown
    const dd = document.getElementById('schedule-publisher-dropdown');
    if (dd) dd.classList.add('hidden');
}

// ─── Month navigation ─────────────────────────────────────────────────────────

export function scheduleChangeMonth(delta) {
    let m = calendarState.month + delta;
    let y = calendarState.year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    calendarState.month = m;
    calendarState.year = y;
    _updateMonthLabel();
    _fetchAndRender();
}

function _updateMonthLabel() {
    const el = document.getElementById('schedule-month-label');
    if (el) el.textContent = `${MONTHS_VI[calendarState.month - 1]}/${calendarState.year}`;
}

// ─── Month picker ─────────────────────────────────────────────────────────────

function _initMonthPicker() {
    calendarState.pickerYear = calendarState.year;
    calendarState.pickerMonth = calendarState.month;
    _buildYearSelect();
    _buildMonthGrid();
}

function _buildYearSelect() {
    const sel = document.getElementById('schedule-year-select');
    if (!sel) return;
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = 2020; y <= currentYear + 2; y++) years.push(y);
    sel.innerHTML = years.map(y => `<option value="${y}" ${y === calendarState.pickerYear ? 'selected' : ''}>${y}</option>`).join('');
}

function _buildMonthGrid() {
    const grid = document.getElementById('schedule-month-grid');
    if (!grid) return;
    grid.innerHTML = MONTHS_VI.map((name, i) => {
        const m = i + 1;
        const isActive = m === calendarState.pickerMonth;
        const isCurrent = m === calendarState.month && calendarState.pickerYear === calendarState.year;
        return `<button class="schedule-picker-month ${isActive ? 'active' : ''} ${isCurrent && !isActive ? 'current' : ''}"
            onclick="app.schedulePickerSelectMonth(${m})">${name.replace('Tháng ', '')}</button>`;
    }).join('');
}

export function scheduleToggleMonthPicker() {
    const picker = document.getElementById('schedule-month-picker');
    if (!picker) return;
    calendarState.pickerYear = calendarState.year;
    calendarState.pickerMonth = calendarState.month;
    _buildYearSelect();
    _buildMonthGrid();
    picker.classList.toggle('hidden');
}

export function scheduleUpdatePickerYear() {
    const sel = document.getElementById('schedule-year-select');
    if (sel) calendarState.pickerYear = parseInt(sel.value);
    _buildMonthGrid();
}

export function schedulePickerSelectMonth(m) {
    calendarState.pickerMonth = m;
    _buildMonthGrid();
}

export function scheduleResetToday() {
    calendarState.pickerYear = new Date().getFullYear();
    calendarState.pickerMonth = new Date().getMonth() + 1;
    _buildYearSelect();
    _buildMonthGrid();
}

export function scheduleApplyPicker() {
    calendarState.year = calendarState.pickerYear;
    calendarState.month = calendarState.pickerMonth;
    const picker = document.getElementById('schedule-month-picker');
    if (picker) picker.classList.add('hidden');
    _updateMonthLabel();
    _fetchAndRender();
}

// ─── Quick navigation ─────────────────────────────────────────────────────────

function _showQuickNav(show) {
    const el = document.getElementById('schedule-quick-nav');
    if (el) el.style.display = show ? '' : 'none';
}

function _highlightNearestDay() {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const isCurrentMonth = today.getFullYear() === calendarState.year && today.getMonth() + 1 === calendarState.month;

    const nearestBtn = document.getElementById('schedule-qnav-nearest');
    if (!nearestBtn) return;

    if (isCurrentMonth) {
        // Find nearest upcoming day
        const upcoming = calendarState.releaseDates.filter(d => d >= todayStr);
        nearestBtn.style.display = upcoming.length > 0 ? '' : 'none';
        nearestBtn.dataset.target = upcoming[0] ?? '';
    } else {
        nearestBtn.style.display = 'none';
    }
}

let _currentScrollDate = null;

function _updateQuickNavButtons() {
    _onScroll();
    window.removeEventListener('scroll', _onScroll);
    window.addEventListener('scroll', _onScroll);
}

function _onScroll() {
    const els = document.querySelectorAll('.release-day');
    const visible = Array.from(els).filter(el => el.getBoundingClientRect().bottom > 100);
    if (visible.length > 0) {
        _currentScrollDate = visible[0].dataset.date ?? null;
    }
}

export function scheduleScrollPrev() {
    const idx = calendarState.releaseDates.indexOf(_currentScrollDate);
    const prev = calendarState.releaseDates[idx - 1];
    if (prev) _scrollToDate(prev);
}

export function scheduleScrollNext() {
    const idx = calendarState.releaseDates.indexOf(_currentScrollDate);
    const next = calendarState.releaseDates[idx + 1];
    if (next) _scrollToDate(next);
}

export function scheduleScrollTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function scheduleScrollNearest() {
    const btn = document.getElementById('schedule-qnav-nearest');
    const target = btn?.dataset.target;
    if (target) _scrollToDate(target);
}

function _scrollToDate(dateStr) {
    const el = document.getElementById(`rday-${dateStr}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Lazy image loading ───────────────────────────────────────────────────────

function _initLazyImages(container) {
    const imgs = container.querySelectorAll('img.lazy-img');
    if (!imgs.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const src = img.dataset.src;
                if (src) {
                    img.src = src;
                    img.classList.add('loaded');
                }
                observer.unobserve(img);
            }
        });
    }, { rootMargin: '200px' });

    imgs.forEach(img => observer.observe(img));
}

// ─── Loading state ────────────────────────────────────────────────────────────

function _setLoading(loading) {
    const bar = document.getElementById('schedule-loading-bar');
    if (bar) bar.style.opacity = loading ? '1' : '0';

    const body = document.getElementById('schedule-body');
    if (body && loading) {
        body.innerHTML = `<div class="schedule-loading">
            <div class="schedule-spinner"></div>
            <p style="color:var(--text-muted);margin-top:1rem;">Đang tải lịch phát hành...</p>
        </div>`;
    }
}
