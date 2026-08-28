import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authed, login, scopeQuery } from '../helpers/api';
import { disconnect, prisma, resetDatabase, seedContext } from '../helpers/db';

type Ctx = Awaited<ReturnType<typeof seedContext>>;

/**
 * Sáu trang dùng chung nhà máy CRUD ở src/lib/crud.ts.
 * Test theo bảng để mọi thực thể đều được bao phủ như nhau.
 */
interface EntityCase {
  path: string;
  label: string;
  /** Tên bảng trong PostgreSQL, khai báo tường minh thay vì suy từ đường dẫn. */
  table: string;
  /** Trường dùng để tìm kiếm và kiểm tra. */
  titleField: string;
  build: (ctx: Ctx) => Record<string, unknown>;
  /** Payload thiếu trường bắt buộc để kiểm tra validation. */
  invalid: (ctx: Ctx) => Record<string, unknown>;
}

const CASES: EntityCase[] = [
  {
    path: '/api/plans',
    table: 'plans',
    label: 'Kế hoạch',
    titleField: 'name',
    build: (ctx) => ({
      schoolYearId: ctx.year.id,
      code: 'KH01',
      name: 'Kế hoạch tuần 1',
      level: 'WEEK',
      startDate: '2026-08-17',
      endDate: '2026-08-23',
      objectives: 'Ổn định nề nếp đầu năm',
      status: 'DRAFT',
      progress: 0,
    }),
    invalid: (ctx) => ({ schoolYearId: ctx.year.id, code: 'KH02' }),
  },
  {
    path: '/api/activities',
    table: 'activities',
    label: 'Hoạt động Đội',
    titleField: 'name',
    build: (ctx) => ({
      schoolYearId: ctx.year.id,
      name: 'Lễ khai giảng',
      category: 'Truyền thống – đạo đức',
      date: '2026-09-05',
      location: 'Sân trường',
      leader: 'Thầy Hiếu',
      safety: 'Bố trí lối thoát hiểm, có nhân viên y tế trực',
      status: 'PLANNED',
    }),
    // Thiếu phương án an toàn — trường bắt buộc của bản gốc.
    invalid: (ctx) => ({
      schoolYearId: ctx.year.id,
      name: 'Thiếu an toàn',
      category: 'Môi trường',
      date: '2026-09-05',
      location: 'Sân trường',
      leader: 'Thầy Hiếu',
    }),
  },
  {
    path: '/api/organization',
    table: 'team_members',
    label: 'Tổ chức Liên đội',
    titleField: 'name',
    build: (ctx) => ({
      schoolYearId: ctx.year.id,
      name: 'Trần Thị B',
      className: '8/A1',
      unit: 'Ban Chỉ huy Liên đội',
      position: 'Liên đội trưởng',
      term: '2026–2027',
    }),
    invalid: (ctx) => ({ schoolYearId: ctx.year.id, name: 'Thiếu lớp' }),
  },
  {
    path: '/api/programs',
    table: 'program_results',
    label: 'Rèn luyện – phong trào',
    titleField: 'name',
    build: (ctx) => ({
      schoolYearId: ctx.year.id,
      name: 'Chuyên hiệu An toàn giao thông',
      scope: 'Khối 6',
      status: 'DRAFT',
    }),
    invalid: (ctx) => ({ schoolYearId: ctx.year.id, name: 'Thiếu đối tượng' }),
  },
  {
    path: '/api/commendations',
    table: 'commendations',
    label: 'Khen thưởng',
    titleField: 'recipient',
    build: (ctx) => ({
      schoolYearId: ctx.year.id,
      awardType: 'Giấy khen',
      level: 'Liên đội',
      recipient: 'Chi đội 7/A1',
      achievement: 'Dẫn đầu thi đua học kỳ I',
      approvalStatus: 'DRAFT',
    }),
    invalid: (ctx) => ({ schoolYearId: ctx.year.id, awardType: 'Giấy khen' }),
  },
  {
    path: '/api/equipment',
    table: 'equipment',
    label: 'Thiết bị Đội',
    titleField: 'name',
    build: (ctx) => ({
      schoolYearId: ctx.year.id,
      name: 'Trống Đội',
      code: 'TB01',
      quantity: 2,
      unit: 'Bộ',
      condition: 'Tốt',
    }),
    invalid: (ctx) => ({ schoolYearId: ctx.year.id, name: 'Thiếu mã' }),
  },
];

