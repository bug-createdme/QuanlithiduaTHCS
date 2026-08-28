import '../setup/test-env';

import { PrismaClient } from '@prisma/client';
import { seedDatabase } from '../../prisma/seed';

/** Một kết nối dùng chung cho toàn bộ tệp test hiện tại. */
export const prisma = new PrismaClient();

/** Bảng do Prisma quản lý, không được xóa. */
const PROTECTED_TABLES = new Set(['_prisma_migrations']);

let cachedTables: string[] | null = null;

async function listTables(): Promise<string[]> {
  if (cachedTables) return cachedTables;
  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;
  cachedTables = rows.map((r) => r.tablename).filter((t) => !PROTECTED_TABLES.has(t));
  return cachedTables;
}

/**
 * Đưa database test về đúng trạng thái sau khi seed.
 *
 * Dùng TRUNCATE … CASCADE thay vì xóa từng bảng theo thứ tự khóa ngoại:
 * nhanh hơn nhiều và không phụ thuộc thứ tự phụ thuộc.
 */
export async function resetDatabase(): Promise<void> {
  const tables = await listTables();
  const quoted = tables.map((t) => `"public"."${t}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
  await seedDatabase(prisma, { quiet: true, force: true });
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}

/** Lấy nhanh các mốc dữ liệu seed mà hầu hết test đều cần. */
export async function seedContext() {
  const year = await prisma.schoolYear.findFirstOrThrow({ where: { isCurrent: true } });
  const [semesters, weeks, classes, campuses, criteriaSet] = await Promise.all([
    prisma.semester.findMany({ where: { schoolYearId: year.id }, orderBy: { sortOrder: 'asc' } }),
    prisma.schoolWeek.findMany({ where: { schoolYearId: year.id }, orderBy: { number: 'asc' } }),
    prisma.class.findMany({ where: { schoolYearId: year.id }, orderBy: { className: 'asc' } }),
    prisma.campus.findMany({ orderBy: { code: 'asc' } }),
    prisma.criteriaSet.findFirstOrThrow({ where: { schoolYearId: year.id } }),
  ]);
  const criteria = await prisma.criterion.findMany({
    where: { criteriaSetId: criteriaSet.id },
    orderBy: { sortOrder: 'asc' },
  });
  return { year, semesters, weeks, classes, campuses, criteriaSet, criteria };
}
