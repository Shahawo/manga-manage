// ============================================================
// supabase-client.js — Khởi tạo Supabase Client
// ⚠️  Thay SUPABASE_URL và SUPABASE_ANON_KEY bằng thông tin thực của bạn
// Lấy tại: Supabase Dashboard → Project Settings → API
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://uviyjgbgqqsozmkfdvbl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2aXlqZ2JncXFzb3pta2ZkdmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2Nzc5NTcsImV4cCI6MjA5MjI1Mzk1N30.eBmEf5t4DQA5hsgMeKuvpO9mMpBTUbgqsJ-EdSWeJg8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});
