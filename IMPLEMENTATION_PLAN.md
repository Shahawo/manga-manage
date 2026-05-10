# Lộ trình Nâng cấp Website Chuyên nghiệp (Enterprise-level Roadmap)

Để biến `Manga-Supabase` từ một dự án cá nhân thành một ứng dụng web thực sự chuyên nghiệp, chuẩn doanh nghiệp, đây là những đề xuất nâng cấp mang tính "lột xác". Bạn có thể chọn triển khai từng phần hoặc làm tất cả.

---

## 🌟 Nhóm 1: Nâng cấp Trải nghiệm Người dùng (UX/UI Polish)
*Những nâng cấp này giúp web của bạn mượt mà và sang trọng như ứng dụng thật.*

### 1. Hệ thống Thông báo (Toast Notifications) thay cho `alert()` - ✅ Đã hoàn thành
- **Vấn đề:** Hiện tại khi có lỗi hoặc thành công, web dùng hộp thoại `alert()` mặc định của trình duyệt. Nó chặn mọi thao tác và trông rất thô.
- **Giải pháp:** Tự code một hệ thống Toast Message (Thông báo góc màn hình) tự động trượt ra và biến mất sau 3 giây. Trông mượt mà và không làm phiền người dùng. Toàn bộ `alert()` trong code (10 hàm còn sót) đã được xóa bỏ và thay bằng `this.showToast()` ở v1.5.4.


### 2. Hiệu ứng tải trang (Skeleton Loading) - ✅ Đã hoàn thành (v1.5.4)
- **Vấn đề:** Khi chờ lấy dữ liệu từ Supabase, màn hình hiển thị chữ "Đang tải...", spinner vòng tròn nhỏ, hoặc màn hình trắng khá nhàm chán.
- **Giải pháp:** Sử dụng **Skeleton Loaders** (các khối xám nhấp nháy chạy hiệu ứng shimmer) mô phỏng trước bố cục của danh sách truyện. Đã được triển khai đầy đủ.
- **Phạm vi áp dụng:**
  - Thư viện cá nhân (Dashboard Series Grid).
  - Admin Kho Chung (Admin Catalog List).
  - Chi tiết bộ truyện Admin & Cá nhân (Volume Grids).



---

## 🛠 Nhóm 2: Nâng cấp Kiến trúc & Công nghệ (Core Architecture)
*Giúp web dễ bảo trì, tối ưu SEO và đạt chuẩn công nghệ mới.*

### 4. Bật Định tuyến Clean URL (History API) - ✅ Đã hoàn thành (v1.5.4)
- **Mục tiêu:** Chuyển từ ứng dụng hiển thị tĩnh sang cơ chế Router thực sự (History API). URL phản ánh đúng trạng thái màn hình hiện tại.
- **Quy tắc Routing:**
  - `/` 👉 Trang chủ (Dashboard)
  - `/series/:name` 👉 Chi tiết bộ truyện của user
  - `/add` 👉 Màn hình Thêm sách
  - `/admin` 👉 Quản lý kho chung (Admin)
  - `/admin/series/:name` 👉 Chi tiết bộ truyện trong kho chung (Admin)
- **Kế hoạch triển khai:**
  1. Xây dựng hàm `navigateTo(path)` trong `app.js` để xử lý `history.pushState()` và thay đổi View.
  2. Lắng nghe sự kiện `window.addEventListener('popstate')` để hỗ trợ nút Back/Forward của trình duyệt.
  3. Cập nhật hàm `init()` để khi mới mở web lên, ứng dụng sẽ đọc URL hiện tại và khôi phục đúng màn hình (thay vì luôn vào Dashboard).
  4. Sửa đổi các sự kiện `onclick` đang gọi `showView` hoặc `openSeriesDetail` sang `navigateTo`.
  
> **Lưu ý quan trọng cho bạn:**
> Vì bạn đang sử dụng lệnh `npx serve .` để chạy server nội bộ, khi áp dụng Clean URL (không có `#`), nếu bạn ấn F5 ở một trang con như `/series/One-Piece`, trình duyệt sẽ báo lỗi 404 vì thư mục đó không có thật. Để F5 hoạt động đúng đắn, bạn sẽ phải đổi lệnh chạy server thành `npx serve -s .` (chế độ Single Page Application - tự động điều hướng mọi request về `index.html`).
> Bạn có đồng ý triển khai tính năng này không?

### 5. Meta Tags & SEO (OpenGraph)
- **Giải pháp:** Khi bạn copy link chi tiết của một bộ truyện gửi qua Zalo hay Facebook, nó sẽ tự động hiển thị **Ảnh bìa bộ truyện, Tên truyện và Tóm tắt** giống y hệt như khi bạn chia sẻ link báo chí. Việc này yêu cầu tích hợp linh động các thẻ `<meta property="og:...">`.

