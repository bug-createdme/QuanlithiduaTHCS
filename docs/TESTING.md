# Kiểm thử tự động

**388 bài kiểm thử** chạy trong khoảng 15 giây.

| Nhóm | Số bài | Cần PostgreSQL? |
|---|---|---|
| Backend — unit | 87 | Không |
| Backend — integration | 254 | Có |
| Frontend — unit | 47 | Không |
| **Tổng** | **388** | |

---

## Chạy

```bash
# Toàn bộ (từ thư mục gốc)
npm test
```

```bash
# Chỉ phần nhanh, không cần cơ sở dữ liệu
npm run test:unit
```

```bash
# Chỉ backend, chỉ frontend
npm run test:backend
npm run test:frontend
```

```bash
# Chỉ integration
npm run test:integration
```

```bash
# Đo độ phủ mã backend
npm run test:coverage
```

Chạy lại tự động khi sửa mã:

```bash
npm run test:watch --prefix backend
```

Chạy một tệp hoặc lọc theo tên bài:

```bash
npx vitest run tests/integration/scores.test.ts --prefix backend
npx vitest run -t "mở khóa" --prefix backend
```

> Integration test cần PostgreSQL đang chạy: `docker compose up -d`.

---

## Database dùng cho kiểm thử

Test **không bao giờ đụng vào database làm việc**.

```
DATABASE_URL          →  tpt_doi_thcs        (dữ liệu thật của bạn)
TEST_DATABASE_URL     →  tpt_doi_thcs_test   (test dọn sạch tự do)
```

Tên database test được suy ra từ `DATABASE_URL` bằng cách thêm hậu tố `_test`.
`tests/setup/test-env.ts` có một bộ chặn cứng: nếu hai tên trùng nhau, toàn bộ
bộ kiểm thử dừng ngay với thông báo lỗi thay vì chạy tiếp.

Muốn chỉ định database khác, đặt biến `TEST_DATABASE_URL` trong `backend/.env`.

**Vòng đời**

1. `tests/setup/global-setup.ts` chạy một lần: tạo database test nếu chưa có, rồi `prisma migrate deploy`.
2. Mỗi tệp integration gọi `resetDatabase()` ở `beforeAll`: `TRUNCATE … CASCADE` toàn bộ bảng rồi seed lại.
3. Các tệp chạy **tuần tự** (`fileParallelism: false`) vì dùng chung một database.

---

## Cấu trúc

```
backend/tests/
├── setup/
│   ├── test-env.ts        Ép DATABASE_URL sang database test, chặn nhầm lẫn
│   └── global-setup.ts    Tạo database test + áp dụng migration
├── helpers/
│   ├── db.ts              Kết nối dùng chung, resetDatabase(), seedContext()
│   ├── api.ts             Supertest client, login(), authed(), scopeQuery()
│   └── fixtures.ts        Bộ dựng dữ liệu mẫu đúng kiểu cho unit test
├── unit/                  Logic thuần, không chạm cơ sở dữ liệu
│   ├── score.service.test.ts   Quy đổi điểm, xếp hạng, phân tích ô nhập, quy trình
│   ├── task.service.test.ts    Checklist, thứ tự ngày, chu kỳ lặp
│   ├── dates.test.ts           Ngày ISO, sinh 40 tuần, mốc lặp
│   ├── text.test.ts            Bỏ dấu, CSV an toàn, JSON ổn định
│   └── scope.test.ts           Mệnh đề WHERE theo phạm vi, backoff mật khẩu
└── integration/           Gọi API thật qua Supertest
    ├── auth.test.ts       Đăng nhập, backoff, refresh, đổi mật khẩu
    ├── academic.test.ts   Năm học, cơ sở, lớp, nhập hàng loạt, đóng năm
    ├── scores.test.ts     Toàn bộ nghiệp vụ thi đua
    ├── tasks.test.ts      Checklist, bộ lọc, việc lặp, khóa lạc quan
    ├── entities.test.ts   Sáu thực thể dùng chung nhà máy CRUD
    └── platform.test.ts   Báo cáo, cấu hình, sao lưu, trợ lý

frontend/tests/
├── format.test.ts         Định dạng ngày, bỏ dấu, tiện ích hiển thị
├── labels.test.ts         Bảng nhãn phủ hết enum, tông màu badge
└── navigation.test.ts     16 mục nav, 14 nhóm thiết lập, cấu hình 6 trang CRUD
```

---

## Những gì được bảo vệ

Bộ kiểm thử tập trung vào các quy tắc dễ vỡ khi sửa mã về sau:

