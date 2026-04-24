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

CREATE POLICY "Users can view own manga" ON manga
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own manga" ON manga
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own manga" ON manga
  FOR UPDATE USING (auth.uid() = user_id);

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
CREATE POLICY "Authenticated users can view catalog" ON catalog
  FOR SELECT USING (auth.role() = 'authenticated');

-- Chỉ service_role mới ghi được
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
CREATE POLICY "Users can insert pending" ON pending_catalog
  FOR INSERT WITH CHECK (auth.uid() = submitted_by);

-- Users xem pending của mình
CREATE POLICY "Users can view own pending" ON pending_catalog
  FOR SELECT USING (auth.uid() = submitted_by);

-- Admin xem toàn bộ (qua RPC / service_role)
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

CREATE POLICY "Users can insert feedback" ON feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own feedback" ON feedback
  FOR SELECT USING (auth.uid() = user_id);

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
CREATE POLICY "Service role manages admins" ON admin_users
  FOR ALL USING (auth.role() = 'service_role');

-- User tự check xem mình có là admin không
CREATE POLICY "Users can check own admin status" ON admin_users
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- 6. RPC: Kiểm tra admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC: Lấy toàn bộ pending (chỉ admin)
CREATE OR REPLACE FUNCTION get_all_pending()
RETURNS SETOF pending_catalog AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY SELECT * FROM pending_catalog WHERE status = 'pending' ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RPC: Lấy toàn bộ feedback (chỉ admin)
CREATE OR REPLACE FUNCTION get_all_feedback()
RETURNS SETOF feedback AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY SELECT * FROM feedback ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. RPC: Admin approve pending → thêm vào catalog
CREATE OR REPLACE FUNCTION admin_approve_pending(pending_id UUID, updated_data JSONB)
RETURNS JSONB AS $$
DECLARE
  p pending_catalog;
  new_catalog_id UUID;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT * INTO p FROM pending_catalog WHERE id = pending_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending record not found';
  END IF;

  -- Thêm vào catalog
  INSERT INTO catalog (series, title, volume, isbns, author, translator, publisher, distributor, publish_date, pages, size, price, cover_url, note, gift_urls)
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

  -- Cập nhật trạng thái pending
  UPDATE pending_catalog SET status = 'approved', catalog_id = new_catalog_id WHERE id = pending_id;

  RETURN jsonb_build_object('success', true, 'catalog_id', new_catalog_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. RPC: Admin reject pending
CREATE OR REPLACE FUNCTION admin_reject_pending(pending_id UUID, reason TEXT DEFAULT NULL)
RETURNS JSONB AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  UPDATE pending_catalog SET status = 'rejected', reject_note = reason WHERE id = pending_id;
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. RPC: Admin delete feedback
CREATE OR REPLACE FUNCTION admin_delete_feedback(feedback_id UUID)
RETURNS JSONB AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  DELETE FROM feedback WHERE id = feedback_id;
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. RPC: Admin merge ISBN vào catalog có sẵn
CREATE OR REPLACE FUNCTION admin_merge_isbn(pending_id UUID, target_catalog_id UUID)
RETURNS JSONB AS $$
DECLARE
  p pending_catalog;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT * INTO p FROM pending_catalog WHERE id = pending_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pending not found'; END IF;

  -- Gộp ISBN vào catalog (loại bỏ trùng lặp)
  UPDATE catalog
  SET isbns = ARRAY(
    SELECT DISTINCT unnest(isbns || ARRAY(
      SELECT trim(x) FROM unnest(regexp_split_to_array(COALESCE(p.isbn, p.scanned_isbn), '[,;|/\s\n]+')) AS x WHERE trim(x) <> ''
    ))
  )
  WHERE id = target_catalog_id;

  -- Đánh dấu approved
  UPDATE pending_catalog SET status = 'approved', catalog_id = target_catalog_id WHERE id = pending_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- GRANTS: Cấp quyền cho role 'authenticated'
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE manga TO authenticated;
GRANT SELECT ON TABLE catalog TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE pending_catalog TO authenticated;
GRANT SELECT, INSERT ON TABLE feedback TO authenticated;
GRANT SELECT ON TABLE admin_users TO authenticated;

-- ============================================================
-- STORAGE: Tạo bucket 'covers' (chạy trong Supabase Dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('covers', 'covers', true);
-- CREATE POLICY "Authenticated upload covers" ON storage.objects FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND bucket_id = 'covers');
-- CREATE POLICY "Public read covers" ON storage.objects FOR SELECT USING (bucket_id = 'covers');

-- Thêm admin đầu tiên (thay YOUR_USER_UUID bằng UUID thực):
-- INSERT INTO admin_users (user_id, email) VALUES ('YOUR_USER_UUID', 'your@email.com');
