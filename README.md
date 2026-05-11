# Manga Manager (Supabase Version)

Đây là phiên bản web-based tĩnh (static) quản lý truyện tranh cá nhân sử dụng **Supabase** làm backend. Ứng dụng không cần cài đặt Node.js server, toàn bộ nghiệp vụ (Database, Storage, Authentication) được xử lý trực tiếp trên trình duyệt qua Supabase JS SDK.

## Yêu cầu
1. Một tài khoản Supabase (Miễn phí).
2. Tài khoản Google để kích hoạt Google Sign-In trên Supabase.

## Hướng dẫn cài đặt

### 1. Cài đặt Supabase
- Truy cập [Supabase](https://supabase.com) và tạo một project mới.
- Chạy toàn bộ file `sql/schema.sql` trong menu **SQL Editor** để khởi tạo các bảng và phân quyền (Row Level Security).
- Truy cập menu **Storage** và tạo một bucket mới có tên `covers` (nhớ chọn Public bucket).

### 2. Cấu hình Google Auth
- Đăng nhập [Google Cloud Console](https://console.cloud.google.com).
- Lấy `Client ID` và `Client Secret`.
- Vào menu **Authentication** > **Providers** > **Google** trên Supabase, dán `Client ID` và `Client Secret` vào.
- Bật tuỳ chọn.

### 3. Kết nối với Frontend
- Vào Supabase Dashboard > **Project Settings** > **API**.
- Copy `Project URL` và `anon / public key`.
- Mở file `src/supabase-client.js` và thay thế thông tin tương ứng:
  ```javascript
  const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
  const SUPABASE_ANON_KEY = 'YOUR_KEY_HERE';
  ```

### 4. Chạy ứng dụng
Dự án này sử dụng **Vite** làm công cụ phát triển. Để chạy web trên máy tính của bạn:

1. Cài đặt các thư viện cần thiết (Chỉ cần chạy 1 lần):
```bash
pnpm install
```

2. Bật máy chủ phát triển (Hỗ trợ Hot-Reload):
```bash
pnpm run dev
```

Sau đó truy cập đường dẫn được in ra trên Terminal (ví dụ: `http://localhost:5173`). Mọi thay đổi trong code sẽ tự động cập nhật lên giao diện.

Để đóng gói ứng dụng (Build) phục vụ cho việc đẩy lên máy chủ hoặc Github Pages, chạy lệnh:
```bash
pnpm run build
```

## Phân quyền Admin
Để một người dùng có thể dùng chức năng Quản trị (Duyệt kho chung, Góp ý), bạn cần thêm `user_id` của họ vào bảng `admin_users` trên Supabase:
```sql
INSERT INTO admin_users (user_id, email) VALUES ('uuid-cua-user', 'email@gmail.com');
```
