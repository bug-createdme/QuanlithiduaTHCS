# CLONE_ANALYSIS.md

> Phân tích reverse-engineering website gốc
> **Trợ lý Tổng phụ trách Đội THCS**
> URL: https://giaoducso40-png.github.io/trolytongphutrach/
> Ngày phân tích: 2026-08-23

---

## 0. Tóm tắt điều hành

| Hạng mục | Giá trị |
|---|---|
| Tên sản phẩm | Trợ lý Tổng phụ trách Đội THCS |
| Phiên bản gốc | `3.1.0-rc.1` (build `20260814-drive-rc1`) |
| Schema version gốc | `9` |
| Kiến trúc gốc | SPA một tệp, local-first, PWA |
| Tổng kích thước | `index.html` = 504.280 byte (11.426 dòng) |
| Thành phần | 1.802 dòng CSS + 156 dòng HTML shell + 9.449 dòng JS |
| Framework | **Không có** — Vanilla JS thuần, không build step |
| Lưu trữ gốc | IndexedDB (`TPT_DOI_THCS_DB`), 65 object store |
| Đồng bộ gốc | Google Drive `appDataFolder` qua GIS + Drive API v3 |
| Routing | Hash-based (`#dashboard`, `#tasks`, …) |
| Ngôn ngữ | Tiếng Việt (`lang="vi"`) |
| Tác giả | Thầy Hiếu (Giáo dục số 4.0) — Zalo: 0812806887 |

### Phương pháp phân tích

Repo GitHub Pages gốc chỉ chứa 8 tệp, trong đó **toàn bộ ứng dụng nằm inline trong `index.html` và KHÔNG bị minify**. Điều này cho phép đọc trực tiếp mã nguồn thay vì suy đoán từ DOM đã render. Mọi kết luận dưới đây được đối chiếu chéo giữa:

1. Đọc mã nguồn `index.html` (CSS + HTML + JS đầy đủ).
2. Chạy thật trên trình duyệt, đăng nhập bằng `admin@`, kiểm tra DOM/route/KPI thực tế.

Danh sách tệp repo gốc:

```
.nojekyll
404.html                    1.658 B
RELEASE_MANIFEST.json       2.975 B
app-config.example.js         804 B
app-config.js                 668 B
index.html                504.280 B   ← toàn bộ ứng dụng
manifest.webmanifest          756 B
offline.html                1.840 B
sw.js                       2.377 B
```

---

## 1. Nghiệp vụ — bối cảnh sử dụng

Ứng dụng phục vụ **Tổng phụ trách Đội** (giáo viên phụ trách công tác Đội Thiếu niên Tiền phong Hồ Chí Minh) tại **trường THCS** Việt Nam.

Các nghiệp vụ chính:

1. **Thi đua lớp theo tuần** — nghiệp vụ trung tâm. Chấm điểm từng lớp theo bộ tiêu chí, qua quy trình duyệt/khóa nhiều bước, tính xếp hạng, phát hiện bất thường, ghi nhật ký mọi điều chỉnh.
2. **Kế hoạch & công việc** — kế hoạch năm/kỳ/tháng/tuần, đầu việc có checklist con, lặp định kỳ, phụ thuộc.
3. **Hoạt động Đội & lịch** — tổ chức hoạt động, phương án an toàn, lịch tháng.
4. **Tổ chức Liên đội** — Ban Chỉ huy, đội nghi lễ, phát thanh măng non.
5. **Rèn luyện – phong trào, khen thưởng**.
6. **Hồ sơ – minh chứng** — kho tài liệu, thư mục, phiên bản tệp, thùng rác.
7. **Thiết bị Đội** — kiểm kê, mượn–trả.
8. **Báo cáo** — sinh báo cáo có phiên bản, chốt bất biến kèm checksum.
9. **Sao lưu – đồng bộ** — snapshot nội bộ, backup ngoài, đồng bộ Drive.
10. **Trung tâm cấu hình** — 14 nhóm thiết lập, danh mục động, trường tùy chỉnh.

### Triết lý thiết kế nghiệp vụ (quan trọng khi rebuild)

Mã nguồn gốc thể hiện rõ các nguyên tắc sau, **phải giữ nguyên**:

- **Hệ thống không tự suy diễn số liệu.** Ví dụ: "Ghi nhận nhanh" tạo bản ghi hồ sơ nhưng *không* tự cộng/trừ điểm thi đua.
- **Cảnh báo ≠ kết luận.** Tab "Kiểm tra bất thường" ghi rõ: *"Cảnh báo chỉ yêu cầu kiểm tra, không tự kết luận sai phạm."*
- **Xếp hạng chưa duyệt là tạm thời.** Chỉ bảng ở trạng thái `approved`/`locked` mới cho xếp hạng chính thức vào báo cáo.
- **Bất biến sau khi chốt.** Báo cáo `finalized` lưu HTML tĩnh + checksum; muốn sửa phải tạo phiên bản mới.
- **Xóa mềm.** Bản ghi xóa vẫn còn trong nhật ký (`deleted_at` tombstone).
- **Bộ tiêu chí đã phát sinh điểm bị khóa cấu trúc** — chỉ được nhân bản sang phiên bản mới.

---

## 2. Pages & Routes

Routing dùng **hash** (`location.hash`), có `history.pushState`. Fallback về `dashboard` nếu hash không hợp lệ.

Định nghĩa gốc (`const NAV`, dòng 4863):

| # | Route | Icon | Nhãn | Renderer |
|---|---|---|---|---|
| 1 | `#dashboard` | `⌂` | Tổng quan | `renderDashboard()` |
| 2 | `#today` | `◷` | Hôm nay | `renderToday()` |
| 3 | `#plans` | `▤` | Kế hoạch | `renderEntity("plans")` |
| 4 | `#tasks` | `✓` | Công việc và checklist | `renderTasks()` |
| 5 | `#calendar` | `▦` | Lịch hoạt động | `renderCalendar()` |
| 6 | `#scores` | `★` | Thi đua lớp | `renderScores()` |
| 7 | `#activities` | `⚑` | Hoạt động Đội | `renderEntity("activities")` |
| 8 | `#organization` | `♟` | Tổ chức Liên đội | `renderEntity("organization")` |
| 9 | `#programs` | `◇` | Rèn luyện – phong trào | `renderEntity("programs")` |
| 10 | `#commendations` | `✦` | Khen thưởng | `renderEntity("commendations")` |
| 11 | `#documents` | `▧` | Hồ sơ – minh chứng | `renderDocuments()` |
| 12 | `#equipment` | `◫` | Thiết bị Đội | `renderEntity("equipment")` |
| 13 | `#reports` | `▥` | Báo cáo | `renderReports()` |
| 14 | `#assistant` | `◎` | Trợ lý tổng hợp | `renderAssistant()` |
| 15 | `#backup` | `⇄` | Sao lưu – đồng bộ | `renderBackup()` |
| 16 | `#settings` | `⚙` | Thiết lập | `renderSettings()` |

Ngoài 16 route còn có **màn hình kích hoạt** (`#activationScreen`) hiển thị trước khi vào app — không phải route, là overlay toàn màn hình.

---

## 3. App Shell — cấu trúc layout

