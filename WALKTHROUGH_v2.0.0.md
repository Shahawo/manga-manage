# Walkthrough v2.0.0: Kiến Trúc SPA Modular Hoàn Chỉnh (Vite & ES6 Modules)

Phiên bản 2.0.0 đánh dấu một bước ngoặt lớn của Manga-Supabase: hoàn tất quá trình "rã đông" (deconstruct) tệp mã nguồn khổng lồ `app.js` và xóa bỏ hoàn toàn mẫu thiết kế Monolithic Mixin cũ, chuyển đổi sang một cấu trúc ES6 Modular tiêu chuẩn, linh hoạt, dễ bảo trì, và có tính mở rộng cao.

## 1. Kết quả Đạt được
- **Loại bỏ Lõi Monolith Cuối Cùng (`core.js`):** Tệp `core.js` (nặng tới gần 3000 dòng code) đã bị tiêu diệt và phân rã thành 5 module chuyên biệt, thực hiện duy nhất 1 trách nhiệm (Single Responsibility).
- **ES6 Modules chuẩn:** Không còn phương pháp `Object.assign(app, {...})` cũ kỹ. Toàn bộ các hàm xử lý đều được export dưới dạng độc lập (`export function`). Tuy nhiên, để đảm bảo các file HTML cũ không bị lỗi (tương thích ngược), `main.js` chịu trách nhiệm gom lại và gán (spread) vào `window.app`.
- **Tập trung hóa Trạng thái (Centralized Store):** Tất cả các biến trạng thái (state) rải rác đã được quy về duy nhất một nguồn sự thật: `src/store.js`. Từ đây, ứng dụng bắt đầu mang dáng vấp của một ứng dụng Vue/React thực thụ sử dụng Redux/Pinia.

## 2. Cấu trúc Mã nguồn Mới

Cây thư mục mã nguồn JS trong `src/` hiện được thiết kế cực kỳ rành mạch:

```text
src/
├── main.js                  # Entry point, tích hợp Vite HTML raw loader và kết nối các module thành `window.app`.
├── store.js                 # Trung tâm lưu trữ State của toàn ứng dụng.
├── supabase-client.js       # Khởi tạo kết nối Supabase
└── mixins/                  # Các module xử lý nghiệp vụ (Controller/Service)
    ├── admin.js             # [MỚI] Xử lý duyệt sách, gộp sách, tìm kiếm catalog chung
    ├── api.js               # Background Sync (Optimistic UI), Fetch data từ Supabase
    ├── auth.js              # Xác thực người dùng (Login/Logout, hiển thị Avatar)
    ├── dashboard.js         # [MỚI] Hiển thị danh sách, phân trang, chế độ Grid/List
    ├── form.js              # [MỚI] Xử lý File upload, nén ảnh bìa, kéo thả
    ├── manga.js             # Logic xử lý Toast thông báo, Group series.
    ├── router.js            # Điều hướng trang (History API) và Guard truy cập
    ├── scanner.js           # [MỚI] Xử lý Nhận diện Mã vạch và OCR Ảnh bìa bằng AI
    ├── settings.js          # Hệ thống cấu hình cá nhân (Font, chế độ tối/sáng)
    ├── ui.js                # Render Toast, Skeleton Loading
    └── uiModal.js           # [MỚI] Bật/tắt các Modal, sửa xóa nhanh tập truyện
```

## 3. Các File Đã Bị Xóa / Sửa Đổi
- `[XÓA] app.js` (Ở thư mục gốc - từ v1.7.0).
- `[XÓA] src/mixins/core.js`: Đã bị chia tách và tiêu hủy hoàn toàn.
- `[SỬA] package.json`: Cập nhật phiên bản lên `2.0.0` và tích hợp các thư viện phân tích cấu trúc như `acorn`.
- `[THÊM] src/store.js`: Lưu trữ các biến `codeReader`, `isSyncing`, `aiScanImageDataUrl`, v.v.

## 4. Hướng dẫn Dành Cho Lập Trình Viên

Từ phiên bản 2.0.0 trở đi, việc phát triển tính năng mới thay đổi hoàn toàn:

1. **Thêm logic mới:** Hãy tạo một file `.js` mới trong `src/mixins/` chứa các hàm `export function`, sau đó import và spread (`...tên_module`) vào `app` bên trong `main.js`.
2. **Khai báo biến toàn cục:** Nếu cần một biến lưu tạm bộ nhớ (như cache), KHÔNG được khai báo `let` tự do. Thay vào đó, hãy định nghĩa nó bên trong `src/store.js`. Khi truy cập, gọi `store.tenBien`.
3. **Môi trường phát triển:** Chạy lệnh `npm run dev` để làm việc. Khi triển khai lên hosting, chạy `npm run build`.

Vite sẽ gom và tree-shake các hàm không dùng tới, giúp dung lượng ứng dụng siêu nhẹ (chỉ khoảng ~168KB) và tốc độ tải trang gần như tức thì.
