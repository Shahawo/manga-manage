import { supabase } from './supabase-client.js';
import { applyAuthMixin } from './mixins/auth.js';
import { applyApiMixin } from './mixins/api.js';
import { applySettingsMixin } from './mixins/settings.js';
import { applyRouterMixin } from './mixins/router.js';
import { applyUiMixin } from './mixins/ui.js';
import { applyMangaMixin } from './mixins/manga.js';
import { applyCoreMixin } from './mixins/core.js';


const app = {};

applyAuthMixin(app);
applyApiMixin(app);
applySettingsMixin(app);
applyRouterMixin(app);
applyUiMixin(app);
applyMangaMixin(app);
applyCoreMixin(app);

window.app = app;

// We must extract init manually to be called after all mixins
app.init();