```
body[data-paper="landscape|portrait"]
├── section.activation-screen#activationScreen      ← màn hình mật khẩu
├── div.app#appShell                                 ← CSS Grid 2 cột × 2 hàng
│   ├── aside.sidebar#sidebar        (grid-row 1/3)
│   │   ├── .brand                   (logo "Đ" + tên)
│   │   ├── nav.nav#nav              (16 nút, render động)
│   │   └── .sidebar-foot            (ghi chú lưu trữ)
│   ├── header.topbar                (grid-column 2)
│   │   ├── button#toggleSidebar     ☰
│   │   ├── select#yearSelect        Năm học
│   │   ├── button#mobileContext     ☷ (chỉ mobile/tablet)
│   │   ├── select#semesterSelect    Học kỳ
│   │   ├── select#weekSelect        Tuần
│   │   ├── select#campusSelect      Cơ sở
│   │   ├── .searchbox > input#globalSearch
│   │   ├── button#quickAdd          ＋ Thêm nhanh
│   │   └── .status-line
│   │       ├── span#sessionChip     "Khóa sau 10 phút"
│   │       ├── span#saveState       "Chưa thay đổi"
│   │       ├── span.dot#networkDot  ● trạng thái mạng
│   │       ├── span#networkText     "Trực tuyến"
│   │       ├── button#syncState     "Chỉ lưu trên thiết bị này"
│   │       └── button#lockNow       🔒
│   └── main.content#content         (nội dung route)
├── div.modal-layer#modalLayer       ← modal duy nhất, tái sử dụng
│   └── section.modal#modal
│       ├── .modal-head > h2#modalTitle + button#modalClose
│       ├── .modal-body#modalBody
│       └── .modal-foot#modalFoot
├── div.toast-zone#toasts            ← aria-live="polite"
└── 4 × input[type=file].hidden      ← backup, csv, document, version
```

### Bộ lọc phạm vi toàn cục (Context selectors)

4 dropdown ở topbar tạo **phạm vi dữ liệu** áp dụng cho mọi trang. Hàm `scoped(store)` lọc:

```js
async function scoped(store) {
  return (await db.all(store)).filter(x =>
    (!x.school_year_id || x.school_year_id === state.yearId) &&
    (!x.semester_id || state.semesterId === "all" || x.semester_id === state.semesterId) &&
    (!x.campus_id || x.campus_id === "all" || state.campusId === "all" || x.campus_id === state.campusId)
  );
}
```

Ý nghĩa: bản ghi **không có** trường phạm vi → luôn hiển thị; `campus_id === "all"` → luôn hiển thị.

Trên màn hình hẹp, 4 select bị ẩn dần và thay bằng nút `☷` mở modal "Chọn phạm vi dữ liệu" (`showMobileContext()`).

---

## 4. Authentication & Session

### 4.1 Cơ chế gốc

| Thuộc tính | Giá trị gốc |
|---|---|
| Mật khẩu | **Hard-code `"admin@"`** trong `SessionLockManager.verify()` |
| Lưu mật khẩu | Không lưu (không localStorage, không cookie) |
| Không có user | Ứng dụng đơn người dùng, không có khái niệm tài khoản |
| Chống brute-force | Backoff mũ 2 sau 3 lần sai |
| Auto-lock | Mặc định 10 phút không hoạt động (cấu hình 5/10/15/30) |

Thuật toán backoff gốc:

```js
this.failedAttempts += 1;
const delay = this.failedAttempts < 3 ? 0 : Math.min(30, 2 ** (this.failedAttempts - 3));
this.blockedUntil = Date.now() + delay * 1000;
```

→ Lần sai 1, 2: không chờ. Lần 3: 1s. Lần 4: 2s. Lần 5: 4s… tối đa 30s.

### 4.2 Luồng mở khóa

```
showActivation() → nhập mật khẩu → sessionLock.verify()
  ├─ sai  → hiện lỗi + đếm ngược, disable nút
  └─ đúng → state.unlocked = true
            → launchApp()
               ├─ tabCoordinator.start()   (chống 2 tab cùng ghi)
               ├─ db.open()                (mở IndexedDB)
               ├─ bindShell()
               ├─ recoverInterruptedOperations()
               ├─ ensureSeed()             (seed lần đầu)
               ├─ migrateEnhancedData()    (migration schema 8→9)
               ├─ generateRecurringTasks() (sinh việc lặp)
               ├─ ensureStorageProtection()
               ├─ ensureScheduledSnapshots()
               ├─ ensureScheduledDirectoryBackup()
               ├─ loadContext()            (nạp năm/kỳ/tuần/cơ sở)
               ├─ renderNav() + updateNetwork()
               └─ go(initialPage)
```

### 4.3 Tự thú nhận của chính hệ thống gốc

Panel bảo mật ghi rõ:

> Mật khẩu `admin@` chỉ giúp ngăn thao tác nhầm. Vì mã web là công khai, đây không phải lớp bảo mật tuyệt đối hay cơ chế chống sao chép.

→ **Đây là lỗ hổng nghiêm trọng cần khắc phục ở hệ thống mới** (xem §14).

### 4.4 Khóa nhiều tab (Tab Coordinator)

Chỉ 1 tab được quyền ghi. Tab thứ 2 vào chế độ **chỉ đọc**, hiện banner:

> **Chế độ chỉ đọc:** một thẻ khác đang có quyền ghi dữ liệu. Có thể xem và xuất sao lưu; hãy đóng thẻ ghi rồi tải lại để chỉnh sửa.

---

## 5. Storage — phân tích chi tiết

### 5.1 IndexedDB

- Tên DB: `TPT_DOI_THCS_DB` (từ `app-config.js`)
- Schema version: `9`
- `keyPath: "id"` cho mọi store
- **65 object store**, chia 5 nhóm:

**Nhóm A — Nghiệp vụ (business, 41 store):**
`profiles`, `schools`, `campuses`, `school_years`, `semesters`, `school_weeks`, `grades`, `classes`, `homeroom_teachers`, `plans`, `plan_targets`, `tasks`, `task_check_items`, `task_dependencies`, `calendar_events`, `activity_categories`, `activities`, `activity_classes`, `activity_check_items`, `criteria_sets`, `criteria_groups`, `criteria`, `weekly_score_sheets`, `score_entries`, `score_evidence`, `ranking_snapshots`, `team_units`, `team_positions`, `team_members`, `training_records`, `programs`, `program_results`, `commendations`, `documents`, `attachments`, `equipment`, `equipment_transactions`, `report_templates`, `generated_reports`, `task_templates`, `report_packages`

**Nhóm B — Cấu hình (6 store):**
`config_categories`, `config_items`, `custom_field_definitions`, `document_folders`, `document_links`, `file_versions`

**Nhóm C — Hệ thống / nhật ký (`SYSTEM_STORES`, 9 store):**
`operation_journal`, `internal_snapshots`, `form_drafts`, `restore_staging`, `backup_handles`, `backup_records`, `migration_logs`, `audit_logs`, `license_events`

**Nhóm D — Đồng bộ (2 store):**
`sync_outbox`, `sync_conflicts`

**Nhóm E — Khác (7 store):**
`app_settings`, `score_component_versions`, `year_transition_logs`, `document_links`, `plan_targets`, `activity_check_items`, `criteria_groups`

