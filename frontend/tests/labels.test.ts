import { describe, expect, it } from 'vitest';
import {
  CRITERION_DATA_TYPE_LABEL,
  REPEAT_RULE_LABEL,
  SHEET_STATUS_LABEL,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  statusLabel,
  statusTone,
  toOptions,
} from '@/lib/labels';
import type {
  CriterionDataType,
  RepeatRule,
  SheetStatus,
  TaskPriority,
  TaskStatus,
} from '@/types';

/**
 * Các bảng nhãn phải phủ hết giá trị enum của backend.
 * Thiếu một giá trị là giao diện sẽ hiện mã thô kiểu "WAITING" cho người dùng.
 */
describe('Bảng nhãn phủ hết enum', () => {
  it('trạng thái công việc đủ 6 giá trị', () => {
    const expected: TaskStatus[] = ['TODO', 'DOING', 'WAITING', 'REVIEW', 'DONE', 'PAUSED'];
    expect(Object.keys(TASK_STATUS_LABEL).sort()).toEqual([...expected].sort());
  });

  it('mức ưu tiên đủ 4 giá trị', () => {
    const expected: TaskPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
    expect(Object.keys(TASK_PRIORITY_LABEL).sort()).toEqual([...expected].sort());
  });

  it('chu kỳ lặp đủ 5 giá trị', () => {
    const expected: RepeatRule[] = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
    expect(Object.keys(REPEAT_RULE_LABEL).sort()).toEqual([...expected].sort());
  });

  it('trạng thái bảng thi đua đủ 6 giá trị của quy trình', () => {
    const expected: SheetStatus[] = [
      'DRAFT',
      'COMPLETE',
      'REVIEW',
      'APPROVED',
      'LOCKED',
      'UNLOCKED',
    ];
    expect(Object.keys(SHEET_STATUS_LABEL).sort()).toEqual([...expected].sort());
  });

  it('kiểu dữ liệu tiêu chí đủ 5 giá trị', () => {
    const expected: CriterionDataType[] = ['SCORE', 'COUNT', 'BOOLEAN', 'CHOICE', 'NOTE'];
    expect(Object.keys(CRITERION_DATA_TYPE_LABEL).sort()).toEqual([...expected].sort());
  });

  it('mọi nhãn đều là tiếng Việt, không lọt mã thô', () => {
    const all = { ...TASK_STATUS_LABEL, ...SHEET_STATUS_LABEL, ...REPEAT_RULE_LABEL };
    for (const [code, label] of Object.entries(all)) {
      expect(label).not.toBe(code);
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

describe('statusLabel — tra nhãn qua nhiều bảng', () => {
  it('tìm được nhãn ở bảng bất kỳ', () => {
    expect(statusLabel('DONE')).toBe('Hoàn thành');
    expect(statusLabel('LOCKED')).toBe('Đã khóa');
    expect(statusLabel('NOT_SUBMITTED')).toBe('Chưa gửi');
  });

  it('giá trị rỗng cho dấu gạch ngang', () => {
    expect(statusLabel(null)).toBe('—');
    expect(statusLabel(undefined)).toBe('—');
  });

  it('giá trị lạ trả nguyên văn thay vì rỗng', () => {
    expect(statusLabel('GIA_TRI_LA')).toBe('GIA_TRI_LA');
  });
});

describe('statusTone — màu badge theo trạng thái', () => {
  it('trạng thái tích cực dùng tông xanh lá', () => {
    expect(statusTone('DONE')).toBe('green');
    expect(statusTone('APPROVED')).toBe('green');
    expect(statusTone('LOCKED')).toBe('green');
  });

  it('trạng thái đang xử lý dùng tông xanh dương', () => {
    expect(statusTone('DOING')).toBe('blue');
    expect(statusTone('REVIEW')).toBe('blue');
  });

  it('trạng thái cần chú ý dùng tông đỏ', () => {
    expect(statusTone('OVERDUE')).toBe('red');
    expect(statusTone('URGENT')).toBe('red');
  });

  it('mặc định là tông vàng, giữ đúng quy tắc của bản gốc', () => {
    expect(statusTone('TODO')).toBe('yellow');
    expect(statusTone('WAITING')).toBe('yellow');
  });

  it('giá trị rỗng dùng tông trung tính', () => {
    expect(statusTone(null)).toBe('default');
  });
});

describe('toOptions — dựng danh sách cho thẻ select', () => {
  it('giữ nguyên thứ tự khai báo', () => {
    const options = toOptions(TASK_STATUS_LABEL);
    expect(options[0]).toEqual({ value: 'TODO', label: 'Chưa làm' });
    expect(options).toHaveLength(6);
  });

  it('mỗi mục có đủ value và label', () => {
    for (const option of toOptions(REPEAT_RULE_LABEL)) {
      expect(option.value).toBeTruthy();
      expect(option.label).toBeTruthy();
    }
  });
});
