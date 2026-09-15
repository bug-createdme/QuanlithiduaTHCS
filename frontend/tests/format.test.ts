import { describe, expect, it } from 'vitest';
import {
  addDays,
  clamp,
  cx,
  dateTextToIso,
  fmtDate,
  formatBytes,
  isoToDateText,
  maskDateText,
  maskTimeText,
  normalizeText,
  normalizeTimeText,
  toDateInput,
} from '@/lib/format';

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

describe('isoToDateText — đổi ISO sang dd/MM/yyyy', () => {
  it('giữ đúng thứ tự ngày trước tháng', () => {
    expect(isoToDateText('2026-09-07')).toBe('07/09/2026');
    expect(isoToDateText('2026-12-31')).toBe('31/12/2026');
  });

  it('chấp nhận chuỗi ISO có phần giờ', () => {
    expect(isoToDateText('2026-09-07T10:30:00.000Z')).toBe('07/09/2026');
  });

  it('giá trị rỗng hoặc sai định dạng cho chuỗi rỗng', () => {
    expect(isoToDateText(null)).toBe('');
    expect(isoToDateText(undefined)).toBe('');
    expect(isoToDateText('')).toBe('');
    expect(isoToDateText('07/09/2026')).toBe('');
  });
});

describe('dateTextToIso — đổi dd/MM/yyyy sang ISO', () => {
  it('đọc đúng ngày và tháng, không lẫn kiểu Mỹ', () => {
    expect(dateTextToIso('07/09/2026')).toBe('2026-09-07');
    expect(dateTextToIso('7/9/2026')).toBe('2026-09-07');
  });

  it('loại bỏ ngày không có thật', () => {
    expect(dateTextToIso('31/02/2026')).toBeNull();
    expect(dateTextToIso('31/04/2026')).toBeNull();
    expect(dateTextToIso('00/01/2026')).toBeNull();
    expect(dateTextToIso('01/13/2026')).toBeNull();
  });

  it('nhận ngày 29/2 của năm nhuận và loại năm thường', () => {
    expect(dateTextToIso('29/02/2024')).toBe('2024-02-29');
    expect(dateTextToIso('29/02/2026')).toBeNull();
  });

  it('chuỗi chưa gõ xong hoặc rác đều trả null', () => {
    expect(dateTextToIso('')).toBeNull();
    expect(dateTextToIso('07/09')).toBeNull();
    expect(dateTextToIso('abc')).toBeNull();
  });

  it('khứ hồi với isoToDateText giữ nguyên giá trị', () => {
    expect(dateTextToIso(isoToDateText('2026-09-07'))).toBe('2026-09-07');
  });
});

describe('maskDateText — tự chèn dấu gạch chéo khi gõ', () => {
  it('chèn dấu theo số ký tự đã gõ', () => {
    expect(maskDateText('0')).toBe('0');
    expect(maskDateText('07')).toBe('07');
    expect(maskDateText('079')).toBe('07/9');
    expect(maskDateText('0709')).toBe('07/09');
    expect(maskDateText('07092026')).toBe('07/09/2026');
  });

  it('bỏ ký tự không phải số và cắt phần thừa', () => {
    expect(maskDateText('07/09/2026')).toBe('07/09/2026');
    expect(maskDateText('a0b7c0d9e2f0g2h6')).toBe('07/09/2026');
    expect(maskDateText('070920261234')).toBe('07/09/2026');
  });
});

describe('normalizeTimeText — chuẩn hóa giờ 24', () => {
  it('thêm số 0 ở đầu và giữ đúng giờ 24', () => {
    expect(normalizeTimeText('7:30')).toBe('07:30');
    expect(normalizeTimeText('07:30')).toBe('07:30');
    expect(normalizeTimeText('23:59')).toBe('23:59');
    expect(normalizeTimeText('00:00')).toBe('00:00');
  });

  it('loại giờ hoặc phút không có thật', () => {
    expect(normalizeTimeText('24:00')).toBeNull();
    expect(normalizeTimeText('12:60')).toBeNull();
    expect(normalizeTimeText('-1:00')).toBeNull();
  });

  it('không nhận định dạng 12 giờ kèm AM/PM', () => {
    expect(normalizeTimeText('03:04 PM')).toBeNull();
    expect(normalizeTimeText('3:04PM')).toBeNull();
  });

  it('chuỗi dở dang hoặc rác trả null', () => {
    expect(normalizeTimeText('')).toBeNull();
    expect(normalizeTimeText('07')).toBeNull();
    expect(normalizeTimeText('07:3')).toBeNull();
  });
});

describe('maskTimeText — tự chèn dấu hai chấm khi gõ', () => {
  it('chèn dấu sau hai chữ số đầu', () => {
    expect(maskTimeText('0')).toBe('0');
    expect(maskTimeText('07')).toBe('07');
    expect(maskTimeText('073')).toBe('07:3');
    expect(maskTimeText('0730')).toBe('07:30');
  });

  it('bỏ ký tự không phải số và cắt phần thừa', () => {
    expect(maskTimeText('07:30')).toBe('07:30');
    expect(maskTimeText('07:30 PM')).toBe('07:30');
    expect(maskTimeText('073099')).toBe('07:30');
  });
});
