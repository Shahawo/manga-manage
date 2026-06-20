import { Hono } from 'hono';
import { requireAuth } from './auth.js';

const app = new Hono();

app.use('*', requireAuth);

app.get('/', async (c) => {
  const user = c.get('user');
  
  try {
    // 1. Get tracked schedule info by joining user_tracked_schedule with release_calendar
    const { results: trackingInfo } = await c.env.DB.prepare(`
      SELECT 
        r.id as schedule_id,
        r.title,
        r.volume,
        r.release_date,
        r.cover_url,
        r.price
      FROM user_tracked_schedule t
      JOIN release_calendar r ON t.schedule_id = r.id
      WHERE t.user_id = ?
    `).bind(user.id).all();

    // 2. Compute event state dynamically based on CURRENT_DATE
    // Use GMT+7 as standard for Vietnamese users
    const todayObj = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
    
    const year = todayObj.getFullYear();
    const month = String(todayObj.getMonth() + 1).padStart(2, '0');
    const day = String(todayObj.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const tomorrowObj = new Date(todayObj);
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tYear = tomorrowObj.getFullYear();
    const tMonth = String(tomorrowObj.getMonth() + 1).padStart(2, '0');
    const tDay = String(tomorrowObj.getDate()).padStart(2, '0');
    const tomorrowStr = `${tYear}-${tMonth}-${tDay}`;

    const notifications = [];
    
    for (const item of trackingInfo) {
      let eventType = null;
      if (item.release_date === tomorrowStr) {
        eventType = 'tomorrow';
      } else if (item.release_date === todayStr) {
        eventType = 'today';
      } else if (item.release_date < todayStr) {
        eventType = 'released';
      }
      
      if (eventType) {
        notifications.push({
          ...item,
          event_type: eventType,
        });
      }
    }

    if (notifications.length === 0) {
      return c.json({ data: [] });
    }

    // 3. Fetch read statuses
    const { results: readStatuses } = await c.env.DB.prepare(`
      SELECT schedule_id, event_type
      FROM user_notification_reads
      WHERE user_id = ?
    `).bind(user.id).all();

    const readSet = new Set(readStatuses.map(r => `${r.schedule_id}_${r.event_type}`));

    // 4. Map and sort
    const finalNotifications = notifications.map(n => {
      let message = '';
      const volumeStr = n.volume ? `- Tập ${n.volume}` : '';
      const priceStr = n.price ? n.price.toLocaleString('vi-VN') + ' đ' : 'chưa rõ';
      
      if (n.event_type === 'tomorrow') {
        message = `Cuốn <b>${n.title}</b> bạn theo dõi sẽ phát hành vào ngày mai với giá ${priceStr}.`;
      } else if (n.event_type === 'today') {
        message = `Cuốn <b>${n.title}</b> bạn theo dõi chính thức phát hành hôm nay!`;
      } else if (n.event_type === 'released') {
        const parts = n.release_date.split('-');
        let dateStr = n.release_date;
        if (parts.length === 3) dateStr = `${parts[2]}/${parts[1]}`;
        message = `Cuốn <b>${n.title}</b> bạn theo dõi đã phát hành ngày ${dateStr}.`;
      }

      return {
        id: `${n.schedule_id}_${n.event_type}`, // unique key for frontend
        schedule_id: n.schedule_id,
        event_type: n.event_type,
        title: n.title,
        message: message,
        cover_url: n.cover_url,
        release_date: n.release_date,
        is_read: readSet.has(`${n.schedule_id}_${n.event_type}`) ? 1 : 0
      };
    });

    // Sort by release_date DESC
    finalNotifications.sort((a, b) => {
       if (a.release_date > b.release_date) return -1;
       if (a.release_date < b.release_date) return 1;
       // If same date, prioritize 'today' over 'released'
       return 0;
    });

    return c.json({ data: finalNotifications.slice(0, 20) });

  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

app.post('/read', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { schedule_id, event_type } = body;
  
  if (!schedule_id || !event_type) return c.json({ error: 'Missing parameters' }, 400);

  try {
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO user_notification_reads (user_id, schedule_id, event_type) VALUES (?, ?, ?)'
    ).bind(user.id, schedule_id, event_type).run();

    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

export default app;
