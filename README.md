# Kho Truyen (Manga-Supabase)

Kho Truyen la ung dung web tinh de quan ly bo suu tap manga/light novel ca nhan. Frontend chay bang Vite + Vanilla JavaScript, backend dung Supabase cho Authentication, PostgreSQL, Row Level Security va Storage.

## Tinh nang chinh

- Dang nhap Google qua Supabase Auth.
- Quan ly thu vien ca nhan theo series, tap, ISBN, tac gia, dich gia, NXB/NPH, gia bia, ngay phat hanh, anh bia va anh qua tang.
- Theo doi tien do suu tam theo tong so tap he thong va muc tieu rieng cua tung user.
- Quet ISBN bang camera/anh voi ZXing, quet anh bia bang OCR Tesseract.js, va tu dong doi chieu voi Kho chung.
- Dong gop sach moi vao `pending_catalog` de admin duyet vao `catalog`.
- Admin panel cho pending, catalog, feedback va lich phat hanh.
- Lich phat hanh public theo thang, loc NXB, quick navigation va badge "Mua tiep" theo thu vien cua user.
- Thong ke ca nhan bang Chart.js: tong so cuon, tong series, sach them theo thoi gian, phan bo NPH/NXB va tong gia tri an/hien.
- Export/import backup JSON cho thu vien ca nhan.
- Queue dong bo nen voi optimistic UI de thao tac van muot khi mang cham hoac tam mat ket noi.

## Cong nghe

- Frontend: Vite, Vanilla JS ES modules, HTML, CSS.
- Backend: Supabase Auth, Database, Storage.
- Database: PostgreSQL + RLS, schema chinh o `sql/schema.sql`.
- Thu vien runtime qua CDN: `@supabase/supabase-js@2`, Feather Icons, Flatpickr, ZXing, Tesseract.js, Chart.js.
- Test: Vitest + jsdom.
- Deploy: GitHub Actions -> GitHub Pages, co `public/404.html` de ho tro SPA clean URL.

## Cai dat local

1. Cai dependency:

```bash
pnpm install
```

2. Tao file `.env` tu `.env.example`:

```env
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

3. Chay dev server:

```bash
pnpm run dev
```

4. Build production:

```bash
pnpm run build
```

5. Chay test:

```bash
pnpm run test
```

## Cai dat Supabase

1. Tao project Supabase moi.
2. Vao SQL Editor va chay toan bo `sql/schema.sql`.
3. Bat Google provider trong Authentication -> Providers -> Google, dien Client ID va Client Secret tu Google Cloud Console.
4. Them URL dev va production vao Auth redirect URLs, vi du `http://localhost:5173` va domain GitHub Pages/custom domain.
5. Neu can admin dau tien, chay SQL sau voi UUID user that:

```sql
insert into public.admin_users (user_id, email)
values ('USER_UUID', 'admin@example.com');
```

`sql/schema.sql` da tao bucket public `covers`, cac bang ung dung, RLS policies, grants va RPC admin can thiet.

## Cau truc du an

```text
src/
  main.js                 Entry point, ghep cac mixin vao window.app
  store.js                Global state va localStorage-backed settings/cache
  supabase-client.js      Supabase client dung bien moi truong Vite
  mixins/                 Module tinh nang: auth, api, manga, form, scanner, admin, stats, schedule...
  views/                  HTML partial cho form, modal va admin
  utils/security.js       Escape HTML helper
sql/
  schema.sql              Schema tong hop de khoi tao Supabase tu dau
  04_series_tracking.sql  Migration tham khao cho tracking series
  05_release_calendar.sql Migration tham khao cho lich phat hanh
public/
  404.html                Redirect cho SPA tren GitHub Pages
  CNAME                   Custom domain
```

## Ghi chu bao mat

- Frontend chi dung anon key qua `VITE_SUPABASE_ANON_KEY`; khong dua service role key vao client.
- Cac bang trong `public` deu bat RLS.
- Du lieu ca nhan trong `manga` va `user_series_settings` khoa theo `auth.uid()`.
- Cac thao tac admin di qua RPC `SECURITY INVOKER` va ham `public.is_admin()`.
- Output co nguy co render HTML can di qua `escapeHTML()`.
