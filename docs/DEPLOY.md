# Triển khai lên máy chủ

Hướng dẫn dựng hệ thống trên **Oracle Cloud Always Free** — 4 nhân ARM Ampere,
24 GB RAM, 200 GB đĩa, miễn phí vĩnh viễn. Các bước cũng áp dụng được cho bất
kỳ VPS Linux nào; chỉ phần tạo máy chủ là khác.

## Kiến trúc

```
                    Internet
                        │
                   :443 (HTTPS)
                        │
              ┌─────────▼─────────┐
              │  Caddy            │  tự xin chứng chỉ Let's Encrypt
              │  (chỉ container   │
              │   này mở cổng)    │
              └────┬─────────┬────┘
                   │         │
           /api/*  │         │  mọi đường dẫn khác
                   │         │
         ┌─────────▼──┐  ┌───▼────────┐
         │ backend    │  │ frontend   │
         │ :4000      │  │ :3000      │
         └──┬──────┬──┘  └────────────┘
            │      │
   ┌────────▼─┐  ┌─▼──────────┐
   │ postgres │  │ volume     │
   │ (volume) │  │ uploads    │
   └──────────┘  └────────────┘
```

Frontend và backend nằm sau **cùng một tên miền**. Đây không phải lựa chọn cho
đẹp: cookie refresh đặt `sameSite=lax`, nên nếu tách sang hai tên miền khác
nhau thì trình duyệt không gửi kèm cookie và người dùng bị đăng xuất mỗi 15
phút. Cùng origin cũng làm CORS gần như không cần tới.

---

## 1. Chuẩn bị

**Tên miền.** Bắt buộc phải có, vì Caddy cần nó để xin chứng chỉ HTTPS.
VNNIC có chương trình cấp tên miền `.id.vn` miễn phí cho cá nhân người Việt
(đăng ký qua iNET hoặc TenTen). Tên miền `.io.vn` cũng rất rẻ.

**Tài khoản Oracle Cloud.** Đăng ký cần thẻ tín dụng để xác minh, không bị trừ
tiền. Thẻ nội địa thường bị từ chối; thẻ Visa/Mastercard quốc tế thì được.

---

## 2. Tạo máy chủ

Compute → Instances → Create Instance:

| Mục | Chọn |
|---|---|
| Image | **Ubuntu 24.04 LTS** — hỗ trợ tới 4/2029; 22.04 hết hỗ trợ tiêu chuẩn từ 4/2027 |
| Shape | **VM.Standard.A1.Flex** — 4 OCPU, 24 GB RAM |
| Boot volume | 100–200 GB |
| SSH key | Tải khóa riêng về và giữ kỹ |

> **Nếu báo "Out of capacity"** — rất hay gặp với A1 ở các region đông. Cách xử
> lý, theo thứ tự nên thử: chọn Availability Domain khác; đổi sang region ít
> đông hơn (Osaka, Seoul); hoặc nâng tài khoản lên Pay-As-You-Go — vẫn giữ
> nguyên hạn mức Always Free và không mất tiền nếu không vượt, nhưng được ưu
> tiên tài nguyên và tránh bị thu hồi instance khi để nhàn rỗi.

### Mở cổng — phải làm ở tầng tường lửa đám mây

Networking → Virtual Cloud Network → Security Lists → Default → Add Ingress
Rules. Thêm hai luật, `Source CIDR` là `0.0.0.0/0`:

