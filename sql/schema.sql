-- ============================================================
-- Manga-Cloudflare complete schema
-- Run this file via wrangler d1 execute manga_db --file=sql/schema.sql
-- ============================================================

-- ============================================================
-- 1. Personal library
-- ============================================================
CREATE TABLE IF NOT EXISTS public.manga (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  series       TEXT NOT NULL,
  title        TEXT NOT NULL,
  volume       FLOAT,
  isbn         TEXT,
  author       TEXT,
  translator   TEXT,
  publisher    TEXT,
  distributor  TEXT,
  publish_date DATE,
  pages        INT,
  size         TEXT,
  price        INT,
  note         TEXT,
  cover_url    TEXT,
  gift_urls    TEXT[] DEFAULT '{}',
  catalog_id   UUID,
  added_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manga_user_id ON public.manga(user_id);
CREATE INDEX IF NOT EXISTS idx_manga_series ON public.manga(series);

ALTER TABLE public.manga ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own manga" ON public.manga;
CREATE POLICY "Users can view own manga" ON public.manga
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own manga" ON public.manga;
CREATE POLICY "Users can insert own manga" ON public.manga
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own manga" ON public.manga;
CREATE POLICY "Users can update own manga" ON public.manga
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own manga" ON public.manga;
CREATE POLICY "Users can delete own manga" ON public.manga
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 2. Shared catalog
-- ============================================================
CREATE TABLE IF NOT EXISTS public.catalog (
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

CREATE INDEX IF NOT EXISTS idx_catalog_series ON public.catalog(series);
CREATE INDEX IF NOT EXISTS idx_catalog_isbns ON public.catalog USING GIN(isbns);

ALTER TABLE public.catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view catalog" ON public.catalog;
CREATE POLICY "Authenticated users can view catalog" ON public.catalog
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role can manage catalog" ON public.catalog;
CREATE POLICY "Service role can manage catalog" ON public.catalog
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 3. Pending catalog contributions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pending_catalog (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by    UUID REFERENCES auth.users(id),
  submitted_name  TEXT,
  submitted_email TEXT,
  linked_manga_id UUID,
  catalog_id      UUID REFERENCES public.catalog(id),
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
  status          TEXT DEFAULT 'pending',
  reject_note     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pending_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert pending" ON public.pending_catalog;
CREATE POLICY "Users can insert pending" ON public.pending_catalog
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = submitted_by);

DROP POLICY IF EXISTS "Users can view own pending" ON public.pending_catalog;
CREATE POLICY "Users can view own pending" ON public.pending_catalog
  FOR SELECT TO authenticated
  USING (auth.uid() = submitted_by);

DROP POLICY IF EXISTS "Service role manages pending" ON public.pending_catalog;
CREATE POLICY "Service role manages pending" ON public.pending_catalog
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 4. Feedback
-- ============================================================
CREATE TABLE IF NOT EXISTS public.feedback (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id),
  user_name  TEXT,
  user_email TEXT,
  title      TEXT,
  content    TEXT NOT NULL,
  status     TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert feedback" ON public.feedback;
CREATE POLICY "Users can insert feedback" ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
CREATE POLICY "Users can view own feedback" ON public.feedback
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages feedback" ON public.feedback;
CREATE POLICY "Service role manages feedback" ON public.feedback
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 5. Admin users
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages admins" ON public.admin_users;
CREATE POLICY "Service role manages admins" ON public.admin_users
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can check own admin status" ON public.admin_users;
CREATE POLICY "Users can check own admin status" ON public.admin_users
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 6. Admin helper RPCs
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
  );
END;
$$;

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

  RETURN QUERY
  SELECT *
  FROM public.pending_catalog
  WHERE status = 'pending'
  ORDER BY created_at DESC;
END;
$$;

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

  RETURN QUERY
  SELECT *
  FROM public.feedback
  ORDER BY created_at DESC;
END;
$$;

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

  SELECT * INTO p
  FROM public.pending_catalog
  WHERE id = pending_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending record not found';
  END IF;

  INSERT INTO public.catalog (
    series, title, volume, isbns, author, translator, publisher, distributor,
    publish_date, pages, size, price, cover_url, note, gift_urls
  )
  VALUES (
    COALESCE(updated_data->>'series', p.series),
    COALESCE(updated_data->>'title', p.title),
    COALESCE((updated_data->>'volume')::FLOAT, p.volume),
    ARRAY(
      SELECT trim(x)
      FROM unnest(regexp_split_to_array(COALESCE(updated_data->>'isbn', p.isbn), '[,;|/\s\n]+')) AS x
      WHERE trim(x) <> ''
    ),
    COALESCE(updated_data->>'author', p.author),
    COALESCE(updated_data->>'translator', p.translator),
    COALESCE(updated_data->>'publisher', p.publisher),
    COALESCE(updated_data->>'distributor', p.distributor),
    CASE WHEN updated_data->>'publish_date' IS NOT NULL THEN (updated_data->>'publish_date')::DATE ELSE p.publish_date END,
    COALESCE((updated_data->>'pages')::INT, p.pages),
    COALESCE(updated_data->>'size', p.size),
    COALESCE((updated_data->>'price')::INT, p.price),
    COALESCE(updated_data->>'cover_url', p.cover_url),
    COALESCE(updated_data->>'note', p.note),
    CASE WHEN updated_data->'gift_urls' IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(updated_data->'gift_urls')) ELSE p.gift_urls END
  )
  RETURNING id INTO new_catalog_id;

  DELETE FROM public.pending_catalog WHERE id = pending_id;

  RETURN jsonb_build_object('success', true, 'catalog_id', new_catalog_id);
