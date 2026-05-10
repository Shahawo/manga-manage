import { supabase } from './supabase-client.js';
import * as settings from './mixins/settings.js';
import * as router from './mixins/router.js';
import * as ui from './mixins/ui.js';

import * as auth from './mixins/auth.js';
import * as api from './mixins/api.js';
import * as manga from './mixins/manga.js';

import { applyCoreMixin } from './mixins/core.js';

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
    ...manga
};
window.app = app;

applyCoreMixin(app);

// We must extract init manually to be called after all mixins
app.init();
