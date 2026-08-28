# Kiến trúc hệ thống

## 1. Sơ đồ tổng thể

```
Trình duyệt
   │
   ├── Next.js 15 (App Router, React 19, TypeScript, TailwindCSS, Lucide)
   │      • Chỉ giữ trạng thái giao diện: theme, thu gọn sidebar, phạm vi đang chọn
   │      • Không lưu dữ liệu nghiệp vụ ở client
   │
   ▼  REST + JSON, Bearer access token (15 phút)
Node.js 20 + Express 4 + TypeScript
   │      • Zod validate mọi đầu vào
   │      • Middleware: helmet, cors, compression, rate limit, pino
   │      • Phân lớp: routes → service → Prisma
   │
   ▼  Prisma 5
PostgreSQL 16
   • 47 bảng · 27 enum · 14 UNIQUE · 20 CHECK · ~30 index
   • pg_trgm + unaccent cho tìm kiếm tiếng Việt bỏ dấu
   • Nguồn dữ liệu duy nhất (single source of truth)
```

Tệp đính kèm nằm trên đĩa máy chủ (`backend/uploads/`), metadata và SHA-256 nằm trong PostgreSQL.

---

## 2. Luồng dữ liệu bắt buộc

Mọi thao tác ghi đều đi trọn vẹn chuỗi sau — không có đường tắt nào ghi thẳng vào bộ nhớ trình duyệt:

```
Người dùng
   ↓ thao tác trên giao diện
Next.js Client Component
   ↓ services/api.ts (fetch + Bearer token, tự làm mới khi 401)
REST API  →  Zod validation
   ↓ hợp lệ
Business logic (service)  — quy tắc nghiệp vụ, kiểm tra trạng thái
   ↓
Prisma  ($transaction khi cần nguyên tử)
   ↓
PostgreSQL
   ↓
Response JSON  →  cập nhật giao diện + toast
```

Khi vi phạm quy tắc, lỗi quay ngược cùng đường với mã máy đọc được (`BUSINESS_RULE`, `REVISION_CONFLICT`, …) và thông điệp tiếng Việt hiển thị được ngay.

---

## 3. Phân lớp thư mục backend

```
src/
├── config/env.ts          Kiểm tra biến môi trường lúc khởi động (Zod)
├── lib/
│   ├── prisma.ts          Một PrismaClient duy nhất cho tiến trình
│   ├── errors.ts          Phân loại lỗi + mã máy đọc được
│   ├── http.ts            asyncHandler, ok/created/noContent, phân trang
│   ├── scope.ts           Dịch phạm vi (năm/kỳ/tuần/cơ sở) thành WHERE
│   ├── crud.ts            Nhà máy sinh router CRUD dùng chung
│   ├── audit.ts           Ghi nhật ký kiểm toán
│   ├── dates.ts           Ngày ISO không múi giờ, sinh 40 tuần, lịch lặp
│   ├── text.ts            Bỏ dấu tiếng Việt, CSV an toàn, JSON ổn định
│   └── logger.ts          Pino, tự ẩn trường nhạy cảm
├── middleware/
│   ├── auth.ts            requireAuth / requireRole / requireWrite
│   └── errorHandler.ts    Dịch lỗi Prisma/Zod/Multer sang thông điệp người dùng
├── modules/               Mỗi phân hệ một thư mục: routes + service
└── routes/index.ts        Gắn toàn bộ router vào /api
```

Quy tắc: **route không chứa nghiệp vụ**. Logic tính điểm, quy trình duyệt, sinh việc lặp… nằm trong `*.service.ts` để kiểm thử và tái sử dụng được.

---

## 4. Bốn quyết định kiến trúc quan trọng

### 4.1 Nhà máy CRUD thay vì chép mã

Sáu trang (Kế hoạch, Hoạt động, Tổ chức, Rèn luyện, Khen thưởng, Thiết bị) có cùng hình dạng: danh sách → tìm → lọc → phân trang → form → xóa mềm. Thay vì viết sáu bộ handler gần giống nhau, `lib/crud.ts` sinh router từ một mô tả cấu hình. Frontend đối xứng với `components/entity/EntityPage.tsx` + `entity.config.ts`.

