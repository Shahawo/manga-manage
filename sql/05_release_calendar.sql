-- ============================================================
-- 05. BẢNG RELEASE_CALENDAR (Lịch phát hành manga/light novel)
-- Chạy file này trong Supabase SQL Editor
-- Created for Manga-Supabase v2.3.0
-- ============================================================

-- Tạo bảng release_calendar
CREATE TABLE IF NOT EXISTS public.release_calendar (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id   UUID REFERENCES public.catalog(id) ON DELETE SET NULL,
  release_date DATE NOT NULL,
  series       TEXT,
  title        TEXT NOT NULL,
  volume       FLOAT,
  publisher    TEXT,
  price        INT,
  cover_url    TEXT,
  edition      TEXT DEFAULT 'standard',  -- 'standard' | 'special' | 'collector'
  note         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes để query nhanh theo tháng
CREATE INDEX IF NOT EXISTS idx_release_calendar_date      ON public.release_calendar(release_date);
CREATE INDEX IF NOT EXISTS idx_release_calendar_series    ON public.release_calendar(series);
CREATE INDEX IF NOT EXISTS idx_release_calendar_publisher ON public.release_calendar(publisher);

-- ============================================================
-- RLS Policies
ALTER TABLE public.release_calendar ENABLE ROW LEVEL SECURITY;

-- Public read: Ai cũng có thể xem (không cần đăng nhập)
DROP POLICY IF EXISTS "Anyone can view release_calendar" ON public.release_calendar;
CREATE POLICY "Anyone can view release_calendar" ON public.release_calendar
  FOR SELECT USING (true);

-- Admin write: Chỉ Admin mới thêm/sửa/xóa
DROP POLICY IF EXISTS "Admins can manage release_calendar" ON public.release_calendar;
CREATE POLICY "Admins can manage release_calendar" ON public.release_calendar
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- Grants
GRANT SELECT ON public.release_calendar TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.release_calendar TO authenticated, service_role;

-- ============================================================
-- RPC: Admin upsert một release entry
CREATE OR REPLACE FUNCTION public.admin_upsert_release(entry_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  entry_id UUID;
  existing_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  entry_id := (entry_data->>'id')::UUID;

  IF entry_id IS NOT NULL THEN
    -- Update existing
    UPDATE public.release_calendar SET
      release_date = COALESCE((entry_data->>'release_date')::DATE, release_date),
      series       = COALESCE(entry_data->>'series', series),
      title        = COALESCE(entry_data->>'title', title),
      volume       = COALESCE((entry_data->>'volume')::FLOAT, volume),
      publisher    = COALESCE(entry_data->>'publisher', publisher),
      price        = COALESCE((entry_data->>'price')::INT, price),
      cover_url    = COALESCE(entry_data->>'cover_url', cover_url),
      edition      = COALESCE(entry_data->>'edition', edition),
      note         = COALESCE(entry_data->>'note', note),
      catalog_id   = CASE WHEN (entry_data->>'catalog_id') IS NOT NULL THEN (entry_data->>'catalog_id')::UUID ELSE catalog_id END,
      updated_at   = NOW()
    WHERE id = entry_id;
    RETURN jsonb_build_object('success', true, 'id', entry_id, 'action', 'updated');
  ELSE
    -- Check duplicate: same title + release_date
    SELECT id INTO existing_id FROM public.release_calendar
    WHERE title = entry_data->>'title'
      AND release_date = (entry_data->>'release_date')::DATE
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'duplicate', 'id', existing_id);
    END IF;

    -- Insert new
    INSERT INTO public.release_calendar (release_date, series, title, volume, publisher, price, cover_url, edition, note, catalog_id)
    VALUES (
      (entry_data->>'release_date')::DATE,
      entry_data->>'series',
      entry_data->>'title',
      (entry_data->>'volume')::FLOAT,
      entry_data->>'publisher',
      (entry_data->>'price')::INT,
      entry_data->>'cover_url',
      COALESCE(entry_data->>'edition', 'standard'),
      entry_data->>'note',
      CASE WHEN (entry_data->>'catalog_id') IS NOT NULL THEN (entry_data->>'catalog_id')::UUID ELSE NULL END
    ) RETURNING id INTO entry_id;
    RETURN jsonb_build_object('success', true, 'id', entry_id, 'action', 'inserted');
  END IF;
END;
$$;

-- RPC: Admin delete một release entry
CREATE OR REPLACE FUNCTION public.admin_delete_release(release_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  DELETE FROM public.release_calendar WHERE id = release_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Grants cho RPCs
REVOKE EXECUTE ON FUNCTION public.admin_upsert_release(JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_release(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_upsert_release(JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_release(UUID) TO authenticated, service_role;
