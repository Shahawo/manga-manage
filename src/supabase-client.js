// ============================================================
// supabase-client.js — Khởi tạo Supabase Client
// ⚠️  Thay SUPABASE_URL và SUPABASE_ANON_KEY bằng thông tin thực của bạn
// Lấy tại: Supabase Dashboard → Project Settings → API
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing Supabase credentials! Please check your .env file.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: (...args) => {
      // Bọc fetch mặc định để xử lý lỗi TCP socket bị kẹt sau khi wake up từ tab sleep
      const [url, options] = args;
      const modifiedOptions = { ...options };
      modifiedOptions.headers = new Headers(modifiedOptions.headers || {});
      // Thêm header để tránh trình duyệt cache kết nối chết
      modifiedOptions.headers.set('Cache-Control', 'no-cache');
      return fetch(url, modifiedOptions);
    }
  }
});