Lợi ích: sửa một chỗ, sáu trang cùng đúng. Bản gốc cũng theo tinh thần này với hằng số `ENTITY`.

### 4.2 Khóa lạc quan bằng `revision`

Bản gốc ném `RevisionConflictError` khi hai nơi cùng sửa một bản ghi. Ở đây mỗi bảng có cột `revision`; client gửi kèm giá trị đang giữ, server so khớp trước khi ghi và trả **HTTP 409** nếu lệch. Giao diện hiện thông báo yêu cầu mở lại bản ghi thay vì âm thầm ghi đè.

### 4.3 Phạm vi dữ liệu xử lý ở server

Bản gốc tải toàn bộ store rồi lọc bằng `Array.filter` trong trình duyệt. Cách đó không mở rộng được. Ở đây bốn dropdown gửi lên `?yearId=&semesterId=&weekId=&campusId=`, `lib/scope.ts` dịch thành mệnh đề `WHERE` có index hỗ trợ.

Giữ nguyên ngữ nghĩa gốc: cột `NULL` nghĩa là "áp dụng cho mọi giá trị" nên luôn được lấy.

### 4.4 Điểm khôi phục tự động tại các mốc rủi ro

Trước khi làm việc khó hoàn tác, hệ thống tự chụp một `snapshot` được đánh dấu `protected` (không bị dọn tự động):

| Mốc | `reason` |
|---|---|
| Trước khóa bảng thi đua | `before-score-lock` |
| Trước mở khóa bảng thi đua | `before-score-unlock` |
| Sau khi chốt báo cáo | `after-finalized-report` |
| Trước khi đóng năm học | `before-year-close` |
| Trước khi phục hồi | `before-restore` / `before-file-restore` |

---

## 5. Xác thực

```
POST /api/auth/login
   → bcrypt.compare (cost 12)
   → access token JWT 15 phút (chỉ nằm trong bộ nhớ JS)
   → refresh token 7 ngày (cookie HttpOnly, SameSite=Lax, chỉ lưu SHA-256 ở DB)

Khi access token hết hạn
   → services/api.ts tự gọi /auth/refresh một lần rồi phát lại yêu cầu
   → refresh token xoay vòng: token cũ bị thu hồi ngay khi cấp token mới

Đổi mật khẩu → thu hồi toàn bộ phiên đang mở.
```

Chống dò mật khẩu giữ đúng thuật toán bản gốc — `delay = attempts < 3 ? 0 : min(30, 2^(attempts-3))` giây — nhưng thực thi ở server nên không thể bỏ qua bằng DevTools.

---

## 6. Điều được phép lưu ở trình duyệt

Chỉ ba loại trạng thái giao diện, đúng giới hạn đề ra:

| Khóa localStorage | Nội dung |
|---|---|
| `tpt:scope` | Năm/học kỳ/tuần/cơ sở đang chọn |
| `tpt:sidebar-collapsed` | Thanh bên có đang thu gọn |
| *(bộ nhớ JS)* | Access token — mất khi tải lại trang, khôi phục qua refresh cookie |

**Không** dùng IndexedDB, **không** lưu bản ghi nghiệp vụ, **không** lưu mật khẩu.

---

## 7. Tác vụ nền

`server.ts` chạy định kỳ mỗi 24 giờ và một lần lúc khởi động:

1. Dọn phiên hết hạn / đã thu hồi.
2. Dọn điểm khôi phục quá hạn (7 ngày · 4 tuần · 12 tháng; `protected` miễn trừ).
3. Sinh công việc lặp đã đến hạn.

Bản gốc chỉ chạy được những việc này lúc người dùng mở ứng dụng vì trình duyệt không có lịch nền tin cậy — đây là lợi thế trực tiếp của việc có backend thật.
