# Quy tắc Quản lý Phiên bản & Walkthrough (Dành cho AI)

Tài liệu này đóng vai trò như một bộ nhớ dài hạn để AI tuân thủ nghiêm ngặt quy trình làm việc và phát hành phiên bản mới của dự án.

## Quy trình làm việc (Workflow)

1. **Ghi log liên tục (Real-time Logging)**:
   - Trong quá trình phát triển (khi chưa chốt nâng phiên bản), mọi thay đổi mã nguồn, sửa lỗi (bug fix), cải thiện UX/UI, hoặc thêm tính năng mới **bắt buộc phải được cập nhật trực tiếp ngay lập tức** vào file `WALKTHROUGH_v[phiên_bản_đang_phát_triển].md`.
   - *Ví dụ: Hiện tại app đang là `1.5.2`, AI làm bất cứ tính năng gì thì phải tự động mở file `WALKTHROUGH_v1.5.3.md` ra và ghi log vào đó.*

2. **Khi người dùng yêu cầu "Nâng phiên bản"**:
   - **Bước 1 - Xác định số phiên bản (Theo chuẩn SemVer - Semantic Versioning: MAJOR.MINOR.PATCH)**:
     - Dựa vào những gì đã làm trong file Walkthrough:
       - **PATCH (`x.x.1` -> `x.x.2`)**: Dành cho sửa lỗi (bug fixes), tinh chỉnh nhỏ (tweaks), cải thiện UX/UI không làm thay đổi luồng hoạt động chính.
       - **MINOR (`x.1.x` -> `x.2.0`)**: Dành cho việc thêm tính năng mới (new features), thay đổi luồng hoạt động mà vẫn tương thích với dữ liệu cũ. Khi tăng MINOR, PATCH phải reset về 0.
       - **MAJOR (`1.x.x` -> `2.0.0`)**: Dành cho việc thay đổi kiến trúc toàn diện, cấu trúc dữ liệu bị phá vỡ (breaking changes), hoặc viết lại toàn bộ core. Khi tăng MAJOR, cả MINOR và PATCH phải reset về 0.
     - **⚠️ Quy tắc bắt buộc — Hỏi người dùng khi có mâu thuẫn:**
       Nếu kết quả phân tích Walkthrough của AI cho thấy nên nâng theo một mức khác với tên file Walkthrough hiện tại (ví dụ: AI thấy có tính năng mới → nên nâng MINOR, nhưng file đang là `WALKTHROUGH_v1.5.3.md` gợi ý PATCH), AI **PHẢI DỪNG LẠI và hỏi người dùng** trước khi tiến hành, với format:
       > *"Tôi phân tích thấy nên nâng **[MINOR/MAJOR/PATCH]** vì [lý do cụ thể — ví dụ: có thêm tính năng Smart Search]. Tuy nhiên file Walkthrough hiện tại tên là `vX.X.X` gợi ý nâng **[PATCH/...]**. Bạn muốn nâng phiên bản nào?"*

       AI **KHÔNG được tự ý chọn** một mức và tiến hành mà không hỏi, kể cả khi tên file có vẻ rõ ràng.
   - **Bước 2 - Cập nhật mã nguồn**:
     - Tìm và cập nhật đồng loạt tất cả các thông tin phiên bản trong dự án (`index.html`, `app.js`...).
     - *Ví dụ: Cập nhật cache-busting `styles.css?v=1.5.3`, đổi text `Phiên bản 1.5.3` ở Footer.*
   - **Bước 2.5 - Rà soát & Chắt lọc Walkthrough (BẮT BUỘC trước khi chốt sổ)**:
     Đây là bước dọn dẹp và biên tập lại nội dung Walkthrough để tài liệu luôn súc tích, chính xác, không bị phình to vô nghĩa theo thời gian.
     - **Gộp lỗi tương tự:** Nếu nhiều mục mô tả cùng một vấn đề (vd: nhiều mục về "spinner bị treo"), gộp thành một mục duy nhất với giải pháp hoàn chỉnh nhất.
     - **Loại bỏ fix đã lỗi thời:** Nếu mục A mô tả cách giải quyết cũ, nhưng mục B (xuất hiện sau) đã thực hiện cách giải quyết mới tốt hơn và thay thế hoàn toàn A → xóa mục A, chỉ giữ mục B.
     - **Phân loại theo nhóm:** Sau khi gộp và lọc, sắp xếp các mục vào các nhóm rõ ràng:
       - 🐛 **Lỗi chức năng (Feature Bugs)**: Logic sai, CRUD không hoạt động, dữ liệu không nhất quán.
       - 🎨 **Lỗi giao diện / UX (UI/UX Bugs)**: Toast sai màu, spinner kẹt, layout vỡ, thiếu feedback.
       - ⚡ **Cải thiện hiệu năng (Performance)**: Prefetch, cache, lazy load, debounce.
       - 🔄 **Kiến trúc / Đồng bộ hóa (Architecture/Sync)**: Background sync queue, offline-first, auto-reconcile, tab visibility.
       - ✨ **Tính năng mới (New Features)**: Các chức năng hoàn toàn mới được thêm vào.
     - **Chuẩn hóa format:** Mỗi mục trong Walkthrough phải có đủ: **Triệu chứng → Nguyên nhân → Giải pháp → Kết quả**.
   - **Bước 3 - Chốt sổ Walkthrough hiện tại**:
     - Hoàn thiện và format lại file Walkthrough của phiên bản vừa được nâng (sau khi đã rà soát ở Bước 2.5).
   - **Bước 4 - Tạo trước Walkthrough cho phiên bản kế tiếp**:
     - Phải **tạo sẵn ngay lập tức** một file Walkthrough trống (Dự kiến là Patch tiếp theo) để chuẩn bị cho chu trình làm việc mới.
     - *Ví dụ: Vừa chốt nâng lên `1.5.3`, tạo ngay `WALKTHROUGH_v1.5.4.md`.*
