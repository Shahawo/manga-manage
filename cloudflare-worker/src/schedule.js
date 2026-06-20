import { Hono } from 'hono';

const app = new Hono();

app.get('/', async (c) => {
  const from = c.req.query('from');
  const to = c.req.query('to');

  try {
    let stmt = c.env.DB.prepare(
      'SELECT * FROM release_calendar WHERE release_date >= ? AND release_date <= ? ORDER BY release_date ASC, title ASC'
    ).bind(from, to);
    
    const { results } = await stmt.all();
    return c.json({ data: results });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

app.post('/admin/import', async (c) => {
  const data = await c.req.json();
  const id = crypto.randomUUID();
  console.log('Incoming import data:', data.title, data.cover_url);
  try {
    // Check for duplicate title, volume, release date, and edition
    const { results } = await c.env.DB.prepare(
      'SELECT id, cover_url FROM release_calendar WHERE title = ? AND volume = ? AND release_date = ? AND edition = ? LIMIT 1'
    ).bind(data.title, data.volume || null, data.release_date, data.edition || 'standard').all();
    
    if (results.length > 0) {
      const existing = results[0];
      // If the existing record doesn't have a cover, but new data does, update it!
      if (data.cover_url && (!existing.cover_url || existing.cover_url.trim() === '')) {
        await c.env.DB.prepare(
          'UPDATE release_calendar SET cover_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind(data.cover_url, existing.id).run();
      }
      return c.json({ error: 'duplicate' });
    }

    await c.env.DB.prepare(`
      INSERT INTO release_calendar (id, catalog_id, release_date, series, title, volume, publisher, price, cover_url, edition, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, data.catalog_id || null, data.release_date, data.series || null, data.title, data.volume || null, 
      data.publisher || null, data.price || null, data.cover_url || null, data.edition || 'standard', data.note || null
    ).run();

    return c.json({ success: true, id });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

export default app;
