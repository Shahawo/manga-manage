import { Hono } from 'hono';

const app = new Hono();

app.post('/', async (c) => {
  const data = await c.req.json();
  const id = crypto.randomUUID();
  try {
    await c.env.DB.prepare(`
      INSERT INTO feedback (id, user_id, user_name, user_email, title, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      id, data.user_id, data.user_name, data.user_email, data.title, data.content
    ).run();
    return c.json({ success: true, id });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

export default app;
