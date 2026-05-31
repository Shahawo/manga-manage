# Walkthrough v2.3.1 — Nâng cấp Ổn định & Bảo mật

**Ngày phát hành:** 2026-05-17  
**Phiên bản trước:** v2.3.0  
**Loại nâng cấp:** PATCH — Sửa lỗi, bảo mật, tăng cường tính ổn định (Network Resilience)

---

## Tóm tắt

Phiên bản 2.3.1 tập trung giải quyết triệt để lỗi **Treo UI/Loading vô hạn (Tab Suspension Bug)** khi người dùng chuyển sang tab khác và quay lại, đồng thời **vá một lỗ hổng bảo mật nghiêm trọng (Stored XSS)** trong trang Quản trị (Admin Panel).

---

## 1. Cải thiện & Sửa lỗi (Fixes & Hardening)

### 🔄 Kiến trúc & Đồng bộ (Network Resilience & Auto-Retry)

#### Lỗi Treo Fetch (Loading Infinite) khi trình duyệt ngủ đông
- **Triệu chứng:** Khi người dùng chuyển sang tab khác (VD: Youtube) khoảng vài phút rồi quay lại, trình duyệt sẽ đưa tab Manga-Supabase vào trạng thái ngủ đông (Throttle/Suspend). Lúc này, các socket kết nối mạng bị ngắt. Nếu gọi fetch() lúc này, request sẽ bị "treo vĩnh viễn" (pending mãi mãi) không bao giờ trả về lỗi hay timeout, khiến loading spinner quay vô tận.
- **Giải pháp:**
  - **Tầng 1 (Cache Control):** Ghi đè cấu hình `global.fetch` trong `supabase-client.js` để tự động đính kèm header `Cache-Control: no-cache`. Điều này ép trình duyệt luôn mở socket mới thay vì dùng lại socket rác.
  - **Tầng 2 (AbortController & Promise.race):** Bao bọc toàn bộ các hàm gọi API (trong `api.js`, `admin.js`, `schedule-import.js`) bằng một bộ đếm thời gian (Timeout `10-18s`) bằng `Promise.race`.
  - **Tầng 3 (Auto-Retry):** Khi bị quá thời gian (Timeout), hệ thống sẽ ngầm gọi `controller.abort()` để hủy request rác và tự động thử lại lần thứ 2 (Auto-retry) trước khi báo lỗi cho người dùng.
- **Kết quả:** Giao diện hoàn toàn "miễn nhiễm" với các biến động mạng khi chuyển tab. Người dùng không còn bị kẹt màn hình tải dữ liệu.

### 🛡️ Bảo mật (Security)

#### Vá lỗ hổng Stored XSS trong Admin Panel
- **Triệu chứng:** Trong màn hình *Góp ý người dùng* và *Danh sách Sách chờ duyệt*, các dữ liệu do người dùng nhập (như tên người dùng, tên sách) được gắn trực tiếp vào giao diện qua `.innerHTML` mà không được mã hóa (encode). Kẻ xấu có thể gửi tên sách chứa mã độc `<script>` để chiếm quyền điều khiển của tài khoản Admin khi họ mở bảng quản trị.
- **Giải pháp:** Sử dụng hàm `escapeHTML()` (trong `utils/security.js`) để encode toàn bộ các thuộc tính như `p.series`, `p.title`, `fb.userName`, `fb.content` trước khi nhúng vào giao diện.
- **Kết quả:** Đóng hoàn toàn lỗ hổng XSS tiêm mã độc vào Admin Panel.

---

## 2. Các File Đã Thay Đổi

| File | Mô tả thay đổi |
|------|---------------|
| `package.json` | Nâng phiên bản `2.3.0` → `2.3.1` |
| `src/supabase-client.js` | Ghi đè `global.fetch` thêm header `Cache-Control: no-cache`. |
| `src/mixins/admin.js` | Vá XSS (`escapeHTML`); thêm `AbortController` + Timeout + Retry cho các hàm `fetchPendingBooks`, `checkDuplicate`, `renderAdminSeriesDetail`, `fetchAdminFeedback`, `adminScheduleLoad`. |
| `src/mixins/schedule-import.js`| Thêm `AbortController` (18s timeout) cho luồng crawl dữ liệu từ Tana.moe. |
| `SYSTEM_REVIEW.md` | Xuất báo cáo đánh giá toàn diện sau khi rà soát kiến trúc. |
