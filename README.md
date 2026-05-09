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
- Mở file `supabase-client.js` và thay thế thông tin tương ứng:
  ```javascript
  const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
  const SUPABASE_ANON_KEY = 'YOUR_KEY_HERE';
  ```

### 4. Chạy ứng dụng
Do sử dụng `import { supabase } from ...` và tính năng Clean URL (Single Page Application), bạn cần chạy qua một local server thay vì mở trực tiếp `index.html`.
Chạy lệnh sau nếu máy bạn đã cài Node.js:
```bash
npx serve -s .
```

Sau đó truy cập `http://localhost:3000`. Cờ `-s` (single) giúp tự động chuyển hướng các đường dẫn ảo (ví dụ: `/series/abc`) về `index.html`.

## Phân quyền Admin
Để một người dùng có thể dùng chức năng Quản trị (Duyệt kho chung, Góp ý), bạn cần thêm `user_id` của họ vào bảng `admin_users` trên Supabase:
```sql
INSERT INTO admin_users (user_id, email) VALUES ('uuid-cua-user', 'email@gmail.com');
```
