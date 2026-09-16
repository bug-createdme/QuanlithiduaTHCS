#!/usr/bin/env bash
#
# Sao lưu cơ sở dữ liệu và tệp đính kèm.
#
# Chạy tay:
#   ./docker/backup.sh
#
# Chạy tự động mỗi ngày lúc 2 giờ sáng (crontab -e):
#   0 2 * * * /opt/tpt-doi/docker/backup.sh >> /var/log/tpt-doi-backup.log 2>&1
#
# Biến môi trường điều chỉnh được:
#   BACKUP_DIR   thư mục chứa bản sao lưu   (mặc định /opt/tpt-doi/backups)
#   KEEP_DAYS    số ngày giữ lại            (mặc định 14)
#   RCLONE_DEST  đích đồng bộ ra ngoài máy  (ví dụ "r2:tpt-doi-backup"; bỏ trống thì không đồng bộ)
#
# Bản sao lưu nằm CÙNG MỘT MÁY với dữ liệu gốc thì không phải là sao lưu —
# ổ hỏng hay tài khoản bị khóa là mất cả hai. Hãy đặt RCLONE_DEST.

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-/opt/tpt-doi/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
RCLONE_DEST="${RCLONE_DEST:-}"
UPLOADS_VOLUME="${UPLOADS_VOLUME:-tpt_doi_uploads_prod}"

# `--env-file` là bắt buộc, không phải cho gọn.
#
# Docker Compose xác định thư mục dự án theo vị trí tệp compose, nên với
# `-f .../docker/docker-compose.prod.yml` nó đi tìm `.env` trong `docker/` chứ
# không phải ở thư mục gốc. Thiếu cờ này thì mọi biến đều rỗng và script chết
# ngay từ lệnh pg_dump — lặng lẽ, vào 2 giờ sáng, khi không ai nhìn.
#
# Không dùng `--project-directory` để sửa: nó sẽ đổi gốc phân giải của
# `./Caddyfile` trong tệp compose và làm Caddy không khởi động được.
COMPOSE=(docker compose --env-file "${PROJECT_DIR}/.env" -f "${PROJECT_DIR}/docker/docker-compose.prod.yml")
STAMP="$(date +%Y%m%d-%H%M%S)"
DB_FILE="${BACKUP_DIR}/db-${STAMP}.dump"
FILES_FILE="${BACKUP_DIR}/uploads-${STAMP}.tar.gz"

log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
die() { log "LỖI: $*" >&2; exit 1; }

mkdir -p "${BACKUP_DIR}"

# ── 1. Cơ sở dữ liệu ────────────────────────────────────────────────────────
# Lấy thông tin đăng nhập từ chính biến môi trường của container, để script này
# không phải đọc và tự phân tích tệp .env.
log "Đang kết xuất cơ sở dữ liệu…"
"${COMPOSE[@]}" exec -T postgres sh -c \
	'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl -Fc' \
	> "${DB_FILE}" || die "pg_dump thất bại"

[[ -s "${DB_FILE}" ]] || die "tệp kết xuất rỗng: ${DB_FILE}"

# Kiểm tra bản kết xuất ĐỌC ĐƯỢC, không chỉ kiểm tra nó tồn tại. Đây là khác
# biệt giữa "có sao lưu" và "có sao lưu dùng được".
log "Đang kiểm tra bản kết xuất…"
"${COMPOSE[@]}" exec -T postgres pg_restore --list /dev/stdin < "${DB_FILE}" > /dev/null \
	|| die "bản kết xuất hỏng, pg_restore không đọc được: ${DB_FILE}"

TABLES="$("${COMPOSE[@]}" exec -T postgres pg_restore --list /dev/stdin < "${DB_FILE}" | grep -c 'TABLE DATA' || true)"
log "Cơ sở dữ liệu: $(du -h "${DB_FILE}" | cut -f1), ${TABLES} bảng có dữ liệu"

# ── 2. Tệp đính kèm ─────────────────────────────────────────────────────────
# Đóng gói bằng container tạm gắn volume ở chế độ chỉ đọc, để không phải dừng
# backend và cũng không cần quyền root trên thư mục volume.
log "Đang đóng gói tệp đính kèm…"
docker run --rm \
	-v "${UPLOADS_VOLUME}:/data:ro" \
	-v "${BACKUP_DIR}:/backup" \
	alpine:3 tar czf "/backup/$(basename "${FILES_FILE}")" -C /data . \
	|| die "không đóng gói được tệp đính kèm"

log "Tệp đính kèm: $(du -h "${FILES_FILE}" | cut -f1)"

# ── 3. Đồng bộ ra ngoài máy ─────────────────────────────────────────────────
if [[ -n "${RCLONE_DEST}" ]]; then
	if command -v rclone > /dev/null 2>&1; then
		log "Đang đồng bộ lên ${RCLONE_DEST}…"
		rclone copy "${DB_FILE}" "${RCLONE_DEST}/" --no-traverse
		rclone copy "${FILES_FILE}" "${RCLONE_DEST}/" --no-traverse
		log "Đã đồng bộ xong."
	else
		log "CẢNH BÁO: đã đặt RCLONE_DEST nhưng máy chưa cài rclone — bỏ qua bước đồng bộ."
	fi
else
	log "CẢNH BÁO: chưa đặt RCLONE_DEST. Bản sao lưu chỉ nằm trên chính máy chủ này."
fi

# ── 4. Dọn bản cũ ───────────────────────────────────────────────────────────
# Chỉ dọn sau khi các bước trên đã thành công; set -e bảo đảm điều đó. Nếu hôm
# nay sao lưu hỏng thì bản cũ vẫn còn nguyên.
DELETED="$(find "${BACKUP_DIR}" -maxdepth 1 -type f \( -name 'db-*.dump' -o -name 'uploads-*.tar.gz' \) -mtime "+${KEEP_DAYS}" -print -delete | wc -l)"
log "Đã xóa ${DELETED} tệp cũ hơn ${KEEP_DAYS} ngày."

log "Hoàn tất. Thư mục sao lưu: ${BACKUP_DIR}"
