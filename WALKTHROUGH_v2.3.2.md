# Walkthrough v2.3.2 (Đang phát triển)

**Ngày khởi tạo:** 2026-05-17  
**Phiên bản trước:** v2.3.1  

*Mọi thay đổi trong chu kỳ phát triển của phiên bản này sẽ được tự động ghi log vào đây.*

---

## 1. Nhật ký thay đổi (Chưa phân loại)

- **Tối ưu hóa Egress Supabase Storage**:
  - Tinh chỉnh hàm `compressImageToBlob` (trong `src/mixins/form.js`): Giảm kích thước ảnh tối đa từ `1200px` xuống `800px` và chất lượng WebP từ `0.85` xuống `0.8` nhằm giảm mạnh dung lượng ảnh bìa khi upload.
  - Bổ sung `cacheControl: '31536000'` (cache 1 năm) vào các lệnh `supabase.storage.upload()` (cả ảnh bìa và quà tặng) để trình duyệt/CDN giữ cache, triệt tiêu việc gọi mạng lại mỗi lần tải lại trang.
  - **Tích hợp Cloudflare Worker Proxy**: Bổ sung hàm tiện ích `getCdnUrl` và `getOriginalUrl` trong `src/mixins/ui.js` để tự động biến đổi (proxy) các link tải ảnh bìa (`supabase.co`) sang tên miền CDN (`workers.dev`). Đã xử lý chặn luồng ngược tại `api.js` và `form.js` để đảm bảo luôn lưu lại link gốc vào database (an toàn dữ liệu) nhưng render ra màn hình bằng link CDN. Giảm 100% Egress!
- **Khắc phục lỗi treo Loading vô hạn khi thao tác dữ liệu (Mutations)**:
  - Mở rộng cơ chế chống treo Fetch (từng áp dụng cho tải danh sách ở bản 2.3.1) cho các tác vụ thay đổi dữ liệu: Thêm, sửa, xoá truyện người dùng và Kho chung, duyệt và gộp sách.
  - Tạo hàm wrapper `executeWithAbort()` trong `src/mixins/api.js` sử dụng `AbortController`, Timeout (15s) và Auto-Retry.
  - Áp dụng `executeWithAbort()` vào toàn bộ luồng đồng bộ ngầm (`processSyncQueue()`) để bảo vệ các hàng đợi thao tác (INSERT_MANGA, UPDATE_MANGA, DELETE_MANGA, ADMIN_UPDATE_CATALOG, v.v.).
  - Áp dụng vào các thao tác chặn giao diện đồng bộ trực tiếp (`adminApprove`, `quickMerge`, `saveAdminSeriesMetadata`) trong `src/mixins/admin.js`, ngăn tình trạng ứng dụng đóng băng khi rớt mạng hoặc tab bị ngủ đông.
- **Đơn giản hóa mã nguồn (Code Simplification - SYSTEM_REVIEW.md Mục 3)**:
  - Tách module `admin.js` quá khổ (hơn 1500 dòng) thành các file sub-mixins nhỏ hơn, gắn kết chặt chẽ về logic: `src/mixins/admin-catalog.js` (Quản lý Kho chung), `src/mixins/admin-pending.js` (Duyệt sách chờ duyệt), và `src/mixins/admin-schedule.js` (Lịch phát hành).
  - Rút gọn file core `src/mixins/admin.js` chỉ giữ lại các hàm điều hướng panel chính và quản lý góp ý (Feedback).
  - Tích hợp và đồng bộ hóa cơ chế `executeWithAbort()` cho tất cả các truy vấn dữ liệu và RPC trong các sub-mixins này nhằm loại bỏ code lặp thừa, giảm thiểu boilerplate.
  - Cập nhật `src/main.js` để tự động import và spread các sub-mixins mới này vào namespace `window.app`, duy trì tính tương thích ngược hoàn toàn mà không làm thay đổi các handler onclick trong UI.
- **Tái cấu trúc mã nguồn (Phase 1 - View Extraction)**:
  - Tách các khối HTML của từng màn hình (`dashboard`, `detail`, `about`, `stats`, `schedule`, `search`, `add-method`, `coming-soon`) ra khỏi `index.html` và chuyển thành các file độc lập trong thư mục `src/views/`.
  - Cập nhật `src/main.js` để import các view này dưới dạng chuỗi (raw Vite string) và bơm (inject) vào thẻ `<main class="container">` lúc khởi động ứng dụng.
  - Kết quả: Giảm dung lượng file `index.html` từ ~600 dòng xuống còn khoảng 150 dòng (chỉ còn chứa cấu trúc bộ khung layout chính như Navbar), giúp code dễ đọc và dễ bảo trì hơn đáng kể.
- **Tái cấu trúc mã nguồn (Phase 2 - CSS Modularization)**:
  - Phân tách file `styles.css` gốc khổng lồ (~3300 dòng) thành các module nhỏ, dễ quản lý hơn nằm trong thư mục `src/styles/`.
  - Hệ thống CSS mới bao gồm: `variables.css`, `base.css`, `layout.css`, cùng các thư mục `components/` (chứa CSS cho button, modal, dropdown, form...) và `views/` (chứa CSS riêng rẽ cho từng màn hình như dashboard, detail, stats, schedule).
  - Tích hợp bằng `@import` ngay tại file `styles.css` gốc, tận dụng tính năng build tự động của Vite để gom CSS mà không làm ảnh hưởng tốc độ tải trang.
- **Tái cấu trúc mã nguồn (Phase 3 - JS Feature Grouping)**:
  - Xóa bỏ thư mục `src/mixins/` đang bị phình to (chứa 18 file).
  - Phân bổ lại các file logic JS vào 2 khu vực rõ ràng:
    - `src/core/`: Chứa các tính năng cốt lõi (api, auth, router, store, ui, settings).
    - `src/features/`: Chứa các tính năng nghiệp vụ cụ thể (`admin/`, `manga/`, `schedule/`, `stats/`).
  - Tự động cập nhật các đường dẫn import (relative paths) tương ứng đảm bảo ứng dụng không bị gián đoạn. Cấu trúc giờ đây đã tuân thủ chặt chẽ mô hình phân tách tính năng (Feature-driven), sẵn sàng cho các nâng cấp và mở rộng (scale) cực lớn trong tương lai mà không sợ conflict code.