### 5.2 Các tập loại trừ (quan trọng cho backup/sync)

```js
SYSTEM_STORES              // 9 store hệ thống
SNAPSHOT_EXCLUDED_STORES   // SYSTEM + attachments, file_versions, sync_outbox, sync_conflicts
EXTERNAL_BACKUP_EXCLUDED   // operation_journal, internal_snapshots, form_drafts,
                           // restore_staging, backup_handles
SYNC_EXCLUDED_STORES       // sync_outbox, sync_conflicts, + SYSTEM + app_settings
```

Lý do: snapshot nội bộ **không chứa Blob** để tránh nhân đôi dung lượng; `app_settings` không đồng bộ vì mang tính thiết bị.

### 5.3 localStorage

Chỉ dùng cho **duy nhất 1 khóa**:

```js
`${APP.appId}:device-id`   // ví dụ: "vn.giaoducso40.tpt.thcs.standard:device-id"
                            // giá trị: "web-<uuid>"
```

Có try/catch fallback sang `session-<uuid>` nếu localStorage bị chặn.

### 5.4 sessionStorage

**Không sử dụng.**

### 5.5 Record identity (theo `RELEASE_MANIFEST.json`)

```
stable UUID + school/year + revision + device_id + tombstone
```

Mọi bản ghi mang: `id` (UUID), `created_at`, `updated_at`, `deleted_at` (tombstone), `revision`, `device_id`.

---

## 6. Google Drive Sync (bản gốc)

| Thuộc tính | Giá trị |
|---|---|
| Provider | Google Identity Services + Google Drive API v3 |
| Scope | `https://www.googleapis.com/auth/drive.appdata` |
| Vùng lưu | `appDataFolder` (ẩn với người dùng) |
| Mô hình | local-first IndexedDB + durable outbox + immutable operation batches + verified snapshots |
| Lưu token | **memory-only** (không persist) |
| Chính sách xung đột | Hiện xung đột rõ ràng; merge local/Drive/per-field; **không** silent last-write-wins |
| Đính kèm | UUID + SHA-256; multipart cho tệp nhỏ; resumable > 5 MiB |
| Format | `TPT-DRIVE-SYNC-1` |

**Trạng thái thực tế trên bản public:** `GOOGLE_CLIENT_ID` = `""` → Drive **chưa cấu hình**. Nút "Đồng bộ" hiện thông báo *"Chưa cấu hình"* và gợi ý mở `SETUP_CONFIG.html` (tệp này **không tồn tại** trong repo → link 404).

Trạng thái sync (`syncState` chip): `local` · `syncing` · `synced` · `offline` · `conflict` · `error`.

---

## 7. Business Logic — chi tiết từng module

### 7.1 Dashboard (Tổng quan)

6 thẻ KPI, mỗi thẻ là **nút bấm được** dẫn tới trang lọc sẵn:

| KPI | Công thức | Hành động khi bấm |
|---|---|---|
| Việc hôm nay | `tasks.status≠done ∧ due_date = today` | → `#tasks` filter `today` |
| Sắp đến hạn trong 3 ngày | `due_date > today ∧ due_date ≤ today+3` | → `#tasks` filter `soon` |
| Việc quá hạn | `status≠done ∧ due_date < today` | → `#tasks` filter `overdue` |
| Hoạt động sắp diễn ra | `events.date ≥ today`, lấy 5 | → `#calendar` |
| Lớp chưa nhập thi đua | `classes` \ `{score_entries.class_id của tuần}` | → `#scores` |
| Lớp thuộc bảng đã duyệt | `sheet.status ∈ {approved, locked} ? classes.length : 0` | → `#scores` |

4 card bên dưới: **Việc cần xử lý** (7 mục: quá hạn → hôm nay → sắp tới), **Tiến độ và dữ liệu** (% hoàn thành, trạng thái bảng tuần, lớp đã có dữ liệu, sao lưu gần nhất), **Hoạt động sắp tới**, **5 lớp dẫn đầu tạm thời**.

### 7.2 Hôm nay

- **Việc phải làm**: `status≠done ∧ (due_date ≤ today ∨ start_date = today)`. Checkbox tick → `status = done, progress = 100`; bỏ tick → `status = doing`.
- **Lịch hôm nay**: `events.date = today`.
- **Checklist trực tuần**: 3 checkbox **tĩnh, không lưu** (chỉ hỗ trợ thị giác).
- **Chờ phối hợp**: đếm `status = waiting`.
- **Ghi chú nhanh**: lưu thành bản ghi `documents` với `type = "Ghi chú"`.
- **Kết thúc ngày**: modal thống kê, ghi rõ *"hệ thống không tự sửa trạng thái"*.
- **Ghi nhận nhanh** (`openQuickIncident`): lưu vào `documents` với `type = "Ghi nhận nhanh"`. Có cảnh báo: *"Ghi nhận này không tự động thay đổi bảng thi đua."*

### 7.3 Entity pages (generic CRUD) — 7 trang

Bảy trang dùng chung `renderEntity()` / `entityForm()` / `entityColumns()`:
`plans`, `activities`, `organization`, `programs`, `commendations`, `documents`(*), `equipment`.

(*) `documents` có cấu hình ENTITY nhưng route `#documents` dùng `renderDocuments()` riêng — cấu hình ENTITY chỉ dùng cho `entityForm`.

Đặc điểm chung:
- Toolbar: ô tìm kiếm (debounce 180 ms, tìm trên **mọi giá trị** của bản ghi) + lọc cơ sở + đếm bản ghi.
- Bảng: cột theo `entityColumns(key)` + cột Thao tác (Sửa/Xóa).
- **Phân trang 200 dòng/trang.**
- Nút "Xuất CSV" (có BOM `﻿`, chống CSV-injection bằng prefix `'` cho giá trị bắt đầu `= + - @`).
- Form modal 2 cột, trường `textarea` chiếm `full` width.
- Mọi form đều có select **"Cơ sở áp dụng"** (mặc định `all` = Toàn trường).
- Có hỗ trợ **trường tùy chỉnh** (custom fields) do người dùng định nghĩa.
- Một số trường `select` được **ghi đè động** bởi danh mục cấu hình (`dynamicMap`):

```js
activities:    { category: "activity_type" }
organization:  { unit: "team_group" }
commendations: { award_type: "award_type", level: "award_level" }
programs:      { name: "program_type" }
equipment:     { group: "equipment_group", condition: "equipment_condition", unit: "unit" }
```

**Bảng trường đầy đủ:** xem `DATABASE_DESIGN.md` §3.

### 7.4 Công việc và checklist (`#tasks`)

Hai chế độ xem: **Danh sách** (100 dòng/trang) và **Kanban** (4 cột: Chưa làm / Đang làm / Chờ phối hợp / Hoàn thành, tối đa 50 thẻ/cột).

Bộ lọc: tìm kiếm (debounce 160 ms, tìm trên `JSON.stringify(task)`), trạng thái, mức ưu tiên. Filter từ Dashboard: `today` / `soon` / `overdue` (dùng 1 lần rồi reset).

**Trạng thái:** `todo` · `doing` · `waiting` · `review` · `done` · `paused`
**Ưu tiên:** `low` · `normal` · `high` · `urgent`

