# REST API — tham chiếu

Gốc: `http://localhost:4000/api`

## Quy ước chung

**Phản hồi thành công**

```json
{ "data": … }
```

Có phân trang thì kèm `meta`:

```json
{ "data": [ … ], "meta": { "total": 128, "page": 1, "pageSize": 50, "pageCount": 3 } }
```

**Phản hồi lỗi**

```json
{
  "error": {
    "code": "BUSINESS_RULE",
    "message": "Chưa thể hoàn thành vì còn checklist bắt buộc chưa xong.",
    "issues": [{ "field": "dueDate", "message": "Ngày phải theo dạng YYYY-MM-DD" }]
  }
}
```

**Bảng mã lỗi**

| Mã | HTTP | Ý nghĩa |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Dữ liệu sai định dạng; xem `issues` |
| `AUTH_REQUIRED` | 401 | Thiếu hoặc hết hạn access token |
| `AUTH_INVALID` | 401 | Sai tên đăng nhập/mật khẩu |
| `AUTH_BLOCKED` | 429 | Sai nhiều lần; `details.waitSeconds` |
| `PERMISSION_DENIED` | 403 | Vai trò không đủ quyền |
| `NOT_FOUND` | 404 | Không có bản ghi |
| `CONFLICT` | 409 | Trùng giá trị duy nhất hoặc còn ràng buộc |
| `REVISION_CONFLICT` | 409 | Bản ghi đã đổi ở nơi khác |
| `IMMUTABLE_RECORD` | 409 | Báo cáo đã chốt / bộ tiêu chí đã khóa |
| `BUSINESS_RULE` | 422 | Đúng định dạng nhưng sai luật nghiệp vụ |
| `PAYLOAD_TOO_LARGE` | 413 | Tệp vượt `MAX_FILE_MB` |
| `RATE_LIMITED` | 429 | Quá nhiều yêu cầu |
| `DATABASE_ERROR` | 500/503 | Lỗi cơ sở dữ liệu |

**Xác thực** — mọi điểm cuối ngoài `/auth/login`, `/auth/refresh` và `/health` đều cần header:

```
Authorization: Bearer <accessToken>
```

**Tham số phạm vi** dùng chung cho các điểm cuối nghiệp vụ:

```
?yearId=<uuid>&semesterId=<uuid|all>&weekId=<uuid>&campusId=<uuid|all>
```

---

## Xác thực — `/auth`

| Method | Đường dẫn | Mô tả |
|---|---|---|
| POST | `/auth/login` | Đăng nhập; đặt cookie refresh, trả access token |
| POST | `/auth/refresh` | Cấp access token mới, xoay vòng refresh token |
| POST | `/auth/logout` | Thu hồi phiên hiện tại |
| POST | `/auth/logout-all` | Thu hồi mọi phiên của tài khoản |
| GET | `/auth/me` | Thông tin tài khoản đang đăng nhập |
| POST | `/auth/change-password` | Đổi mật khẩu; thu hồi toàn bộ phiên |
| PATCH | `/auth/auto-lock` | Đặt thời gian tự khóa (5/10/15/30 phút) |

---

## Học vụ — `/academic`

| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET / PATCH | `/academic/school` | Thông tin trường |
| GET | `/academic/campuses` | Danh sách cơ sở kèm số lớp |
| POST / PATCH / DELETE | `/academic/campuses[/:id]` | Thêm/sửa/xóa cơ sở |
| GET | `/academic/campuses/:id/usage` | Kiểm tra cơ sở có đang được dùng |
| GET | `/academic/years` | Danh sách năm học |
| POST | `/academic/years` | Tạo năm học + 2 học kỳ + **40 tuần**, sao chép có chọn lọc |
| POST | `/academic/years/:id/set-current` | Đặt năm hiện hành |
| GET | `/academic/years/:id/close-check` | Kiểm tra tồn đọng trước khi đóng năm |
| POST | `/academic/years/:id/close` | Đóng năm (snapshot bảo vệ + chuyển chỉ đọc) |
| GET | `/academic/semesters` | Học kỳ theo năm |
| GET | `/academic/weeks` | Tuần theo năm/học kỳ |
| GET / POST / PATCH / DELETE | `/academic/classes[/:id]` | Quản lý lớp |
| POST | `/academic/classes/import` | Nhập hàng loạt (`dryRun` để kiểm tra trước) |

---

## Thi đua — `/scores`

| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/scores/context` | Bộ tiêu chí + lớp + bảng tuần + ô đã nhập + nhãn quy trình |
| GET | `/scores/ranking` | Xếp hạng; `official=true` chỉ trả khi bảng đã duyệt/khóa |
| GET | `/scores/anomalies` | Bốn quy tắc cảnh báo |
| GET | `/scores/history` | Nhật ký điều chỉnh điểm |
| POST | `/scores/sheets` | Khởi tạo bảng tuần |
| POST | `/scores/sheets/:id/advance` | Chuyển trạng thái kế tiếp |
| POST | `/scores/sheets/:id/unlock` | Mở khóa; `reason` tối thiểu 5 ký tự |
| PUT | `/scores/entries` | Lưu một ô; `raw` nhận số, `KAD`, `MIỄN`, `ĐẠT`, rỗng để xóa |
| POST | `/scores/entries/paste` | Dán vùng dữ liệu từ bảng tính |
| POST | `/scores/entries/undo` | Hoàn tác thay đổi gần nhất |

### Quy trình bảng tuần

```
(chưa có) → DRAFT → COMPLETE → REVIEW → APPROVED → LOCKED
                        ▲                              │
                        └────────── UNLOCKED ──────────┘
                                (bắt buộc có lý do)
```

`DRAFT → COMPLETE` yêu cầu đã nhập đủ `số lớp × số tiêu chí` ô.
`APPROVED → LOCKED` tạo snapshot bảo vệ, đóng băng bộ tiêu chí và chốt bảng xếp hạng.

### Giá trị ô điểm

| Nhập | `entryState` | Vào tổng? | Tính là đã nhập? |
|---|---|---|---|
| số (chấp nhận `7,5`) | `VALUE` | ✅ | ✅ |
| `KAD` / `N/A` | `NA` | ❌ | ✅ |
| `MIỄN` / `MIEN` | `EXEMPT` | ❌ | ✅ |
| `ĐẠT` / `KHÔNG ĐẠT` | `VALUE` (1/0) | ✅ | ✅ |
| rỗng | *xóa bản ghi* | ❌ | ❌ |

---

## Bộ tiêu chí — `/criteria`

| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/criteria/sets` | Danh sách bộ, kèm cờ `locked` |
| GET | `/criteria/sets/:id` | Chi tiết bộ + tiêu chí |
| POST / PATCH | `/criteria/sets[/:id]` | Tạo/sửa; bộ đã có điểm bị khóa cấu trúc |
| POST | `/criteria/sets/:id/clone` | Nhân bản sang phiên bản mới (1.0 → 1.1) |
| GET | `/criteria/sets/:id/export` | Xuất JSON `TPT-CRITERIA-1` |
| POST | `/criteria/sets/:id/criteria` | Thêm tiêu chí |
| PATCH / DELETE | `/criteria/criteria/:id` | Sửa/xóa tiêu chí |

---

## Công việc — `/tasks`

| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/tasks` | Danh sách; `filter=today\|soon\|overdue`, `q`, `status`, `priority` |
| GET | `/tasks/export` | Xuất CSV |
| GET | `/tasks/templates` | 16 mẫu công việc |
| POST | `/tasks/templates/apply` | Thêm hàng loạt từ mẫu |
| POST | `/tasks/generate-recurring` | Sinh việc lặp đã đến hạn |
| GET / POST / PATCH / DELETE | `/tasks[/:id]` | CRUD |
| POST | `/tasks/:id/clone` | Nhân bản |
| PATCH | `/tasks/check-items/:id` | Tick một mục checklist |

Checklist gửi dưới dạng textarea: mỗi dòng một mục, tiền tố `!` = bắt buộc.
Không thể đặt `status = DONE` khi còn mục bắt buộc chưa xong.

---

## Thực thể dùng chung

Sáu đường dẫn dưới đây có cùng bộ điểm cuối: `/plans`, `/activities`, `/organization`, `/programs`, `/commendations`, `/equipment`.

| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/{entity}` | Danh sách; `q`, `status`, `page`, `pageSize`, `all=true` |
| GET | `/{entity}/export` | Xuất CSV (BOM UTF-8, chống CSV injection) |
| GET | `/{entity}/:id` | Chi tiết |
| POST | `/{entity}` | Tạo mới |
| PATCH | `/{entity}/:id` | Cập nhật; gửi `revision` để tránh ghi đè |
| DELETE | `/{entity}/:id` | Xóa mềm |

---

## Các phân hệ còn lại

| Nhóm | Điểm cuối chính |
|---|---|
| `/calendar` | CRUD sự kiện; phản hồi kèm `warnings` khi thiếu địa điểm/phụ trách/an toàn |
| `/documents` | Thư mục, tải tệp (nhiều tệp), phiên bản tệp, tải về, thùng rác, ghim |
| `/reports` | `preview`, lưu nháp/chốt, danh sách phiên bản, `export/csv`, gói báo cáo năm |
| `/config` | Danh mục động: CRUD mục, di chuyển thứ tự, khôi phục mẫu, xuất/nhập JSON |
| `/settings` | Thiết lập key-value, trường tùy chỉnh, trạng thái & xóa dữ liệu mẫu |
| `/backup` | `overview`, `export`, `verify`, `restore`, điểm khôi phục, nhật ký kiểm toán |
| `/analytics` | `dashboard`, `today`, `search`, `assistant/ask`, `quick-note`, `upcoming` |
| `/health` | Kiểm tra tình trạng máy chủ và kết nối cơ sở dữ liệu |
