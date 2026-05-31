# Walkthrough v3.0.1 (Development)

## Mục lục

## Log Công Việc
### Task 1: Quản lý Phiên bản & Chốt sổ Walkthrough (v3.0.0)
- Nâng cấp đồng loạt các mã định danh phiên bản trong source code (cập nhật cache-busting `styles.css?v=3.0.0` trong `index.html`, text hiển thị trong `admin.html`).
- Chạy lệnh build frontend (`pnpm build`) và deploy bản `3.0.0` lên Cloudflare Pages (`npx wrangler pages deploy dist`).
- Định dạng và chốt sổ (Release) file `WALKTHROUGH_v3.0.0.md`, phân chia theo các nhóm rõ ràng (Kiến trúc, Tính năng mới, Lỗi tính năng, Lỗi giao diện) tuân thủ đúng `VERSIONING_RULES.md`.
- Khởi tạo file `WALKTHROUGH_v3.0.1.md` cho các bản cập nhật, sửa lỗi (Patch) sắp tới.

### Task 2: Hotfix các lỗi phát sinh giao diện & logic API (Bản vá 3.0.1)
- **Lỗi hiển thị Lịch phát hành (Tháng 6 vẫn hiện Tháng 5):** Sửa lỗi API Worker `GET /schedule` không nhận tham số ngày tháng, bổ sung query SQL lọc theo `start` và `end`. Đã deploy Worker mới.
- **Lỗi khung ảnh bìa bị vỡ ở Lịch phát hành:** Cập nhật file `admin-schedule.js` bắt sự kiện `onerror` để thay thế ảnh lỗi (404/403) bằng block giao diện xám (placeholder).
- **Lỗi kẹt giao diện Admin (Không chuyển đổi được các nội dung Tab):** Bổ sung logic xóa/thêm class `hidden` và `active` cho các container ứng với từng Tab trong file `admin.js`.
- **Lỗi trắng dữ liệu khi tải lại trang (F5) ở Admin:** Phát hiện và xử lý triệt để vòng lặp vô hạn (Infinite Loop) gây tràn bộ nhớ đệm (Stack Overflow) do hàm `switchAdminTab` và `navigateTo` gọi lồng nhau liên tục khiến quá trình tải data bị ngắt gãy. Bỏ hàm `navigateTo` thừa bên trong `switchAdminTab`.
