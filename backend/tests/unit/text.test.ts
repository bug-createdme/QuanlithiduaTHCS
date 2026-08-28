import '../setup/test-env';

import { describe, expect, it } from 'vitest';
import {
  buildSearchText,
  compareVietnamese,
  csvSafe,
  formatBytes,
  nextVersion,
  normalizeText,
  stableJson,
  toCsv,
} from '../../src/lib/text';

describe('normalizeText — bỏ dấu tiếng Việt', () => {
  it('bỏ toàn bộ dấu thanh và dấu mũ', () => {
    expect(normalizeText('Thi đua lớp')).toBe('thi dua lop');
    expect(normalizeText('Nề nếp')).toBe('ne nep');
    expect(normalizeText('Rèn luyện đội viên')).toBe('ren luyen doi vien');
  });

  it('xử lý riêng chữ đ/Đ mà NFD không tách được', () => {
    expect(normalizeText('Đội')).toBe('doi');
    expect(normalizeText('ĐỘI TNTP')).toBe('doi tntp');
  });

  it('gộp khoảng trắng thừa và cắt hai đầu', () => {
    expect(normalizeText('  Tổng   phụ  trách  ')).toBe('tong phu trach');
  });

  it('giá trị rỗng cho chuỗi rỗng', () => {
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(undefined)).toBe('');
  });
});

describe('buildSearchText', () => {
  it('ghép nhiều trường và bỏ giá trị trống', () => {
    expect(buildSearchText('Kế hoạch tuần', null, 'Số 12/KH', '')).toBe('ke hoach tuan so 12/kh');
  });
});

describe('compareVietnamese — sắp xếp tên lớp', () => {
  it('so sánh phần số theo giá trị, không theo ký tự', () => {
    expect(compareVietnamese('6/A2', '6/A10')).toBeLessThan(0);
  });

  it('sắp đúng cả danh sách lớp', () => {
    const sorted = ['6/A10', '6/A2', '7/A1', '6/A1'].sort(compareVietnamese);
    expect(sorted).toEqual(['6/A1', '6/A2', '6/A10', '7/A1']);
  });
});

describe('csvSafe — chống lộ công thức khi mở bằng Excel', () => {
  it('bọc nháy kép và nhân đôi nháy bên trong', () => {
    expect(csvSafe('Nề nếp')).toBe('"Nề nếp"');
    expect(csvSafe('Ghi "chú"')).toBe('"Ghi ""chú"""');
  });

  it('thêm nháy đơn trước ký tự khởi tạo công thức', () => {
    // Nếu không chặn, Excel sẽ thực thi các ô này như công thức.
    expect(csvSafe('=1+1')).toBe(`"'=1+1"`);
    expect(csvSafe('+84912345678')).toBe(`"'+84912345678"`);
    expect(csvSafe('-5')).toBe(`"'-5"`);
    expect(csvSafe('@SUM(A1)')).toBe(`"'@SUM(A1)"`);
  });

  it('giá trị rỗng cho ô rỗng hợp lệ', () => {
    expect(csvSafe(null)).toBe('""');
    expect(csvSafe(undefined)).toBe('""');
  });
});

describe('toCsv', () => {
  const csv = toCsv(['Lớp', 'Điểm'], [['6/A1', 95], ['6/A2', 88]]);

  it('bắt đầu bằng BOM UTF-8 để Excel đọc đúng tiếng Việt', () => {
    expect(csv.codePointAt(0)).toBe(0xfeff);
  });

  it('dùng CRLF giữa các dòng', () => {
    expect(csv).toContain('\r\n');
    expect(csv.split('\r\n')).toHaveLength(3);
  });

  it('giữ nguyên thứ tự cột và dòng', () => {
    // BOM đứng đầu cả chuỗi nên nằm trong dòng đầu tiên; bỏ ra để so nội dung.
    const lines = csv.replace(/^\uFEFF/, '').split('\r\n');
    expect(lines[0]).toBe('"Lớp","Điểm"');
    expect(lines[1]).toBe('"6/A1","95"');
    expect(lines[2]).toBe('"6/A2","88"');
  });
});

describe('stableJson — chuỗi hoá ổn định để tính checksum', () => {
  it('cùng nội dung khác thứ tự khóa cho cùng kết quả', () => {
    expect(stableJson({ b: 1, a: 2 })).toBe(stableJson({ a: 2, b: 1 }));
  });

  it('lồng nhiều tầng vẫn ổn định', () => {
    const x = { outer: { z: 1, a: [{ q: 1, b: 2 }] } };
    const y = { outer: { a: [{ b: 2, q: 1 }], z: 1 } };
    expect(stableJson(x)).toBe(stableJson(y));
  });

  it('nội dung khác nhau cho kết quả khác nhau', () => {
    expect(stableJson({ a: 1 })).not.toBe(stableJson({ a: 2 }));
  });

  it('không vỡ khi gặp tham chiếu vòng', () => {
    const node: Record<string, unknown> = { name: 'x' };
    node.self = node;
    expect(() => stableJson(node)).not.toThrow();
  });

  it('chuyển Date về chuỗi ISO', () => {
    expect(stableJson({ at: new Date('2026-08-23T00:00:00.000Z') })).toContain('2026-08-23');
  });
});

describe('nextVersion — nhân bản bộ tiêu chí', () => {
  it('tăng số cuối', () => {
    expect(nextVersion('1.0')).toBe('1.1');
    expect(nextVersion('1.9')).toBe('1.10');
    expect(nextVersion('2.3.4')).toBe('2.3.5');
  });

  it('giá trị trống mặc định thành 1.1', () => {
    expect(nextVersion(null)).toBe('1.1');
    expect(nextVersion(undefined)).toBe('1.1');
  });
});

describe('formatBytes', () => {
  it('hiển thị đơn vị phù hợp', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1024 * 1024 * 5)).toBe('5.0 MB');
  });
});
