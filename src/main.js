import { supabase } from './supabase-client.js';
import * as settings from './mixins/settings.js';
import * as router from './mixins/router.js';
import * as ui from './mixins/ui.js';

import * as auth from './mixins/auth.js';
import * as api from './mixins/api.js';
import * as manga from './mixins/manga.js';
import * as dashboard from './mixins/dashboard.js';
import * as ui_modal from './mixins/uiModal.js';
import * as form from './mixins/form.js';
import * as scanner from './mixins/scanner.js';
import * as admin from './mixins/admin.js';
import * as stats from './mixins/stats.js';
import * as schedule from './mixins/schedule.js';
import * as scheduleImport from './mixins/schedule-import.js';

// Nạp HTML bằng Vite
import adminHtml from './views/admin.html?raw';
import formHtml from './views/form.html?raw';
import modalsHtml from './views/modals.html?raw';

// Bơm HTML vào DOM trước khi khởi tạo
const mainContainer = document.querySelector('main.container');
if (mainContainer) {
    mainContainer.insertAdjacentHTML('beforeend', adminHtml);
    mainContainer.insertAdjacentHTML('beforeend', formHtml);
    mainContainer.insertAdjacentHTML('beforeend', modalsHtml);
}

const app = {
    ...settings,
    ...router,
    ...ui,
    ...auth,
    ...api,
    ...manga,
    ...dashboard,
    ...ui_modal,
    ...form,
    ...scanner,
    ...admin,
    ...stats,
    ...schedule,
    ...scheduleImport
};
window.app = app;

// We must extract init manually to be called after all mixins
app.init();

