-- 1. Bảng series_metadata (Dành cho Admin cập nhật số tập tổng của toàn hệ thống)
CREATE TABLE IF NOT EXISTS public.series_metadata (
    series TEXT PRIMARY KEY,
    total_volumes NUMERIC NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'ongoing',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.series_metadata ENABLE ROW LEVEL SECURITY;

-- Mọi người dùng đã đăng nhập đều có thể xem
CREATE POLICY "Authenticated users can view series_metadata" ON public.series_metadata
    FOR SELECT USING (auth.role() = 'authenticated');

-- Chỉ admin mới có thể sửa (Sử dụng hàm is_admin đã tạo từ trước)
CREATE POLICY "Admins can insert series_metadata" ON public.series_metadata
    FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admins can update series_metadata" ON public.series_metadata
    FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admins can delete series_metadata" ON public.series_metadata
    FOR DELETE USING (is_admin());


-- 2. Bảng user_series_settings (Dành cho User ghi đè số tập mục tiêu cá nhân)
CREATE TABLE IF NOT EXISTS public.user_series_settings (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    series TEXT NOT NULL,
    target_volumes NUMERIC NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (user_id, series)
);

ALTER TABLE public.user_series_settings ENABLE ROW LEVEL SECURITY;

-- User chỉ có thể quản lý dữ liệu của chính mình
CREATE POLICY "Users can view their own series settings" ON public.user_series_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own series settings" ON public.user_series_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own series settings" ON public.user_series_settings
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own series settings" ON public.user_series_settings
    FOR DELETE USING (auth.uid() = user_id);

-- 3. Phân quyền truy cập cho các Role (Bắt buộc để RLS hoạt động)
GRANT ALL ON TABLE public.series_metadata TO authenticated, anon, service_role;
GRANT ALL ON TABLE public.user_series_settings TO authenticated, anon, service_role;
