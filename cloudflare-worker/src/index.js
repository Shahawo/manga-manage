import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sign } from 'hono/jwt';
import { requireAuth } from './auth.js';
import libraryApp from './library.js';
import catalogApp from './catalog.js';
import uploadApp from './upload.js';
import scheduleApp from './schedule.js';
import adminApp from './admin.js';
import feedbackApp from './feedback.js';
import notificationsApp from './notifications.js';

const app = new Hono();

// Global CORS config
app.use('/api/*', cors({
  origin: '*', // TODO: Restrict to frontend origin later
  allowHeaders: ['Content-Type', 'Authorization', 'X-Mock-User'],
  allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE'],
  credentials: true,
}));

app.route('/api/library', libraryApp);
app.route('/api/catalog', catalogApp);
app.use('/api/upload/*', requireAuth);
app.route('/api/upload', uploadApp);
app.route('/api/schedule', scheduleApp);
app.route('/api/admin', adminApp);
app.route('/api/feedback', feedbackApp);
app.route('/api/notifications', notificationsApp);

// R2 Storage file server
app.get('/api/storage/:path{.*}', async (c) => {
  const path = c.req.param('path');
  try {
    const object = await c.env.BUCKET.get(path);
    if (!object) return c.json({ error: 'File not found' }, 404);
    
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    
    return new Response(object.body, { headers });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// Setup routes
app.get('/api', (c) => {
  return c.json({ message: 'Hello from Manga Cloudflare Worker API' });
});

// Auto migrate endpoint (unprotected)
app.get('/api/migrate', async (c) => {
  try {
    let msg = [];
    try { await c.env.DB.prepare('ALTER TABLE pending_catalog ADD COLUMN status TEXT DEFAULT "pending"').run(); msg.push('added status'); } catch(e) {}
    try { await c.env.DB.prepare('ALTER TABLE pending_catalog ADD COLUMN reject_note TEXT').run(); msg.push('added reject_note'); } catch(e) {}
    return c.json({ success: true, message: 'Migration complete', actions: msg });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// Google Auth Endpoint
app.post('/api/auth/google', async (c) => {
  try {
    const { access_token } = await c.req.json();
    if (!access_token) return c.json({ error: 'Missing token' }, 400);

    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    
    if (!response.ok) {
      return c.json({ error: 'Invalid Google token' }, 401);
    }
    
    const userInfo = await response.json();
    const jwtSecret = c.env.JWT_SECRET || 'default_secret_for_development_only';
    
    const { results } = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userInfo.sub).all();
    if (results.length === 0) {
      await c.env.DB.prepare('INSERT INTO users (id, email, name) VALUES (?, ?, ?)')
        .bind(userInfo.sub, userInfo.email, userInfo.name || userInfo.email.split('@')[0])
        .run();
    }
    
    const payload = {
      sub: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30
    };
    const token = await sign(payload, jwtSecret);
    
    return c.json({ token, user: payload });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Auth failed' }, 500);
  }
});

// Mock Auth Endpoint for local development
app.post('/api/auth/mock', async (c) => {
  if (c.env.ENVIRONMENT !== 'development') {
    return c.json({ error: 'Mock auth only available in development' }, 403);
  }
  const body = await c.req.json();
  const mockToken = btoa(JSON.stringify({ 
    sub: body.id || 'mock-user-123', 
    email: body.email || 'test@example.com',
    name: body.name || 'Test User'
  }));
  return c.json({ token: `mock.${mockToken}.sig` });
});

app.get('/api/me', requireAuth, (c) => {
  const user = c.get('user');
  return c.json({ user });
});

export default app;
