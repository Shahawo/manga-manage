import { verify } from 'hono/jwt';

export const requireAuth = async (c, next) => {
  // 1. Check for mock auth in local dev
  const mockUser = c.req.header('X-Mock-User');
  if (mockUser) {
    const user = JSON.parse(mockUser);
    c.set('user', user);
    return await next();
  }

  // 2. Custom JWT (Bearer token)
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Missing or invalid token format' }, 401);
  }

  const token = authHeader.substring(7);
  const jwtSecret = c.env.JWT_SECRET || 'default_secret_for_development_only';

  try {
    const payload = await verify(token, jwtSecret, 'HS256');
    
    // Set user info
    c.set('user', {
      id: payload.sub,
      email: payload.email,
      name: payload.name || payload.email.split('@')[0],
      user_metadata: {
        avatar_url: payload.picture
      }
    });
    
    await next();
  } catch (err) {
    return c.json({ error: 'Invalid Token: ' + err.message }, 403);
  }
};
