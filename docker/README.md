# Docker

## Phát triển — chỉ chạy PostgreSQL trong container

Đây là cách dùng mặc định: cơ sở dữ liệu chạy trong Docker, còn backend và frontend chạy trực tiếp bằng `npm run dev` để có hot-reload.

```bash
docker compose up -d          # PostgreSQL (5433) + Adminer (8081)
docker compose ps
docker compose logs -f postgres
docker compose down           # dừng, GIỮ dữ liệu
docker compose down -v        # dừng và XÓA SẠCH dữ liệu
```

## Chạy toàn bộ hệ thống bằng Docker

```bash
docker compose -f docker-compose.yml -f docker/docker-compose.full.yml up -d --build
```

Lệnh trên bổ sung hai service `backend` và `frontend` vào bên cạnh PostgreSQL.

## Ghi chú

- `backend.Dockerfile` tự chạy `prisma migrate deploy` trước khi khởi động API.
- Tệp đính kèm nằm ở `/app/uploads` trong container; hãy gắn volume để không mất khi dựng lại.
- `NEXT_PUBLIC_API_URL` được nhúng vào bundle **lúc build**, nên đổi giá trị thì phải build lại frontend.
