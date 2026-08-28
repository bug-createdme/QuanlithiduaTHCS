/**
 * Tiện ích ngày tháng làm việc với chuỗi ISO "YYYY-MM-DD" (không giờ, không múi giờ),
 * đúng như bản gốc dùng localISO()/today()/addDays().
 * Cột DATE của PostgreSQL cũng không mang múi giờ, nên quy ước này khớp tự nhiên.
 */

/** Chuyển Date sang "YYYY-MM-DD" theo lịch địa phương (không dùng toISOString để tránh lệch múi giờ). */
export function localISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function today(): string {
  return localISO(new Date());
}

/** Cộng n ngày vào chuỗi ISO. n có thể âm. */
export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return localISO(d);
}

/** Số ngày giữa hai mốc ISO (b − a). */
export function diffDays(a: string, b: string): number {
  const ms = new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime();
  return Math.round(ms / 86_400_000);
}

export type RepeatRuleValue = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

/** Mốc lặp kế tiếp. Giữ nguyên nextRepeatDate() của bản gốc (dùng 12:00 để tránh lệch DST). */
export function nextRepeatDate(value: string | null, rule: RepeatRuleValue): string | null {
  if (!value || rule === 'NONE') return null;
  const d = new Date(`${value}T12:00:00`);
  if (rule === 'DAILY') d.setDate(d.getDate() + 1);
  if (rule === 'WEEKLY') d.setDate(d.getDate() + 7);
  if (rule === 'MONTHLY') d.setMonth(d.getMonth() + 1);
  if (rule === 'YEARLY') d.setFullYear(d.getFullYear() + 1);
  return localISO(d);
}

/** Chuyển giá trị Date của Prisma sang "YYYY-MM-DD" cho JSON trả về. */
export function toDateString(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

/** Chuyển chuỗi "YYYY-MM-DD" sang Date UTC nửa đêm để ghi vào cột DATE. */
export function toDbDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

/** Sinh 40 tuần học, mỗi tuần 7 ngày, tính từ ngày bắt đầu năm học. */
export function generateWeeks(startDate: string, count = 40): Array<{
  number: number;
  name: string;
  startDate: string;
  endDate: string;
}> {
  const weeks: Array<{ number: number; name: string; startDate: string; endDate: string }> = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  for (let i = 1; i <= count; i += 1) {
    const end = new Date(cursor);
    end.setDate(end.getDate() + 6);
    weeks.push({ number: i, name: `Tuần ${i}`, startDate: localISO(cursor), endDate: localISO(end) });
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

/** Giới hạn số trong khoảng [min, max]; giá trị không hợp lệ trả về min. */
export function clamp(value: unknown, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