Cả hai đều có thể **mở rộng** bằng danh mục cấu hình (`task_status`, `priority`), gộp và khử trùng lặp theo khóa đầu tiên.

**Checklist con** — nhập dạng textarea, mỗi dòng một mục, tiền tố `!` = bắt buộc:

```
! Kiểm tra khu vực trực
Ghi nhận nề nếp đầu giờ
```

Khi lưu: so khớp với mục cũ theo `normalizeText(label)` để **giữ nguyên trạng thái `done`**; mục không còn trong danh sách bị xóa.

**Validation:**
- `due_date ≥ start_date` — nếu sai: *"Hạn hoàn thành phải từ ngày bắt đầu trở đi."*
- Không cho `status = done` nếu còn checklist bắt buộc chưa xong: *"Chưa thể hoàn thành vì còn checklist bắt buộc chưa xong."*
- `progress` clamp `[0, 100]`.

**Lặp định kỳ** (`repeat_rule`): `none` · `daily` · `weekly` · `monthly` · `yearly`, kèm `repeat_until` tùy chọn.

`generateRecurringTasks()` chạy mỗi lần mở app:
- Duyệt task có `repeat_rule ≠ none ∧ repeat_next_at`.
- Vòng lặp `while (due <= today)` với **guard 400 lần** chống vô hạn.
- Khóa chống trùng: `repeat_occurrence_key = "${source.id}:${due}"`.
- Bản sinh ra giữ nguyên **độ dài** (`due_date - start_date`), reset `status = todo`, `progress = 0`, `repeat_rule = none`, gắn `repeat_source_id`.
- Sao chép cả checklist con (reset `done = false`).

**Thư viện mẫu:** 16 công việc mẫu cứng trong mã, thêm hàng loạt với `group = "Mẫu tham khảo"`, hạn `today + 7`.

**Nhân bản:** tạo bản sao với hậu tố `" (bản sao)"`, reset `status = todo`, `progress = 0`.

### 7.5 Lịch hoạt động (`#calendar`)

Lưới **42 ô** (6 tuần × 7 ngày), tuần bắt đầu **Thứ Hai**:

```js
const first = new Date(y, m, 1);
const start = new Date(y, m, 1 - first.getDay() + 1);
```

Ô ngoài tháng có class `.other` (mờ). Điều hướng: `‹` / `›` / "Hôm nay". Nút "In lịch" gọi `window.print()`.

Form sự kiện: tên (bắt buộc), ngày (bắt buộc), giờ, địa điểm, người phụ trách, cơ sở, **nhắc trước (giờ)** mặc định 24, **checklist an toàn**.

**Cảnh báo mềm khi lưu** — nếu thiếu `location` ∨ `leader` ∨ `safety`:
> *"Đã lưu; còn thiếu địa điểm, phụ trách hoặc checklist an toàn."* (toast màu đỏ, **nhưng vẫn lưu**)

### 7.6 Thi đua lớp (`#scores`) — MODULE PHỨC TẠP NHẤT

#### 7.6.1 Bốn tab

`entry` (Nhập điểm) · `ranking` (Xếp hạng) · `anomaly` (Kiểm tra bất thường) · `history` (Nhật ký điều chỉnh)

#### 7.6.2 Chọn bộ tiêu chí — `scoreContext()`

Thứ tự ưu tiên:
1. Bộ đang chọn thủ công (`state.criteriaSetId`)
2. Bộ gắn với sheet đã `locked`/`approved` của tuần
3. Bộ `status = active` khớp học kỳ
4. Bộ đầu tiên

Bộ `status = "stopped"` bị loại khỏi danh sách.

#### 7.6.3 Ba công thức tính (`criteria_sets.formula`)

| Formula | Điểm khởi đầu | Cách cộng |
|---|---|---|
| `base` | `base_score` (mặc định 100) | Cộng/trừ từng tiêu chí |
| `sum` | 0 | Cộng thẳng |
| `weighted` | 0 | Cộng × `criterion.weight` |

#### 7.6.4 Năm kiểu dữ liệu tiêu chí (`criteria.data_type`)

```js
function criterionScore(entry, criterion, set) {
  let score = Number(entry?.value || 0);
  if (criterion.data_type === "count")   score *= Number(criterion.points || 0);
  if (criterion.data_type === "boolean") score = entry?.value ? Number(criterion.points || 0) : 0;
  if (criterion.data_type === "note")    score = 0;
  if (set?.formula === "weighted")       score *= Number(criterion.weight || 1);
  return score;
}
```

| `data_type` | Ý nghĩa | Quy đổi điểm |
|---|---|---|
| `score` | Điểm trực tiếp | `value` |
| `count` | Số lần | `value × points` |
| `boolean` | Đạt/không đạt | `value ? points : 0` |
| `choice` | Mức lựa chọn | `value` (như score) |
| `note` | Ghi chú | **luôn 0** |

#### 7.6.5 Ba trạng thái ô nhập (`score_entries.entry_state`)

| Nhập | `entry_state` | Ý nghĩa | Vào tổng? |
|---|---|---|---|
| (rỗng) | *xóa bản ghi* | Chưa nhập | — |
| `0` | `value` | Có dữ liệu = 0 | ✅ |
| `KAD` hoặc `N/A` | `na` | Không áp dụng | ❌ (tính là "đã nhập") |
| `MIỄN` / `MIEN` | `exempt` | Được miễn | ❌ (tính là "đã nhập") |

Với `data_type = boolean`, chấp nhận: `ĐẠT`/`DAT`/`CÓ`/`CO` → `1`; `KHÔNG ĐẠT`/`KHONG DAT`/`KHÔNG`/`KHONG` → `0`.

Số nhập chấp nhận dấu phẩy thập phân (`"7,5"` → `7.5`).

**Validation:** `criterion.min ≤ value ≤ criterion.max`, sai thì toast *"Giá trị phải trong khoảng {min} đến {max}."* và **không lưu**.

#### 7.6.6 Nhập liệu nhanh

- **Enter** → xuống ô cùng cột hàng dưới. **Shift+Enter** → lên trên.
- **Paste vùng Excel** (`scorePaste`): parse ma trận tab/newline, ghi từ ô đang chọn, **bỏ qua ô không hợp lệ** (không báo lỗi từng ô), ghi 1 audit log tổng `score_bulk_paste`.
- **Hoàn tác 1 bước** (`state.lastScoreUndo`): lưu `{type:"restore", row}` hoặc `{type:"delete", id}`.
- Ô chưa nhập có class `.missing` (nền đỏ nhạt).

#### 7.6.7 Workflow trạng thái bảng tuần (`weekly_score_sheets.status`)

```
(chưa có)
   │ "Khởi tạo bảng tuần"
   ▼
 draft ──"Đánh dấu đã nhập đủ"──▶ complete
   │        ▲                          │ "Gửi kiểm tra"
   │        │                          ▼
   │        └──────────────────────  review
   │                                    │ "Duyệt bảng"
   │                                    ▼
   │                                 approved
   │                                    │ "Khóa bảng"
   │                                    ▼
   │                                  locked
   │                                    │ "Mở khóa có lý do"
   │                                    ▼
   └──"Gửi kiểm tra lại"───────────  unlocked
```

**Điều kiện & tác dụng phụ:**

