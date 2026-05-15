-- ============================================================
-- MANGA-SUPABASE: Database Schema
-- Chạy toàn bộ file này trong Supabase SQL Editor
-- ============================================================

-- 1. BẢNG MANGA (Kệ sách cá nhân - RLS theo user)
CREATE TABLE IF NOT EXISTS manga (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  series      TEXT NOT NULL,
  title       TEXT NOT NULL,
  volume      FLOAT,
  isbn        TEXT,
  author      TEXT,
  translator  TEXT,
  publisher   TEXT,
  distributor TEXT,
  publish_date DATE,
  pages       INT,
  size        TEXT,
  price       INT,
  note        TEXT,
  cover_url   TEXT,
  gift_urls   TEXT[] DEFAULT '{}',
  catalog_id  UUID,
  added_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index để tìm kiếm nhanh theo user
CREATE INDEX IF NOT EXISTS idx_manga_user_id ON manga(user_id);
CREATE INDEX IF NOT EXISTS idx_manga_series ON manga(series);

-- RLS cho bảng manga
ALTER TABLE manga ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own manga" ON public.manga;
CREATE POLICY "Users can view own manga" ON manga
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own manga" ON public.manga;
CREATE POLICY "Users can insert own manga" ON manga
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own manga" ON public.manga;
CREATE POLICY "Users can update own manga" ON manga
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own manga" ON public.manga;
CREATE POLICY "Users can delete own manga" ON manga
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 2. BẢNG CATALOG (Kho chung sách - public read)
CREATE TABLE IF NOT EXISTS catalog (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series       TEXT,
  title        TEXT NOT NULL,
  volume       FLOAT,
  isbns        TEXT[] DEFAULT '{}',
  author       TEXT,
  translator   TEXT,
  publisher    TEXT,
  distributor  TEXT,
  publish_date DATE,
  pages        INT,
  size         TEXT,
  price        INT,
  cover_url    TEXT,
  note         TEXT,
  gift_urls    TEXT[] DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_series ON catalog(series);
CREATE INDEX IF NOT EXISTS idx_catalog_isbns ON catalog USING GIN(isbns);

ALTER TABLE catalog ENABLE ROW LEVEL SECURITY;

-- Tất cả user đăng nhập đều đọc được catalog
DROP POLICY IF EXISTS "Authenticated users can view catalog" ON public.catalog;
CREATE POLICY "Authenticated users can view catalog" ON catalog
  FOR SELECT USING (auth.role() = 'authenticated');

-- Chỉ service_role mới ghi được
DROP POLICY IF EXISTS "Service role can manage catalog" ON public.catalog;
CREATE POLICY "Service role can manage catalog" ON catalog
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 3. BẢNG PENDING_CATALOG (Sách chờ admin duyệt)
CREATE TABLE IF NOT EXISTS pending_catalog (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by    UUID REFERENCES auth.users(id),
  submitted_name  TEXT,
  submitted_email TEXT,
  linked_manga_id UUID,
  catalog_id      UUID REFERENCES catalog(id),
  scanned_isbn    TEXT,
  series          TEXT,
  title           TEXT,
  volume          FLOAT,
  isbn            TEXT,
  author          TEXT,
  translator      TEXT,
  publisher       TEXT,
  distributor     TEXT,
  publish_date    DATE,
  pages           INT,
  size            TEXT,
  price           INT,
  cover_url       TEXT,
  note            TEXT,
  gift_urls       TEXT[] DEFAULT '{}',
  status          TEXT DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  reject_note     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pending_catalog ENABLE ROW LEVEL SECURITY;

-- Users thêm mới
DROP POLICY IF EXISTS "Users can insert pending" ON public.pending_catalog;
CREATE POLICY "Users can insert pending" ON pending_catalog
  FOR INSERT WITH CHECK (auth.uid() = submitted_by);

-- Users xem pending của mình
DROP POLICY IF EXISTS "Users can view own pending" ON public.pending_catalog;
CREATE POLICY "Users can view own pending" ON pending_catalog
  FOR SELECT USING (auth.uid() = submitted_by);

-- Admin xem toàn bộ (qua RPC / service_role)
DROP POLICY IF EXISTS "Service role manages pending" ON public.pending_catalog;
CREATE POLICY "Service role manages pending" ON pending_catalog
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 4. BẢNG FEEDBACK (Góp ý từ users)
CREATE TABLE IF NOT EXISTS feedback (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id),
  user_name    TEXT,
  user_email   TEXT,
  title        TEXT,
  content      TEXT NOT NULL,
  status       TEXT DEFAULT 'new',   -- 'new' | 'seen'
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert feedback" ON public.feedback;
CREATE POLICY "Users can insert feedback" ON feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
CREATE POLICY "Users can view own feedback" ON feedback
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages feedback" ON public.feedback;
CREATE POLICY "Service role manages feedback" ON feedback
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 5. BẢNG ADMIN_USERS (Danh sách admin)
CREATE TABLE IF NOT EXISTS admin_users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Chỉ service_role mới quản lý admins
DROP POLICY IF EXISTS "Service role manages admins" ON public.admin_users;
CREATE POLICY "Service role manages admins" ON admin_users
  FOR ALL USING (auth.role() = 'service_role');

-- User tự check xem mình có là admin không
DROP POLICY IF EXISTS "Users can check own admin status" ON public.admin_users;
CREATE POLICY "Users can check own admin status" ON admin_users
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- 6. RPC: Kiểm tra admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
  );
END;
$$;

-- 7. RPC: Lấy toàn bộ pending (chỉ admin)
CREATE OR REPLACE FUNCTION public.get_all_pending()
RETURNS SETOF public.pending_catalog
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY SELECT * FROM public.pending_catalog WHERE status = 'pending' ORDER BY created_at DESC;
END;
$$;

-- 8. RPC: Lấy toàn bộ feedback (chỉ admin)
CREATE OR REPLACE FUNCTION public.get_all_feedback()
RETURNS SETOF public.feedback
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY SELECT * FROM public.feedback ORDER BY created_at DESC;
END;
$$;

-- 9. RPC: Admin approve pending → thêm vào catalog
CREATE OR REPLACE FUNCTION public.admin_approve_pending(pending_id UUID, updated_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  p public.pending_catalog%ROWTYPE;
  new_catalog_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT * INTO p FROM public.pending_catalog WHERE id = pending_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending record not found';
  END IF;

  -- Thêm vào catalog
  INSERT INTO public.catalog (series, title, volume, isbns, author, translator, publisher, distributor, publish_date, pages, size, price, cover_url, note, gift_urls)
  VALUES (
    COALESCE((updated_data->>'series')::TEXT, p.series),
    COALESCE((updated_data->>'title')::TEXT, p.title),
    COALESCE((updated_data->>'volume')::FLOAT, p.volume),
    ARRAY(SELECT trim(x) FROM unnest(regexp_split_to_array(COALESCE((updated_data->>'isbn')::TEXT, p.isbn), '[,;|/\s\n]+')) AS x WHERE trim(x) <> ''),
    COALESCE((updated_data->>'author')::TEXT, p.author),
    COALESCE((updated_data->>'translator')::TEXT, p.translator),
    COALESCE((updated_data->>'publisher')::TEXT, p.publisher),
    COALESCE((updated_data->>'distributor')::TEXT, p.distributor),
    CASE WHEN (updated_data->>'publish_date') IS NOT NULL THEN (updated_data->>'publish_date')::DATE ELSE p.publish_date END,
    COALESCE((updated_data->>'pages')::INT, p.pages),
    COALESCE((updated_data->>'size')::TEXT, p.size),
    COALESCE((updated_data->>'price')::INT, p.price),
    COALESCE((updated_data->>'cover_url')::TEXT, p.cover_url),
    COALESCE((updated_data->>'note')::TEXT, p.note),
    CASE WHEN (updated_data->'gift_urls') IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(updated_data->'gift_urls')) ELSE p.gift_urls END
  ) RETURNING id INTO new_catalog_id;

  -- Xoá khỏi pending
  DELETE FROM public.pending_catalog WHERE id = pending_id;

  RETURN jsonb_build_object('success', true, 'catalog_id', new_catalog_id);
END;
$$;

-- 10. RPC: Admin reject pending
CREATE OR REPLACE FUNCTION public.admin_reject_pending(pending_id UUID, reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- Xoá khỏi pending
  DELETE FROM public.pending_catalog WHERE id = pending_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- 11. RPC: Admin delete feedback
CREATE OR REPLACE FUNCTION public.admin_delete_feedback(feedback_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  DELETE FROM public.feedback WHERE id = feedback_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- 12. RPC: Admin merge ISBN vào catalog có sẵn
CREATE OR REPLACE FUNCTION public.admin_merge_isbn(pending_id UUID, target_catalog_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  p public.pending_catalog%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT * INTO p FROM public.pending_catalog WHERE id = pending_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pending not found'; END IF;

  -- Gộp ISBN vào catalog (loại bỏ trùng lặp)
  UPDATE public.catalog
  SET isbns = ARRAY(
    SELECT DISTINCT unnest(isbns || ARRAY(
      SELECT trim(x) FROM unnest(regexp_split_to_array(COALESCE(p.isbn, p.scanned_isbn), '[,;|/\s\n]+')) AS x WHERE trim(x) <> ''
    ))
  )
  WHERE id = target_catalog_id;

  -- Xoá khỏi pending
  DELETE FROM public.pending_catalog WHERE id = pending_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 13. RPC: Admin update catalog
CREATE OR REPLACE FUNCTION public.admin_update_catalog(catalog_id UUID, updated_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.catalog
  SET
    series       = COALESCE((updated_data->>'series')::TEXT, series),
    title        = COALESCE((updated_data->>'title')::TEXT, title),
    volume       = COALESCE((updated_data->>'volume')::FLOAT, volume),
    isbns        = CASE WHEN (updated_data->'isbns') IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(updated_data->'isbns')) ELSE isbns END,
    author       = COALESCE((updated_data->>'author')::TEXT, author),
    translator   = COALESCE((updated_data->>'translator')::TEXT, translator),
    publisher    = COALESCE((updated_data->>'publisher')::TEXT, publisher),
    distributor  = COALESCE((updated_data->>'distributor')::TEXT, distributor),
    publish_date = CASE WHEN (updated_data->>'publish_date') IS NOT NULL THEN (updated_data->>'publish_date')::DATE ELSE publish_date END,
    pages        = COALESCE((updated_data->>'pages')::INT, pages),
    size         = COALESCE((updated_data->>'size')::TEXT, size),
    price        = COALESCE((updated_data->>'price')::INT, price),
    cover_url    = COALESCE((updated_data->>'cover_url')::TEXT, cover_url),
    note         = COALESCE((updated_data->>'note')::TEXT, note),
    gift_urls    = CASE WHEN (updated_data->'gift_urls') IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(updated_data->'gift_urls')) ELSE gift_urls END,
    updated_at   = NOW()
  WHERE id = catalog_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 14. RPC: Admin delete catalog
CREATE OR REPLACE FUNCTION public.admin_delete_catalog(catalog_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  DELETE FROM public.catalog WHERE id = catalog_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 15. BẢNG SERIES_METADATA (Admin quản lý tổng số tập hệ thống)
-- 14b. Admin catalog/pending/feedback policies for SECURITY INVOKER RPCs
DROP POLICY IF EXISTS "Admins can manage catalog" ON public.catalog;
CREATE POLICY "Admins can manage catalog" ON public.catalog
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage pending" ON public.pending_catalog;
CREATE POLICY "Admins can manage pending" ON public.pending_catalog
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage feedback" ON public.feedback;
CREATE POLICY "Admins can manage feedback" ON public.feedback
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- 15. BANG SERIES_METADATA (Admin quan ly tong so tap he thong)
CREATE TABLE IF NOT EXISTS public.series_metadata (
    series TEXT PRIMARY KEY,
    total_volumes NUMERIC NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'ongoing',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.series_metadata ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view series_metadata" ON public.series_metadata;
CREATE POLICY "Authenticated users can view series_metadata" ON public.series_metadata
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can insert series_metadata" ON public.series_metadata;
CREATE POLICY "Admins can insert series_metadata" ON public.series_metadata
    FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update series_metadata" ON public.series_metadata;
CREATE POLICY "Admins can update series_metadata" ON public.series_metadata
    FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete series_metadata" ON public.series_metadata;
CREATE POLICY "Admins can delete series_metadata" ON public.series_metadata
    FOR DELETE USING (public.is_admin());


-- ============================================================
-- 16. BẢNG USER_SERIES_SETTINGS (User tuỳ chỉnh số tập mục tiêu)
CREATE TABLE IF NOT EXISTS public.user_series_settings (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    series TEXT NOT NULL,
    target_volumes NUMERIC NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (user_id, series)
);

ALTER TABLE public.user_series_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own series settings" ON public.user_series_settings;
CREATE POLICY "Users can view their own series settings" ON public.user_series_settings
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own series settings" ON public.user_series_settings;
CREATE POLICY "Users can insert their own series settings" ON public.user_series_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own series settings" ON public.user_series_settings;
CREATE POLICY "Users can update their own series settings" ON public.user_series_settings
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own series settings" ON public.user_series_settings;
CREATE POLICY "Users can delete their own series settings" ON public.user_series_settings
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- GRANTS: explicit Data API privileges for each role.
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.manga TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.catalog TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pending_catalog TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.feedback TO authenticated, service_role;
GRANT SELECT ON TABLE public.admin_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.series_metadata TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_series_settings TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_all_pending() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_all_feedback() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_approve_pending(UUID, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_reject_pending(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_feedback(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_merge_isbn(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_catalog(UUID, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_catalog(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_all_pending() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_all_feedback() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_approve_pending(UUID, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_reject_pending(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_feedback(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_merge_isbn(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_catalog(UUID, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_catalog(UUID) TO authenticated, service_role;

-- ============================================================
-- STORAGE: Cấu hình bảo mật (RLS) cho Bucket 'covers'
-- ============================================================

-- 1. Tạo bucket 'covers' (Giới hạn dung lượng < 5MB, chỉ nhận file ảnh)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
  'covers', 
  'covers', 
  true, 
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET 
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 2. Bật RLS cho bảng chứa file (storage.objects)
-- Lưu ý: Supabase mặc định đã BẬT RLS cho bảng này, không cần chạy lệnh ALTER TABLE nữa để tránh lỗi quyền hạn (ERROR 42501).

-- 3. Policy: Ai cũng có thể tải và xem ảnh (Public Read)
-- Public URL downloads still work because the bucket is public; no SELECT policy is needed.
DROP POLICY IF EXISTS "Public read covers" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

-- 4. Policy: CHỈ user đã đăng nhập mới được upload ảnh
DROP POLICY IF EXISTS "Authenticated upload covers" ON storage.objects;
CREATE POLICY "Authenticated upload covers" ON storage.objects 
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND 
    bucket_id = 'covers'
  );

-- 5. Policy: CHỈ chủ nhân file mới có quyền Xoá/Sửa ảnh của mình
DROP POLICY IF EXISTS "Owner can update own covers" ON storage.objects;
CREATE POLICY "Owner can update own covers" ON storage.objects
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND 
    bucket_id = 'covers' AND 
    owner = auth.uid()
  );

DROP POLICY IF EXISTS "Owner can delete own covers" ON storage.objects;
CREATE POLICY "Owner can delete own covers" ON storage.objects
  FOR DELETE USING (
    auth.role() = 'authenticated' AND 
    bucket_id = 'covers' AND 
    owner = auth.uid()
  );

-- Thêm admin đầu tiên (thay YOUR_USER_UUID bằng UUID thực):
-- INSERT INTO admin_users (user_id, email) VALUES ('YOUR_USER_UUID', 'your@email.com');
