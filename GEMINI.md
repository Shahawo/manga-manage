# 🚀 Trình Quản Lý Vòng Đời Dự Án (Full Lifecycle Rules)

AI Assistant (Antigravity/Gemini) làm việc trong dự án **Manga-Supabase** phải TỰ ĐỘNG nhận diện ngữ cảnh và tuân thủ chặt chẽ vòng đời phát triển dưới đây. **Tuyệt đối không được bỏ qua các bước xác minh.**

## 🔄 Quy Trình Full Lifecycle:

### 1. Giai đoạn Bắt đầu (Starting a project/feature)
*Kích hoạt khi: USER yêu cầu làm một tính năng mới tinh (ví dụ: làm OCR, làm giao diện mới) mà chưa có kế hoạch chi tiết.*
- **Step A:** Tự động nạp `.agent-skills/skills/spec-driven-development/SKILL.md`. AI phải hỏi và chốt được bản Đặc tả (Spec) với USER. KHÔNG ĐƯỢC CODE KHI CHƯA CÓ SPEC.
- **Step B:** Tự động nạp `.agent-skills/skills/planning-and-task-breakdown/SKILL.md`. AI phải chia bản Spec thành một danh sách các Task nhỏ, có thứ tự rõ ràng.

### 2. Giai đoạn Code (During development)
*Kích hoạt khi: Đang trong quá trình viết code cho một Task cụ thể.*
- Luôn giữ trong ngữ cảnh: `.agent-skills/skills/incremental-implementation/SKILL.md`. Viết code theo từng lát cắt mỏng (thin slices). Làm đến đâu chắc đến đó.
- Kết hợp với: `.agent-skills/skills/test-driven-development/SKILL.md`. Phải chứng minh được logic vừa code hoạt động (qua console.log, devtools hoặc báo cáo chạy tay).

### 3. Giai đoạn Hoàn thành Tính năng (Before merge)
*Kích hoạt khi: Cả AI và USER đều cho rằng tính năng đã chạy được.*
- AI không được vội vã chuyển sang việc khác. Cần tự động đề xuất nạp `.agent-skills/skills/code-review-and-quality/SKILL.md` để dọn dẹp lại code (clean code, cấu trúc file).
- Đặc biệt nạp `.agent-skills/skills/security-and-hardening/SKILL.md` để soi các lỗi bảo mật chết người (RLS Supabase, rò rỉ API, XSS).

### 4. Giai đoạn Ra mắt (Before deploy)
*Kích hoạt khi: Chuẩn bị đưa code lên môi trường production (GitHub Pages / Vercel).*
- Bắt buộc nạp `.agent-skills/skills/shipping-and-launch/SKILL.md`. AI sẽ chạy một bảng Checklist (tốc độ tải, biến môi trường, tối ưu hóa) trước khi cho phép deploy.

---

**⚠️ LƯU Ý KỸ THUẬT DÀNH CHO AI (SYSTEM NOTE):**
1. **KHÔNG** đọc tất cả các file SKILL cùng một lúc. Hãy sử dụng khả năng `view_file` để đọc nội dung file khi chuyển tiếp sang Giai đoạn (Phase) tương ứng.
2. Tại bất kỳ thời điểm nào, AI có trách nhiệm **Nhắc nhở** người dùng nếu người dùng đang nhảy cóc (Ví dụ: Đòi code luôn khi chưa làm Spec ở Giai đoạn 1).
3. Sử dụng Markdown đẹp mắt (có Checkbox) để báo cáo tiến độ các bước của quy trình cho USER.
