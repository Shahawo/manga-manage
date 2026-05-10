# Định Hướng Phát Triển Tương Lai (Roadmap)

Dưới đây là các định hướng phát triển nhằm biến "Kệ Truyện Của Tôi" từ một công cụ quản lý cá nhân thành một Nền tảng/Sân chơi số 1 dành cho cộng đồng sưu tầm truyện vật lý.

---

## 📊 1. Thống Kê & Trực quan hóa Dữ liệu (Analytics & Insights)
*Dân sưu tầm rất thích nhìn lại những gì mình đã đạt được. Việc trực quan hóa dữ liệu sẽ tạo động lực lớn.*

- **Dashboard Chi phí:** Tự động cộng tổng trường `price` của tất cả sách trong thư viện cá nhân. Hiển thị con số: "Tổng giá trị tài sản bộ sưu tập".
- **Biểu đồ Phân Bổ (Charts):** Cung cấp các biểu đồ tròn (Pie chart) hoặc biểu đồ cột thống kê:
  - Tỉ lệ phần trăm sách theo Nhà Xuất Bản (Kim Đồng, Trẻ, IPM...).
  - Số lượng sách mua mỗi tháng/mỗi năm.
- **Hệ thống Danh hiệu (Gamification):** Trao huy hiệu (Badge) trên Avatar khi đạt mốc thành tựu (VD: *Tân Binh* - 10 cuốn, *Cá Mập* - 100 cuốn, *Fan Cuồng* - Hoàn thành 10 bộ truyện...).

## 🌐 2. Tính năng Mạng Xã Hội & "Khoe" Kệ (Social Sharing)
*Chuyển từ tự quản lý sang kết nối cộng đồng.*

- **Kệ Truyện Công Khai (Public Profile):** Cho phép người dùng tạo một đường link đại diện (VD: `ketruyen.com/u/hoang`). Link này có thể gửi cho người khác xem (chỉ ở chế độ Read-only).
- **Tính năng Follow:** Theo dõi kệ truyện của người khác để xem họ vừa tậu thêm bộ nào.
- **Danh sách mong muốn (Wishlist):** Cho phép tạo một danh sách các cuốn "Đang tìm mua".

## 🛒 3. Chợ Trao Đổi / Pass Truyện (Marketplace & Trading)
*Giải quyết bài toán mua nhầm, mua lô, hoặc muốn thanh lý truyện cũ.*

- **Trạng thái "Muốn Bán/Đổi":** Tại chi tiết mỗi cuốn sách đang có, thêm nút gạt: **Đưa lên sàn**.
- **Khu vực Chợ (Marketplace Tab):** Nơi hiển thị tất cả sách đang được người dùng khác đánh dấu muốn pass lại.
- Vì hệ thống đã có sẵn dữ liệu chuẩn từ Kho Chung (tên sách, ISBN, giá bìa...), bài đăng bán sẽ được tạo tự động chỉ với 1 click, người bán chỉ cần điền thêm "Giá muốn bán" và "Tình trạng sách (Mới 99%, có ố vàng...)".

## 📅 4. Tích hợp Lịch Phát Hành (Release Calendar)
*Giúp người dùng không bao giờ bỏ lỡ các tập mới của bộ truyện đang theo dõi.*

- **Trang Lịch Phát Hành:** Cập nhật lịch ra mắt sách hàng tháng từ các đơn vị phát hành (NXB Trẻ, Kim Đồng, IPM, Thái Hà...).
- **Cảnh báo thông minh:** Hệ thống quét đối chiếu Kệ truyện cá nhân của user với Lịch phát hành. Nếu user đang có từ Tập 1 đến Tập 10 của "One Piece", và Lịch báo ngày 15/10 ra Tập 11 => **Gửi thông báo đẩy (Push Notification)** hoặc bôi đỏ trên giao diện để nhắc user đi mua.

## 🤖 5. Nâng cấp Công nghệ Nhận diện (OCR & AI Vision) — ✅ DONE
*Giải quyết vấn đề quét mã vạch bị hỏng hoặc sách cũ.*

- ✅ **Quét ảnh bìa (AI Vision):** Bổ sung lựa chọn quét ảnh bìa song song với quét Barcode.
- ✅ **Tích hợp OCR tại Client:** Sử dụng `Tesseract.js` chạy hoàn toàn trên trình duyệt người dùng để đọc chữ (tiếng Việt/tiếng Anh) từ ảnh bìa mà không cần tốn chi phí API backend.
- ✅ **Tự động đối chiếu Kho chung:** Làm sạch text từ OCR và tự động query tìm kiếm các cụm từ tương ứng trong bảng `catalog` của Supabase, hiển thị danh sách kết quả trực quan để người dùng chọn.

## 📱 6. Nâng cấp thành PWA (Progressive Web App)
*Mang lại trải nghiệm như App Mobile thật sự với chi phí 0 đồng.*

