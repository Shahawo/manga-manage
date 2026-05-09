# Walkthrough v1.7.0: Tái cấu trúc mã nguồn (Vite & Modularization)

Phiên bản này tập trung hoàn toàn vào việc tái cấu trúc (Refactor) mã nguồn để dễ bảo trì, tăng hiệu suất mà không làm thay đổi các tính năng hiện có.

## 1. Kết quả Đạt được
- **Loại bỏ `app.js` khổng lồ:** File `app.js` (nặng 180KB, chứa hơn 3600 dòng code) đã được phân tách thành công.
- **Áp dụng Mixin Pattern:** Thay vì viết lại toàn bộ class/object, hệ thống sử dụng phương pháp Mixin để chia nhỏ logic nhưng vẫn giữ nguyên đối tượng `app` toàn cục. Điều này đảm bảo 100% các sự kiện giao diện (`onclick` trên thẻ HTML) không bị vỡ.
- **Tích hợp Vite Bundler:** Ứng dụng đã chuyển từ môi trường thuần tĩnh (Static server) sang môi trường Node.js sử dụng Vite để hỗ trợ ES6 Modules, nén code và tối ưu hoá tốc độ.

## 2. Cấu trúc Mã nguồn Mới

Mã nguồn Javascript đã được di chuyển vào thư mục `src/` với cấu trúc sau:

```text
src/
├── main.js                  # Điểm khởi đầu (Entry point), tự động gắn kết các mixin.
├── supabase-client.js       # Khởi tạo kết nối Supabase
└── mixins/
    ├── api.js               # Logic fetch data, background sync.
    ├── auth.js              # Đăng nhập, phân quyền User/Admin.
    ├── router.js            # History API, điều hướng trang.
    ├── settings.js          # Lưu trữ cài đặt hiển thị (Font, ViewMode).
    ├── ui.js                # Render giao diện, Toast, Skeleton.
    ├── manga.js             # Form nhập liệu, barcode scanner, upload ảnh.
    └── core.js              # Các tính năng quản trị Admin và các logic phụ trợ khác.
```

## 3. Các File Đã Bị Xóa / Sửa Đổi
- `[XÓA] app.js` (Ở thư mục gốc).
- `[XÓA] markers.txt` (File tạm trong quá trình tách code).
- `[SỬA] index.html`: Cập nhật lại đường dẫn script thành `<script type="module" src="/src/main.js"></script>`.
- `[THÊM] package.json`: Khai báo lệnh chạy Vite.
- `[THÊM] vite.config.js`: Cấu hình Base URL và môi trường build cho Vite.

## 4. Hướng dẫn Dành Cho Lập Trình Viên

Từ phiên bản 1.7.0 trở đi, việc phát triển ứng dụng thay đổi như sau:

- **Môi trường phát triển:** Chạy lệnh `npm run dev` để bật máy chủ cục bộ (Hỗ trợ Hot-Reload). Bỏ hoàn toàn lệnh `npx serve -s .`.
- **Môi trường Production:** Chạy lệnh `npm run build` để Vite nén toàn bộ HTML, CSS và JS vào thư mục `dist/`. Mã nguồn nén cuối cùng chỉ còn khoảng ~116KB (So với 180KB ban đầu), giúp tăng tốc độ tải trang đáng kể.
- **Khi muốn thêm tính năng mới:** Thay vì viết thêm vào file dài, hãy viết các logic mới vào module tương ứng trong thư mục `src/mixins/` và gắn nó vào biến `app`.
