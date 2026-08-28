import '../setup/test-env';

import { describe, expect, it } from 'vitest';
import { scopeWhere } from '../../src/lib/scope';
import { backoffSeconds } from '../../src/modules/auth/auth.service';

const YEAR = '11111111-1111-4111-8111-111111111111';
const SEMESTER = '22222222-2222-4222-8222-222222222222';
const CAMPUS = '33333333-3333-4333-8333-333333333333';
const WEEK = '44444444-4444-4444-8444-444444444444';

describe('scopeWhere — dịch phạm vi thành mệnh đề WHERE', () => {
  it('luôn loại bản ghi đã xóa mềm', () => {
    expect(scopeWhere({})).toMatchObject({ deletedAt: null });
  });

  it('lọc theo năm học khi được chỉ định', () => {
    expect(scopeWhere({ yearId: YEAR })).toMatchObject({ schoolYearId: YEAR });
  });

  it('bỏ qua học kỳ khi chọn "all"', () => {
    const where = scopeWhere({ yearId: YEAR, semesterId: 'all' }, { semester: true });
    expect(where.OR).toBeUndefined();
  });

  it('học kỳ cụ thể vẫn lấy bản ghi có semesterId rỗng', () => {
    // NULL nghĩa là "áp dụng cho mọi học kỳ" — giữ đúng ngữ nghĩa bản gốc.
    const where = scopeWhere({ yearId: YEAR, semesterId: SEMESTER }, { semester: true });
    expect(where.OR).toEqual([{ semesterId: null }, { semesterId: SEMESTER }]);
  });

  it('cơ sở cụ thể vẫn lấy bản ghi áp dụng toàn trường', () => {
    const where = scopeWhere({ yearId: YEAR, campusId: CAMPUS }, { campus: true });
    expect(where.OR).toEqual([{ campusId: null }, { campusId: CAMPUS }]);
  });

  it('lọc đồng thời học kỳ và cơ sở thì gộp bằng AND, không ghi đè nhau', () => {
    const where = scopeWhere(
      { yearId: YEAR, semesterId: SEMESTER, campusId: CAMPUS },
      { semester: true, campus: true },
    );
    expect(where.OR).toBeUndefined();
    expect(where.AND).toEqual([
      { OR: [{ semesterId: null }, { semesterId: SEMESTER }] },
      { OR: [{ campusId: null }, { campusId: CAMPUS }] },
    ]);
  });

  it('chỉ lọc theo tuần khi bảng có cột week_id', () => {
    expect(scopeWhere({ yearId: YEAR, weekId: WEEK }, { week: true })).toMatchObject({
      weekId: WEEK,
    });
    expect(scopeWhere({ yearId: YEAR, weekId: WEEK })).not.toHaveProperty('weekId');
  });

  it('không lọc theo trường mà bảng không có', () => {
    const where = scopeWhere({ yearId: YEAR, semesterId: SEMESTER, campusId: CAMPUS });
    expect(where.OR).toBeUndefined();
    expect(where.AND).toBeUndefined();
  });
});

describe('backoffSeconds — chống dò mật khẩu', () => {
  it('hai lần sai đầu không phải chờ', () => {
    expect(backoffSeconds(0)).toBe(0);
    expect(backoffSeconds(1)).toBe(0);
    expect(backoffSeconds(2)).toBe(0);
  });

  it('từ lần thứ ba trở đi chờ theo lũy thừa 2', () => {
    expect(backoffSeconds(3)).toBe(1);
    expect(backoffSeconds(4)).toBe(2);
    expect(backoffSeconds(5)).toBe(4);
    expect(backoffSeconds(6)).toBe(8);
    expect(backoffSeconds(7)).toBe(16);
  });

  it('chặn trên ở 30 giây, đúng như bản gốc', () => {
    expect(backoffSeconds(8)).toBe(30);
    expect(backoffSeconds(20)).toBe(30);
    expect(backoffSeconds(100)).toBe(30);
  });
});
