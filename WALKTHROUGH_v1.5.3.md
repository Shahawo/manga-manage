# Manga Manager - Phiên bản 1.5.3

## 📌 Tổng quan phiên bản
Phiên bản 1.5.3 tập trung vào ba trụ cột lớn:
1. **Kiến trúc Background Sync Queue** — đưa toàn bộ thao tác CRUD về mô hình Optimistic UI + queueTask, loại bỏ mọi loading overlay có thể bị treo.
2. **Ổn định Admin Catalog** — fix chuỗi lỗi trong giao diện quản lý Kho chung (tab-switch freeze, spinner kẹt, series detail instant render, smart search).
3. **Vá lỗi giao diện & chức năng** — toast, badge, dropdown, data mapping, bucket Storage.

---

## 🎨 Lỗi giao diện / UX

### 1. Dropdown Lọc tiến độ bị rớt thẻ HTML
- **Triệu chứng:** Tùy chọn "Chưa đủ bộ (<100%)" bị hiển thị sai do ký tự `<` bị trình duyệt phân giải thành thẻ HTML.
- **Giải pháp:** Thay `<` bằng `&lt;` trong template HTML của dropdown.

### 2. Badge phiên bản chồng màu trong Admin Duyệt sách
- **Triệu chứng:** Badge `ĐẶC BIỆT` bị lộ mép màu cam khi sách đồng thời có badge ISBN — hai badge đè lên cùng tọa độ.
- **Giải pháp:** Tách riêng cụm badge thành class `pending-badge-stack`, xếp dọc thay vì chồng.

### 3. Chuẩn hóa Toast + Thay alert() bằng Toast
- **Triệu chứng:** Toast loại `'info'` hiển thị màu xanh lá (giống success, gây nhầm). Hàm `autoFill()` dùng `alert()` chặn màn hình.
- **Giải pháp:** Thêm type `'info'` màu vàng cam (`#d97706`) vào `showToast()`. Thay tất cả `alert()` bằng `this.showToast(..., 'error')`.

### 4. Ô "Số tập" trống khi chưa load — bỏ placeholder "Đang tải..."
- **Triệu chứng:** Khi click vào series trong Admin Kho chung, ô "Số tập" hiện "Đang tải..." trong khi fetch `series_metadata` ngầm, trông thừa.
- **Giải pháp:** `totalInput.placeholder = ''` → ô trống sạch sẽ; số tập thật điền vào khi fetch xong.

---

## 🐛 Lỗi chức năng

### 5. Đồng bộ bucket Storage + khôi phục luồng đóng góp Kho chung
- **Bucket:** Sửa `app.js` upload ảnh vào bucket `covers` (trước đây bị sai tên). Thêm biến `storageBucket` tránh hard-code.
- **Đóng góp Kho chung:** Khi user thêm sách mới không từ catalog, tự đưa vào `pending_catalog` qua task `INSERT_PENDING` — không mất đóng góp khi mạng yếu hay chuyển tab.

### 6. Sửa lỗi hiển thị dữ liệu Admin + chuẩn hóa localStorage keys
- **Admin data:** Sửa gọi sai hàm `renderAdminFeedback` → `renderFeedbackList`. Map đúng field snake_case (`scanned_isbn`, `user_name`, `user_email`, `created_at`).
- **localStorage:** Thống nhất `gridCols`, `fontSize` làm key chính; giữ fallback key cũ `setting_gridCols` / `setting_fontSize` để không mất cài đặt cũ.

### 7. Admin Kho chung: click tập không mở modal + xóa không cập nhật UI
- **Nguyên nhân 1:** `openCatalogModal(id)` tìm ID trong `adminCatalogCache` — nhưng cache này đã là mảng gộp theo series (`{series, count, cover}`) không có `id` → `.find()` luôn trả `undefined`.
- **Nguyên nhân 2:** `adminDeleteCatalog()` filter `adminCatalogCache` theo `id` → filter vô hiệu, UI render lại dữ liệu cũ.
- **Giải pháp:** Chuyển tất cả tra cứu ID sang `fullCatalogCache` (chứa từng tập riêng lẻ với `id` thật).

