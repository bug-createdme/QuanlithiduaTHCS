/**
 * Seed — tái hiện chính xác ensureSeed() của website gốc, cộng thêm:
 *   • tài khoản đăng nhập thật (thay mật khẩu hard-code "admin@")
 *   • 21 danh mục cấu hình động + ~120 mục
 *   • 16 mẫu công việc (bản gốc hard-code trong JS)
 *
 * Chạy lại an toàn: nếu đã có trường thì bỏ qua toàn bộ.
 *   npm run seed
 */
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  CONFIG_COLORS,
  CONFIG_DEFINITIONS,
  DEFAULT_APP_SETTINGS,
  SAMPLE_CRITERIA,
  TASK_TEMPLATES,
  slugCode,
} from './seed-data';

// ── Tiện ích cục bộ (seed không import từ src/ để chạy độc lập) ─────────────

const localISO = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const toDate = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

const addDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return localISO(d);
};

const normalize = (v: string): string =>
  v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .trim();

const todayISO = localISO(new Date());

export interface SeedOptions {
  /** Tắt log để bộ kiểm thử không bị nhiễu đầu ra. */
  quiet?: boolean;
  /** Bỏ qua kiểm tra "đã có dữ liệu" — dùng khi database vừa được dọn sạch. */
  force?: boolean;
}

/**
 * Nạp dữ liệu khởi tạo. Tách thành hàm để cả CLI lẫn bộ kiểm thử
 * dùng chung một nguồn sự thật, không phải chạy lại qua tiến trình con.
 */