| Chuyển | Điều kiện | Tác dụng phụ |
|---|---|---|
| `→ draft` | — | Tạo sheet, gắn `criteria_set_id` |
| `draft → complete` | `entries.length ≥ classes × criteria` | Nếu thiếu: *"Còn N ô chưa nhập/KAD/MIỄN."* |
| `complete → review` | — | — |
| `review → approved` | — | Ghi `approved_at` |
| `approved → locked` | — | ① Snapshot bảo vệ `before-score-lock`<br>② Ghi `locked_at`<br>③ **Đóng băng `criteria_snapshot`** (set + criteria)<br>④ Tạo `ranking_snapshots` |
| `locked → unlocked` | **Bắt buộc lý do ≥ 5 ký tự** | ① Snapshot `before-score-unlock`<br>② Ghi `unlock_reason`, `unlocked_at`<br>③ Đặt `reports_stale = true` |
| `unlocked → review` | — | — |

Khi `locked`, mọi ô nhập bị `disabled`.

#### 7.6.8 Xếp hạng (`calculateRanking`)

```js
.filter(x => x.filled > 0)                     // bỏ lớp chưa có dữ liệu nào
.sort((a,b) => b.total - a.total
            || a.class_name.localeCompare(b.class_name, "vi", {numeric:true}))
```

**Xử lý đồng hạng:** cùng `total` → cùng `rank` (hạng nhảy cóc — 1, 2, 2, 4).

`official = true` → trả `[]` nếu sheet chưa `approved`/`locked`. Dashboard gọi `calculateRanking(false)` để xem tạm thời.

#### 7.6.9 Kiểm tra bất thường

| Mức | Điều kiện |
|---|---|
| 🔴 `red` | Lớp **chưa có** dữ liệu nào |
| 🟡 `yellow` | Lớp **thiếu** N tiêu chí |
| 🟡 `yellow` | Thiếu minh chứng khi `criterion.evidence_required = true` |
| 🔴 `red` | `value` vượt `[min, max]` |

#### 7.6.10 Quản lý bộ tiêu chí

- **Khóa cấu trúc:** nếu bộ đã dùng trong bất kỳ `weekly_score_sheets` nào (`used = true`) → `name`, `version`, `base_score` chuyển `readonly`; `formula` `disabled`; không cho thêm/sửa tiêu chí.
- **Nhân bản phiên bản:** `nextVersion("1.0")` → `"1.1"`; đặt `status = draft`, gắn `source_set_id` / `source_criteria_id`. Dữ liệu tuần cũ **không đổi**.
- **Mã tiêu chí duy nhất trong bộ** (so sánh không phân biệt hoa/thường).
- Validation: `min ≤ max`, cả hai phải hữu hạn.
- Xuất JSON: format `TPT-CRITERIA-1`.

Trạng thái bộ: `draft` · `active` · `stopped`.

### 7.7 Báo cáo (`#reports`)

**5 loại:** `week` (Công tác tuần) · `scores` (Tổng hợp thi đua) · `tasks` (Tiến độ công việc) · `activities` (Hoạt động) · `equipment` (Thiết bị).

Mỗi báo cáo có: tiêu đề trường, tên báo cáo, phạm vi (tuần/cơ sở), thời điểm tạo, nội dung bảng, và **khối chữ ký 2 cột** ("Người lập báo cáo" / "Xác nhận của nhà trường").

Báo cáo `scores` **từ chối xếp hạng** nếu sheet chưa duyệt:
> *"Bảng tuần chưa được duyệt nên chưa có xếp hạng chính thức."*

**Phiên bản hóa:**

| Thuộc tính | Nháp (`draft`) | Chốt (`finalized`) |
|---|---|---|
| `immutable` | `false` | `true` |
| `content_html` | lưu | lưu (bất biến) |
| `content_checksum` | SHA-256 của HTML | SHA-256 của HTML |
| `source_checksum` | SHA-256 của `stableJSON(source)` | như trái |
| `finalized_at` | `null` | timestamp |
| Snapshot | không | **có** (`after-finalized-report`) |

`version = max(version hiện có cùng type + year) + 1`.

`config_snapshot` lưu: `criteria_set_id`, `criteria_set_version`, `app_version`, `schema`, `build_id`.

**Trạng thái gửi:** `not_submitted` · `submitted` · `accepted`.

Chốt báo cáo yêu cầu **tick xác nhận** đã đối chiếu.

**Khổ in:** A4 ngang (`landscape`) / A4 dọc (`portrait`), lưu vào `app_settings.paper_orientation`, áp qua `body[data-paper]` và `@media print`.

### 7.8 Trợ lý tổng hợp (`#assistant`)

**Rule-based, KHÔNG có AI/LLM.** Nhận diện bằng `String.includes()` trên câu hỏi viết thường:

| Từ khóa | Trả lời | Link nguồn |
|---|---|---|
| `hôm nay` | Việc cần làm hôm nay | `#tasks` |
| `quá hạn` | Danh sách việc quá hạn | `#tasks` |
| `chưa nhập` | Lớp chưa nhập thi đua (badge) | `#tasks` |
| `bất thường` | Số lớp thiếu + số giá trị vượt giới hạn | `#scores` |
| `báo cáo` | Tóm tắt nháp báo cáo tuần | `#tasks` |
| `tiến độ` | % hoàn thành công việc | `#tasks` |
| `hoạt động` | Hoạt động thiếu địa điểm/phụ trách/an toàn | `#calendar` |
| `sao lưu` | Thời điểm sao lưu gần nhất | `#backup` |
| *(khác)* | Thông báo chưa nhận diện + gợi ý | `#tasks` |

8 nút "câu hỏi nhanh" dựng sẵn. Mọi câu trả lời đều kèm dấu thời gian + phạm vi:
> *"Dữ liệu lúc {datetime}; phạm vi {tuần}, {cơ sở}."*

Badge trên đầu trang: `AssistantProvider cục bộ`.

### 7.9 Hồ sơ – minh chứng (`#documents`)

Không dùng `renderEntity` — có UI riêng dạng file manager:

- **Cột trái:** cây thư mục (`Tất cả tài liệu` / thư mục con / `Thùng rác`) + **thanh dung lượng** (`navigator.storage.estimate()`) + nút "Bảo vệ lưu trữ" (`navigator.storage.persist()`).
- **Cột phải:** drop zone (kéo thả nhiều tệp **và dán ảnh từ clipboard**) + lưới/danh sách tài liệu.
- Hai chế độ xem: `grid` (thẻ file có icon theo phần mở rộng) / `list` (bảng).
- Tìm kiếm: `normalizeText()` trên `name + tags + description + document_no` (bỏ dấu tiếng Việt), debounce 220 ms.
- Sắp xếp: `pinned` giảm dần → `updated_at` giảm dần.
- **Thùng rác:** xóa mềm (`deleted_at`), có "Khôi phục" / "Xóa vĩnh viễn" (`hardDelete`).
- **Phiên bản tệp:** `replaceDocumentVersion()` — tệp cũ chuyển `status = archived`, tệp mới tăng `version`.
- Trạng thái đồng bộ mỗi tệp: `synced` (xanh) / chờ (vàng).
- Loại tệp chấp nhận: `.pdf .doc .docx .xls .xlsx .ppt .pptx .txt .csv .png .jpg .jpeg .webp .zip`
- Giới hạn dung lượng mỗi tệp: cấu hình `max_file_mb` (mặc định 25 MB, min 1, max 250).

