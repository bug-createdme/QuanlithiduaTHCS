/** Tiện ích định dạng dùng chung. Ngày giờ theo chuẩn hiển thị Việt Nam. */

const DATE_FMT = new Intl.DateTimeFormat('vi-VN');
const DATETIME_FMT = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
const NUMBER_FMT = new Intl.NumberFormat('vi-VN');

/** Chuỗi ISO (có hoặc không phần giờ) → "dd/MM/yyyy". */
export function fmtDate(value: string | null | undefined): string {
  if (!value) return '—';
  const iso = value.length > 10 ? value.slice(0, 10) : value;
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '—' : DATE_FMT.format(date);
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : DATETIME_FMT.format(date);
}

export function fmtNumber(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? NUMBER_FMT.format(n) : '0';
}

export function formatBytes(bytes: number | string | null | undefined): string {
  const n = Number(bytes ?? 0);
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Chuỗi ISO ngày hôm nay theo lịch địa phương (không dùng toISOString để khỏi lệch múi giờ). */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Cắt phần giờ khỏi chuỗi ISO để đổ vào <input type="date">. */
export function toDateInput(value: string | null | undefined): string {
  if (!value) return '';
  return value.length > 10 ? value.slice(0, 10) : value;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Bỏ dấu tiếng Việt để tìm kiếm/so sánh không phân biệt dấu. */
export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

/** Ghép danh sách class, bỏ qua giá trị rỗng/false. */
export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
