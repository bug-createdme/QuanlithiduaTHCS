/**
 * Chuẩn hóa văn bản tiếng Việt — cổng vào cho tìm kiếm bỏ dấu.
 * Tái hiện normalizeText() của bản gốc:
 *   .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
 * Bổ sung xử lý riêng chữ "đ/Đ" vì NFD không tách được dấu gạch ngang.
 */
export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Gộp nhiều trường thành một chuỗi tìm kiếm đã chuẩn hóa. */
export function buildSearchText(...parts: unknown[]): string {
  return normalizeText(parts.filter((p) => p !== null && p !== undefined && p !== '').join(' '));
}

/**
 * Vô hiệu hóa ký tự đại diện của LIKE/ILIKE trong từ khóa người dùng gõ.
 *
 * `contains` của Prisma đưa thẳng chuỗi vào ILIKE nên `%` và `_` vẫn còn tác
 * dụng đại diện: gõ một dấu `%` sẽ khớp mọi bản ghi. PostgreSQL mặc định lấy
 * `\` làm ký tự thoát, nên chỉ cần nhân đôi `\` rồi thoát `%` và `_`.
 */
export function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/[%_]/g, (char) => `\\${char}`);
}

/** So sánh tên lớp/chuỗi có số theo thứ tự tự nhiên tiếng Việt: 6/A2 < 6/A10. */
export function compareVietnamese(a: string, b: string): number {
  return String(a).localeCompare(String(b), 'vi', { numeric: true, sensitivity: 'base' });
}

/**
 * Ô CSV an toàn: bọc nháy kép, nhân đôi nháy bên trong và chặn CSV injection
 * bằng cách thêm dấu nháy đơn trước các ký tự khởi tạo công thức.
 * Giữ đúng hành vi csvSafe() của bản gốc.
 */
export function csvSafe(value: unknown): string {
  let s = String(value ?? '').replace(/"/g, '""');
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s}"`;
}

/**
 * BOM UTF-8 — Excel cần dấu này để mở CSV tiếng Việt không bị lỗi phông.
 * Viết dạng escape để ký tự vô hình không bị mất khi sao chép hay đổi encoding.
 */
const UTF8_BOM = '\uFEFF';

/** Dựng nội dung CSV kèm BOM UTF-8 để Excel đọc đúng tiếng Việt. */
export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header.map(csvSafe).join(',')];
  for (const row of rows) lines.push(row.map(csvSafe).join(','));
  return UTF8_BOM + lines.join('\r\n');
}

/**
 * Tuần tự hoá JSON ổn định (khóa sắp xếp) để checksum không đổi
 * khi thứ tự thuộc tính thay đổi. Tái hiện stableJSON() của bản gốc.
 */
export function stableJson(value: unknown): string {
  const seen = new WeakSet<object>();

  const walk = (input: unknown): unknown => {
    if (input === null || typeof input !== 'object') {
      return typeof input === 'bigint' ? input.toString() : input;
    }
    if (input instanceof Date) return input.toISOString();
    if (seen.has(input)) return null;
    seen.add(input);
    if (Array.isArray(input)) return input.map(walk);
    return Object.fromEntries(
      Object.keys(input as Record<string, unknown>)
        .sort()
        .map((key) => [key, walk((input as Record<string, unknown>)[key])]),
    );
  };

  return JSON.stringify(walk(value));
}

/** Tăng số phiên bản kiểu "1.0" → "1.1". Giữ đúng nextVersion() của bản gốc. */
export function nextVersion(value: string | null | undefined): string {
  const parts = String(value || '1.0').split('.');
  const last = Number(parts.pop()) || 0;
  return [...parts, last + 1].join('.');
}

/** Định dạng byte sang chuỗi người đọc được. */
export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