END;
$$;

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

  DELETE FROM public.pending_catalog WHERE id = pending_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

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

  SELECT * INTO p
  FROM public.pending_catalog
  WHERE id = pending_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending not found';
  END IF;

  UPDATE public.catalog
  SET isbns = ARRAY(
    SELECT DISTINCT unnest(isbns || ARRAY(
      SELECT trim(x)
      FROM unnest(regexp_split_to_array(COALESCE(p.isbn, p.scanned_isbn), '[,;|/\s\n]+')) AS x
      WHERE trim(x) <> ''
    ))
  )
  WHERE id = target_catalog_id;

  DELETE FROM public.pending_catalog WHERE id = pending_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

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
    series       = COALESCE(updated_data->>'series', series),
    title        = COALESCE(updated_data->>'title', title),
    volume       = COALESCE((updated_data->>'volume')::FLOAT, volume),
    isbns        = CASE WHEN updated_data->'isbns' IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(updated_data->'isbns')) ELSE isbns END,
    author       = COALESCE(updated_data->>'author', author),
    translator   = COALESCE(updated_data->>'translator', translator),
    publisher    = COALESCE(updated_data->>'publisher', publisher),
    distributor  = COALESCE(updated_data->>'distributor', distributor),
    publish_date = CASE WHEN updated_data->>'publish_date' IS NOT NULL THEN (updated_data->>'publish_date')::DATE ELSE publish_date END,
    pages        = COALESCE((updated_data->>'pages')::INT, pages),
    size         = COALESCE(updated_data->>'size', size),
    price        = COALESCE((updated_data->>'price')::INT, price),
    cover_url    = COALESCE(updated_data->>'cover_url', cover_url),
    note         = COALESCE(updated_data->>'note', note),
    gift_urls    = CASE WHEN updated_data->'gift_urls' IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(updated_data->'gift_urls')) ELSE gift_urls END,
    updated_at   = NOW()
  WHERE id = catalog_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

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
-- 7. Series tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS public.series_metadata (
  series        TEXT PRIMARY KEY,
  total_volumes NUMERIC NOT NULL DEFAULT 0,
  status        TEXT DEFAULT 'ongoing',
  updated_at    TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.series_metadata ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view series_metadata" ON public.series_metadata;
CREATE POLICY "Authenticated users can view series_metadata" ON public.series_metadata
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert series_metadata" ON public.series_metadata;
CREATE POLICY "Admins can insert series_metadata" ON public.series_metadata
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update series_metadata" ON public.series_metadata;
CREATE POLICY "Admins can update series_metadata" ON public.series_metadata
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete series_metadata" ON public.series_metadata;
CREATE POLICY "Admins can delete series_metadata" ON public.series_metadata
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.user_series_settings (
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  series         TEXT NOT NULL,
  target_volumes NUMERIC NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (user_id, series)
);

ALTER TABLE public.user_series_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own series settings" ON public.user_series_settings;
CREATE POLICY "Users can view their own series settings" ON public.user_series_settings
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own series settings" ON public.user_series_settings;
CREATE POLICY "Users can insert their own series settings" ON public.user_series_settings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own series settings" ON public.user_series_settings;
CREATE POLICY "Users can update their own series settings" ON public.user_series_settings
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own series settings" ON public.user_series_settings;
CREATE POLICY "Users can delete their own series settings" ON public.user_series_settings
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 8. Release calendar
-- ============================================================
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
  edition      TEXT DEFAULT 'standard',
  note         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_release_calendar_date ON public.release_calendar(release_date);
CREATE INDEX IF NOT EXISTS idx_release_calendar_series ON public.release_calendar(series);
CREATE INDEX IF NOT EXISTS idx_release_calendar_publisher ON public.release_calendar(publisher);

ALTER TABLE public.release_calendar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view release_calendar" ON public.release_calendar;
CREATE POLICY "Anyone can view release_calendar" ON public.release_calendar
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage release_calendar" ON public.release_calendar;
CREATE POLICY "Admins can manage release_calendar" ON public.release_calendar
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

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

  entry_id := NULLIF(entry_data->>'id', '')::UUID;

  IF entry_id IS NOT NULL THEN
    UPDATE public.release_calendar
    SET
      release_date = COALESCE((entry_data->>'release_date')::DATE, release_date),
      series       = COALESCE(entry_data->>'series', series),
      title        = COALESCE(entry_data->>'title', title),
      volume       = COALESCE((entry_data->>'volume')::FLOAT, volume),
      publisher    = COALESCE(entry_data->>'publisher', publisher),
      price        = COALESCE((entry_data->>'price')::INT, price),
      cover_url    = COALESCE(entry_data->>'cover_url', cover_url),
      edition      = COALESCE(entry_data->>'edition', edition),
      note         = COALESCE(entry_data->>'note', note),
      catalog_id   = CASE WHEN entry_data->>'catalog_id' IS NOT NULL THEN (entry_data->>'catalog_id')::UUID ELSE catalog_id END,
      updated_at   = NOW()
    WHERE id = entry_id;

    RETURN jsonb_build_object('success', true, 'id', entry_id, 'action', 'updated');
  END IF;

  SELECT id INTO existing_id
  FROM public.release_calendar
  WHERE title = entry_data->>'title'
    AND release_date = (entry_data->>'release_date')::DATE
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'duplicate', 'id', existing_id);
  END IF;

  INSERT INTO public.release_calendar (
    release_date, series, title, volume, publisher, price, cover_url, edition, note, catalog_id
  )
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
    CASE WHEN entry_data->>'catalog_id' IS NOT NULL THEN (entry_data->>'catalog_id')::UUID ELSE NULL END
  )
  RETURNING id INTO entry_id;

  RETURN jsonb_build_object('success', true, 'id', entry_id, 'action', 'inserted');