- TCP cổng **80** (Let's Encrypt cần để xác thực)
- TCP cổng **443**

Đây là bước hay bị bỏ sót nhất. Không mở ở đây thì mọi thứ phía trong chạy đúng
mà ngoài Internet vẫn không vào được.

> Nếu bạn chọn image Oracle Linux thay vì Ubuntu, còn phải mở thêm ở
> `firewalld` trong máy. Với Ubuntu + Docker thì thường không cần, vì cổng do
> Docker công bố đi qua chuỗi FORWARD chứ không qua INPUT. Cách chắc chắn nhất
> là kiểm tra thật sau khi chạy xong — xem mục Xử lý sự cố.

### Trỏ tên miền

Tạo bản ghi **A** cho tên miền, trỏ về địa chỉ IP công khai của máy chủ.
**Làm việc này trước khi khởi động hệ thống** — Caddy xin chứng chỉ ngay lần
chạy đầu, và sẽ thất bại nếu DNS chưa trỏ đúng. Kiểm tra bằng:

```bash
dig +short thidua.truong-cua-ban.id.vn
```

---

## 3. Cài Docker

SSH vào máy chủ rồi chạy:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
docker compose version
```

---

## 4. Lấy mã nguồn và cấu hình

```bash
sudo mkdir -p /opt/tpt-doi && sudo chown $USER:$USER /opt/tpt-doi
git clone https://github.com/bug-createdme/QuanlithiduaTHCS.git /opt/tpt-doi
cd /opt/tpt-doi
cp docker/env.prod.example .env
```

Sinh các chuỗi bí mật:

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)"
echo "JWT_SECRET=$(openssl rand -hex 48)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 48)"
echo "SEED_ADMIN_PASSWORD=$(openssl rand -base64 18)"
```

Mở `.env` bằng `nano .env`, dán các giá trị trên vào, và sửa `DOMAIN` thành tên
miền thật. Giữ nguyên `TZ=Asia/Ho_Chi_Minh`.

> **Đừng bỏ qua `TZ`.** Hàm `today()` trong `backend/src/lib/dates.ts` lấy ngày
> theo giờ hệ thống. Máy chủ Linux mặc định chạy UTC, chậm hơn Việt Nam 7
> tiếng — nghĩa là từ 00:00 đến 07:00 giờ Việt Nam, hệ thống tưởng vẫn là hôm
> qua. Sai lệch lan sang công việc lặp, lịch tuần và sổ điểm.

---

## 5. Khởi động

```bash
docker compose --env-file /opt/tpt-doi/.env -f docker/docker-compose.prod.yml up -d --build
```

Lần đầu mất khoảng 5–10 phút vì phải biên dịch trên máy ARM. Backend tự chạy
`prisma migrate deploy` trước khi khởi động API.

Nạp dữ liệu khởi tạo — **chỉ chạy một lần duy nhất**:

```bash
docker compose --env-file /opt/tpt-doi/.env -f docker/docker-compose.prod.yml --profile seed run --rm seed
```

Theo dõi quá trình Caddy xin chứng chỉ:

```bash
docker compose --env-file /opt/tpt-doi/.env -f docker/docker-compose.prod.yml logs -f caddy
```

Xong thì mở `https://<tên-miền-của-bạn>` và đăng nhập bằng `admin` với mật khẩu
`SEED_ADMIN_PASSWORD` bạn đã đặt.

---

## 6. Sao lưu tự động

Bản sao lưu nằm cùng một máy với dữ liệu gốc thì **không phải là sao lưu** — ổ
hỏng hoặc tài khoản bị khóa là mất cả hai. Hãy cấu hình đồng bộ ra ngoài.

Cài `rclone` và trỏ tới Cloudflare R2 (miễn phí 10 GB) hoặc Google Drive:

```bash
sudo apt install -y rclone && rclone config
```

Bật sao lưu hằng ngày lúc 2 giờ sáng:

```bash
crontab -e
```

Thêm dòng:

```
0 2 * * * RCLONE_DEST=r2:tpt-doi-backup /opt/tpt-doi/docker/backup.sh >> /var/log/tpt-doi-backup.log 2>&1
```

Script tự kiểm tra bản kết xuất có **đọc được** bằng `pg_restore --list`, không
chỉ kiểm tra tệp tồn tại, và chỉ xóa bản cũ sau khi bản mới đã thành công.

Chạy thử ngay một lần để chắc chắn:

```bash
/opt/tpt-doi/docker/backup.sh
```

**Hãy thử khôi phục ít nhất một lần** trên máy khác. Bản sao lưu chưa từng được
khôi phục thử thì chưa biết là có dùng được hay không.

---

## 7. Cập nhật phiên bản

```bash
cd /opt/tpt-doi
./docker/backup.sh                                              # sao lưu trước
git pull
docker compose --env-file /opt/tpt-doi/.env -f docker/docker-compose.prod.yml up -d --build
```

Migration mới được áp dụng tự động lúc backend khởi động.

---

## 8. Xử lý sự cố

**Không vào được từ Internet.** Kiểm tra theo thứ tự từ trong ra ngoài:

```bash
docker compose --env-file /opt/tpt-doi/.env -f docker/docker-compose.prod.yml ps        # container còn chạy?
curl -I http://localhost                                   # Caddy trả lời trong máy?
sudo ss -tlnp | grep -E ':80|:443'                         # cổng có được nghe?
```

Nếu ba lệnh trên đều ổn mà ngoài Internet vẫn không vào được thì vấn đề nằm ở
Security List của Oracle, không phải ở máy chủ.

**Caddy không xin được chứng chỉ.** Gần như luôn là do DNS chưa trỏ đúng hoặc
cổng 80 chưa mở. Xem `docker compose ... logs caddy`. Let's Encrypt có giới hạn
số lần thử mỗi tuần, nên hãy sửa DNS cho đúng rồi mới khởi động lại.

**Đăng nhập xong lại bị đăng xuất sau ít phút.** Dấu hiệu kinh điển của việc
cookie refresh không được gửi kèm. Kiểm tra `NEXT_PUBLIC_API_URL` lúc build
đúng là `/api` (đường dẫn tương đối), chứ không phải một URL đầy đủ trỏ sang
tên miền khác.

**Xem nhật ký:**

```bash
docker compose --env-file /opt/tpt-doi/.env -f docker/docker-compose.prod.yml logs -f backend
```

**Truy cập cơ sở dữ liệu.** PostgreSQL cố ý không mở cổng ra ngoài. Dùng:

```bash
docker compose --env-file /opt/tpt-doi/.env -f docker/docker-compose.prod.yml exec postgres \
  psql -U tpt -d tpt_doi_thcs
```

---

## Danh sách kiểm tra trước khi bàn giao cho trường

- [ ] `JWT_SECRET` và `JWT_REFRESH_SECRET` là hai chuỗi ngẫu nhiên khác nhau
- [ ] `POSTGRES_PASSWORD` đã đổi, không còn giá trị mẫu
- [ ] `SEED_ADMIN_PASSWORD` đã đặt, và đã đăng nhập đổi lại sau khi bàn giao
- [ ] `TZ=Asia/Ho_Chi_Minh`
- [ ] `DOMAIN` trỏ đúng, HTTPS hoạt động, `http://` tự chuyển sang `https://`
- [ ] Cron sao lưu đã chạy và đã sinh ra tệp thật
- [ ] `RCLONE_DEST` đã đặt, bản sao lưu có mặt ở nơi thứ hai
- [ ] Đã thử khôi phục một bản sao lưu thành công
- [ ] Đã cập nhật tên trường thật trong **Thiết lập → Thông tin trường**
