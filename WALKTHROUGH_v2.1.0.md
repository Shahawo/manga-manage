# Walkthrough v2.1.0: Testing & Architecture Foundation

Phiên bản này tập trung vào việc củng cố chất lượng mã nguồn bằng cách thiết lập nền tảng kiểm thử tự động và chuẩn bị cho việc di chuyển sang TypeScript.

## 🚀 Các thay đổi chính

### 1. Tích hợp Vitest (Testing Framework)
- Cài đặt `vitest` và `jsdom` để chạy unit tests trong môi trường giả lập trình duyệt.
- Cấu hình `vitest.config.js` để hỗ trợ global variables và coverage report.
- Thêm các scripts mới vào `package.json`:
    - `npm test`: Chạy toàn bộ tests.
    - `npm run test:watch`: Chạy tests ở chế độ quan sát thay đổi.
    - `npm run test:coverage`: Sinh báo cáo độ phủ mã nguồn.

### 2. Viết Unit Tests đầu tiên
- **Security Utils (`src/utils/security.test.js`)**: Đảm bảo hàm `escapeHTML` hoạt động chính xác để ngăn chặn XSS. Độ phủ: 100%.
- **Manga Mixins (`src/mixins/manga.test.js`)**: Kiểm tra logic quan trọng của hàm `getSeriesGroups` (tính toán %, phân nhóm bộ truyện, sắp xếp).

### 3. Nền tảng TypeScript
- Khởi tạo file `tsconfig.json` cho phép kiểm tra lỗi (type checking) trên cả file JavaScript hiện có (`allowJs: true`, `checkJs: true`).
- Giúp phát hiện sớm các lỗi truy cập thuộc tính không tồn tại hoặc sai kiểu dữ liệu.

## 🛠 Cách chạy Tests
Mở terminal và chạy lệnh:
```bash
npm test
```
Để xem báo cáo độ phủ:
```bash
npm run test:coverage
```

## 📈 Định hướng tiếp theo
- Chuyển đổi dần các file `.js` quan trọng sang `.ts` (TypeScript).
- Refactor các thành phần UI để loại bỏ sự phụ thuộc vào `window.app`.
- Tự động hóa việc chạy tests thông qua GitHub Actions.
