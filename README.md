# Kho Truyện (Manga-Supabase) 📚

**Kho Truyện** là ứng dụng web quản lý bộ sưu tập manga và light novel cá nhân (SPA - Single Page Application). Dự án được thiết kế với giao diện hiện đại, tốc độ cao nhờ sử dụng **Vite + Vanilla JavaScript**, kết hợp với sức mạnh của **Supabase** cho Authentication, Database, Storage và tính năng bảo mật Row Level Security (RLS).

Đặc biệt, hệ thống đã được tái cấu trúc theo kiến trúc **Feature-driven**, đảm bảo khả năng mở rộng mạnh mẽ trong tương lai.

## ✨ Tính năng nổi bật

- **Quản lý Thư viện Cá nhân**: Theo dõi bộ sưu tập theo Series, ISBN, Tác giả, Nhà xuất bản, v.v. Hỗ trợ hiển thị dạng Grid và List.
- **Tính năng Thông minh (AI & OCR)**: Tích hợp thư viện `ZXing` (quét mã vạch Barcode) và `Tesseract.js` (nhận diện chữ trên ảnh bìa OCR) giúp tự động hóa tối đa việc nhập liệu sách mới.
- **Lịch Phát Hành**: Cập nhật lịch phát hành manga/light novel hàng tháng, đi kèm tính năng phân tích và đề xuất "Mua tiếp" (Continue Buying) các tập tiếp theo trong series bạn đang sưu tầm.
- **Bảng Thống Kê (Dashboard Stats)**: Trực quan hóa dữ liệu qua biểu đồ `Chart.js`, cho biết số lượng sách đã mua, tổng chi tiêu theo tháng và tỷ lệ các nhà xuất bản.
- **Kho Sách Chung (Catalog)**: Dữ liệu đám đông được người dùng đóng góp (`pending_catalog`) và phê duyệt bởi Admin, giúp mọi người không cần nhập liệu lại các cuốn sách đã có trên hệ thống.
- **Chế độ Ngoại tuyến (Offline Queue)**: Trải nghiệm mượt mà không độ trễ nhờ cơ chế Optimistic UI kết hợp hàng đợi đồng bộ ngầm (Background Sync Queue) khi có mạng trở lại.
- **Tối ưu Băng thông với CDN**: Tích hợp Cloudflare Worker Proxy để tải ảnh trực tiếp từ CDN, giảm tối đa Egress cost trên Supabase Storage.

## 🛠 Công nghệ sử dụng

- **Frontend**: Vite, Vanilla JavaScript (ES Modules), HTML5, CSS3 (Modular).
- **Backend & Database**: Supabase (Auth, PostgreSQL, Storage, Edge Functions).
- **Thư viện bên thứ ba**:
  - Giao diện: `Feather Icons`, `Flatpickr`, `Chart.js`.
  - Xử lý Ảnh & Camera: `ZXing` (Barcode), `Tesseract.js` (OCR).
- **Kiến trúc mã nguồn**: Modular CSS, Feature-driven JS Architecture, HTML View Extraction.

## 📂 Cấu trúc thư mục (Feature-driven)

```text
src/
 ├── core/                 # Logic cốt lõi của hệ thống (api, auth, router, store, ui, settings)
 ├── features/             # Logic nghiệp vụ phân tách theo Domain (admin, manga, schedule, stats)
 ├── styles/               # CSS Modular được chia nhỏ (base, layout, components, views, variables)
 ├── views/                # Các HTML partials độc lập (dashboard.html, detail.html, admin.html, ...)
 ├── utils/                # Tiện ích chung (như escapeHTML chống XSS)
 ├── main.js               # Entry point - Kết nối và khởi tạo ứng dụng (`window.app`)
 └── supabase-client.js    # Khởi tạo Supabase client
sql/
 ├── schema.sql            # Schema tổng hợp để thiết lập database Supabase
 └── ...                   # Các file migration
```

## 🚀 Hướng dẫn Cài đặt & Chạy Local

**1. Clone dự án và Cài đặt thư viện:**
```bash
git clone https://github.com/Shahawo/manga-manage.git
cd manga-manage
pnpm install
```

**2. Thiết lập Biến môi trường:**
Tạo file `.env` dựa trên `.env.example`:
```env
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

**3. Khởi động môi trường Dev:**
```bash
pnpm run dev
```

**4. Build cho Production:**
```bash
pnpm run build
```

## 🔒 Ghi chú Bảo mật & RLS

- Toàn bộ thao tác CRUD tới Supabase từ client chỉ sử dụng khóa `ANON_KEY`. Hệ thống tuân thủ nghiêm ngặt **Row Level Security (RLS)** trên toàn bộ các bảng trong lược đồ `public`.
- Các dữ liệu nhạy cảm hoặc mang tính cá nhân (thư viện người dùng) bị khóa chặt bằng định danh `auth.uid()`.
- Quyền Admin được phân giải hoàn toàn qua hàm RPC `public.is_admin()`, chặn đứng khả năng lạm quyền từ phía Client.
- Dữ liệu xuất ra màn hình (Render) luôn đi qua hàm chống XSS `escapeHTML()`.

---
*Dự án được duy trì và phát triển bởi Shahawo.*