---

## ✨ Tính năng mới

### 8. Giao diện Admin Kho chung mới — Gộp series + 2 cột
- **Trước:** Danh sách dài từng tập rời rạc không có cấu trúc.
- **Sau:** Tập được gộp theo series, click vào series → chuyển sang màn hình chi tiết (không dùng modal) hiển thị các tập theo lưới 2 cột, tối đa 100 cuốn/trang.
- Hàng đầu tiên của detail view: tên series + ô nhập "Số tập thực tế" (Enter → đồng bộ ngay).

### 9. Smart Search Mode — Tìm "spy x family tập 1" trả về đúng tập riêng lẻ
- **Triệu chứng:** Tìm "spy x family tập 1" → trả về series "Spy X Family (8 cuốn)" thay vì Tập 1 cụ thể.
- **Nguyên nhân:** `searchAdminCatalog()` luôn group theo series bất kể query cụ thể đến đâu.
- **Giải pháp — Smart Search Mode:** Kích hoạt hiển thị từng volume khi:
  1. Query chứa chỉ định tập (`tập N`, `vol N`, `volume N`), hoặc
  2. Kết quả filter ≤ 15 cuốn.
  - Thêm `_renderCatalogVolumeResults()` render flat list, mỗi item click trực tiếp mở modal chỉnh sửa.

---

## 🔄 Kiến trúc / Đồng bộ hóa

### 10. Background Sync Queue + Optimistic UI — Kiến trúc cốt lõi
*(Hợp nhất các fix ban đầu về form-freeze, queue cơ bản, và form guard)*

- **Vấn đề:** Mọi `await supabase.*` bị treo vĩnh viễn khi browser throttle JS lúc tab ẩn → loading overlay kẹt.
- **Giải pháp kiến trúc:**
  - **Optimistic UI:** Form đóng ngay, kết quả hiển thị ngay, task được đẩy vào `syncQueue` (localStorage).
  - **Background Worker:** `processSyncQueue()` chạy ngầm, tự thử lại khi có mạng / tab hiện.
  - **UUID Frontend:** Tự cấp UUID ở client trước khi insert, loại bỏ ID tạm phiền phức.
  - **Form Guard:** `_abortAllPending()` không abort khi `currentView === 'form'` để form submit không bị interrupt.
  - **`withTimeout(15s)`:** Bọc mọi Supabase call trong queue để tránh kẹt vô hạn.

### 11. Mở rộng Sync Queue: DELETE, REJECT + retry thông minh
*(Hợp nhất các mục về DELETE_MANGA, ADMIN_REJECT_PENDING, pendingRejectedIds)*

- **DELETE_MANGA:** Thêm vào queue thay vì `await` trực tiếp.
- **ADMIN_REJECT_PENDING:** Chạy ngầm qua queue, modal đóng ngay. Task từ chối có `attempts + retryAt` → tự thử lại sau lỗi mạng; ID từ chối lưu vào `pendingRejectedIds` để ẩn khỏi UI ngay cả khi Supabase trả data cũ.
- **nonBlocking flag:** Task `INSERT_PENDING` không chặn hàng đợi nếu lỗi.
- **Queue bypass:** Các task sau task `REJECT` đang retry vẫn được xử lý — queue không bị đứng toàn bộ.

### 12. Auto-Reconcile + Queue-Aware Loading + Suppress Toast khi F5
*(Hợp nhất 3 cải tiến liên tiếp về sync queue)*

