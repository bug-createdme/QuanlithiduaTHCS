import '../setup/test-env';

import type { Task } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/lib/errors';
import { assertDateOrder, parseChecklist, resolveRepeatNext } from '../../src/modules/tasks/task.service';

describe('parseChecklist — textarea thành danh sách mục', () => {
  it('mỗi dòng là một mục', () => {
    expect(parseChecklist('Mục A\nMục B')).toEqual([
      { label: 'Mục A', required: false },
      { label: 'Mục B', required: false },
    ]);
  });

  it('tiền tố ! đánh dấu mục bắt buộc và bị loại khỏi nhãn', () => {
    expect(parseChecklist('! Kiểm tra khu vực trực')).toEqual([
      { label: 'Kiểm tra khu vực trực', required: true },
    ]);
  });

  it('chấp nhận ! sát chữ, không cần khoảng trắng', () => {
    expect(parseChecklist('!Ghi nhận nề nếp')).toEqual([
      { label: 'Ghi nhận nề nếp', required: true },
    ]);
  });

  it('bỏ dòng trống và khoảng trắng thừa', () => {
    expect(parseChecklist('  Mục A  \n\n\n  ! Mục B \n   ')).toEqual([
      { label: 'Mục A', required: false },
      { label: 'Mục B', required: true },
    ]);
  });

  it('chuỗi rỗng hoặc null cho mảng rỗng', () => {
    expect(parseChecklist('')).toEqual([]);
    expect(parseChecklist(null)).toEqual([]);
    expect(parseChecklist(undefined)).toEqual([]);
  });

  it('dòng chỉ có dấu ! bị bỏ vì không còn nhãn', () => {
    expect(parseChecklist('!\n! ')).toEqual([]);
  });
});

describe('assertDateOrder — hạn phải từ ngày bắt đầu trở đi', () => {
  it('cho qua khi hạn bằng hoặc sau ngày bắt đầu', () => {
    expect(() => assertDateOrder('2026-08-20', '2026-08-23')).not.toThrow();
    expect(() => assertDateOrder('2026-08-23', '2026-08-23')).not.toThrow();
  });

  it('chặn khi hạn trước ngày bắt đầu, đúng câu chữ bản gốc', () => {
    expect(() => assertDateOrder('2026-08-23', '2026-08-20')).toThrowError(AppError);
    expect(() => assertDateOrder('2026-08-23', '2026-08-20')).toThrowError(
      'Hạn hoàn thành phải từ ngày bắt đầu trở đi.',
    );
  });

  it('bỏ qua kiểm tra khi thiếu một trong hai mốc', () => {
    expect(() => assertDateOrder(null, '2026-08-20')).not.toThrow();
    expect(() => assertDateOrder('2026-08-23', null)).not.toThrow();
  });
});

describe('resolveRepeatNext — mốc lặp kế tiếp khi lưu công việc', () => {
  const task = (overrides: Partial<Task>): Task =>
    ({
      repeatRule: 'NONE',
      repeatNextAt: null,
      ...overrides,
    }) as Task;

  it('không lặp thì không có mốc kế tiếp', () => {
    expect(resolveRepeatNext({ repeatRule: 'NONE', dueDate: '2026-08-23' }, null)).toBeNull();
  });

  it('công việc mới có lặp thì tính mốc từ hạn hiện tại', () => {
    const next = resolveRepeatNext({ repeatRule: 'WEEKLY', dueDate: '2026-08-23' }, null);
    expect(next?.toISOString().slice(0, 10)).toBe('2026-08-30');
  });

  it('đổi chu kỳ thì tính lại mốc', () => {
    const existing = task({ repeatRule: 'DAILY', repeatNextAt: new Date('2026-08-24T00:00:00Z') });
    const next = resolveRepeatNext({ repeatRule: 'MONTHLY', dueDate: '2026-08-23' }, existing);
    expect(next?.toISOString().slice(0, 10)).toBe('2026-09-23');
  });

  it('giữ nguyên chu kỳ thì không dời mốc đang chờ', () => {
    const pending = new Date('2026-08-30T00:00:00Z');
    const existing = task({ repeatRule: 'WEEKLY', repeatNextAt: pending });
    expect(resolveRepeatNext({ repeatRule: 'WEEKLY', dueDate: '2026-08-23' }, existing)).toBe(pending);
  });

  it('có chu kỳ nhưng chưa có mốc thì khởi tạo mốc', () => {
    const existing = task({ repeatRule: 'WEEKLY', repeatNextAt: null });
    const next = resolveRepeatNext({ repeatRule: 'WEEKLY', dueDate: '2026-08-23' }, existing);
    expect(next?.toISOString().slice(0, 10)).toBe('2026-08-30');
  });
});
