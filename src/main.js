import { store } from './store.js';
import * as settings from './core/settings.js';
import * as router from './core/router.js';
import * as ui from './core/ui.js';

import * as auth from './core/auth.js';
import * as api from './core/api.js';
import * as apiClient from './utils/api-client.js';
import * as manga from './features/manga/manga.js';
import * as dashboard from './features/manga/dashboard.js';
import * as ui_modal from './core/uiModal.js';
import * as form from './features/manga/form.js';
import * as scanner from './features/manga/scanner.js';
import * as admin from './features/admin/admin.js';
import * as adminCatalog from './features/admin/admin-catalog.js';
import * as adminPending from './features/admin/admin-pending.js';
import * as adminSchedule from './features/admin/admin-schedule.js';
import * as stats from './features/stats/stats.js';
import * as schedule from './features/schedule/schedule.js';
import * as scheduleImport from './features/schedule/schedule-import.js';

// Nạp HTML bằng Vite
import adminHtml from './views/admin.html?raw';
import formHtml from './views/form.html?raw';
import modalsHtml from './views/modals.html?raw';
import dashboardHtml from './views/dashboard.html?raw';
import detailHtml from './views/detail.html?raw';
import addMethodHtml from './views/add-method.html?raw';
import searchHtml from './views/search.html?raw';
import aboutHtml from './views/about.html?raw';
import statsHtml from './views/stats.html?raw';
import scheduleHtml from './views/schedule.html?raw';
import comingSoonHtml from './views/coming-soon.html?raw';

// Bơm HTML vào DOM trước khi khởi tạo
const mainContainer = document.querySelector('main.container');
if (mainContainer) {
    mainContainer.insertAdjacentHTML('beforeend', dashboardHtml);
    mainContainer.insertAdjacentHTML('beforeend', detailHtml);
    mainContainer.insertAdjacentHTML('beforeend', addMethodHtml);
    mainContainer.insertAdjacentHTML('beforeend', searchHtml);
    mainContainer.insertAdjacentHTML('beforeend', aboutHtml);
    mainContainer.insertAdjacentHTML('beforeend', statsHtml);
    mainContainer.insertAdjacentHTML('beforeend', scheduleHtml);
    mainContainer.insertAdjacentHTML('beforeend', comingSoonHtml);
    
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
    ...apiClient,
    ...manga,
    ...dashboard,
    ...ui_modal,
    ...form,
    ...scanner,
    ...admin,
    ...adminCatalog,
    ...adminPending,
    ...adminSchedule,
    ...stats,
    ...schedule,
    ...scheduleImport
};
window.app = app;

// We must extract init manually to be called after all mixins
app.init();
app.initGoogleAuth();