**Thi đua**
- Quy đổi điểm cho cả 5 kiểu tiêu chí và 3 công thức tính.
- `KAD`/`MIỄN` tính là đã nhập nhưng không cộng điểm.
- Ô rỗng xóa hẳn bản ghi, không lưu `NULL`.
- Đồng điểm thì đồng hạng, hạng kế tiếp nhảy cóc.
- Sắp xếp tên lớp theo số tự nhiên: `6/A2` trước `6/A10`.
- Quy trình 6 trạng thái đi đúng thứ tự.
- Khóa bảng đóng băng bộ tiêu chí và chốt bảng xếp hạng.
- Mở khóa bắt buộc lý do ≥ 5 ký tự, đặt cờ `reportsStale`.
- Cả khóa lẫn mở khóa đều tạo điểm khôi phục `protected`.
- Bộ tiêu chí đã phát sinh điểm bị khóa cấu trúc; nhân bản 1.0 → 1.1 không đụng dữ liệu cũ.

**Công việc**
- `!` đầu dòng đánh dấu mục checklist bắt buộc.
- Không hoàn thành được khi còn mục bắt buộc chưa xong.
- Sửa checklist giữ nguyên trạng thái đã tick của mục trùng nhãn.
- Việc lặp không sinh trùng khi chạy lại.
- `revision` lệch trả 409 thay vì ghi đè âm thầm.

**Dữ liệu và bảo mật**
- Mật khẩu băm không bao giờ lọt ra phản hồi API.
- Refresh token chỉ nằm ở cookie HttpOnly, xoay vòng sau mỗi lần dùng.
- Đổi mật khẩu thu hồi toàn bộ phiên đang mở.
- Backoff mũ 2 sau 3 lần sai, chặn trên 30 giây.
- Xóa là xóa mềm, bản ghi vẫn còn trong cơ sở dữ liệu.
- Bản ghi ngoài phạm vi năm học không lọt vào danh sách.
- CSV xuất ra có BOM UTF-8 và chặn CSV injection.
- Báo cáo đã chốt không sửa được.
- Ngừng dùng danh mục không xóa dữ liệu lịch sử.

---

## Lỗi thật mà bộ kiểm thử đã phát hiện

Ghi lại để thấy giá trị thực tế, không phải để trang trí:

**`scopeFields` gửi `semesterId` cho mọi thực thể.** Chỉ `plans` và `tasks` có cột đó, nên
lệnh tạo mới ở **Hoạt động, Tổ chức, Rèn luyện, Khen thưởng, Thiết bị và Lịch đều thất bại**
với lỗi Prisma. Trước đó chỉ có Công việc từng được tạo thử bằng tay nên lỗi chưa lộ.
Đã sửa bằng cách tách `scopeFields` và `scopeFieldsWithSemester`
(`src/modules/entities/entity.schemas.ts`).

**`LOG_LEVEL` thiếu giá trị `silent`.** Pino hỗ trợ mức này nhưng schema kiểm tra biến môi
trường lại không, nên không tắt được log. Đã bổ sung vào `src/config/env.ts`.

---

## Viết thêm bài kiểm thử

**Unit** — cho hàm thuần, không chạm cơ sở dữ liệu:

```ts
import '../setup/test-env';
import { describe, expect, it } from 'vitest';
import { criterionScore } from '../../src/modules/scores/score.service';
import { d, makeCriterion, makeEntry } from '../helpers/fixtures';

it('kiểu COUNT nhân số lần với điểm mỗi lần', () => {
  const criterion = makeCriterion({ id: 'c1', dataType: 'COUNT', points: d(3) });
  const entry = makeEntry({ id: 'e1', classId: 'l1', criteriaId: 'c1', value: d(4) });
  expect(criterionScore(entry, criterion, null)).toBe(12);
});
```

**Integration** — gọi API thật:

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { authed, login } from '../helpers/api';
import { resetDatabase, seedContext } from '../helpers/db';

describe('Tính năng mới', () => {
  let api: ReturnType<typeof authed>;

  beforeAll(async () => {
    await resetDatabase();               // luôn bắt đầu từ dữ liệu seed
    api = authed((await login()).accessToken);
  });

  it('trả về đúng dữ liệu', async () => {
    const response = await api.get('/api/duong-dan').expect(200);
    expect(response.body.data).toBeTruthy();
  });
});
```

Quy ước:
- Mô tả bài kiểm thử bằng tiếng Việt, nói **hành vi mong đợi**, không nói tên hàm.
- Mỗi tệp integration tự `resetDatabase()`, không phụ thuộc tệp khác.
- Khi kiểm tra thông báo lỗi, so đúng nguyên văn tiếng Việt — đó là phần giao diện người dùng nhìn thấy.

---

## Tích hợp liên tục

```yaml
# .github/workflows/test.yml
name: Kiểm thử
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: tpt
          POSTGRES_PASSWORD: tpt_secret
          POSTGRES_DB: tpt_doi_thcs
        ports: ['5433:5432']
        options: >-
          --health-cmd pg_isready --health-interval 10s
          --health-timeout 5s --health-retries 10

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm run install:all
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
        env:
          DATABASE_URL: postgresql://tpt:tpt_secret@localhost:5433/tpt_doi_thcs?schema=public
          JWT_SECRET: ci-access-secret
          JWT_REFRESH_SECRET: ci-refresh-secret
```