END;
$$;

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

-- ============================================================
-- 9. Grants for Data API and RPC
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.manga TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.catalog TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pending_catalog TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.feedback TO authenticated, service_role;
GRANT SELECT ON TABLE public.admin_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.series_metadata TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_series_settings TO authenticated, service_role;
GRANT SELECT ON TABLE public.release_calendar TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.release_calendar TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_all_pending() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_all_feedback() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_approve_pending(UUID, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_reject_pending(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_feedback(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_merge_isbn(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_catalog(UUID, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_catalog(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_upsert_release(JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_release(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_all_pending() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_all_feedback() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_approve_pending(UUID, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_reject_pending(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_feedback(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_merge_isbn(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_catalog(UUID, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_catalog(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_upsert_release(JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_release(UUID) TO authenticated, service_role;

-- ============================================================
-- 10. Storage bucket and policies
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'covers',
  'covers',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

DROP POLICY IF EXISTS "Public read covers" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

DROP POLICY IF EXISTS "Authenticated upload covers" ON storage.objects;
CREATE POLICY "Authenticated upload covers" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'covers'
  );

DROP POLICY IF EXISTS "Owner can update own covers" ON storage.objects;
CREATE POLICY "Owner can update own covers" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'covers'
    AND owner = auth.uid()
  )
  WITH CHECK (
    bucket_id = 'covers'
    AND owner = auth.uid()
  );

DROP POLICY IF EXISTS "Owner can delete own covers" ON storage.objects;
CREATE POLICY "Owner can delete own covers" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'covers'
    AND owner = auth.uid()
  );

-- First admin example:
-- INSERT INTO public.admin_users (user_id, email)
-- VALUES ('YOUR_USER_UUID', 'your@email.com');