export async function seedDatabase(
  prisma: PrismaClient,
  options: SeedOptions = {},
): Promise<void> {
  const log = options.quiet ? () => {} : (message: string) => console.log(message);

  if (!options.force && (await prisma.school.count()) > 0) {
    log('⏭  Đã có dữ liệu trường — bỏ qua seed. Dùng `npm run db:reset` nếu muốn tạo lại.');
    return;
  }

  log('🌱 Bắt đầu seed dữ liệu…');

  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
  const adminUsername = process.env.SEED_ADMIN_USERNAME ?? 'admin';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin@';
  const adminFullName = process.env.SEED_ADMIN_FULLNAME ?? 'Tổng phụ trách Đội';

  await prisma.$transaction(
    async (tx) => {
      // ── 1. Tài khoản quản trị ─────────────────────────────────────────────
      // Bản gốc dùng mật khẩu "admin@" hard-code trong mã public.
      // Ở đây mật khẩu được băm bcrypt và BUỘC đổi ở lần đăng nhập đầu tiên.
      await tx.user.create({
        data: {
          username: adminUsername,
          fullName: adminFullName,
          passwordHash: await bcrypt.hash(adminPassword, rounds),
          role: 'ADMIN',
          mustChangePassword: true,
          autoLockMinutes: 10,
        },
      });
      log(`   ✓ Tài khoản quản trị: ${adminUsername}`);

      // ── 2. Trường và cơ sở ────────────────────────────────────────────────
      const school = await tx.school.create({
        data: {
          name: 'TRƯỜNG THCS (CHƯA CẤU HÌNH)',
          code: '',
          address: '',
          reporterTitle: 'Tổng phụ trách Đội',
          isSample: true,
        },
      });

      const [campus1, campus2] = await Promise.all([
        tx.campus.create({ data: { schoolId: school.id, name: 'Cơ sở 1', code: 'CS1' } }),
        tx.campus.create({ data: { schoolId: school.id, name: 'Cơ sở 2', code: 'CS2' } }),
      ]);
      log('   ✓ 1 trường, 2 cơ sở');

      // ── 3. Năm học 2026–2027 ──────────────────────────────────────────────
      const yearStart = '2026-08-15';
      const yearEnd = '2027-05-31';
      const year = await tx.schoolYear.create({
        data: {
          schoolId: school.id,
          name: '2026–2027',
          startDate: toDate(yearStart),
          endDate: toDate(yearEnd),
          isCurrent: true,
          status: 'OPEN',
        },
      });

      const semester1 = await tx.semester.create({
        data: {
          schoolYearId: year.id,
          name: 'Học kỳ I',
          startDate: toDate('2026-08-15'),
          endDate: toDate('2027-01-10'),
          sortOrder: 1,
        },
      });
      const semester2 = await tx.semester.create({
        data: {
          schoolYearId: year.id,
          name: 'Học kỳ II',
          startDate: toDate('2027-01-11'),
          endDate: toDate('2027-05-31'),
          sortOrder: 2,
        },
      });
      log('   ✓ Năm học 2026–2027 + 2 học kỳ');

      // ── 4. 40 tuần học, bắt đầu 2026-08-17 (đúng bản gốc) ─────────────────
      const weekRows: Prisma.SchoolWeekCreateManyInput[] = [];
      let cursor = '2026-08-17';
      for (let i = 1; i <= 40; i += 1) {
        const end = addDays(cursor, 6);
        // Tuần thuộc học kỳ nào là do ngày bắt đầu quyết định.
        const semesterId = cursor <= '2027-01-10' ? semester1.id : semester2.id;
        weekRows.push({
          schoolYearId: year.id,
          semesterId,
          number: i,
          name: `Tuần ${i}`,
          startDate: toDate(cursor),
          endDate: toDate(end),
        });
        cursor = addDays(cursor, 7);
      }
      await tx.schoolWeek.createMany({ data: weekRows });
      log('   ✓ 40 tuần học');

      // ── 5. 16 lớp: khối 6–9 × 2 lớp × 2 cơ sở ─────────────────────────────
      const classRows: Prisma.ClassCreateManyInput[] = [];
      for (const [campus, prefix] of [
        [campus1, 'A'],
        [campus2, 'B'],
      ] as const) {
        for (let grade = 6; grade <= 9; grade += 1) {
          for (let n = 1; n <= 2; n += 1) {
            classRows.push({
              schoolYearId: year.id,
              campusId: campus.id,
              grade,
              className: `${grade}/${prefix}${n}`,
              teacher: '',
              active: true,
              isSample: true,
            });
          }
        }
      }
      await tx.class.createMany({ data: classRows });
      log(`   ✓ ${classRows.length} lớp`);

      // ── 6. Bộ tiêu chí mẫu + 5 tiêu chí ───────────────────────────────────
      const criteriaSet = await tx.criteriaSet.create({
        data: {
          schoolYearId: year.id,
          name: 'Mẫu tham khảo – cần nhà trường phê duyệt trước khi sử dụng',
          version: '1.0',
          formula: 'BASE',
          baseScore: new Prisma.Decimal(100),
          status: 'DRAFT',
          effectiveFrom: toDate(yearStart),
          basis: 'Mẫu nội bộ, chưa phải quy định bắt buộc.',
          isSample: true,
        },
      });

      await tx.criterion.createMany({
        data: SAMPLE_CRITERIA.map(([code, groupName, name, points, min, max], i) => ({
          criteriaSetId: criteriaSet.id,
          code,
          groupName,
          name,
          dataType: 'SCORE' as const,
          points: new Prisma.Decimal(points),
          minValue: new Prisma.Decimal(min),
          maxValue: new Prisma.Decimal(max),
          weight: new Prisma.Decimal(1),
          evidenceRequired: false,
          sortOrder: i + 1,
          active: true,
          isSample: true,
        })),
      });
      log('   ✓ 1 bộ tiêu chí + 5 tiêu chí');

      // ── 7. 3 công việc mẫu ────────────────────────────────────────────────
      await tx.task.createMany({
        data: [
          {
            schoolYearId: year.id,
            campusId: null,
            title: 'Chuẩn bị nội dung sinh hoạt dưới cờ',
            groupName: 'Hằng tuần',
            startDate: toDate(todayISO),
            dueDate: toDate(todayISO),
            priority: 'HIGH' as const,
            status: 'DOING' as const,
            progress: 40,
            isSample: true,
          },
          {
            schoolYearId: year.id,
            campusId: campus1.id,
            title: 'Rà soát lớp chưa nhập thi đua',
            groupName: 'Thi đua',
            startDate: toDate(todayISO),
            dueDate: toDate(todayISO),
            priority: 'NORMAL' as const,
            status: 'TODO' as const,
            progress: 0,
            isSample: true,
          },
          {
            schoolYearId: year.id,
            campusId: campus2.id,
            title: 'Kiểm tra hồ sơ Chi đội',
            groupName: 'Tổ chức Đội',
            startDate: toDate(todayISO),
            dueDate: toDate(addDays(todayISO, 2)),
            priority: 'NORMAL' as const,
            status: 'TODO' as const,
            progress: 0,
            isSample: true,
          },
        ],
      });
      log('   ✓ 3 công việc mẫu');

      // ── 8. 21 danh mục cấu hình + toàn bộ mục mặc định ────────────────────
      let itemCount = 0;
      for (const [index, [key, name, labels]] of CONFIG_DEFINITIONS.entries()) {
        const category = await tx.configCategory.create({
          data: { key, name, sortOrder: index + 1 },
        });
        const seen = new Set<string>();
        await tx.configItem.createMany({
          data: labels.map((label, i) => {
            // Bảo đảm mã duy nhất trong danh mục kể cả khi hai nhãn trùng slug.
            let code = slugCode(label);
            let suffix = 2;
            while (seen.has(code)) code = `${slugCode(label)}_${suffix++}`;
            seen.add(code);
            return {
              categoryId: category.id,
              categoryKey: key,
              label,
              code,
              color: CONFIG_COLORS[i % CONFIG_COLORS.length]!,
              icon: '•',
              sortOrder: i + 1,
              active: true,
              isDefault: true,
              searchText: normalize(label),
            };
          }),
        });
        itemCount += labels.length;
      }
      log(`   ✓ ${CONFIG_DEFINITIONS.length} danh mục cấu hình + ${itemCount} mục`);

      // ── 9. 16 mẫu công việc ───────────────────────────────────────────────
      await tx.taskTemplate.createMany({
        data: TASK_TEMPLATES.map((title, i) => ({
          title,
          groupName: 'Mẫu tham khảo',
          defaultDueOffsetDays: 7,
          sortOrder: i + 1,
          active: true,
        })),
      });
      log(`   ✓ ${TASK_TEMPLATES.length} mẫu công việc`);

      // ── 10. Thiết lập ứng dụng ────────────────────────────────────────────
      await tx.appSetting.createMany({
        data: DEFAULT_APP_SETTINGS.map(([key, value]) => ({
          key,
          value: value as Prisma.InputJsonValue,
        })),
      });
      log(`   ✓ ${DEFAULT_APP_SETTINGS.length} thiết lập mặc định`);
    },
    { timeout: 120_000, maxWait: 20_000 },
  );

  log('\n✅ Seed hoàn tất.');
  log(`   Đăng nhập: ${adminUsername} / ${adminPassword}  (buộc đổi mật khẩu lần đầu)`);
}

/**
 * Điểm vào dòng lệnh — chỉ chạy khi gọi trực tiếp (`npm run seed`),
 * không chạy khi tệp bị import từ bộ kiểm thử.
 */
if (require.main === module) {
  const cli = new PrismaClient();
  seedDatabase(cli)
    .catch((error: unknown) => {
      console.error('❌ Seed thất bại:', error);
      process.exitCode = 1;
    })
    .finally(() => {
      void cli.$disconnect();
    });
}
