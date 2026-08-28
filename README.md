# Trợ lý Tổng phụ trách Đội THCS

Hệ thống quản lý công tác Đội, thi đua lớp và báo cáo dành cho **Tổng phụ trách Đội** ở trường THCS.

Đây là bản dựng lại từ đầu của website
[giaoducso40-png.github.io/trolytongphutrach](https://giaoducso40-png.github.io/trolytongphutrach/),
chuyển từ kiến trúc *local-first trên IndexedDB* sang **PostgreSQL tập trung + REST API thật**,
giữ nguyên giao diện, thao tác và toàn bộ nghiệp vụ.

---

## Mục lục

- [Tổng quan](#tổng-quan)
- [Tính năng](#tính-năng)
- [Công nghệ](#công-nghệ)
- [Yêu cầu](#yêu-cầu)
- [Cài đặt](#cài-đặt)
- [Biến môi trường](#biến-môi-trường)
- [Cơ sở dữ liệu](#cơ-sở-dữ-liệu)
- [Phát triển](#phát-triển)
- [Kiểm thử](#kiểm-thử)
- [Triển khai thật](#triển-khai-thật)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Khác biệt so với bản gốc](#khác-biệt-so-với-bản-gốc)
- [Hạn chế đã biết](#hạn-chế-đã-biết)
- [Tài liệu](#tài-liệu)

---

## Tổng quan

| | Bản gốc | Bản này |
|---|---|---|
| Lưu trữ | IndexedDB trên từng trình duyệt | **PostgreSQL tập trung** |
| Dùng nhiều thiết bị | Mỗi máy một bản dữ liệu riêng | Một nguồn dữ liệu duy nhất |
| Backend | Không có | Node.js + Express + Prisma |
| Xác thực | Mật khẩu `admin@` viết thẳng trong mã công khai | Tài khoản thật, bcrypt + JWT |
| Ràng buộc dữ liệu | Kiểm tra bằng JavaScript, có thể bỏ qua | Ràng buộc ở tầng cơ sở dữ liệu |
| Rủi ro mất dữ liệu | Trình duyệt có thể tự xóa IndexedDB | Không còn |
| Số tab được ghi | Chỉ một tab, tab khác chỉ đọc | Không giới hạn |

Giao diện, câu chữ tiếng Việt, bố cục và luồng thao tác được giữ **giống bản gốc nhất có thể** —
xem [`CLONE_ANALYSIS.md`](CLONE_ANALYSIS.md) để biết mức độ đối chiếu.

---

## Tính năng

**16 phân hệ**, đúng bằng bản gốc:

| Phân hệ | Nội dung chính |
|---|---|
| **Tổng quan** | 6 thẻ KPI bấm được, việc cần xử lý, tiến độ, hoạt động sắp tới, 5 lớp dẫn đầu |
| **Hôm nay** | Việc đến hạn, lịch trong ngày, checklist trực tuần, ghi nhận nhanh |
| **Kế hoạch** | Kế hoạch năm/kỳ/tháng/tuần, mục tiêu, chỉ tiêu, rủi ro |
| **Công việc** | Danh sách + Kanban, checklist con, việc lặp định kỳ, thư viện 16 mẫu |
| **Lịch hoạt động** | Lịch tháng 42 ô, cảnh báo thiếu địa điểm/phụ trách/an toàn |
| **Thi đua lớp** | Nhập điểm, dán từ Excel, quy trình duyệt–khóa 6 trạng thái, xếp hạng, kiểm tra bất thường, nhật ký |
| **Hoạt động Đội** | Tổ chức hoạt động kèm phương án an toàn và dự phòng |
| **Tổ chức Liên đội** | Ban Chỉ huy, đội nghi lễ, phát thanh măng non |
| **Rèn luyện – phong trào** | Chương trình, chuyên hiệu, công trình măng non |
| **Khen thưởng** | Hồ sơ khen thưởng tập thể và cá nhân |
| **Hồ sơ – minh chứng** | Kho tệp thật, thư mục, phiên bản tệp, thùng rác, tìm kiếm bỏ dấu |
| **Thiết bị Đội** | Kiểm kê, tình trạng, mượn–trả |
| **Báo cáo** | 5 loại báo cáo, lưu nháp/chốt bất biến kèm checksum, xuất CSV, in A4 |
| **Trợ lý tổng hợp** | Tra cứu theo quy tắc trên dữ liệu đã lưu (không dùng AI) |
| **Sao lưu – đồng bộ** | Xuất/nhập 3 phạm vi, điểm khôi phục nội bộ, nhật ký kiểm toán |
| **Thiết lập** | 14 nhóm cấu hình, 21 danh mục động, trường tùy chỉnh, vòng đời năm học |

**Điểm nhấn nghiệp vụ được giữ nguyên từ bản gốc**

- Bảng thi đua đi qua 6 trạng thái; mỗi lần khóa/mở khóa đều tạo **điểm khôi phục bảo vệ**.
- Mở khóa bảng đã duyệt **bắt buộc ghi lý do** tối thiểu 5 ký tự và đánh dấu báo cáo liên quan cần cập nhật.
- Bộ tiêu chí đã phát sinh điểm bị **khóa cấu trúc**; muốn đổi phải nhân bản phiên bản mới, dữ liệu tuần cũ giữ nguyên.
- Báo cáo đã chốt là **bất biến**, lưu kèm checksum nguồn.
- Ô điểm phân biệt rõ *chưa nhập* / *bằng 0* / *KAD (không áp dụng)* / *MIỄN*.
- Cảnh báo bất thường chỉ **yêu cầu kiểm tra**, không tự kết luận sai phạm.
- Không thể đánh dấu hoàn thành công việc khi còn mục checklist bắt buộc chưa xong.
- Xóa là **xóa mềm**, bản ghi vẫn còn trong nhật ký.

---

## Công nghệ

**Frontend** — Next.js 15 (App Router) · React 19 · TypeScript (strict) · TailwindCSS 3 · Lucide React

**Backend** — Node.js 20 · Express 4 · TypeScript (strict) · Prisma 5 · Zod · bcryptjs · jsonwebtoken · Pino · Multer

**Cơ sở dữ liệu** — PostgreSQL 16 · UUID · migration · seed · transaction · `pg_trgm` + `unaccent`

---

## Yêu cầu

| Phần mềm | Phiên bản |
|---|---|
| Node.js | ≥ 20 |
| npm | ≥ 10 |
| Docker Desktop | bản hiện hành (để chạy PostgreSQL) |

Không có Docker thì cần một PostgreSQL 16 chạy sẵn và sửa `DATABASE_URL` cho khớp.

---

## Cài đặt

### 1. Khởi động PostgreSQL

```bash
docker compose up -d
```

PostgreSQL nghe ở **cổng 5433** (tránh đụng PostgreSQL cài sẵn trên máy ở 5432).
Adminer có tại <http://localhost:8081>.

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate deploy
npm run seed
npm run dev
```

API chạy tại <http://localhost:4000/api> — kiểm tra bằng <http://localhost:4000/api/health>.

### 3. Frontend

Mở cửa sổ dòng lệnh thứ hai:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Giao diện chạy tại <http://localhost:3000>.

### 4. Đăng nhập lần đầu

```
Tên đăng nhập:  admin
Mật khẩu:       admin@
```

Hệ thống **bắt buộc đổi mật khẩu ngay ở lần đăng nhập đầu tiên**.

---

## Biến môi trường

### `backend/.env`

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `DATABASE_URL` | `postgresql://tpt:tpt_secret@localhost:5433/tpt_doi_thcs?schema=public` | Chuỗi kết nối PostgreSQL |
| `NODE_ENV` | `development` | `development` \| `test` \| `production` |
| `PORT` | `4000` | Cổng API |
| `CORS_ORIGIN` | `http://localhost:3000` | Origin được phép, ngăn bằng dấu phẩy |
| `JWT_SECRET` | *(bắt buộc khi production)* | Khóa ký access token |
| `JWT_REFRESH_SECRET` | *(bắt buộc khi production)* | Khóa ký refresh token |
| `JWT_EXPIRES_IN` | `15m` | Hạn access token |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Hạn refresh token |
| `BCRYPT_ROUNDS` | `12` | Độ mạnh băm mật khẩu |
| `UPLOAD_DIR` | `./uploads` | Nơi lưu tệp đính kèm |
| `MAX_FILE_MB` | `25` | Dung lượng tối đa mỗi tệp |
| `LOG_LEVEL` | `info` | Mức ghi log |
| `RATE_LIMIT_MAX` | `300` | Số yêu cầu tối đa mỗi phút |
| `AUTH_RATE_LIMIT_MAX` | `10` | Giới hạn riêng cho điểm cuối đăng nhập |

Sinh khóa bí mật:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### `frontend/.env.local`

| Biến | Mặc định |
|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api` |

> `NEXT_PUBLIC_*` được nhúng vào bundle lúc build — đổi giá trị thì phải build lại frontend.

**Không bao giờ commit tệp `.env`.** Chỉ commit `.env.example`.

---

## Cơ sở dữ liệu

### Migration

```bash
cd backend
npx prisma migrate dev --name <ten_thay_doi>   # phát triển: tạo + áp dụng
npx prisma migrate deploy                       # thật: chỉ áp dụng
npx prisma migrate status                       # xem trạng thái
```

Hai migration hiện có:

| Migration | Nội dung |
|---|---|
| `20260823103630_init` | 47 bảng, 27 enum, khóa ngoại, index |
| `20260823104000_constraints_and_indexes` | 20 ràng buộc CHECK, `pg_trgm`, `unaccent`, index GIN và index một phần |

### Seed

```bash
npm run seed
```

Nạp đúng bộ dữ liệu khởi tạo của bản gốc:

| Dữ liệu | Số lượng |
|---|---|
| Tài khoản quản trị | 1 (`admin`, buộc đổi mật khẩu) |
| Trường / cơ sở | 1 / 2 |
| Năm học 2026–2027 | 2 học kỳ, **40 tuần** |
| Lớp | **16** (khối 6–9 × 2 lớp × 2 cơ sở) |
| Bộ tiêu chí / tiêu chí | 1 / 5 |
| Công việc mẫu | 3 |
| Danh mục cấu hình | 21 nhóm, 103 mục |
| Mẫu công việc | 16 |
| Thiết lập ứng dụng | 13 |

Seed **an toàn khi chạy lại**: nếu đã có dữ liệu trường thì bỏ qua.

### Tạo lại từ đầu

```bash
npm run db:reset      # XÓA SẠCH, migrate lại và seed
```

### Kiểm tra nhanh

```bash
docker compose exec -T postgres psql -U tpt -d tpt_doi_thcs -f - < database/queries/health-check.sql
```

---

## Phát triển

```bash
# Backend
cd backend
npm run dev          # tsx watch, tự khởi động lại khi sửa mã
npm run build        # biên dịch TypeScript sang dist/
npm run typecheck    # kiểm tra kiểu, không xuất tệp
npm run lint         # ESLint
npm run prisma:studio

# Frontend
cd frontend
npm run dev          # http://localhost:3000
npm run build        # build cho môi trường thật
npm run typecheck
npm run lint
```

> Sau khi sửa `tailwind.config.ts`, hãy khởi động lại `npm run dev` — Next.js không luôn nhận thay đổi của tệp cấu hình này.

### Thư mục build của frontend

`next dev` và `next build` ghi vào **hai thư mục khác nhau**:

| Lệnh | Thư mục output |
|---|---|
| `npm run dev` | `.next` |
| `npm run build` / `npm start` | `.next-prod` |

Lý do: nếu dùng chung `.next`, chạy `npm run build` (hoặc `npm run verify`) trong lúc
dev server đang mở sẽ ghi đè các chunk mà dev server đang tham chiếu, gây lỗi
`Cannot find module './xxx.js'` cho tới khi xóa `.next` và khởi động lại.
Tách thư mục nên hai lệnh chạy song song vô tư — xem `distDir` trong
[`frontend/next.config.mjs`](frontend/next.config.mjs).

### Xử lý sự cố

**`Cannot find module './xxx.js'` hoặc giao diện trắng sau khi đổi cấu hình**

```bash
npm run clean
```

Rồi khởi động lại `npm run dev`. Lệnh này xóa `backend/dist`, `frontend/.next`
và `frontend/.next-prod`.

**Thay đổi trong `tailwind.config.ts` không có hiệu lực** — dừng và chạy lại `npm run dev`.

**`prisma migrate` báo timeout advisory lock** — còn tiến trình khác giữ kết nối.
Dừng backend rồi thử lại:

```bash
docker compose exec -T postgres psql -U tpt -d tpt_doi_thcs -c "select pg_terminate_backend(pid) from pg_stat_activity where datname='tpt_doi_thcs' and pid <> pg_backend_pid();"
```

**Cổng 5432 đã bị chiếm** — dự án dùng **5433** cho container để không đụng
PostgreSQL cài sẵn trên máy. Đổi bằng `POSTGRES_PORT` trong `.env` ở thư mục gốc.

---

## Kiểm thử

**356 bài kiểm thử tự động**, chạy khoảng 15 giây.

```bash
npm test
```

| Lệnh | Nội dung |
|---|---|
| `npm test` | Toàn bộ 356 bài (backend 309 + frontend 47) |
| `npm run test:unit` | 134 bài logic thuần, **không cần cơ sở dữ liệu** |
| `npm run test:integration` | 222 bài gọi API thật |
| `npm run test:backend` / `npm run test:frontend` | Chạy riêng từng bên |
| `npm run test:coverage` | Đo độ phủ mã backend |
| `npm run verify` | typecheck → lint → test → build |

| Nhóm | Số bài | Cần PostgreSQL? |
|---|---|---|
| Backend — unit | 87 | Không |
| Backend — integration | 222 | Có |
| Frontend — unit | 47 | Không |

> Integration test dùng **database riêng** `tpt_doi_thcs_test`, tự tạo và tự dọn.
> Dữ liệu làm việc trong `tpt_doi_thcs` không bao giờ bị đụng tới — có bộ chặn cứng
> dừng toàn bộ bộ kiểm thử nếu hai tên database trùng nhau.

Chi tiết cấu trúc, quy ước viết test và mẫu cấu hình CI: [`docs/TESTING.md`](docs/TESTING.md).

---

## Triển khai thật

### Chạy toàn bộ bằng Docker

Tạo tệp `.env` ở thư mục gốc:

```env
POSTGRES_USER=tpt
POSTGRES_PASSWORD=<mat_khau_manh>
POSTGRES_DB=tpt_doi_thcs

JWT_SECRET=<chuoi_ngau_nhien_96_ky_tu>
JWT_REFRESH_SECRET=<chuoi_ngau_nhien_96_ky_tu_khac>

CORS_ORIGIN=https://ten-mien-cua-truong
NEXT_PUBLIC_API_URL=https://ten-mien-cua-truong/api
```

Rồi chạy:

```bash
docker compose -f docker-compose.yml -f docker/docker-compose.full.yml up -d --build
```

Container backend tự chạy `prisma migrate deploy` trước khi khởi động.
Lần đầu cần seed thủ công:

```bash
docker compose exec backend npx tsx prisma/seed.ts
```

### Danh sách kiểm tra trước khi đưa vào sử dụng

- [ ] Đã đặt `JWT_SECRET` và `JWT_REFRESH_SECRET` ngẫu nhiên, khác nhau
- [ ] Đã đổi `POSTGRES_PASSWORD`
- [ ] Đã đổi mật khẩu tài khoản `admin`
- [ ] `CORS_ORIGIN` trỏ đúng tên miền thật
- [ ] Chạy sau HTTPS (cookie refresh mới bật cờ `secure`)
- [ ] Đã gắn volume cho `/app/uploads` và ổ dữ liệu PostgreSQL
- [ ] Đã lên lịch sao lưu PostgreSQL định kỳ (`pg_dump`)
- [ ] Đã cập nhật tên trường thật trong **Thiết lập → Thông tin trường**

---

## Cấu trúc thư mục

```
QuanlithiduaTHCS/
├── frontend/                 Next.js 15 — 20 route
│   ├── app/
│   │   ├── (app)/            16 trang nghiệp vụ, dùng chung AppShell
│   │   ├── login/            Đăng nhập
│   │   └── doi-mat-khau/     Đổi mật khẩu
│   ├── components/
│   │   ├── layout/           AppShell, Sidebar, Topbar, LockScreen
│   │   ├── ui/               Nút, thẻ, bảng, modal, toast, trường nhập
│   │   └── entity/           Trang CRUD dùng chung + cấu hình 6 thực thể
│   ├── hooks/                useAuth, useScope, useToast, useApiQuery
│   ├── services/api.ts       Lớp REST duy nhất
│   ├── lib/                  Định dạng, nhãn tiếng Việt, điều hướng
│   ├── types/                Kiểu dữ liệu nghiệp vụ
│   └── public/               Favicon, icon PWA, manifest
│
├── backend/                  Node.js + Express + Prisma
│   ├── src/
│   │   ├── config/           Kiểm tra biến môi trường
│   │   ├── lib/              Prisma, lỗi, HTTP, phạm vi, CRUD, nhật ký
│   │   ├── middleware/       Xác thực, xử lý lỗi
│   │   ├── modules/          12 phân hệ nghiệp vụ
│   │   └── routes/           Gắn router vào /api
│   ├── prisma/
│   │   ├── schema.prisma     47 bảng, 27 enum
│   │   ├── migrations/       2 migration
│   │   └── seed.ts
│   └── .env.example
│
├── database/                 Tài liệu và truy vấn SQL kiểm tra
├── docker/                   Dockerfile production + compose đầy đủ
├── docs/                     API.md, ARCHITECTURE.md
├── docker-compose.yml        PostgreSQL + Adminer cho phát triển
├── CLONE_ANALYSIS.md         Phân tích website gốc
├── DATABASE_DESIGN.md        Thiết kế cơ sở dữ liệu
└── README.md
```

---

## Khác biệt so với bản gốc

Những thay đổi dưới đây là **có chủ đích**, xuất phát từ yêu cầu đổi kiến trúc:

| Bản gốc | Bản này | Lý do |
|---|---|---|
| Mật khẩu `admin@` viết trong mã | Tài khoản thật, bcrypt cost 12, JWT | Mã frontend luôn công khai; kiểm tra phải ở server |
| IndexedDB 65 object store | PostgreSQL 47 bảng | 15 store gốc chỉ khai báo mà chưa dùng; xem `DATABASE_DESIGN.md` §7 |
| Đồng bộ Google Drive | Xuất/nhập tệp JSON | Theo lựa chọn khi bắt đầu dự án; PostgreSQL là nguồn dữ liệu duy nhất |
| Lọc và phân trang ở trình duyệt | Xử lý ở server, có index | Cách cũ không mở rộng được khi dữ liệu nhiều |
| Biểu tượng Unicode (`⌂ ◷ ▤`) | Lucide React | Theo yêu cầu công nghệ, ánh xạ 1-1 |
| Định tuyến bằng hash (`#tasks`) | Đường dẫn thật (`/tasks`) | Chuẩn của Next.js App Router |
| Chỉ một tab được ghi | Không giới hạn | Không cần nữa khi dữ liệu tập trung |
| Thiếu favicon và icon PWA (lỗi 404) | Đã bổ sung | Khiếm khuyết của bản gốc |

**Được giữ nguyên có chủ đích:** checklist trực tuần ở trang *Hôm nay* vẫn không lưu xuống cơ sở dữ liệu,
và *Ghi chú nhanh* vẫn lưu vào hồ sơ thay vì bảng riêng — đúng như bản gốc.

---

## Hạn chế đã biết

1. **Chưa có kiểm thử giao diện ở mức component.** Đã có 356 bài kiểm thử cho nghiệp vụ và API (xem [Kiểm thử](#kiểm-thử)), nhưng chưa có test render component React hay test đầu-cuối trên trình duyệt.
2. **Chưa có màn hình quản lý người dùng.** Lược đồ đã hỗ trợ ba vai trò `ADMIN`/`EDITOR`/`VIEWER` và API đã kiểm tra quyền, nhưng việc tạo tài khoản mới hiện phải làm qua `prisma studio`.
3. **Sáu bảng dựng sẵn chưa có giao diện:** `plan_targets`, `task_dependencies`, `score_evidence`, `equipment_transactions`, `training_records`, `homeroom_teachers`. Bản gốc cũng chưa có màn hình cho các phần này.
4. **Phục hồi dữ liệu là thao tác ghi đè toàn cục.** Có tạo điểm khôi phục bảo vệ trước khi ghi, nhưng chưa có chế độ hợp nhất theo từng trường.
5. **Chưa có xử lý ảnh.** Ảnh tải lên được lưu nguyên bản, chưa tạo ảnh thu nhỏ.
6. **Chưa hỗ trợ ngoại tuyến.** Bản gốc là PWA chạy được khi mất mạng; bản này cần kết nối tới máy chủ.

---

## Tài liệu

| Tệp | Nội dung |
|---|---|
| [`CLONE_ANALYSIS.md`](CLONE_ANALYSIS.md) | Phân tích website gốc: pages, nghiệp vụ, storage, design token, hạn chế |
| [`DATABASE_DESIGN.md`](DATABASE_DESIGN.md) | Thiết kế PostgreSQL: bảng, quan hệ, ràng buộc, transaction |
| [`docs/API.md`](docs/API.md) | Tham chiếu REST API |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Luồng dữ liệu và quyết định kiến trúc |
| [`docs/TESTING.md`](docs/TESTING.md) | Cấu trúc bộ kiểm thử, quy ước viết test, mẫu cấu hình CI |
| [`database/README.md`](database/README.md) | Thao tác với cơ sở dữ liệu |
| [`docker/README.md`](docker/README.md) | Cách chạy bằng Docker |

---

## Ghi công

Ý tưởng, nghiệp vụ và thiết kế giao diện gốc thuộc về **Thầy Hiếu (Giáo dục số 4.0)** —
tác giả của [Trợ lý Tổng phụ trách Đội THCS](https://giaoducso40-png.github.io/trolytongphutrach/).
Dự án này dựng lại phần kỹ thuật trên nền tảng máy chủ, giữ nguyên nghiệp vụ đó.
