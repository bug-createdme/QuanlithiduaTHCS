import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authed, login } from '../helpers/api';
import { disconnect, prisma, resetDatabase, seedContext } from '../helpers/db';

type Ctx = Awaited<ReturnType<typeof seedContext>>;

describe('Học vụ', () => {
  let api: ReturnType<typeof authed>;
  let ctx: Ctx;

  beforeAll(async () => {
    await resetDatabase();
    const session = await login();
    api = authed(session.accessToken);
    ctx = await seedContext();
  });

  afterAll(async () => {
    await disconnect();
  });

  describe('Dữ liệu khởi tạo', () => {
    it('có đúng một năm học hiện hành', async () => {
      const response = await api.get('/api/academic/years').expect(200);
      expect(response.body.data.filter((y: { isCurrent: boolean }) => y.isCurrent)).toHaveLength(1);
    });

    it('năm học có 2 học kỳ và 40 tuần', async () => {
      const semesters = await api
        .get(`/api/academic/semesters?schoolYearId=${ctx.year.id}`)
        .expect(200);
      const weeks = await api.get(`/api/academic/weeks?schoolYearId=${ctx.year.id}`).expect(200);

      expect(semesters.body.data).toHaveLength(2);
      expect(weeks.body.data).toHaveLength(40);
      expect(weeks.body.data[0].name).toBe('Tuần 1');
      expect(weeks.body.data[39].name).toBe('Tuần 40');
    });

    it('các tuần nối tiếp nhau không hở ngày', async () => {
      const response = await api.get(`/api/academic/weeks?schoolYearId=${ctx.year.id}`).expect(200);
      const weeks = response.body.data as Array<{ startDate: string; endDate: string }>;

      for (let i = 1; i < weeks.length; i += 1) {
        const previousEnd = new Date(weeks[i - 1]!.endDate);
        const currentStart = new Date(weeks[i]!.startDate);
        const gapDays = (currentStart.getTime() - previousEnd.getTime()) / 86_400_000;
        expect(gapDays).toBe(1);
      }
    });

    it('có 16 lớp trải đều 2 cơ sở', async () => {
      const response = await api
        .get(`/api/academic/classes?schoolYearId=${ctx.year.id}`)
        .expect(200);
      expect(response.body.data).toHaveLength(16);

      const byCampus = new Map<string, number>();
      for (const cls of response.body.data as Array<{ campusId: string }>) {
        byCampus.set(cls.campusId, (byCampus.get(cls.campusId) ?? 0) + 1);
      }
      expect([...byCampus.values()]).toEqual([8, 8]);
    });
  });

  describe('Cơ sở', () => {
    it('thêm cơ sở mới', async () => {
      const response = await api
        .post('/api/academic/campuses')
        .send({ name: 'Cơ sở 3', code: 'cs3' })
        .expect(201);
      // Mã luôn được chuẩn hoá thành chữ hoa.
      expect(response.body.data.code).toBe('CS3');
    });

    it('trùng mã bị từ chối', async () => {
      const response = await api
        .post('/api/academic/campuses')
        .send({ name: 'Cơ sở khác', code: 'CS3' })
        .expect(409);
      expect(response.body.error.message).toBe('Mã cơ sở đã tồn tại.');
    });

    it('trùng tên (không phân biệt dấu) bị từ chối', async () => {
      const response = await api
        .post('/api/academic/campuses')
        .send({ name: 'CO SO 3', code: 'CS4' })
        .expect(409);
      expect(response.body.error.message).toBe('Tên cơ sở đã tồn tại.');
    });

    it('mã chứa ký tự không hợp lệ bị từ chối', async () => {
      await api
        .post('/api/academic/campuses')
        .send({ name: 'Cơ sở 5', code: 'CS 5!' })
        .expect(400);
    });

    it('xóa được cơ sở chưa phát sinh dữ liệu', async () => {
      const campus = await prisma.campus.findFirstOrThrow({ where: { code: 'CS3' } });
      const usage = await api.get(`/api/academic/campuses/${campus.id}/usage`).expect(200);
      expect(usage.body.data.deletable).toBe(true);

      await api.delete(`/api/academic/campuses/${campus.id}`).expect(204);
    });

    it('không xóa được cơ sở đang có lớp', async () => {
      const campus = ctx.campuses[0]!;
      const usage = await api.get(`/api/academic/campuses/${campus.id}/usage`).expect(200);
      expect(usage.body.data.deletable).toBe(false);

      const response = await api.delete(`/api/academic/campuses/${campus.id}`).expect(409);
      expect(response.body.error.message).toMatch(/đang được dùng bởi/);
    });
  });

  describe('Lớp', () => {
    it('trùng tên lớp trong cùng năm học bị từ chối', async () => {
      const response = await api
        .post('/api/academic/classes')
        .send({
          schoolYearId: ctx.year.id,
          campusId: ctx.campuses[0]!.id,
          className: '6/A1',
          grade: 6,
        })
        .expect(409);
      expect(response.body.error.message).toBe('Tên lớp đã tồn tại trong năm học.');
    });

    it('khối ngoài 1–9 bị từ chối', async () => {
      await api
        .post('/api/academic/classes')
        .send({
          schoolYearId: ctx.year.id,
          campusId: ctx.campuses[0]!.id,
          className: '10/A1',
          grade: 10,
        })
        .expect(400);
    });

    it('không xóa lớp đã có điểm, buộc chuyển sang ngừng dùng', async () => {
      // Dựng một ô điểm cho lớp đầu tiên.
      const sheet = await prisma.weeklyScoreSheet.create({
        data: {
          schoolYearId: ctx.year.id,
          weekId: ctx.weeks[0]!.id,
          criteriaSetId: ctx.criteriaSet.id,
          status: 'DRAFT',
        },
      });
      await prisma.scoreEntry.create({
        data: {
          sheetId: sheet.id,
          schoolYearId: ctx.year.id,
          weekId: ctx.weeks[0]!.id,
          classId: ctx.classes[0]!.id,
          criteriaId: ctx.criteria[0]!.id,
          entryState: 'VALUE',
          value: -3,
        },
      });

      const response = await api.delete(`/api/academic/classes/${ctx.classes[0]!.id}`).expect(409);
      expect(response.body.error.message).toMatch(/Ngừng hoạt động/);
    });
  });

  describe('Nhập lớp hàng loạt', () => {
    const rows = [
      { code: '8C1', className: '8/C1', grade: 8, campusCode: 'CS1', teacher: 'Nguyễn Văn A' },
      { code: '8C2', className: '8/C2', grade: 8, campusCode: 'CS2' },
    ];

    it('dryRun chỉ kiểm tra, không ghi dữ liệu', async () => {
      const before = await prisma.class.count({ where: { schoolYearId: ctx.year.id } });

      const response = await api
        .post('/api/academic/classes/import')
        .send({ schoolYearId: ctx.year.id, rows, dryRun: true })
        .expect(200);

      expect(response.body.data.errors).toEqual([]);
      expect(response.body.data.valid).toBe(2);

      const after = await prisma.class.count({ where: { schoolYearId: ctx.year.id } });
      expect(after).toBe(before);
    });

    it('báo lỗi theo từng dòng khi mã cơ sở sai', async () => {
      const response = await api
        .post('/api/academic/classes/import')
        .send({
          schoolYearId: ctx.year.id,
          rows: [{ className: '9/X1', grade: 9, campusCode: 'KHONG-CO' }],
        })
        .expect(200);

      expect(response.body.data.imported).toBe(0);
      expect(response.body.data.errors[0]).toMatchObject({ row: 1 });
      expect(response.body.data.errors[0].message).toMatch(/không tồn tại/);
    });

    it('có một dòng lỗi thì không ghi dòng nào (all-or-nothing)', async () => {
      const before = await prisma.class.count({ where: { schoolYearId: ctx.year.id } });

      await api
        .post('/api/academic/classes/import')
        .send({
          schoolYearId: ctx.year.id,
          rows: [
            { className: '9/Y1', grade: 9, campusCode: 'CS1' },
            { className: '9/Y2', grade: 9, campusCode: 'SAI' },
          ],
        })
        .expect(200);

      const after = await prisma.class.count({ where: { schoolYearId: ctx.year.id } });
      expect(after).toBe(before);
    });

    it('dữ liệu hợp lệ được ghi đầy đủ', async () => {
      const response = await api
        .post('/api/academic/classes/import')
        .send({ schoolYearId: ctx.year.id, rows })
        .expect(201);

      expect(response.body.data.imported).toBe(2);
      const created = await prisma.class.findFirst({
        where: { schoolYearId: ctx.year.id, className: '8/C1' },
      });
      expect(created?.teacher).toBe('Nguyễn Văn A');
    });
  });

  describe('Vòng đời năm học', () => {
    it('tạo năm học mới kèm 2 học kỳ và 40 tuần', async () => {
      const response = await api
        .post('/api/academic/years')
        .send({
          name: '2027–2028',
          startDate: '2027-08-15',
          endDate: '2028-05-31',
          copyClasses: false,
          copyCriteria: false,
          copyTemplates: false,
        })
        .expect(201);

      const yearId = response.body.data.id;
      const [semesters, weeks] = await Promise.all([
        prisma.semester.count({ where: { schoolYearId: yearId } }),
        prisma.schoolWeek.count({ where: { schoolYearId: yearId } }),
      ]);
      expect(semesters).toBe(2);
      expect(weeks).toBe(40);
    });

    it('ngày kết thúc trước ngày bắt đầu bị chặn', async () => {
      const response = await api
        .post('/api/academic/years')
        .send({ name: '2029–2030', startDate: '2029-08-15', endDate: '2029-01-01' })
        .expect(422);
      expect(response.body.error.message).toBe('Ngày kết thúc phải sau ngày bắt đầu.');
    });

    it('sao chép lớp và bộ tiêu chí khi được chọn, tiêu chí về trạng thái dự thảo', async () => {
      const response = await api
        .post('/api/academic/years')
        .send({
          name: '2030–2031',
          startDate: '2030-08-15',
          endDate: '2031-05-31',
          copyFromYearId: ctx.year.id,
          copyClasses: true,
          copyCriteria: true,
        })
        .expect(201);

      const yearId = response.body.data.id;
      const classes = await prisma.class.count({ where: { schoolYearId: yearId } });
      expect(classes).toBeGreaterThan(0);

      const sets = await prisma.criteriaSet.findMany({ where: { schoolYearId: yearId } });
      expect(sets.length).toBeGreaterThan(0);
      expect(sets.every((s) => s.status === 'DRAFT')).toBe(true);

      // Không mang theo điểm của năm cũ.
      const entries = await prisma.scoreEntry.count({ where: { schoolYearId: yearId } });
      expect(entries).toBe(0);
    });

    it('đặt năm hiện hành thì bỏ cờ ở mọi năm khác', async () => {
      const target = await prisma.schoolYear.findFirstOrThrow({ where: { name: '2027–2028' } });
      await api.post(`/api/academic/years/${target.id}/set-current`).expect(200);

      const current = await prisma.schoolYear.findMany({ where: { isCurrent: true } });
      expect(current).toHaveLength(1);
      expect(current[0]!.id).toBe(target.id);
    });

    it('kiểm tra tồn đọng trước khi đóng năm', async () => {
      const response = await api
        .get(`/api/academic/years/${ctx.year.id}/close-check`)
        .expect(200);
      expect(response.body.data).toHaveProperty('warnings');
      expect(Array.isArray(response.body.data.warnings)).toBe(true);
    });

    it('đóng năm chuyển sang chỉ đọc và tạo điểm khôi phục bảo vệ', async () => {
      const target = await prisma.schoolYear.findFirstOrThrow({ where: { name: '2030–2031' } });

      await api
        .post(`/api/academic/years/${target.id}/close`)
        .send({ reason: 'Kết thúc năm học kiểm thử' })
        .expect(200);

      const closed = await prisma.schoolYear.findUniqueOrThrow({ where: { id: target.id } });
      expect(closed.status).toBe('ARCHIVED');
      expect(closed.readOnly).toBe(true);
      expect(closed.closedAt).not.toBeNull();

      const snapshot = await prisma.snapshot.findFirst({
        where: { reason: 'before-year-close', schoolYearId: target.id },
      });
      expect(snapshot?.protected).toBe(true);

      const log = await prisma.yearTransitionLog.findFirst({
        where: { fromYearId: target.id, action: 'CLOSE' },
      });
      expect(log?.reason).toBe('Kết thúc năm học kiểm thử');
    });

    it('không đóng lại năm đã đóng', async () => {
      const target = await prisma.schoolYear.findFirstOrThrow({ where: { name: '2030–2031' } });
      await api.post(`/api/academic/years/${target.id}/close`).send({}).expect(409);
    });
  });

  describe('Thông tin trường', () => {
    it('cập nhật tên trường và bỏ cờ dữ liệu mẫu', async () => {
      const response = await api
        .patch('/api/academic/school')
        .send({ name: 'THCS Nguyễn Trãi', code: 'NT01', reporterTitle: 'Tổng phụ trách Đội' })
        .expect(200);

      expect(response.body.data.name).toBe('THCS Nguyễn Trãi');
      expect(response.body.data.isSample).toBe(false);
    });

    it('thiếu tên trường bị từ chối', async () => {
      await api.patch('/api/academic/school').send({ name: '' }).expect(400);
    });
  });
});
