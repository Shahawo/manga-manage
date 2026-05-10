# 🤖 Hướng Dẫn Sử Dụng Agent-Skills Cho Dự Án Manga-Supabase

Tài liệu này hướng dẫn cách tương tác với AI Assistant (Claude, Gemini, v.v.) bằng cách sử dụng bộ quy chuẩn kỹ sư **`agent-skills`** đã được cài đặt trong thư mục ẩn `.agent-skills` của dự án này.

Việc áp dụng các kỹ năng này giúp AI ngừng việc viết code cẩu thả, thay vào đó làm việc theo các quy trình chuẩn mực như một Kỹ sư phần mềm thực thụ.

---

## 1. ⚙️ Thiết Lập Mặc Định (Luật Chung)
Để AI luôn nhớ cách làm việc chuẩn, bạn có thể gửi câu lệnh (prompt) thiết lập ban đầu này ở mỗi cuộc hội thoại mới:

> *"Trong phiên làm việc này, hãy luôn đóng vai một Kỹ sư phần mềm và ngầm tuân thủ 3 quy tắc sau:*
> *1. `.agent-skills/skills/spec-driven-development/SKILL.md` (Viết đặc tả trước)*
> *2. `.agent-skills/skills/test-driven-development/SKILL.md` (Làm đến đâu chứng minh đến đó)*
> *3. `.agent-skills/skills/code-review-and-quality/SKILL.md` (Review khắt khe trước khi hoàn thành)"*

---

## 2. 📚 Các Kỹ Năng (Skills) Theo Từng Giai Đoạn

Mỗi khi bạn muốn giao việc cho AI, hãy đính kèm tên file SKILL.md tương ứng để ép AI làm việc theo quy trình.

### 📝 Giai đoạn 1: Lên ý tưởng & Lên kế hoạch
- **Lên ý tưởng:** `.agent-skills/skills/idea-refine/SKILL.md`
  *(Dùng khi ý tưởng còn mơ hồ, ví dụ: "Hãy giúp tôi lên ý tưởng cho tính năng mạng xã hội của app.")*
- **Chia nhỏ công việc:** `.agent-skills/skills/planning-and-task-breakdown/SKILL.md`
  *(Dùng khi đã có đặc tả rõ ràng và cần chia thành các task nhỏ để code.)*

### 🛠 Giai đoạn 2: Bắt tay vào Code
- **Code từng phần (Incremental):** `.agent-skills/skills/incremental-implementation/SKILL.md`
  *(Bắt AI không viết một cục code khổng lồ, mà chia thành từng đoạn nhỏ, làm xong test kỹ rồi mới làm tiếp.)*
- **Thiết kế Giao diện (UI):** `.agent-skills/skills/frontend-ui-engineering/SKILL.md`
  *(Áp dụng khi thiết kế giao diện HTML/CSS/JS, tối ưu hóa hiển thị di động, dark mode, v.v.)*
- **Thiết kế API/Data:** `.agent-skills/skills/api-and-interface-design/SKILL.md`
  *(Áp dụng khi thao tác với cơ sở dữ liệu Supabase, lên cấu trúc bảng, RLS.)*

### 🐛 Giai đoạn 3: Tìm lỗi & Tối ưu (Debug)
- **Truy tìm lỗi (Debug):** `.agent-skills/skills/debugging-and-error-recovery/SKILL.md`
  *(Thay vì đoán bừa, AI sẽ phải tuân thủ 5 bước: Tái tạo -> Khoanh vùng -> Thu nhỏ -> Sửa -> Viết phòng ngừa.)*
- **Tối ưu hiệu năng:** `.agent-skills/skills/performance-optimization/SKILL.md`
  *(Phân tích và làm cho web tải nhanh hơn, mượt hơn.)*

---

## 3. 🎭 Hệ Thống "Agent Personas" (Đóng vai AI Chuyên gia)

Trong thư mục `.agent-skills/agents/` có chứa các **"Nhân cách AI" (Models/Personas)**. Đây là những bộ cài đặt siêu chi tiết ép AI hóa thân thành các CHUYÊN GIA KHẮT KHE nhất thay vì làm một trợ lý hiền lành. 

Bạn dùng nó vào giai đoạn cuối (trước khi hoàn thành tính năng).

**Có 3 Chuyên gia chính:**

1. **👨‍💻 Chuyên gia Code Review (`code-reviewer.md`)**
   - **Mục đích:** Review code như một Senior Staff Engineer.
   - **Câu lệnh mẫu:** *"Đọc file `.agent-skills/agents/code-reviewer.md`. Hóa thân thành Chuyên gia và review lại file `index.js` giúp tôi."*

2. **🕵️ Chuyên gia Bảo Mật (`security-auditor.md`)**
   - **Mục đích:** Truy lùng lỗ hổng bảo mật (XSS, phân quyền sai, lộ API).
   - **Câu lệnh mẫu:** *"Đọc file `.agent-skills/agents/security-auditor.md`. Đóng vai Chuyên gia Bảo Mật, rà soát lại toàn bộ quy tắc RLS trên Supabase và logic xác thực người dùng của tôi."*

3. **🧪 Chuyên gia Kiểm Thử (`test-engineer.md`)**
   - **Mục đích:** Tìm mọi cách để làm crash ứng dụng của bạn.
   - **Câu lệnh mẫu:** *"Đọc file `.agent-skills/agents/test-engineer.md`. Hóa thân thành QA, lên kịch bản test cho tính năng OCR Quét mã vạch."*

---

## 💡 Ví Dụ Thực Tế Trong Dự Án (Copy & Paste)

**Giao task tính năng mới:**
> *"Tôi muốn làm tính năng Xuất/Nhập dữ liệu (.json). Hãy tuân thủ quy trình `.agent-skills/skills/incremental-implementation/SKILL.md` để triển khai, và dùng `.agent-skills/skills/frontend-ui-engineering/SKILL.md` để làm modal giao diện."*

**Yêu cầu Debug:**
> *"Hệ thống đăng nhập Google Auth thỉnh thoảng bị lỗi không lưu session. Kích hoạt `.agent-skills/skills/debugging-and-error-recovery/SKILL.md` để tìm gốc rễ vấn đề."*
