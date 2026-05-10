# Spec: Testing Infrastructure & TypeScript Migration

## Objective
Thiết lập nền tảng kiểm thử tự động (Unit Test) với Vitest và tiến hành chuẩn bị môi trường TypeScript để đảm bảo chất lượng mã nguồn, ngăn ngừa lỗi hồi quy (regression bugs) và tăng độ tin cậy của ứng dụng Kệ Truyện (Manga-Supabase).
Mục tiêu cụ thể đợt 1: Cài đặt Vitest, viết test cho `utils/security.js` và `mixins/manga.js`. Thiết lập cấu hình TypeScript cơ bản.

## Tech Stack
- **Framework Test:** Vitest (tích hợp hoàn hảo với Vite hiện tại)
- **Môi trường Test DOM:** JSDOM hoặc Happy-DOM (để test các hàm mixins có tương tác DOM)
- **Ngôn ngữ:** JavaScript/TypeScript

## Commands
- Chạy Test 1 lần: `npm test`
- Chạy Test (Watch mode): `npm run test:watch`
- Chạy Test kèm Báo cáo độ phủ (Coverage): `npm run test:coverage`

## Project Structure
Các file test sẽ được đặt nằm cùng thư mục với file source code để dễ quản lý:
```
src/
├── utils/
│   ├── security.js
│   └── security.test.js    <-- File test mới
├── mixins/
│   ├── manga.js
│   └── manga.test.js       <-- File test mới
```

## Code Style
Ví dụ cấu trúc viết test bằng Vitest:
```javascript
import { describe, it, expect } from 'vitest';
import { escapeHTML } from './security';

describe('escapeHTML utility', () => {
  it('should escape <script> tags to prevent XSS', () => {
    const input = '<script>alert(1)</script>';
    const expected = '&lt;script&gt;alert(1)&lt;/script&gt;';
    expect(escapeHTML(input)).toBe(expected);
  });
});
```

## Testing Strategy
- **Cấp độ:** Tập trung vào Unit Test cho các pure function (logic tính toán, helper) trước.
- **Mocking:** Sử dụng `vi.mock` để giả lập `store` và `supabase` nếu cần test các hàm gọi API hoặc thay đổi trạng thái toàn cục.
- **Coverage:** Mục tiêu đạt > 80% coverage cho các file được nhắm tới (`security.js`, `manga.js`).

## Boundaries (Giới hạn)
- **Luôn làm:** Cài đặt Vitest vào `devDependencies` (không đưa vào production build). Giữ code test độc lập với code app.
- **Hỏi trước khi làm:** Nếu cần thay đổi lớn trong file `vite.config.js` làm ảnh hưởng đến quá trình build production.
- **Tuyệt đối không:** Bỏ qua (skip) test bị lỗi thay vì sửa logic.

## Success Criteria (Tiêu chí Hoàn thành)
- [ ] Chạy lệnh `npm test` thành công trên terminal.
- [ ] Hàm `escapeHTML` trong `security.js` được bao phủ 100% test case.
- [ ] Hàm `getSeriesGroups` trong `manga.js` được test chính xác với các dữ liệu đầu vào giả lập (mock data).
- [ ] Sinh ra file `tsconfig.json` hợp lệ, hỗ trợ kiểm tra kiểu dữ liệu cho toàn dự án.

## Giả định (Assumptions)
1. Chúng ta vẫn dùng JSDOM để giả lập DOM trong môi trường Node.js (vì ứng dụng thao tác với DOM nhiều).
2. Dự án dùng NPM làm package manager (dựa theo `package-lock.json`).

---