### 7.10 Sao lưu – đồng bộ (`#backup`)

**Ba phạm vi sao lưu ngoài:**

| Chế độ | Nội dung | Phù hợp |
|---|---|---|
| Nhanh | Cấu hình, metadata, dữ liệu nghiệp vụ; **không** gồm Blob | Sao lưu thường xuyên |
| Đầy đủ | Toàn bộ dữ liệu, tệp, manifest, SHA-256 | Đổi máy, lưu trữ định kỳ |
| Gói năm học | Dữ liệu năm đang chọn + cấu hình chung + báo cáo chốt + tệp | Đóng năm / bàn giao |

Format backup: `TPT-BACKUP-3`.

**Điểm khôi phục nội bộ (snapshot):**
- Chính sách giữ: **7 ngày · 4 tuần · 12 tháng**; snapshot `protected` **không tự xóa**.
- Không chứa Blob (`SNAPSHOT_EXCLUDED_STORES`).
- Có SHA-256 checksum, đếm bản ghi theo store.
- Tự tạo tại các mốc: trước khóa bảng, trước mở khóa, sau chốt báo cáo, trước migration, trước đóng năm.

**Thư mục sao lưu ngoài:** dùng File System Access API (`showDirectoryPicker`), lưu handle vào `backup_handles`. Có tùy chọn tự sao lưu mỗi ngày **khi mở ứng dụng** — kèm cảnh báo trung thực:
> *"Web/PWA không chạy lịch nền tin cậy khi đã đóng."*

**Ngưỡng cảnh báo dung lượng:** thấp 70% · cao 85% · nguy cấp 95% (bắt buộc tăng dần).

**Phục hồi:** kiểm tra định dạng, định danh (`app_id`, `school_profile_id`), phiên bản schema, checksum **trước khi ghi**.

### 7.11 Thiết lập (`#settings`) — Trung tâm cấu hình

**14 tab:**

| # | Tab | Nội dung |
|---|---|---|
| 1 | `school` | Tên trường, mã, địa chỉ, người lập báo cáo, chức danh |
| 2 | `context` | Cơ sở – năm học – học kỳ – tuần + danh mục `plan_*` |
| 3 | `classes` | Lớp và GVCN + nhập CSV/dán Excel |
| 4 | `competition` | Mở trình quản lý bộ tiêu chí |
| 5 | `activities` | Danh mục `activity_type`, `calendar_type` |
| 6 | `tasks` | Danh mục `task_group`, `task_status`, `priority` |
| 7 | `documents` | Danh mục `document_type`, `document_status` |
| 8 | `team` | Danh mục `team_group`, `team_position`, `program_type`, `specialty` |
| 9 | `awards` | Danh mục `award_type`, `award_level` |
| 10 | `equipment` | Danh mục `equipment_group`, `equipment_condition`, `unit` |
| 11 | `reports` | Danh mục `report_type`, `report_template` |
| 12 | `appearance` | Khổ in, chế độ hiển thị gọn |
| 13 | `data` | Sao lưu, giới hạn tệp, ngưỡng dung lượng |
| 14 | `security` | Auto-lock, định danh phát hành, Drive |

**Danh mục động (`config_items`):** 21 nhóm định nghĩa sẵn trong `CONFIG_DEFINITIONS`. Mỗi mục có: `label`, `code` (duy nhất, pattern `[A-Za-z0-9_-]+`), `color`, `icon`, `order`, `description`, `active`. Thao tác: thêm/sửa/nhân bản/bật-tắt/di chuyển lên-xuống/khôi phục mẫu/tìm kiếm (bỏ dấu).

Nguyên tắc: **ngừng dùng ≠ xóa** — *"Danh mục ngừng sử dụng không xuất hiện khi tạo mới nhưng vẫn giữ nguyên tên trong dữ liệu lịch sử."*

**Trường tùy chỉnh (`custom_field_definitions`):** 9 kiểu — `short_text`, `long_text`, `number`, `date`, `single_choice`, `multi_choice`, `boolean`, `link`, `file`. Gắn theo `entity_type`. Giá trị lưu trong `custom_values` (JSON) của bản ghi. Ghi chú an toàn: *"không cho phép nhập hoặc thực thi mã JavaScript."*

**Vòng đời năm học:**

- *Tạo năm mới* — sinh 2 học kỳ + **40 tuần** tự động từ ngày bắt đầu (mỗi tuần 7 ngày). Sao chép **có chọn lọc**: lớp + GVCN (ID mới), bộ tiêu chí (chuyển về `draft`), mẫu công việc. **Không** sao chép: điểm, xếp hạng, công việc phát sinh, hoạt động, hồ sơ, báo cáo.
- *Đóng năm* — kiểm tra bảng chưa khóa / việc chưa xong / báo cáo nháp → tạo snapshot bảo vệ + báo cáo tổng kết chốt + gói năm học → chuyển năm sang **chỉ đọc**.
- *Mở sửa có lý do* — năm đã đóng cần override trong phiên, ghi lý do vào nhật ký (`state.yearEditOverrides`).

**Quản lý cơ sở:** không cho xóa nếu còn dữ liệu tham chiếu (kiểm tra 16 store), phải giữ ≥ 1 cơ sở, tên & mã duy nhất.

**Nhập lớp CSV:** 5 cột `mã lớp, tên lớp, khối, mã cơ sở, GVCN`, tự nhận tab hoặc phẩy, tự bỏ dòng tiêu đề, có bước **Xem trước** trước khi ghi.

---

## 8. Data Models — trích từ mã nguồn

Xem chi tiết đầy đủ tại **`DATABASE_DESIGN.md`**. Tóm tắt các thực thể chính:

```
schools 1─n campuses
schools 1─n school_years 1─n semesters
                         1─n school_weeks (40 tuần)
                         1─n classes ──n─1 campuses

criteria_sets 1─n criteria
weekly_score_sheets ──n─1 school_weeks
                    ──n─1 criteria_sets
                    1─n score_entries ──n─1 classes
                                      ──n─1 criteria
                    1─n ranking_snapshots

tasks 1─n task_check_items
tasks n─n tasks (task_dependencies)
tasks 1─n tasks (repeat_source_id — việc lặp)

documents 1─n attachments 1─n file_versions
documents ──n─1 document_folders

config_categories 1─n config_items
custom_field_definitions ──▶ (entity_type)
```

---

## 9. Responsive Behavior

### 9.1 Breakpoints gốc (7 mốc)

| Breakpoint | Thay đổi |
|---|---|
| `≤ 1700px` | Ẩn `session-chip` ("Khóa sau 10 phút") |
| `≤ 1550px` | Ẩn `save-state`; `context-select` max 132px; searchbox min 120px |
| `≤ 1420px` | Hiện nút `☷` mobile-context; ẩn select thứ 2 (Học kỳ) |
| `≤ 1180px` | KPI grid → 3 cột; ẩn `sync-state` |
| `≤ 1100px` | Ẩn `#weekSelect`, `#campusSelect` |
| `≤ 850px` | **Sidebar thu về 64px (icon-only)**; grid-2/3 → 1 cột; ẩn toàn bộ `status-line`; KPI → 2 cột; form-grid → 1 cột; settings-menu → thanh ngang cuộn; kanban → cột cố định 260px |
| `≤ 520px` | **Sidebar chuyển thành bottom nav** (grid-row 3, cao `70px + safe-area`), nav cuộn ngang với scroll-snap, mỗi nút 112×62px xếp dọc icon+label |
| `≤ 370px` | Tinh chỉnh cỡ chữ nhỏ nhất |