### 6. Sử dụng Công cụ Đóng gói (Vite Bundler) thay cho `serve`
- **Vấn đề:** Hiện tại bạn đang dùng `npx serve` để chạy các file JS/CSS dạng "thô". Khi code phình to, load sẽ chậm.
- **Giải pháp:** Chuyển sang dùng **Vite** làm môi trường phát triển. Vite sẽ:
  - Tự động gộp file, nén JS và CSS lại thành 1 file siêu nhỏ khi xuất bản (build).
  - Tự động tải lại trang ngay khi bạn vừa ấn Ctrl+S (Hot Module Replacement) - không cần F5 tay.
  - Hỗ trợ tốt hơn rất nhiều cho Clean URL.

---

## 📈 Lộ trình Đề xuất cho Phiên bản 1.6.0
Để không bị ngợp, tôi đề xuất gói nâng cấp **Phiên bản 1.6.0** sẽ tập trung vào 2 thứ cốt lõi nhất:
1. **Clean URL Routing (History API):** Đổi URL siêu sạch.
2. **Hệ thống Thông báo (Toast Messages):** Xóa bỏ toàn bộ `alert()` xấu xí.
3. **Hiệu ứng Skeleton Loading:** Thêm bộ khung xám nhấp nháy lúc tải dữ liệu.

## 🚀 Tổng Kết Tình Trạng Hiện Tại (v1.6.0)
Tất cả các mục tiêu cốt lõi của Kiến trúc SPA & Supabase đã **HOÀN THÀNH**.
Dự án giờ đây là một ứng dụng Web tĩnh (Static Web App) 100%, không cần Node.js backend.
Đã xử lý triệt để bộ định tuyến (Router) bao gồm điều hướng F5, History API và UI Grid/List CSS Variables.
Sẵn sàng đưa vào hoạt động thực tế trên mọi dịch vụ lưu trữ.

---

# Kế hoạch Triển khai: Nền tảng Kiểm thử & TypeScript (Dựa trên SPEC_TESTING_TS.md)

## Tổng quan
Dự án sẽ được tích hợp Vitest để phục vụ việc viết Unit Test cho các thư viện cốt lõi, đồng thời khởi tạo cấu hình TypeScript cơ bản để chuẩn bị cho việc di chuyển dần (incremental adoption) từ Vanilla JS sang TypeScript.

## Danh sách Task (Task Breakdown)

### Giai đoạn 1: Foundation (Môi trường)
- [ ] **Task 1: Cài đặt Dependencies**
  - **Mô tả:** Cài đặt Vitest, JSDOM, TypeScript và các khai báo kiểu cơ bản.
  - **Acceptance:** `package.json` có `vitest`, `jsdom`, `typescript` trong `devDependencies`. Có các lệnh script test.
  - **Files:** `package.json`

- [ ] **Task 2: Cấu hình Môi trường**
  - **Mô tả:** Tạo file cấu hình `vitest.config.js` (hoặc cấu hình chung vào `vite.config.js`) để sử dụng `jsdom`. Tạo `tsconfig.json` với cấu hình linh hoạt (allowJs).
  - **Acceptance:** Chạy lệnh `npm test` thành công (dù chưa có test nào) mà không bị lỗi báo thiếu config. Sinh ra file `tsconfig.json`.
  - **Files:** `vitest.config.js` (hoặc `vite.config.js`), `tsconfig.json`

### Giai đoạn 2: Core Testing (Viết Test)
- [ ] **Task 3: Unit Test cho `security.js`**
  - **Mô tả:** Viết các test case đầu tiên cho file `src/utils/security.js` (hàm `escapeHTML`).
  - **Acceptance:** Báo cáo test (coverage) của `security.js` đạt 100%. Lệnh `npm test` báo Pass.
  - **Files:** `src/utils/security.test.js`

- [ ] **Task 4: Unit Test cho `manga.js`**
  - **Mô tả:** Viết test cho các hàm xử lý dữ liệu phức tạp trong `src/mixins/manga.js` (ví dụ `getSeriesGroups`), sử dụng mock data để không phụ thuộc vào `store`.
  - **Acceptance:** Test chạy Pass. Báo cáo coverage cho hàm `getSeriesGroups` đạt mức cơ bản.
  - **Files:** `src/mixins/manga.test.js`

### Checkpoint Cuối cùng
- [ ] Chạy `npm run test:coverage` hiển thị bảng thống kê.
- [ ] Đảm bảo web app vẫn chạy bình thường với `npm run dev` (không làm hỏng build hiện tại).
- [ ] Kiểm tra nhanh tính năng linting/type-check với TypeScript qua lệnh `npx tsc --noEmit`.
