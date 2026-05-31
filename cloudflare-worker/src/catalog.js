import { Hono } from 'hono';

const app = new Hono();

// Global Catalog is readable by anyone
app.get('/', async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM catalog ORDER BY updated_at DESC').all();
    const catalogList = results.map(m => ({
      ...m,
      isbns: JSON.parse(m.isbns || '[]'),
      gift_urls: JSON.parse(m.gift_urls || '[]')
    }));
    return c.json({ data: catalogList });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

app.get('/search', async (c) => {
  const query = c.req.query('q');
  const isbn = c.req.query('isbn');

  try {
    let stmt;
    if (isbn) {
      stmt = c.env.DB.prepare("SELECT * FROM catalog WHERE isbns LIKE ?").bind(`%${isbn}%`);
    } else if (query) {
      stmt = c.env.DB.prepare("SELECT * FROM catalog WHERE title LIKE ? OR series LIKE ? LIMIT 20").bind(`%${query}%`, `%${query}%`);
    } else {
      return c.json({ data: [] });
    }
    
    const { results } = await stmt.all();
    const catalogList = results.map(m => ({
      ...m,
      isbns: JSON.parse(m.isbns || '[]'),
      gift_urls: JSON.parse(m.gift_urls || '[]')
    }));
    return c.json({ data: catalogList });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

export default app;
