# Walkthrough v3.0.0 (Release)

## Tổng quan
Phiên bản 3.0.0 là một bản cập nhật MAJOR, di dời toàn bộ kiến trúc từ Supabase sang hệ sinh thái Cloudflare (Workers, D1, R2, Pages).

## Chi tiết thay đổi

### 🔄 Kiến trúc / Đồng bộ hóa (Architecture/Sync)
- **Migrate Backend sang Cloudflare Worker**: Khởi tạo API Hono, cấu hình Wrangler với D1 Database và R2 Bucket.
- **Migrate Database sang D1**: Dịch `schema.sql` từ PostgreSQL sang định dạng tương thích SQLite/D1. Xóa bỏ hoàn toàn RLS Policy.
- **Frontend Core Refactor**: Loại bỏ hoàn toàn SDK Supabase khỏi frontend. Viết lại `api-client.js` để thực hiện gọi API trực tiếp tới Worker.
- **Auth Refactor**: Chuyển đổi xác thực sang Google Identity Services (B2C) chuẩn bằng `google.accounts.oauth2.initTokenClient`. Backend sử dụng `hono/jwt` để tự cấp phát và xác minh JWT.

### ✨ Tính năng mới (New Features)
- **Tạo CSDL & Bucket Production**: Đã triển khai D1 và R2 bucket trên môi trường Production thực tế.
- **Deploy Frontend & Backend**: Worker deploy tại `manga-cloudflare-worker.dactam172.workers.dev` và frontend chạy trên Cloudflare Pages (`manga-manage.pages.dev`).

### 🐛 Lỗi chức năng (Feature Bugs)
- **Lỗi 404 khi đăng nhập**: Nguyên nhân do sử dụng nhầm Cloudflare Access (Zero Trust) cho ứng dụng B2C. Giải pháp: Chuyển sang Google OAuth 2.0 Popup và tự quản lý JWT bằng Hono.
- **Lỗi Invalid Token (alg option)**: Hono v4 yêu cầu cung cấp thuật toán bảo mật. Giải pháp: Thêm tham số `'HS256'` vào hàm `verify()` trong `auth.js`.
- **Lỗi hiển thị Avatar**: Nguyên nhân do Backend quên trả về trường `picture` từ API của Google. Giải pháp: Thêm `picture` vào payload JWT và ánh xạ vào `user_metadata.avatar_url`.
- **Lỗi D1_BATCH_TOO_LARGE khi Import JSON**: Cloudflare D1 giới hạn 100 câu lệnh mỗi batch. Giải pháp: Chia nhỏ danh sách import thành từng khối lượng (chunk) 50 cuốn.
- **Lỗi D1_TYPE_ERROR (undefined)**: JSON cũ có thể thiếu trường (undefined), nhưng SQLite chỉ chấp nhận `null`. Giải pháp: Bổ sung logic `?? null` cho toàn bộ tham số khi Insert.
- **Lỗi Lịch Phát Hành (Tháng 6 vẫn hiện tháng 5)**: Nguyên nhân do API backend thiếu lọc theo ngày `start` và `end`. Giải pháp: Cập nhật endpoint `GET /schedule` để query theo thời gian.

### 🎨 Lỗi giao diện / UX (UI/UX Bugs)
- **Kẹt giao diện Admin (Không đổi Tab được)**: Logic UI thiếu mã ẩn/hiện các `.admin-tab-content`. Giải pháp: Bổ sung code xóa/thêm class `hidden` và `active` khi switch tab trong `admin.js`.
- **Lỗi ảnh bìa hỏng trong Lịch phát hành**: Link ảnh cũ không tồn tại sinh ra viền ảnh hỏng. Giải pháp: Sử dụng thủ thuật `onerror="this.outerHTML='<div class=placeholder>...</div>'"` để tạo ô xám bảo vệ bố cục.
