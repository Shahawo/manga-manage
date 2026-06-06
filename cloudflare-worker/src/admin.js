import { Hono } from 'hono';
import { requireAuth } from './auth.js';

const app = new Hono();

app.use('*', requireAuth);

// Admin check middleware
const requireAdmin = async (c, next) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare('SELECT * FROM admin_users WHERE user_id = ?').bind(user.id).all();
  if (results.length === 0) {
    return c.json({ error: 'Unauthorized: Admin access required' }, 403);
  }
  await next();
};

app.get('/check', requireAdmin, (c) => {
  return c.json({ isAdmin: true });
});

// Create pending contribution
app.post('/pending', async (c) => {
  const data = await c.req.json();
  const id = crypto.randomUUID();
  try {
    await c.env.DB.prepare(`
      INSERT INTO pending_catalog (
        id, submitted_by, submitted_name, submitted_email, linked_manga_id, 
        catalog_id, scanned_isbn, series, title, volume, isbn, author, 
        translator, publisher, distributor, publish_date, pages, size, price, cover_url, note, gift_urls
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, data.submitted_by, data.submitted_name, data.submitted_email, data.linked_manga_id, 
      data.catalog_id, data.scanned_isbn, data.series, data.title, data.volume || null, data.isbn, data.author, 
      data.translator, data.publisher, data.distributor, data.publish_date, data.pages, data.size, data.price, data.cover_url, data.note, JSON.stringify(data.gift_urls || [])
    ).run();
    return c.json({ success: true, id });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

app.post('/pending/:id/reject', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const { reason } = await c.req.json();
  try {
    await c.env.DB.prepare('UPDATE pending_catalog SET status = "rejected", reject_note = ? WHERE id = ?').bind(reason || null, id).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

app.put('/catalog/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  try {
    await c.env.DB.prepare(`
      UPDATE catalog SET 
        series=?, title=?, volume=?, isbns=?, author=?, translator=?, publisher=?, distributor=?, 
        publish_date=?, pages=?, size=?, price=?, cover_url=?, note=?, gift_urls=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).bind(
      data.series, data.title, data.volume || null, JSON.stringify(data.isbns || []), data.author, data.translator,
      data.publisher, data.distributor, data.publish_date, data.pages, data.size, data.price,
      data.cover_url, data.note, JSON.stringify(data.gift_urls || []), id
    ).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// --- FEEDBACK ---
app.get('/feedback', requireAdmin, async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM feedback ORDER BY created_at DESC').all();
    return c.json({ data: results });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

app.delete('/feedback/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare('DELETE FROM feedback WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// --- SCHEDULE ---
app.get('/schedule', requireAdmin, async (c) => {
  const start = c.req.query('start');
  const end = c.req.query('end');
  try {
    let query = 'SELECT * FROM release_calendar';
    let params = [];
    if (start && end) {
      query += ' WHERE release_date >= ? AND release_date <= ?';
      params.push(start, end);
    }
    query += ' ORDER BY release_date DESC';
    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    return c.json({ data: results });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

app.get('/schedule/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM release_calendar WHERE id = ?').bind(id).all();
    return c.json({ data: results[0] });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

app.delete('/schedule/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare('DELETE FROM release_calendar WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// --- PENDING ---
app.get('/pending', requireAdmin, async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM pending_catalog ORDER BY created_at DESC').all();
    return c.json({ data: results });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

app.put('/pending/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  try {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    await c.env.DB.prepare(`UPDATE pending_catalog SET ${setClause} WHERE id = ?`).bind(...values, id).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

app.post('/pending/:id/approve', requireAdmin, async (c) => {
  const id = c.req.param('id');
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM pending_catalog WHERE id = ?').bind(id).all();
    if (results.length === 0) return c.json({ error: 'Not found' }, 404);
    
    const p = results[0];
    const catalogId = p.catalog_id || crypto.randomUUID();
    const isbns = [p.isbn, p.scanned_isbn].filter(Boolean);
    const uniqueIsbns = [...new Set(isbns)];

    if (!p.catalog_id) {
      // Insert new
      await c.env.DB.prepare(`
        INSERT INTO catalog (id, series, title, volume, isbns, author, translator, publisher, distributor, publish_date, pages, size, price, cover_url, note, gift_urls)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        catalogId, p.series, p.title, p.volume || null, JSON.stringify(uniqueIsbns), p.author, p.translator, p.publisher, p.distributor, 
        p.publish_date, p.pages, p.size, p.price, p.cover_url, p.note, p.gift_urls
      ).run();
    }

    // Update pending status
    await c.env.DB.prepare('UPDATE pending_catalog SET status = "approved", catalog_id = ? WHERE id = ?').bind(catalogId, id).run();

    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

app.post('/pending/merge', requireAdmin, async (c) => {
  const { pending_id, catalog_id } = await c.req.json();
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM pending_catalog WHERE id = ?').bind(pending_id).all();
    if (results.length === 0) return c.json({ error: 'Not found' }, 404);
    
    const p = results[0];
    const { results: catResults } = await c.env.DB.prepare('SELECT isbns FROM catalog WHERE id = ?').bind(catalog_id).all();
    if (catResults.length === 0) return c.json({ error: 'Catalog not found' }, 404);

    let isbns = [];
    try { isbns = JSON.parse(catResults[0].isbns || '[]'); } catch(e) {}
    if (!Array.isArray(isbns)) isbns = [];

    if (p.isbn && !isbns.includes(p.isbn)) isbns.push(p.isbn);
    if (p.scanned_isbn && !isbns.includes(p.scanned_isbn)) isbns.push(p.scanned_isbn);

    await c.env.DB.prepare('UPDATE catalog SET isbns = ? WHERE id = ?').bind(JSON.stringify(isbns), catalog_id).run();
    await c.env.DB.prepare('UPDATE pending_catalog SET status = "merged", catalog_id = ? WHERE id = ?').bind(catalog_id, pending_id).run();

    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// --- CATALOG ---
app.get('/catalog', requireAdmin, async (c) => {
  const limit = parseInt(c.req.query('limit')) || 50;
  const offset = parseInt(c.req.query('offset')) || 0;
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM catalog ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(limit, offset).all();
    const { results: countRes } = await c.env.DB.prepare('SELECT COUNT(*) as c FROM catalog').all();
    return c.json({ data: results, count: countRes[0].c });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// --- SERIES METADATA ---
app.get('/series-metadata', requireAdmin, async (c) => {
  const series = c.req.query('series');
  if (!series) return c.json({ error: 'Missing series' }, 400);
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM series_metadata WHERE series = ?').bind(series).all();
    return c.json({ data: results[0] || null });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

app.put('/series-metadata', requireAdmin, async (c) => {
  const { series, total_volumes } = await c.req.json();
  if (!series) return c.json({ error: 'Missing series' }, 400);
  try {
    await c.env.DB.prepare(`
      INSERT INTO series_metadata (series, total_volumes) VALUES (?, ?)
      ON CONFLICT(series) DO UPDATE SET total_volumes = ?
    `).bind(series, total_volumes, total_volumes).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// --- STORAGE CLEANUP ---
app.post('/storage/cleanup', requireAdmin, async (c) => {
  try {
    const usedKeys = new Set();
    const extractKey = (url) => {
      if (url && typeof url === 'string' && url.includes('/api/storage/')) {
        usedKeys.add(url.split('/api/storage/')[1]);
      }
    };

    const tables = [
      { name: 'manga', cols: ['cover_url', 'gift_urls'] },
      { name: 'catalog', cols: ['cover_url', 'gift_urls'] },
      { name: 'pending_catalog', cols: ['cover_url', 'gift_urls'] },
      { name: 'release_calendar', cols: ['cover_url'] }
    ];

    for (const table of tables) {
      const res = await c.env.DB.prepare(`SELECT ${table.cols.join(', ')} FROM ${table.name}`).all();
      for (const row of res.results) {
        extractKey(row.cover_url);
        if (table.cols.includes('gift_urls')) {
          try {
            const gifts = JSON.parse(row.gift_urls || '[]');
            for (const g of gifts) extractKey(g);
          } catch(e) {}
        }
      }
    }

    let cursor;
    const r2Objects = [];
    do {
      const listed = await c.env.BUCKET.list({ cursor });
      for (const object of listed.objects) {
        r2Objects.push(object);
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    const now = new Date();
    const deleted = [];
    for (const object of r2Objects) {
      if (!usedKeys.has(object.key)) {
        // Only delete if older than 1 hour (3600000ms) to avoid race conditions with ongoing uploads
        const ageMs = now - new Date(object.uploaded);
        if (ageMs > 3600000) {
          await c.env.BUCKET.delete(object.key);
          deleted.push(object.key);
        }
      }
    }

    return c.json({ success: true, deleted_count: deleted.length, deleted_keys: deleted, total_objects: r2Objects.length });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

export default app;
