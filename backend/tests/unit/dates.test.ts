import '../setup/test-env';

import { describe, expect, it } from 'vitest';
import {
  addDays,
  clamp,
  diffDays,
  generateWeeks,
  localISO,
  nextRepeatDate,
  toDateString,
  toDbDate,
} from '../../src/lib/dates';

describe('localISO — không lệch múi giờ', () => {
  it('lấy ngày theo lịch địa phương, không qua UTC', () => {
    // 23:30 giờ địa phương: dùng toISOString() sẽ nhảy sang ngày hôm sau ở
    // các múi giờ dương như Việt Nam, nên hàm phải đọc trực tiếp getFullYear/…
    const late = new Date(2026, 7, 23, 23, 30, 0);
    expect(localISO(late)).toBe('2026-08-23');
  });

  it('đệm 0 cho tháng và ngày một chữ số', () => {
    expect(localISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('addDays / diffDays', () => {
  it('cộng ngày và tự chuyển tháng', () => {
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02');
  });

  it('nhận số âm để lùi ngày', () => {
    expect(addDays('2026-09-02', -3)).toBe('2026-08-30');
  });

  it('vượt qua năm nhuận đúng', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
  });

  it('đếm số ngày giữa hai mốc', () => {
    expect(diffDays('2026-08-17', '2026-08-23')).toBe(6);
    expect(diffDays('2026-08-23', '2026-08-17')).toBe(-6);
    expect(diffDays('2026-08-23', '2026-08-23')).toBe(0);
  });
});

describe('nextRepeatDate — chu kỳ lặp công việc', () => {
  it('trả null khi không lặp', () => {
    expect(nextRepeatDate('2026-08-23', 'NONE')).toBeNull();
    expect(nextRepeatDate(null, 'WEEKLY')).toBeNull();
  });

  it('cộng đúng theo từng chu kỳ', () => {
    expect(nextRepeatDate('2026-08-23', 'DAILY')).toBe('2026-08-24');
    expect(nextRepeatDate('2026-08-23', 'WEEKLY')).toBe('2026-08-30');
    expect(nextRepeatDate('2026-08-23', 'MONTHLY')).toBe('2026-09-23');
    expect(nextRepeatDate('2026-08-23', 'YEARLY')).toBe('2027-08-23');
  });

  it('lặp hằng tháng từ ngày 31 dồn sang tháng kế tiếp như JavaScript', () => {
    // 31/01 + 1 tháng → 03/03 (2026 không nhuận). Ghi lại hành vi thực tế
    // để nếu sau này đổi cách tính thì test sẽ báo.
    expect(nextRepeatDate('2026-01-31', 'MONTHLY')).toBe('2026-03-03');
  });
});

describe('generateWeeks — sinh tuần học', () => {
  const weeks = generateWeeks('2026-08-17', 40);

  it('sinh đúng 40 tuần', () => {
    expect(weeks).toHaveLength(40);
  });

  it('tuần đầu bắt đầu đúng ngày yêu cầu và kéo dài 7 ngày', () => {
    expect(weeks[0]).toMatchObject({
      number: 1,
      name: 'Tuần 1',
      startDate: '2026-08-17',
      endDate: '2026-08-23',
    });
  });

  it('các tuần nối tiếp nhau không chồng lấn, không hở ngày', () => {
    for (let i = 1; i < weeks.length; i += 1) {
      expect(weeks[i]!.startDate).toBe(addDays(weeks[i - 1]!.endDate, 1));
    }
  });

  it('đánh số liên tục từ 1', () => {
    expect(weeks.map((w) => w.number)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
  });
});

describe('toDbDate / toDateString', () => {
  it('chuyển qua lại không mất ngày', () => {
    const date = toDbDate('2026-08-23');
    expect(date).toBeInstanceOf(Date);
    expect(toDateString(date)).toBe('2026-08-23');
  });

  it('giá trị rỗng cho null', () => {
    expect(toDbDate(null)).toBeNull();
    expect(toDbDate('')).toBeNull();
    expect(toDateString(null)).toBeNull();
  });
});

describe('clamp', () => {
  it('giữ giá trị trong khoảng', () => {
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(42, 0, 100)).toBe(42);
  });

  it('giá trị không phải số trả về cận dưới', () => {
    expect(clamp('abc', 0, 100)).toBe(0);
    expect(clamp(NaN, 5, 100)).toBe(5);
  });
});