- Đăng ký `manifest.json` và Service Worker để người dùng có thể nhấn **"Add to Home Screen"** trên điện thoại.
- Web sẽ hiện icon ngoài màn hình chính, khởi động không có thanh địa chỉ trình duyệt, hỗ trợ hoạt động ngoại tuyến (Offline Mode) một phần, và quan trọng nhất là hỗ trợ nhận **Thông báo đẩy (Push Notifications)**.

## ⚡ 7. Tối ưu Hiệu suất & Ảnh (Performance & Media Optimization) — ✅ DONE
*Hệ thống chứa nhiều hình ảnh bìa truyện có thể gây tốn băng thông và làm chậm tốc độ tải trang.*

- ✅ **Lazy Loading Nâng cao:** `IntersectionObserver` với `rootMargin: 200px` + fade-in animation. Ảnh chỉ tải khi sắp vào viewport, dùng transparent GIF placeholder tránh lỗi `onerror`.
- ✅ **Tối ưu định dạng ảnh WebP:** `compressImageToBlob()` tự động phát hiện browser support → ưu tiên WebP (nhẹ hơn JPEG ~25-35%), fallback JPEG nếu browser cũ. Áp dụng cho cả ảnh bìa lẫn ảnh quà tặng.
- ✅ **Phân trang Dashboard:** 60 series/trang, chỉ kích hoạt khi > 60 series. Nút điều hướng tự hiện/ẩn. Reset trang khi đổi filter/sort/view mode.
- ✅ **List View 2 cột (desktop) / 1 cột (mobile):** Dashboard list view responsive, đổi về 1 cột ở `max-width: 480px`.

## 🛡️ 8. Tối ưu Bảo mật và Logic Backend (Supabase Power-ups)
*Đảm bảo an toàn tuyệt đối cho Kho dữ liệu chung khi dự án mở rộng.*

- **Row Level Security (RLS) chuyên sâu:** Hiện tại web đã chặn route `/admin` ở Frontend, nhưng người rành kỹ thuật vẫn có thể lấy API Key và gọi trực tiếp lên Supabase. Cần cấu hình RLS chặt chẽ trong Supabase Dashboard để đảm bảo chỉ có tài khoản Admin mới được thao tác (Insert/Update/Delete) vào các bảng dữ liệu hệ thống.
- **Supabase Edge Functions:** Xử lý các tác vụ phức tạp ở Backend (như gửi email báo truyện mới, crawl tự động, hoặc kết nối API AI OCR) thay vì xử lý toàn bộ logic trên Frontend.

## 🔍 9. Cải thiện SEO cho SPA (Tùy chọn)
*Giúp dự án dễ dàng được tìm kiếm trên Google (nếu mở rộng thành dạng web public/chợ giao dịch).*

- **Vấn đề:** Các con bọ tìm kiếm của Google (Crawlers) khó đọc được nội dung web của các trang SPA (do dữ liệu được render bằng JavaScript).
- **Giải pháp:** Bổ sung Pre-rendering hoặc chuyển dịch dần sang SSR (Server-Side Rendering). Có thể sử dụng Vite plugin `vite-plugin-ssr` (hoặc Vike) và cấu hình prerender, giúp xuất sẵn các file HTML cho chi tiết từng bộ truyện để Google dễ index.

## 🧪 10. Đảm bảo chất lượng mã nguồn & Kiểm thử (Testing & QA)
*Theo đúng tinh thần của Vòng đời dự án, cần thiết lập nền tảng kiểm thử sau khi đã tái cấu trúc module.*

- **Unit Testing với Vitest:** Viết test cho các hàm logic cốt lõi (như tính toán `%` series, trích xuất dữ liệu Barcode, xử lý phân trang).
- **Tự động hóa CI (Continuous Integration):** Sử dụng GitHub Actions để tự động chạy linter và test suite mỗi khi có thay đổi code mới, bảo vệ nhánh main trước khi Deploy.

## 🏗️ 11. Tái cấu trúc Kiến trúc Frontend (Architecture Refactoring)
*Hệ thống hiện tại tuy đã dùng ES6 Modules nhưng vẫn phụ thuộc vào Vanilla JS với `window.app` và chèn HTML thô (`innerHTML`). Điều này gây rủi ro về XSS và khó duy trì dài hạn.*

- **Dịch chuyển sang TypeScript:** Bổ sung Type definitions (Interfaces/Types) cho dữ liệu lấy từ Supabase (bảng `catalog`, `manga`) để ngăn chặn các lỗi như `ReferenceError` hoặc truy cập property không tồn tại ngay từ lúc viết code.
- **Tiến tới Framework / Web Components:** Áp dụng Alpine.js để thay thế sự kiện inline (`onclick="app.doSomething()"`) bằng cơ chế binding dữ liệu an toàn hơn, hoặc đóng gói các giao diện thành Web Components để có thể tái sử dụng dễ dàng.