describe('Sáu thực thể dùng chung nhà máy CRUD', () => {
  let api: ReturnType<typeof authed>;
  let ctx: Ctx;
  let query: string;

  beforeAll(async () => {
    await resetDatabase();
    const session = await login();
    api = authed(session.accessToken);
    ctx = await seedContext();
    query = scopeQuery({ yearId: ctx.year.id });
  });

  afterAll(async () => {
    await disconnect();
  });

  for (const entity of CASES) {
    describe(entity.label, () => {
      let createdId: string;

      it('tạo bản ghi mới', async () => {
        const response = await api.post(entity.path).send(entity.build(ctx)).expect(201);
        createdId = response.body.data.id;
        expect(response.body.data[entity.titleField]).toBe(entity.build(ctx)[entity.titleField]);
      });

      it('thiếu trường bắt buộc trả 400 kèm chi tiết lỗi', async () => {
        const response = await api.post(entity.path).send(entity.invalid(ctx)).expect(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.issues.length).toBeGreaterThan(0);
      });

      it('lấy được chi tiết theo id', async () => {
        const response = await api.get(`${entity.path}/${createdId}`).expect(200);
        expect(response.body.data.id).toBe(createdId);
      });

      it('id không tồn tại trả 404', async () => {
        await api.get(`${entity.path}/11111111-1111-4111-8111-111111111111`).expect(404);
      });

      it('id sai định dạng trả 400', async () => {
        await api.get(`${entity.path}/khong-phai-uuid`).expect(400);
      });

      it('danh sách có phân trang', async () => {
        const response = await api.get(`${entity.path}?${query}&page=1&pageSize=10`).expect(200);
        expect(response.body.meta).toMatchObject({ page: 1, pageSize: 10 });
        expect(response.body.data.length).toBeGreaterThan(0);
      });

      it('tìm kiếm lọc đúng bản ghi', async () => {
        const keyword = String(entity.build(ctx)[entity.titleField]).slice(0, 6);
        const response = await api.get(`${entity.path}?${query}&q=${encodeURIComponent(keyword)}`).expect(200);
        expect(response.body.data.length).toBeGreaterThan(0);
      });

      it('cập nhật ghi nhận thay đổi và tăng revision', async () => {
        const before = await api.get(`${entity.path}/${createdId}`).expect(200);
        const response = await api
          .patch(`${entity.path}/${createdId}`)
          .send({ [entity.titleField]: 'Đã cập nhật' })
          .expect(200);

        expect(response.body.data[entity.titleField]).toBe('Đã cập nhật');
        expect(response.body.data.revision).toBe(before.body.data.revision + 1);
      });

      it('xuất CSV có BOM UTF-8', async () => {
        const response = await api.get(`${entity.path}/export?${query}`).expect(200);
        expect(response.headers['content-type']).toMatch(/text\/csv/);
        expect(response.text.codePointAt(0)).toBe(0xfeff);
      });

      it('xóa mềm giữ lại bản ghi kèm deletedAt', async () => {
        await api.delete(`${entity.path}/${createdId}`).expect(204);

        // Không còn xuất hiện trong danh sách…
        const list = await api.get(`${entity.path}?${query}`).expect(200);
        expect(list.body.data.some((r: { id: string }) => r.id === createdId)).toBe(false);

        // …nhưng vẫn còn trong cơ sở dữ liệu.
        const rows = await prisma.$queryRawUnsafe<Array<{ deleted_at: Date | null }>>(
          `SELECT deleted_at FROM "${entity.table}" WHERE id = $1::uuid`,
          createdId,
        );
        expect(rows[0]?.deleted_at).not.toBeNull();
      });
    });
  }

  describe('Phạm vi dữ liệu', () => {
    it('bản ghi của năm học khác không lọt vào danh sách', async () => {
      const other = await prisma.schoolYear.create({
        data: {
          schoolId: (await prisma.school.findFirstOrThrow()).id,
          name: '2099–2100',
          startDate: new Date('2099-08-15T00:00:00Z'),
          endDate: new Date('2100-05-31T00:00:00Z'),
        },
      });

      await api
        .post('/api/plans')
        .send({
          schoolYearId: other.id,
          code: 'KH-KHAC',
          name: 'Kế hoạch năm khác',
          level: 'YEAR',
          startDate: '2099-08-15',
          endDate: '2100-05-31',
          objectives: 'Không được lọt sang năm hiện tại',
          status: 'DRAFT',
        })
        .expect(201);

      const response = await api.get(`/api/plans?${query}`).expect(200);
      expect(response.body.data.some((p: { code: string }) => p.code === 'KH-KHAC')).toBe(false);
    });

    it('bản ghi áp dụng toàn trường hiện ở mọi cơ sở', async () => {
      await api
        .post('/api/plans')
        .send({
          schoolYearId: ctx.year.id,
          campusId: null,
          code: 'KH-CHUNG',
          name: 'Kế hoạch toàn trường',
          level: 'YEAR',
          startDate: '2026-08-15',
          endDate: '2027-05-31',
          objectives: 'Áp dụng cho mọi cơ sở',
          status: 'ACTIVE',
        })
        .expect(201);

      const scoped = scopeQuery({ yearId: ctx.year.id, campusId: ctx.campuses[0]!.id });
      const response = await api.get(`/api/plans?${scoped}`).expect(200);
      expect(response.body.data.some((p: { code: string }) => p.code === 'KH-CHUNG')).toBe(true);
    });
  });

  describe('Lịch hoạt động', () => {
    it('cảnh báo mềm khi thiếu địa điểm, phụ trách hoặc an toàn nhưng vẫn lưu', async () => {
      const response = await api
        .post('/api/calendar')
        .send({
          schoolYearId: ctx.year.id,
          title: 'Họp Ban Chỉ huy',
          date: '2026-09-10',
        })
        .expect(201);

      expect(response.body.data.id).toBeTruthy();
      expect(response.body.warnings[0]).toMatch(/còn thiếu/);
    });

    it('đủ thông tin thì không có cảnh báo', async () => {
      const response = await api
        .post('/api/calendar')
        .send({
          schoolYearId: ctx.year.id,
          title: 'Tập huấn nghi lễ',
          date: '2026-09-12',
          location: 'Hội trường',
          leader: 'Thầy Hiếu',
          safety: 'Kiểm tra âm thanh và lối đi',
        })
        .expect(201);

      expect(response.body.warnings).toEqual([]);
    });

    it('lọc theo khoảng ngày', async () => {
      const response = await api
        .get(`/api/calendar?${query}&from=2026-09-11&to=2026-09-13`)
        .expect(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('Tập huấn nghi lễ');
    });
  });
});
