# Kho Truyện (Manga-Cloudflare) 📚

**Kho Truyện** là ứng dụng web quản lý bộ sưu tập manga và light novel cá nhân (SPA - Single Page Application). Dự án được thiết kế với giao diện hiện đại, tốc độ cao nhờ sử dụng **Vite + Vanilla JavaScript**, kết hợp với sức mạnh của hệ sinh thái **Cloudflare (Workers, D1, R2)** cho API, Database, và Storage.

Đặc biệt, hệ thống đã được tái cấu trúc theo kiến trúc **Feature-driven**, đảm bảo khả năng mở rộng mạnh mẽ trong tương lai.

## ✨ Tính năng nổi bật

- **Quản lý Thư viện Cá nhân**: Theo dõi bộ sưu tập theo Series, ISBN, Tác giả, Nhà xuất bản, v.v. Hỗ trợ hiển thị dạng Grid và List.
- **Tính năng Thông minh (AI & OCR)**: Tích hợp thư viện `ZXing` (quét mã vạch Barcode) và `Tesseract.js` (nhận diện chữ trên ảnh bìa OCR) giúp tự động hóa tối đa việc nhập liệu sách mới.
- **Lịch Phát Hành**: Cập nhật lịch phát hành manga/light novel hàng tháng, đi kèm tính năng phân tích và đề xuất "Mua tiếp" (Continue Buying) các tập tiếp theo trong series bạn đang sưu tầm.
- **Bảng Thống Kê (Dashboard Stats)**: Trực quan hóa dữ liệu qua biểu đồ `Chart.js`, cho biết số lượng sách đã mua, tổng chi tiêu theo tháng và tỷ lệ các nhà xuất bản.
- **Kho Sách Chung (Catalog)**: Dữ liệu đám đông được người dùng đóng góp (`pending_catalog`) và phê duyệt bởi Admin, giúp mọi người không cần nhập liệu lại các cuốn sách đã có trên hệ thống.
- **Chế độ Ngoại tuyến (Offline Queue)**: Trải nghiệm mượt mà không độ trễ nhờ cơ chế Optimistic UI kết hợp hàng đợi đồng bộ ngầm (Background Sync Queue) khi có mạng trở lại.
- **Tối ưu Băng thông với CDN**: Tải ảnh trực tiếp từ Cloudflare R2 qua Worker, đảm bảo tốc độ cực nhanh và chi phí bằng 0.

## 🛠 Công nghệ sử dụng

- **Frontend**: Vite, Vanilla JavaScript (ES Modules), HTML5, CSS3 (Modular).
- **Backend & Database**: Cloudflare Workers, D1 (SQLite), R2 (Object Storage).
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
 ├── utils/                # Tiện ích chung (như api-client.js, escapeHTML)
 └── main.js               # Entry point - Kết nối và khởi tạo ứng dụng (`window.app`)
cloudflare-worker/
 ├── src/                  # Mã nguồn của Cloudflare Worker API
 └── schema.sql            # Schema của D1 Database
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
VITE_API_URL=your_cloudflare_worker_api_url_here
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
```

**3. Khởi động môi trường Dev:**
```bash
pnpm run dev
```

**4. Build cho Production:**
```bash
pnpm run build
```

## 🔒 Ghi chú Bảo mật

- Hệ thống xác thực bằng Google OAuth JWT token. Toàn bộ API gọi đến Worker đều phải kèm theo Bearer Token.
- Dữ liệu người dùng được cách ly thông qua user_id.
- Quyền Admin được xác thực trực tiếp trên Worker để chặn đứng khả năng lạm quyền từ phía Client.
- Dữ liệu xuất ra màn hình (Render) luôn đi qua hàm chống XSS `escapeHTML()`.

---
*Dự án được duy trì và phát triển bởi Shahawo.*
