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
  try {
    // Check for duplicate title, volume, and release date
    const { results } = await c.env.DB.prepare(
      'SELECT id FROM release_calendar WHERE title = ? AND volume = ? AND release_date = ? LIMIT 1'
    ).bind(data.title, data.volume || null, data.release_date).all();
    
    if (results.length > 0) {
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
