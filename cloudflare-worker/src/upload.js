import { Hono } from 'hono';

const app = new Hono();

app.post('/', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'];
  const path = body['path'] || file.name;
  
  if (!file) {
    return c.json({ error: 'No file uploaded' }, 400);
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // manga-covers is bound as c.env.BUCKET
    await c.env.BUCKET.put(path, arrayBuffer, {
      httpMetadata: { contentType: file.type }
    });

    const reqUrl = new URL(c.req.url);
    const baseUrl = c.env.R2_PUBLIC_URL ? c.env.R2_PUBLIC_URL : `${reqUrl.protocol}//${reqUrl.host}/api/storage`;
    const publicUrl = `${baseUrl}/${path}`;
    return c.json({ data: { publicUrl } });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

export default app;
