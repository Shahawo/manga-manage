# Tóm Tắt Hệ Thống: Kệ Truyện Của Tôi (Manga Manager)

## 🎯 Mục đích dự án
**Kệ Truyện Của Tôi** là một ứng dụng web dạng **Quản lý Bộ Sưu Tập Truyện Tranh Vật Lý (Physical Manga Tracker)**. Khác với các trang web đọc truyện online, ứng dụng này được thiết kế riêng cho dân sưu tầm, giúp họ số hóa và quản lý danh sách những cuốn truyện thật đang nằm trên kệ sách ở nhà.

Dự án hoạt động dựa trên mô hình **Crowdsourcing (Đóng góp cộng đồng)**, nơi người dùng có thể mượn dữ liệu chung để nhập liệu nhanh, đồng thời đóng góp dữ liệu mới cho hệ thống.

## ⚙️ Các tính năng cốt lõi

### 1. Quản lý Thư viện Cá nhân (Personal Shelf)
- Người dùng đăng nhập (thông qua Google Auth) để sở hữu một "kệ truyện" riêng biệt.
- Quản lý tiến độ sưu tầm theo từng bộ truyện (Series): Theo dõi trực quan trạng thái **"Đã đủ bộ (100%)"** hoặc **"Chưa đủ bộ (<100%)"**.
- Lưu trữ thông tin chi tiết từng cuốn: Hình ảnh bìa, quà tặng kèm, giá tiền, kích thước, nhà xuất bản, dịch giả...
- Hỗ trợ đổi giao diện Sáng/Tối (Dark/Light mode), hiển thị dạng Lưới (Grid) hoặc Danh sách (List).

### 2. Quét Tự Động Thông Minh (Barcode & AI Vision)
- **Tính năng "Ăn tiền":** Thay vì gõ tay toàn bộ thông tin sách, người dùng có thể sử dụng Camera trên điện thoại để quét mã ISBN in ở mặt sau cuốn truyện.
- Hệ thống sẽ tự động đối chiếu mã vạch với Cơ sở dữ liệu và điền sẵn mọi thông tin. Nếu dùng trên máy tính, có thể tải ảnh chụp mã vạch lên để nhận diện.
- **Tích hợp AI Vision (OCR):** Hỗ trợ thêm tính năng chụp ảnh mặt bìa (nếu mã vạch hỏng hoặc mờ). AI (Tesseract.js) tích hợp sẵn trên trình duyệt sẽ tự động nhận diện chữ viết (Tiếng Việt/Tiếng Anh) từ hình ảnh bìa và tìm kiếm tự động sách tương ứng trong kho.

### 3. Hệ Sinh Thái "Kho Chung" (Central Catalog)
- Để giảm tải việc nhập liệu trùng lặp, hệ thống xây dựng một **Kho Dữ Liệu Chung**.
- Khi một người dùng thêm cuốn truyện chưa từng xuất hiện trên hệ thống, dữ liệu này sẽ được đưa vào danh sách **"Chờ duyệt"**.
- Khi đã được Admin phê duyệt và đưa vào Kho Chung, những người dùng khác mua cuốn đó sau này chỉ cần quét mã hoặc gõ tên là thông tin tự động hiện ra.

### 4. Hệ Thống Quản Trị (Admin Panel)
- Dành riêng cho tài khoản được cấp quyền Admin.
- **Duyệt sách:** Kiểm duyệt, chỉnh sửa lại thông tin do người dùng gửi lên trước khi lưu vĩnh viễn vào Kho Chung.
- **Quản lý Kho:** Xem, sửa chữa dữ liệu của các bộ sách đang có trong Kho.
- **Phản hồi:** Đọc và xử lý các báo lỗi, góp ý từ người dùng thông qua form Góp ý (Feedback Modal).

### 5. Sao Lưu Dữ Liệu (Export / Import)
- Cho phép người dùng trích xuất toàn bộ dữ liệu kệ truyện cá nhân thành file `.json` để lưu trữ an toàn.
- Hỗ trợ phục hồi dữ liệu từ file backup bất kỳ lúc nào.

## 🛠 Nền tảng Công nghệ

1. **Kiến trúc:** Single Page Application (SPA). Toàn bộ thao tác chuyển trang đều diễn ra tức thời (mượt mà như App), không cần tải lại trang. Hỗ trợ Clean URL (History API).
2. **Version Current:** `v2.0.0`
3. **Frontend:** Hoàn toàn sử dụng **Vanilla JavaScript**, HTML, và CSS. Không dùng Framework cồng kềnh. Sử dụng **Vite** làm công cụ đóng gói (Bundler) và Hot-Reload.
4. **Backend & Database:** Không sử dụng Server tự host (NodeJS, PHP...). Toàn bộ logic Backend, Cơ sở dữ liệu, Lưu trữ Ảnh (Storage) và Xác thực người dùng (Authentication) đều được xử lý gọn nhẹ thông qua **Supabase** (PostgreSQL).
5. **Bảo mật:** Sử dụng hệ thống phân quyền Row Level Security (RLS) của Supabase để đảm bảo dữ liệu cá nhân của ai người nấy thấy, và chỉ Admin mới được can thiệp vào Kho Chung.
