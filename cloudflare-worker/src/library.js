import { Hono } from 'hono';
import { requireAuth } from './auth.js';

const app = new Hono();

app.use('*', requireAuth);

// Get user library
app.get('/', async (c) => {
  const user = c.get('user');
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM manga WHERE user_id = ? ORDER BY added_at DESC'
    ).bind(user.id).all();
    
    // Parse JSON arrays back to actual arrays for frontend compatibility
    const mangaList = results.map(m => ({
      ...m,
      gift_urls: JSON.parse(m.gift_urls || '[]')
    }));

    return c.json({ data: mangaList });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// Add new manga
app.post('/', async (c) => {
  const user = c.get('user');
  const data = await c.req.json();
  const id = data.id || crypto.randomUUID();
  
  try {
    await c.env.DB.prepare(`
      INSERT INTO manga (id, user_id, series, title, volume, isbn, author, translator, publisher, distributor, publish_date, pages, size, price, note, cover_url, gift_urls, catalog_id, added_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP))
    `).bind(
      id, user.id, data.series ?? null, data.title ?? null, data.volume ?? null, data.isbn ?? null, data.author ?? null, data.translator ?? null,
      data.publisher ?? null, data.distributor ?? null, data.publish_date ?? null, data.pages ?? null, data.size ?? null, data.price ?? null,
      data.note ?? null, data.cover_url ?? null, JSON.stringify(data.gift_urls || []), data.catalog_id ?? null, data.added_at ?? null, data.updated_at ?? null
    ).run();

    return c.json({ success: true, id });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// Update manga
app.put('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const data = await c.req.json();

  try {
    const updateResult = await c.env.DB.prepare(`
      UPDATE manga SET 
        series=?, title=?, volume=?, isbn=?, author=?, translator=?, publisher=?, distributor=?, 
        publish_date=?, pages=?, size=?, price=?, note=?, cover_url=?, gift_urls=?, catalog_id=?, updated_at=COALESCE(?, CURRENT_TIMESTAMP)
      WHERE id=? AND user_id=?
    `).bind(
      data.series ?? null, data.title ?? null, data.volume ?? null, data.isbn ?? null, data.author ?? null, data.translator ?? null,
      data.publisher ?? null, data.distributor ?? null, data.publish_date ?? null, data.pages ?? null, data.size ?? null, data.price ?? null,
      data.note ?? null, data.cover_url ?? null, JSON.stringify(data.gift_urls || []), data.catalog_id ?? null, data.updated_at ?? null,
      id, user.id
    ).run();

    if (updateResult.meta.changes === 0) {
      return c.json({ error: 'Manga not found or unauthorized' }, 404);
    }
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// Delete manga
app.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  try {
    const result = await c.env.DB.prepare('DELETE FROM manga WHERE id = ? AND user_id = ?').bind(id, user.id).run();
    if (result.meta.changes === 0) {
      return c.json({ error: 'Manga not found or unauthorized' }, 404);
    }
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});
// Get meta tracking
app.get('/meta', async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM series_metadata').all();
    return c.json({ data: results });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// Get user settings
app.get('/settings', async (c) => {
  const user = c.get('user');
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM user_series_settings WHERE user_id = ?').bind(user.id).all();
    return c.json({ data: results });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// Update user settings
app.post('/settings', async (c) => {
  const user = c.get('user');
  const data = await c.req.json();
  try {
    const statusVal = data.status !== undefined ? data.status : null;
    await c.env.DB.prepare(`
      INSERT INTO user_series_settings (user_id, series, target_volumes, status, updated_at) 
      VALUES (?, ?, ?, COALESCE(?, 'collecting'), CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, series) DO UPDATE SET 
        target_volumes = CASE WHEN ? IS NOT NULL THEN excluded.target_volumes ELSE user_series_settings.target_volumes END,
        status = CASE WHEN ? IS NOT NULL THEN excluded.status ELSE user_series_settings.status END,
        updated_at=CURRENT_TIMESTAMP
    `).bind(user.id, data.series, data.target_volumes, statusVal, data.target_volumes, statusVal).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// Import data
app.post('/import', async (c) => {
  const user = c.get('user');
  const items = await c.req.json();
  try {
    // Basic bulk insert or batch
    await c.env.DB.prepare('DELETE FROM manga WHERE user_id = ?').bind(user.id).run();
    
    const stmt = c.env.DB.prepare(`
      INSERT INTO manga (id, user_id, series, title, volume, isbn, author, translator, publisher, distributor, publish_date, pages, size, price, note, cover_url, gift_urls, catalog_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const statements = items.map(data => stmt.bind(
      data.id || crypto.randomUUID(), 
      user.id, 
      data.series ?? null, 
      data.title ?? null, 
      data.volume ?? null, 
      data.isbn ?? null, 
      data.author ?? null, 
      data.translator ?? null,
      data.publisher ?? null, 
      data.distributor ?? null, 
      data.publish_date ?? null, 
      data.pages ?? null, 
      data.size ?? null, 
      data.price ?? null,
      data.note ?? null, 
      data.cover_url ?? null, 
      JSON.stringify(data.gift_urls || []), 
      data.catalog_id ?? null
    ));
    
    // Cloudflare D1 has a max batch size of 100. We use chunks of 50 to be safe.
    const CHUNK_SIZE = 50;
    for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
      const chunk = statements.slice(i, i + CHUNK_SIZE);
      await c.env.DB.batch(chunk);
    }
    
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

export default app;
