import '../setup/test-env';

import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/lib/errors';
import {
  WORKFLOW_LABEL,
  criterionScore,
  nextStatus,
  parseCell,
  rankClasses,
} from '../../src/modules/scores/score.service';
import { d, makeClass, makeCriteriaSet, makeCriterion, makeEntry } from '../helpers/fixtures';

describe('criterionScore — quy đổi ô nhập thành điểm', () => {
  const set = makeCriteriaSet({ formula: 'BASE' });

  it('kiểu SCORE lấy thẳng giá trị', () => {
    const criterion = makeCriterion({ id: 'c1', dataType: 'SCORE', points: d(2) });
    const entry = makeEntry({ id: 'e1', classId: 'l1', criteriaId: 'c1', value: d(-5) });
    expect(criterionScore(entry, criterion, set)).toBe(-5);
  });

  it('kiểu COUNT nhân số lần với điểm mỗi lần', () => {
    const criterion = makeCriterion({ id: 'c1', dataType: 'COUNT', points: d(3) });
    const entry = makeEntry({ id: 'e1', classId: 'l1', criteriaId: 'c1', value: d(4) });
    expect(criterionScore(entry, criterion, set)).toBe(12);
  });

  it('kiểu BOOLEAN cho trọn điểm khi đạt, 0 khi không đạt', () => {
    const criterion = makeCriterion({ id: 'c1', dataType: 'BOOLEAN', points: d(5) });
    const dat = makeEntry({ id: 'e1', classId: 'l1', criteriaId: 'c1', value: d(1) });
    const khong = makeEntry({ id: 'e2', classId: 'l1', criteriaId: 'c1', value: d(0) });
    expect(criterionScore(dat, criterion, set)).toBe(5);
    expect(criterionScore(khong, criterion, set)).toBe(0);
  });

  it('kiểu NOTE luôn bằng 0 dù nhập số gì', () => {
    const criterion = makeCriterion({ id: 'c1', dataType: 'NOTE', points: d(9) });
    const entry = makeEntry({ id: 'e1', classId: 'l1', criteriaId: 'c1', value: d(99) });
    expect(criterionScore(entry, criterion, set)).toBe(0);
  });

  it('công thức WEIGHTED nhân thêm trọng số', () => {
    const weighted = makeCriteriaSet({ formula: 'WEIGHTED' });
    const criterion = makeCriterion({ id: 'c1', dataType: 'SCORE', weight: d(2.5) });
    const entry = makeEntry({ id: 'e1', classId: 'l1', criteriaId: 'c1', value: d(4) });
    expect(criterionScore(entry, criterion, weighted)).toBe(10);
  });

  it('ô không có dữ liệu quy về 0', () => {
    const criterion = makeCriterion({ id: 'c1' });
    expect(criterionScore(null, criterion, set)).toBe(0);
    expect(criterionScore(undefined, criterion, set)).toBe(0);
  });
});

