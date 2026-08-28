# Cơ sở dữ liệu

PostgreSQL 16 là **nguồn dữ liệu duy nhất** của hệ thống.

| Nội dung | Vị trí |
|---|---|
| Định nghĩa schema | [`../backend/prisma/schema.prisma`](../backend/prisma/schema.prisma) |
| Migration | [`../backend/prisma/migrations/`](../backend/prisma/migrations/) |
| Seed | [`../backend/prisma/seed.ts`](../backend/prisma/seed.ts) |
| Thiết kế chi tiết | [`../DATABASE_DESIGN.md`](../DATABASE_DESIGN.md) |
| Truy vấn kiểm tra | [`queries/`](queries/) |

## Lệnh thường dùng

```bash
cd backend

npx prisma migrate dev      # tạo + áp dụng migration (môi trường phát triển)
npx prisma migrate deploy   # áp dụng migration (môi trường thật)
npx prisma migrate status   # xem trạng thái
npm run seed                # nạp dữ liệu khởi tạo
npx prisma studio           # xem/sửa dữ liệu bằng giao diện
npm run db:reset            # XÓA SẠCH rồi tạo lại và seed
```

## Kết nối trực tiếp

```bash
docker compose exec postgres psql -U tpt -d tpt_doi_thcs
```

Adminer: <http://localhost:8081> — server `postgres`, user `tpt`, database `tpt_doi_thcs`.
