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

/**
 * 'YYYY-MM-DD' → 'dd/MM/yyyy'.
 *
 * Dùng cho ô nhập ngày tự vẽ. KHÔNG dùng `<input type="date">` của trình duyệt
 * vì Chrome hiển thị theo ngôn ngữ giao diện của máy (thường là mm/dd/yyyy),
 * không theo `lang="vi"` của tài liệu — giáo viên nhìn thấy sai thứ tự ngày/tháng.
 */
export function isoToDateText(iso: string | null | undefined): string {
  if (!iso) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return '';
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/**
 * 'dd/MM/yyyy' → 'YYYY-MM-DD'; trả null nếu không phải ngày có thật.
 * Kiểm tra khứ hồi qua đối tượng Date nên loại được 31/02, 31/04…
 */
export function dateTextToIso(text: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Chèn dấu "/" trong lúc gõ để người dùng không phải tự gõ dấu phân cách. */
export function maskDateText(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Chuẩn hóa chuỗi giờ về `HH:mm` 24 giờ; trả null nếu không phải giờ có thật.
 *
 * Giống ô ngày, `<input type="time">` của trình duyệt hiển thị theo ngôn ngữ
 * hệ điều hành — máy cài tiếng Anh hiện `03:04 PM`, trong khi nhà trường dùng
 * giờ 24. Giá trị lưu xuống cơ sở dữ liệu vẫn là `HH:mm` như trước.
 */
export function normalizeTimeText(text: string): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Chèn dấu ":" trong lúc gõ giờ. */
export function maskTimeText(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
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