### 9.2 Đặc điểm mobile quan trọng

- `body { overflow: hidden }` — app chiếm đúng viewport, chỉ vùng `.content` cuộn.
- Hỗ trợ `env(safe-area-inset-bottom)` cho iPhone notch.
- `viewport-fit=cover` trong meta viewport.
- Bottom nav dùng `scroll-snap-type: x proximity`.
- Nút `☷` mở modal chọn năm/kỳ/tuần/cơ sở thay cho 4 dropdown.
- Bảng điểm (`.score-wrap`) cuộn ngang độc lập.

### 9.3 Print

`@media print` (dòng 1768): ẩn `.no-print`, sidebar, topbar; khổ giấy theo `body[data-paper]`.

---

## 10. UI System — Design Tokens

### 10.1 Bảng màu (CSS variables gốc)

```css
--blue:       #0b6bcb    /* chủ đạo, theme-color */
--blue2:      #0757a6    /* hover/active */
--blue-soft:  #eaf4ff    /* nền nhạt */
--green:      #16845b    /* thành công */
--green-soft: #e9f8f1
--yellow:     #f4b41a    /* cảnh báo */
--red:        #c93c3c    /* nguy hiểm */
--red-soft:   #fff0f0
--ink:        #172235    /* chữ chính */
--muted:      #667085    /* chữ phụ */
--line:       #dce4ec    /* viền */
--bg:         #f4f7fa    /* nền trang */
--card:       #ffffff    /* nền thẻ */
```

**Sidebar dùng màu riêng, KHÔNG phải biến:** nền `#0a3764` (xanh navy đậm), chữ `#dceaf7`, chữ phụ `#cfe4f7`, nút active nền trắng + chữ `#0a4f91`.

### 10.2 Layout tokens

```css
--sidebar:       248px      /* → 64px ở ≤850px */
--top:           62px       /* → 58px ở ≤520px */
--radius:        10px
--shadow:        0 2px 10px rgba(23,34,53,.07)
--space:         10px
--footer-height: 23px
```

### 10.3 Typography

```css
font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
```

**Không dùng web font ngoài.** Cỡ chữ: brand strong 13px, brand span 10.5px, nav label mobile 9.5px, footer 11px.

### 10.4 Component inventory

| Component | Class | Ghi chú |
|---|---|---|
| Nút | `.btn`, `.btn.primary`, `.btn.danger`, `.btn.small` | |
| Nút icon | `.icon-btn` | ☰ 🔒 × |
| Nút link | `.link-btn`, `.link-btn.red` | trong bảng |
| Badge | `.badge`, `.badge.green/blue/yellow/red` | trạng thái |
| Thẻ | `.card` > `.card-head` + `.card-body` | |
| KPI | `.kpi`, `.kpi.warning`, `.kpi.danger`, `.kpi.success` | **là `<button>`** |
| Bảng | `.table-wrap` > `table` | header sticky |
| Bảng điểm | `.score-wrap` > `.score-table` | cột lớp sticky |
| Ô điểm | `.score-input`, `.score-input.missing` | |
| Tabs | `.tabs` > `button.active` | |
| Toolbar | `.toolbar`, `.toolbar .grow` | |
| Form | `.form-grid` > `.field`, `.field.full` | 2 cột |
| Label bắt buộc | `label.required` | dấu * |
| Modal | `.modal-layer`, `.modal`, `.modal.wide` | |
| Toast | `.toast`, `.toast.ok/bad` | tự ẩn sau **3300 ms** |
| Thông báo | `.notice`, `.notice.warn`, `.notice.danger` | |
| Rỗng | `.empty` | |
| Tiến độ | `.progress > span` | |
| Kanban | `.kanban`, `.kanban-col`, `.task-card` | |
| Lịch | `.calendar-grid`, `.dow`, `.calendar-event` | |
| Danh sách gọn | `.compact-list` > `li` > `.main` | |
| Checkbox hàng | `.check-row` | |
| Thư mục | `.folder-pane`, `.folder-row` | |
| Thẻ tệp | `.file-grid`, `.file-card`, `.file-icon` | |
| Drop zone | `.drop-zone`, `.drop-zone.drag` | |
| Đo dung lượng | `.storage-meter` | |
| Cài đặt | `.settings-shell`, `.settings-menu`, `.settings-panel` | |
| Trợ lý | `.assistant-layout`, `.quick-prompts`, `.answer-block` | |
| Banner chỉ đọc | `.readonly-banner` | |
| Banner cập nhật | `.update-banner` | |

### 10.5 Micro-interactions

- Toast tự xóa sau **3300 ms**.
- Debounce: entity search **180 ms**, task search **160 ms**, document search **220 ms**, global search **~200 ms**.
- `@media (prefers-reduced-motion: reduce)` được tôn trọng (dòng 1211).
- Modal có focus trap + trả focus về phần tử gọi (`state.modalReturnFocus`).
- Form nháp tự lưu vào `form_drafts` (`setupModalDraft`) và cảnh báo khi rời trang.

---

## 11. Assets

| Loại | Tình trạng bản gốc |
|---|---|
| Logo | **Không có tệp** — chữ "Đ" trong `<div class="brand-mark">` / `.activation-logo` |
| Favicon | **Không khai báo** trong `<head>` |
| Icon PWA | `./assets/icons/tpt-doi-icon-192.png`, `-512.png` khai báo trong manifest nhưng **thư mục `assets/` KHÔNG tồn tại trong repo** → 404 |
| Icon UI | **Ký tự Unicode thuần**: `⌂ ◷ ▤ ✓ ▦ ★ ⚑ ♟ ◇ ✦ ▧ ◫ ▥ ◎ ⇄ ⚙ ☰ ☷ ◉ ＋ ↶ ‹ › × ▸ ♲ 🔒 ↑ ↓` |
| Font | **System font stack**, không tải font ngoài |
| Hình ảnh | Không có |
| SVG | Không có |

→ **Bản gốc không hotlink bất kỳ tài nguyên ngoài nào.** Hoàn toàn offline-capable.

---

## 12. PWA

`sw.js` — cache name `tpt-doi-thcs-v3-1-0-drive-rc1`:
- Đường dẫn **tương đối** (chạy được dưới subpath GitHub Pages).
- **Không** intercept request ngoài (`external_requests_intercepted: false`).
- **Không** cache dữ liệu runtime (`runtime_data_cached: false`).
- Có `offline.html` fallback.
- Cơ chế `SKIP_WAITING` + banner "Có phiên bản PWA mới đã tải xong."
- **Chặn cập nhật** nếu còn bản nháp đang mở hoặc còn thay đổi chưa đồng bộ.

---

## 13. Seed Data (bản gốc)

`ensureSeed()` chỉ chạy khi bảng `schools` rỗng:

| Thực thể | Dữ liệu |
|---|---|
| Trường | `school-main` — "TRƯỜNG THCS (CHƯA CẤU HÌNH)", `is_sample: true` |
| Cơ sở | 2: "Cơ sở 1" (`CS1`), "Cơ sở 2" (`CS2`) |
| Năm học | "2026–2027", 2026-08-15 → 2027-05-31, `is_current: true` |
| Học kỳ | HK I (08-15 → 01-10), HK II (01-11 → 05-31) |
| Tuần | **40 tuần**, bắt đầu 2026-08-17, mỗi tuần 7 ngày |
| Lớp | **16 lớp**: khối 6–9 × 2 lớp × 2 cơ sở → `6/A1, 6/A2, …, 9/B2` |
| Bộ tiêu chí | 1 bộ mẫu `status: draft`, `formula: base`, `base_score: 100` |
| Tiêu chí | 5: NN01 Nề nếp (−2, [−20,0]) · VS01 Vệ sinh (−2, [−20,0]) · HT01 Học tập (+2, [0,20]) · HD01 Hoạt động (+3, [0,30]) · VT01 Việc tốt (+2, [0,20]) |
| Công việc | 3 việc mẫu |

Mọi bản ghi seed đều có `is_sample: true` → cho phép `deleteSampleData()` xóa sạch dữ liệu mẫu.

**Đã kiểm chứng trên site thật:** KPI "Lớp chưa nhập thi đua" = **16** ✅ khớp chính xác.

---

## 14. Known Limitations của bản gốc

| # | Hạn chế | Mức độ | Hướng xử lý ở bản mới |
|---|---|---|---|
| 1 | **Mật khẩu `admin@` hard-code trong mã public** | 🔴 Nghiêm trọng | Bcrypt hash + JWT, không hard-code |
| 2 | Không có khái niệm người dùng / phân quyền | 🔴 Cao | Bảng `users` + role `ADMIN`/`EDITOR`/`VIEWER` |
| 3 | Dữ liệu chỉ nằm trên 1 trình duyệt 1 máy | 🔴 Cao | PostgreSQL tập trung |
| 4 | Trình duyệt có thể tự xóa IndexedDB khi thiếu dung lượng | 🔴 Cao | Không còn áp dụng |
| 5 | Chỉ 1 tab được ghi (tab khác chỉ đọc) | 🟡 TB | Không còn áp dụng |
| 6 | `SETUP_CONFIG.html` được tham chiếu nhưng **không tồn tại** → 404 | 🟡 TB | Bỏ, thay bằng Settings trong app |
| 7 | Icon PWA 192/512 khai báo nhưng **thiếu tệp** → 404 | 🟡 TB | Tạo icon thật trong `public/` |
| 8 | Không có favicon | 🟢 Thấp | Bổ sung |
| 9 | Google Drive chưa cấu hình (`GOOGLE_CLIENT_ID = ""`) | 🟡 TB | Thay bằng Export/Import file |
| 10 | "Checklist trực tuần" (trang Hôm nay) **không lưu** | 🟡 TB | Giữ nguyên hành vi (UI parity) |
| 11 | Ghi chú nhanh lưu lẫn vào `documents` thay vì bảng riêng | 🟢 Thấp | Giữ nguyên (đúng nghiệp vụ gốc) |
| 12 | Tìm kiếm entity duyệt **mọi giá trị** bản ghi → chậm khi nhiều dữ liệu | 🟡 TB | Chuyển sang tìm kiếm phía server có index |
| 13 | Phân trang client-side (tải toàn bộ rồi cắt) | 🟡 TB | Phân trang server-side |
| 14 | Trợ lý chỉ so khớp chuỗi, không hiểu ngữ nghĩa | 🟢 Thấp | Giữ nguyên (đúng thiết kế "không tự suy diễn") |
| 15 | Không có test tự động phía client | 🟢 Thấp | — |
| 16 | Tự sao lưu chỉ chạy **khi mở app** (Web không có cron nền) | 🟡 TB | Backend có thể chạy job thật |
| 17 | `RELEASE_MANIFEST` thừa nhận: *"chưa nghiệm thu OAuth/Drive/GitHub/browser/thiết bị thật"* | 🟡 TB | — |

---

## 15. Ánh xạ sang kiến trúc mới

| Bản gốc | Bản mới |
|---|---|
| IndexedDB 65 store | PostgreSQL + Prisma |
| `db.put/get/all/remove` | REST API `POST/GET/PATCH/DELETE` |
| `scoped(store)` client-side | Query param `?yearId=&semesterId=&weekId=&campusId=` xử lý ở server |
| Mật khẩu `admin@` hard-code | `users.passwordHash` (bcrypt) + JWT |
| `SessionLockManager` | JWT `exp` + refresh token + auto-lock phía client |
| `tabCoordinator` (khóa 1 tab) | Không cần — DB tập trung |
| `sync_outbox` / Drive | Export/Import JSON qua API |
| `audit_logs` | Bảng `audit_logs` + middleware Prisma |
| `internal_snapshots` | Bảng `snapshots` (JSONB) |
| `form_drafts` | `localStorage` (UI state — được phép) |
| `app_settings` (seed_state) | Bảng `app_settings` key-value |
| Vanilla JS render string | React Server/Client Components |
| CSS variables | Tailwind theme tokens |
| Icon Unicode | **Lucide React** (theo yêu cầu) — ánh xạ 1-1 |
| Hash routing | Next.js App Router (path-based) |

### Ánh xạ Icon: Unicode → Lucide React

| Route | Gốc | Lucide |
|---|---|---|
| dashboard | `⌂` | `LayoutDashboard` |
| today | `◷` | `Clock` |
| plans | `▤` | `ClipboardList` |
| tasks | `✓` | `CheckSquare` |
| calendar | `▦` | `CalendarDays` |
| scores | `★` | `Star` |
| activities | `⚑` | `Flag` |
| organization | `♟` | `Users` |
| programs | `◇` | `Award` |
| commendations | `✦` | `Trophy` |
| documents | `▧` | `FolderOpen` |
| equipment | `◫` | `Package` |
| reports | `▥` | `FileBarChart` |
| assistant | `◎` | `Bot` |
| backup | `⇄` | `RefreshCw` |
| settings | `⚙` | `Settings` |

---

## 16. Kết luận Phase 1

Bản gốc là ứng dụng **nghiệp vụ nghiêm túc, hoàn chỉnh**, không phải demo:

✅ 16 module nghiệp vụ đầy đủ
✅ Workflow duyệt/khóa 6 trạng thái có snapshot bảo vệ
✅ Nhật ký kiểm toán mọi thay đổi điểm
✅ Phiên bản hóa bộ tiêu chí và báo cáo với checksum
✅ Cấu hình động 21 danh mục + trường tùy chỉnh 9 kiểu
✅ Responsive 7 breakpoint, mobile-first bottom nav
✅ PWA offline-capable

Điểm yếu chí mạng: **không có backend, không có xác thực thật, dữ liệu cô lập trên 1 máy**. Đây chính là lý do tồn tại của bản rebuild.

**Toàn bộ nghiệp vụ đã được giải mã từ mã nguồn — không có chi tiết nào phải suy đoán.**

→ Tiếp theo: `DATABASE_DESIGN.md`