describe('rankClasses — xếp hạng thi đua', () => {
  const criteria = [
    makeCriterion({ id: 'c1', code: 'NN01', dataType: 'SCORE' }),
    makeCriterion({ id: 'c2', code: 'HT01', dataType: 'SCORE' }),
  ];
  const classes = [
    makeClass({ id: 'l1', className: '6/A1' }),
    makeClass({ id: 'l2', className: '6/A2' }),
    makeClass({ id: 'l3', className: '6/A10' }),
  ];

  const entry = (cls: string, crit: string, value: number) =>
    makeEntry({ id: `${cls}-${crit}`, classId: cls, criteriaId: crit, value: d(value) });

  it('công thức BASE bắt đầu từ điểm chuẩn rồi cộng trừ', () => {
    const rows = rankClasses(
      [classes[0]!],
      criteria,
      [entry('l1', 'c1', -3), entry('l1', 'c2', 5)],
      makeCriteriaSet({ formula: 'BASE', baseScore: d(100) }),
    );
    expect(rows[0]!.total).toBe(102);
  });

  it('công thức SUM bắt đầu từ 0', () => {
    const rows = rankClasses(
      [classes[0]!],
      criteria,
      [entry('l1', 'c1', -3), entry('l1', 'c2', 5)],
      makeCriteriaSet({ formula: 'SUM' }),
    );
    expect(rows[0]!.total).toBe(2);
  });

  it('ô KAD và MIỄN tính là đã nhập nhưng không cộng điểm', () => {
    const rows = rankClasses(
      [classes[0]!],
      criteria,
      [
        makeEntry({ id: 'a', classId: 'l1', criteriaId: 'c1', entryState: 'NA', value: null }),
        makeEntry({ id: 'b', classId: 'l1', criteriaId: 'c2', entryState: 'EXEMPT', value: null }),
      ],
      makeCriteriaSet({ formula: 'BASE', baseScore: d(100) }),
    );
    expect(rows[0]!.total).toBe(100);
    expect(rows[0]!.filled).toBe(2);
    expect(rows[0]!.complete).toBe(true);
  });

  it('loại lớp chưa nhập ô nào ra khỏi bảng xếp hạng', () => {
    const rows = rankClasses(classes, criteria, [entry('l1', 'c1', 5)], makeCriteriaSet());
    expect(rows).toHaveLength(1);
    expect(rows[0]!.classId).toBe('l1');
  });

  it('đồng điểm thì đồng hạng và hạng kế tiếp nhảy cóc', () => {
    const rows = rankClasses(
      classes,
      criteria,
      [
        entry('l1', 'c1', 10), entry('l1', 'c2', 0),
        entry('l2', 'c1', 10), entry('l2', 'c2', 0),
        entry('l3', 'c1', 1), entry('l3', 'c2', 0),
      ],
      makeCriteriaSet({ formula: 'SUM' }),
    );
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it('cùng điểm thì sắp xếp tên lớp theo thứ tự tự nhiên tiếng Việt', () => {
    // 6/A2 phải đứng trước 6/A10 (so sánh số, không so sánh chuỗi).
    const rows = rankClasses(
      [classes[2]!, classes[1]!],
      criteria,
      [entry('l3', 'c1', 5), entry('l2', 'c1', 5)],
      makeCriteriaSet({ formula: 'SUM' }),
    );
    expect(rows.map((r) => r.className)).toEqual(['6/A2', '6/A10']);
  });

  it('đánh dấu chưa đủ khi thiếu tiêu chí', () => {
    const rows = rankClasses([classes[0]!], criteria, [entry('l1', 'c1', 5)], makeCriteriaSet());
    expect(rows[0]!.complete).toBe(false);
    expect(rows[0]!.filled).toBe(1);
  });
});

describe('parseCell — diễn giải giá trị người dùng gõ', () => {
  const scoreCriterion = makeCriterion({
    id: 'c1',
    code: 'NN01',
    dataType: 'SCORE',
    minValue: d(-20),
    maxValue: d(0),
  });
  const boolCriterion = makeCriterion({
    id: 'c2',
    code: 'BL01',
    dataType: 'BOOLEAN',
    minValue: d(0),
    maxValue: d(1),
  });

  it('ô rỗng nghĩa là xóa bản ghi', () => {
    expect(parseCell('', scoreCriterion)).toEqual({ entryState: 'VALUE', value: null, clear: true });
    expect(parseCell('   ', scoreCriterion)?.clear).toBe(true);
    expect(parseCell(null, scoreCriterion)?.clear).toBe(true);
  });

  it('KAD và N/A cho trạng thái NA', () => {
    expect(parseCell('KAD', scoreCriterion)?.entryState).toBe('NA');
    expect(parseCell('kad', scoreCriterion)?.entryState).toBe('NA');
    expect(parseCell('N/A', scoreCriterion)?.entryState).toBe('NA');
  });

  it('MIỄN và MIEN cho trạng thái EXEMPT', () => {
    expect(parseCell('MIỄN', scoreCriterion)?.entryState).toBe('EXEMPT');
    expect(parseCell('miễn', scoreCriterion)?.entryState).toBe('EXEMPT');
    expect(parseCell('MIEN', scoreCriterion)?.entryState).toBe('EXEMPT');
  });

  it('chấp nhận dấu phẩy thập phân kiểu Việt Nam', () => {
    const criterion = makeCriterion({ id: 'c3', minValue: d(0), maxValue: d(20) });
    expect(parseCell('7,5', criterion)?.value).toBe(7.5);
    expect(parseCell('7.5', criterion)?.value).toBe(7.5);
  });

  it('ĐẠT/KHÔNG ĐẠT quy về 1/0 cho tiêu chí kiểu boolean', () => {
    expect(parseCell('ĐẠT', boolCriterion)?.value).toBe(1);
    expect(parseCell('DAT', boolCriterion)?.value).toBe(1);
    expect(parseCell('CÓ', boolCriterion)?.value).toBe(1);
    expect(parseCell('KHÔNG ĐẠT', boolCriterion)?.value).toBe(0);
    expect(parseCell('KHONG', boolCriterion)?.value).toBe(0);
  });

  it('giá trị ngoài [min,max] bị loại', () => {
    expect(parseCell('5', scoreCriterion)).toBeNull();
    expect(parseCell('-99', scoreCriterion)).toBeNull();
    expect(parseCell('0', scoreCriterion)?.value).toBe(0);
    expect(parseCell('-20', scoreCriterion)?.value).toBe(-20);
  });

  it('chuỗi không phải số bị loại', () => {
    expect(parseCell('abc', scoreCriterion)).toBeNull();
  });

  it('chế độ strict ném lỗi nghiệp vụ kèm thông điệp tiếng Việt', () => {
    expect(() => parseCell('abc', scoreCriterion, { strict: true })).toThrowError(AppError);
    expect(() => parseCell('5', scoreCriterion, { strict: true })).toThrowError(
      /Giá trị phải trong khoảng/,
    );
  });

  it('chế độ không strict trả null để lệnh dán bỏ qua ô hỏng', () => {
    expect(parseCell('abc', scoreCriterion, { strict: false })).toBeNull();
  });
});

describe('Quy trình bảng tuần', () => {
  it('chuyển trạng thái đúng thứ tự của bản gốc', () => {
    expect(nextStatus('DRAFT')).toBe('COMPLETE');
    expect(nextStatus('COMPLETE')).toBe('REVIEW');
    expect(nextStatus('REVIEW')).toBe('APPROVED');
    expect(nextStatus('APPROVED')).toBe('LOCKED');
    expect(nextStatus('LOCKED')).toBe('UNLOCKED');
    // Sau khi mở khóa thì quay lại bước kiểm tra, không nhảy thẳng sang duyệt.
    expect(nextStatus('UNLOCKED')).toBe('REVIEW');
  });

  it('nhãn nút giữ nguyên câu chữ của bản gốc', () => {
    expect(WORKFLOW_LABEL.DRAFT).toBe('Đánh dấu đã nhập đủ');
    expect(WORKFLOW_LABEL.COMPLETE).toBe('Gửi kiểm tra');
    expect(WORKFLOW_LABEL.REVIEW).toBe('Duyệt bảng');
    expect(WORKFLOW_LABEL.APPROVED).toBe('Khóa bảng');
    expect(WORKFLOW_LABEL.LOCKED).toBe('Mở khóa có lý do');
    expect(WORKFLOW_LABEL.UNLOCKED).toBe('Gửi kiểm tra lại');
  });
});
