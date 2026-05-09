import { supabase } from '../supabase-client.js';

export function applySettingsMixin(app) {
    Object.assign(app, {
        

    // ─── CÀI ĐẶT (SETTINGS) ──────────────────────────────────────────────────
    settings: {
        gridCols: localStorage.getItem('gridCols') || localStorage.getItem('setting_gridCols') || '6',
        fontSize: localStorage.getItem('fontSize') || localStorage.getItem('setting_fontSize') || 'normal'
    },

    setSetting(key, value) {
        this.settings[key] = value;
        localStorage.setItem(key, value);
        localStorage.removeItem(`setting_${key}`);
        this.applySettings();
    },
        

    applySettings() {
        // Cột Grid
        document.documentElement.style.setProperty('--grid-cols', this.settings.gridCols);
        document.querySelectorAll('.settings-chip[id^="chip-"]').forEach(el => {
            if (!el.id.includes('fs')) el.classList.remove('active');
        });
        const chipGrid = document.getElementById(`chip-${this.settings.gridCols}`);
        if (chipGrid) chipGrid.classList.add('active');

        // Cỡ chữ
        let fsValue = '1rem';
        if (this.settings.fontSize === 'small') fsValue = '14px';
        if (this.settings.fontSize === 'large') fsValue = '18px';
        if (this.settings.fontSize === 'xlarge') fsValue = '20px';
        if (this.settings.fontSize === 'normal') fsValue = '16px';
        document.documentElement.style.fontSize = fsValue;
        document.documentElement.style.setProperty('--fs-base', fsValue);

        document.querySelectorAll('.settings-chip[id^="chip-fs-"]').forEach(el => el.classList.remove('active'));
        const chipFs = document.getElementById(`chip-fs-${this.settings.fontSize}`);
        if (chipFs) chipFs.classList.add('active');
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
            const cols = this.settings.gridCols || localStorage.getItem('gridCols') || '6';
            document.querySelectorAll('.settings-chip').forEach(c => c.classList.remove('active'));
            const chip = document.getElementById(`chip-${cols}`);
            if (chip) chip.classList.add('active');

            const fontSize = this.settings.fontSize || localStorage.getItem('fontSize') || 'normal';
            const fsChip = document.getElementById(`chip-fs-${fontSize}`);
            if (fsChip) fsChip.classList.add('active');

            const showProgress = localStorage.getItem('showProgress') !== 'false';
            const progressSwitch = document.getElementById('progress-switch');
            if (progressSwitch) progressSwitch.classList.toggle('active', showProgress);

            if (window.feather) { try { feather.replace(); } catch (e) { console.warn('Feather error:', e); } }
        }
    },
    closeSettings() {
        const overlay = document.getElementById('settings-overlay');
        if (overlay) overlay.style.display = 'none';
    },
        
    setSetting(key, value) {
        this.settings[key] = value;
        localStorage.setItem(key, value);
        localStorage.removeItem(`setting_${key}`);
        if (key === 'gridCols') {
            document.documentElement.style.setProperty('--grid-cols', value);
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
        
    applyFontSize(size) {
        const map = { small: '0.875rem', normal: '1rem', large: '1.1rem', xlarge: '1.2rem' };
        document.documentElement.style.setProperty('--fs-base', map[size] || '1rem');
    }
    });
}
