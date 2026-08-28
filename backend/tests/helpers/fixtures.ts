import { Prisma, type Class, type CriteriaSet, type Criterion, type ScoreEntry } from '@prisma/client';

/**
 * Bộ dựng dữ liệu mẫu cho unit test.
 * Trả về đối tượng đầy đủ kiểu để không phải ép kiểu trong từng bài test.
 */

const now = new Date('2026-08-23T00:00:00.000Z');

const base = (id: string) => ({
  id,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  revision: 1,
});

const dec = (value: number | null): Prisma.Decimal | null =>
  value === null ? null : new Prisma.Decimal(value);

export function makeCriterion(overrides: Partial<Criterion> & { id: string }): Criterion {
  return {
    ...base(overrides.id),
    criteriaSetId: 'set-1',
    code: 'NN01',
    groupName: 'Nề nếp',
    name: 'Thực hiện nề nếp chung',
    description: null,
    dataType: 'SCORE',
    points: new Prisma.Decimal(0),
    minValue: dec(-20),
    maxValue: dec(20),
    decimals: 1,
    weight: new Prisma.Decimal(1),
    sortOrder: 1,
    color: '#0b6bcb',
    evidenceRequired: false,
    active: true,
    sourceCriteriaId: null,
    isSample: false,
    ...overrides,
  };
}

export function makeCriteriaSet(overrides: Partial<CriteriaSet> = {}): CriteriaSet {
  return {
    ...base('set-1'),
    schoolYearId: 'year-1',
    semesterId: null,
    campusId: null,
    name: 'Bộ tiêu chí kiểm thử',
    version: '1.0',
    formula: 'BASE',
    baseScore: new Prisma.Decimal(100),
    status: 'ACTIVE',
    effectiveFrom: null,
    effectiveTo: null,
    basis: null,
    lockedVersion: false,
    sourceSetId: null,
    isSample: false,
    ...overrides,
  };
}

export function makeClass(overrides: Partial<Class> & { id: string; className: string }): Class {
  return {
    ...base(overrides.id),
    schoolYearId: 'year-1',
    campusId: 'campus-1',
    code: null,
    className: overrides.className,
    grade: 6,
    teacher: null,
    homeroomTeacherId: null,
    active: true,
    isSample: false,
    ...overrides,
  };
}

export function makeEntry(
  overrides: Partial<ScoreEntry> & { id: string; classId: string; criteriaId: string },
): ScoreEntry {
  return {
    ...base(overrides.id),
    sheetId: 'sheet-1',
    schoolYearId: 'year-1',
    semesterId: null,
    campusId: 'campus-1',
    weekId: 'week-1',
    classId: overrides.classId,
    criteriaId: overrides.criteriaId,
    entryState: 'VALUE',
    value: new Prisma.Decimal(0),
    reason: null,
    ...overrides,
  };
}

/** Giá trị điểm dạng Decimal, viết ngắn cho dễ đọc trong test. */
export const d = (value: number): Prisma.Decimal => new Prisma.Decimal(value);