- **Auto-Reconcile:** Sau `processSyncQueue()` xử lý xong toàn bộ queue → tự gọi `loadData()` để fetch fresh data từ Supabase → UI tự đồng bộ, không cần F5.
- **Queue-Aware Data Loading:** Trong `loadData()`, sau khi fetch từ Supabase, tự merge các pending task trong queue vào data trước khi render (INSERT → hiện ngay, DELETE → ẩn ngay, UPDATE → áp dụng ngay).
- **Suppress Toast:** Flag `_isPageLoad = true` trong `init()` → lần sync đầu tiên sau F5 không hiện toast "Đồng bộ hoàn tất" (user đã thấy sách rồi qua queue-aware merge).
- **Kết quả:** Thêm sách → F5 → sách xuất hiện ngay lập tức, 0 toast thừa.

### 13. Migrate toàn bộ Admin operations sang queueTask — Loại bỏ loading overlay
*(Hợp nhất: Admin Catalog tab-switch abort, submitFeedback, adminUpdateCatalog, adminDeleteCatalog)*

- **Triệu chứng chung:** Các thao tác Admin (gửi góp ý, cập nhật/xóa kho chung) dùng `await supabase.rpc(...)` trực tiếp → chuyển tab → loading overlay kẹt vĩnh viễn.
- **Giải pháp — Migrate sang queueTask (giống pattern Thêm sách):**

  | Hàm | Task type | nonBlocking | Optimistic |
  |---|---|---|---|
  | `submitFeedback` | `INSERT_FEEDBACK` | ✅ (non-critical) | Đóng modal ngay |
  | `adminUpdateCatalog` | `ADMIN_UPDATE_CATALOG` | ❌ (critical) | Merge vào `fullCatalogCache` ngay |
  | `adminDeleteCatalog` | `ADMIN_DELETE_CATALOG` | ❌ (critical) | Filter khỏi `fullCatalogCache` ngay |

- `processSyncQueue()` bổ sung handler cho 3 task type mới, dùng `withTimeout(15s)`.
- **Kết quả:** Chuyển tab không bao giờ làm mất thao tác — task vẫn nằm trong queue localStorage, sync khi online.

---

## ⚡ Cải thiện hiệu năng

### 14. Admin Catalog Prefetch — Vào tab Kho chung hiển thị ngay
- **Vấn đề:** Mỗi lần vào tab "Quản lý Kho" phải chờ fetch toàn bộ catalog (~1-2s).
- **Giải pháp:** Khi admin load trang chính, sau 1.5s tự chạy ngầm `_prefetchCatalogCache()` → fetch toàn bộ bảng `catalog` vào `fullCatalogCache`.
  - Dùng cùng `_catalogFetchController` → tab switch tự abort an toàn.
  - Flag `_isFetchingCatalog` ngăn trùng lặp. Silent failure → `searchAdminCatalog()` vẫn tự fetch lại bình thường.

### 15. Admin Catalog: Tab-switch Guard + Series Detail Instant Render
*(Hợp nhất: abort khi tab ẩn, null-guard, instant render)*

- **Tab-switch Guard (Admin Catalog list):**
  - Lưu controller fetch thành `this._catalogFetchController`.
  - Tab ẩn (`visibilitychange`): nếu fetch đang chạy → abort + xóa `fullCatalogCache`.
  - Tab hiện lại: nếu ở admin view và cache null → gọi lại `searchAdminCatalog(1)` sau 300ms.

- **Series Detail — Null-guard + Instant Render:**
  - **Null-guard:** Nếu `fullCatalogCache` null → fetch lại trước khi render (hiện spinner tạm — hiếm xảy ra).
  - **Instant Render:** Render volumes NGAY LẬP TỨC từ `fullCatalogCache` (0 network request). Fetch `series_metadata` bằng `.then()` không blocking → cập nhật trường "Số tập" khi xong.
  - **Kết quả:** Click series → volumes hiển thị ngay, không spinner, không delay.

---

## 🛠 Yêu cầu Kỹ thuật / Nâng cấp Cơ sở dữ liệu
Không có yêu cầu nâng cấp cơ sở dữ liệu mới. Cần bảo đảm Supabase Storage có bucket public tên `covers` như hướng dẫn hiện tại.
