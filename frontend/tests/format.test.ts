import { describe, expect, it } from 'vitest';
import { addDays, clamp, cx, fmtDate, formatBytes, normalizeText, toDateInput } from '@/lib/format';

describe('fmtDate — hiển thị ngày kiểu Việt Nam', () => {
  it('nhận chuỗi ISO chỉ có ngày', () => {
    expect(fmtDate('2026-08-23')).toBe('23/8/2026');
  });

  it('nhận cả chuỗi ISO đầy đủ có phần giờ', () => {
    expect(fmtDate('2026-08-23T10:30:00.000Z')).toBe('23/8/2026');
  });

  it('giá trị rỗng cho dấu gạch ngang', () => {
    expect(fmtDate(null)).toBe('—');
    expect(fmtDate(undefined)).toBe('—');
    expect(fmtDate('')).toBe('—');
  });

  it('giá trị không hợp lệ không làm vỡ giao diện', () => {
    expect(fmtDate('khong-phai-ngay')).toBe('—');
  });
});

describe('toDateInput — đổ vào ô <input type="date">', () => {
  it('cắt phần giờ khỏi chuỗi ISO', () => {
    expect(toDateInput('2026-08-23T10:30:00.000Z')).toBe('2026-08-23');
  });

  it('giữ nguyên chuỗi đã đúng định dạng', () => {
    expect(toDateInput('2026-08-23')).toBe('2026-08-23');
  });

  it('giá trị rỗng cho chuỗi rỗng để ô input không lỗi', () => {
    expect(toDateInput(null)).toBe('');
  });
});

describe('normalizeText — tìm kiếm bỏ dấu', () => {
  it('bỏ dấu và chữ đ', () => {
    expect(normalizeText('Hồ sơ Đội')).toBe('ho so doi');
  });

  it('dùng được để so khớp không phân biệt dấu', () => {
    expect(normalizeText('Kế hoạch')).toContain(normalizeText('ke hoach'));
  });
});

describe('addDays', () => {
  it('cộng ngày và chuyển tháng đúng', () => {
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02');
  });

  it('lùi ngày với số âm', () => {
    expect(addDays('2026-09-02', -3)).toBe('2026-08-30');
  });
});

describe('cx — ghép class', () => {
  it('bỏ qua giá trị falsy', () => {
    expect(cx('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('chuỗi rỗng khi không có gì', () => {
    expect(cx(false, null)).toBe('');
  });
});

describe('clamp', () => {
  it('giữ trong khoảng', () => {
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(-1, 0, 100)).toBe(0);
    expect(clamp(50, 0, 100)).toBe(50);
  });
});

describe('formatBytes', () => {
  it('hiển thị đơn vị dễ đọc', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(null)).toBe('0 B');
  });
});
