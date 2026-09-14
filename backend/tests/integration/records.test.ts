import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authed, login } from '../helpers/api';
import { disconnect, prisma, resetDatabase, seedContext } from '../helpers/db';

/**
 * Sáu bảng con vốn có trong lược đồ nhưng trước đây không có điểm cuối nào
 * chạm tới, nên không nhập được dữ liệu:
 *
 *   plan_targets · training_records · equipment_transactions
 *   task_dependencies · score_evidence · homeroom_teachers
 *
 * Bộ kiểm này giữ cho phần nghiệp vụ của chúng không trôi: giới hạn tồn kho,
 * chặn vòng lặp phụ thuộc, minh chứng tôn trọng khóa bảng thi đua, và đồng bộ
 * tên giáo viên chủ nhiệm xuống cột văn bản của lớp.
 */

const VIEWER_PASSWORD = 'Viewer@12345';
const MISSING = '00000000-0000-0000-0000-000000000000';

describe('Bảng con: chỉ tiêu, bồi dưỡng, mượn–trả, phụ thuộc, minh chứng, GVCN', () => {
  let api: ReturnType<typeof authed>;
  let viewer: ReturnType<typeof authed>;
  let ctx: Awaited<ReturnType<typeof seedContext>>;

  beforeAll(async () => {
    await resetDatabase();
    api = authed((await login()).accessToken);
    ctx = await seedContext();

    await prisma.user.create({
      data: {
        username: 'viewer_records',
        passwordHash: await bcrypt.hash(VIEWER_PASSWORD, 4),
        fullName: 'Tài khoản chỉ xem',
        role: 'VIEWER',
        active: true,
      },
    });
    viewer = authed((await login('viewer_records', VIEWER_PASSWORD)).accessToken);
  });

  afterAll(async () => {
    await disconnect();
  });

  // ── plan_targets ──────────────────────────────────────────────────────────
  describe('Chỉ tiêu kế hoạch', () => {
    let planId: string;
    let targetId: string;

    beforeAll(async () => {
      const plan = await api
        .post('/api/plans')
        .send({
          schoolYearId: ctx.year.id,
          code: 'KH-CT',
          name: 'Kế hoạch có chỉ tiêu',
          level: 'YEAR',
          startDate: '2026-09-01',
          endDate: '2027-05-31',
          objectives: 'Mục tiêu',
        })
        .expect(201);
      planId = plan.body.data.id;
    });

    it('danh sách rỗng khi chưa khai báo', async () => {
      const response = await api.get(`/api/plan-targets?planId=${planId}`).expect(200);
      expect(response.body.data).toHaveLength(0);
    });

    it('thiếu mã kế hoạch trả 400', async () => {
      await api.get('/api/plan-targets').expect(400);
    });

    it('kế hoạch không tồn tại trả 404, không tạo bản ghi mồ côi', async () => {
      await api.post('/api/plan-targets').send({ planId: MISSING, name: 'Mồ côi' }).expect(404);
    });

    it('tạo chỉ tiêu và giữ đúng giá trị số', async () => {
      const response = await api
        .post('/api/plan-targets')
        .send({ planId, name: 'Số buổi sinh hoạt Đội', targetValue: 36, unit: 'buổi' })
        .expect(201);
      targetId = response.body.data.id;
      expect(String(response.body.data.targetValue)).toBe('36');
    });

    it('ghi kết quả thực hiện', async () => {
      const response = await api
        .patch(`/api/plan-targets/${targetId}`)
        .send({ actualValue: 12 })
        .expect(200);
      expect(String(response.body.data.actualValue)).toBe('12');
    });

    it('revision cũ trả 409', async () => {
      await api.patch(`/api/plan-targets/${targetId}`).send({ actualValue: 15, revision: 1 }).expect(409);
    });

    it('tài khoản chỉ xem không tạo được', async () => {
      await viewer.post('/api/plan-targets').send({ planId, name: 'Chỉ xem' }).expect(403);
    });

    it('xóa mềm rồi biến khỏi danh sách', async () => {
      await api.delete(`/api/plan-targets/${targetId}`).expect(204);
      const response = await api.get(`/api/plan-targets?planId=${planId}`).expect(200);
      expect(response.body.data).toHaveLength(0);
    });
  });

  // ── training_records ──────────────────────────────────────────────────────
  describe('Bồi dưỡng thành viên Đội', () => {
    let memberId: string;

    beforeAll(async () => {
      const member = await api
        .post('/api/organization')
        .send({
          schoolYearId: ctx.year.id,
          name: 'Trần Thị Bích',
          className: '6/A1',
          unit: 'Ban Chỉ huy',
          position: 'Liên đội trưởng',
          term: '2026–2027',
        })
        .expect(201);
      memberId = member.body.data.id;
    });

    it('ghi nhận một buổi bồi dưỡng', async () => {
      const response = await api
        .post('/api/training-records')
        .send({
          teamMemberId: memberId,
          content: 'Tập huấn nghi thức Đội',
          date: '2026-10-05',
          result: 'Đạt loại Tốt',
        })
        .expect(201);
      expect(response.body.data.content).toBe('Tập huấn nghi thức Đội');
    });

    it('ngày sai định dạng trả 400', async () => {
      await api
        .post('/api/training-records')
        .send({ teamMemberId: memberId, content: 'Sai ngày', date: '05/10/2026' })
        .expect(400);
    });

    it('danh sách lọc đúng theo thành viên', async () => {
      const response = await api
        .get(`/api/training-records?teamMemberId=${memberId}`)
        .expect(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  // ── equipment_transactions ────────────────────────────────────────────────
  describe('Sổ mượn–trả thiết bị', () => {
    let equipmentId: string;

    beforeAll(async () => {
      const equipment = await api
        .post('/api/equipment')
        .send({
          schoolYearId: ctx.year.id,
          name: 'Trống Đội',
          code: 'TB-TR',
          quantity: 10,
          unit: 'cái',
          condition: 'Tốt',
        })
        .expect(201);
      equipmentId = equipment.body.data.id;
    });

    it('cho mượn trong giới hạn tồn kho', async () => {
      const response = await api
        .post('/api/equipment-transactions')
        .send({ equipmentId, type: 'BORROW', quantity: 4, borrower: 'Chi đội 8/A1' })
        .expect(201);
      // Không ghi ngày thì lấy thời điểm hiện tại, đúng thói quen ghi sổ.
      expect(response.body.data.borrowedAt).toBeTruthy();
    });

    it('không cho mượn quá số còn trong kho', async () => {
      const response = await api
        .post('/api/equipment-transactions')
        .send({ equipmentId, type: 'BORROW', quantity: 7 })
        .expect(422);
      expect(response.body.error.message).toContain('Chỉ còn 6/10');
    });

    it('không nhận trả nhiều hơn số đang ở ngoài', async () => {
      const response = await api
        .post('/api/equipment-transactions')
        .send({ equipmentId, type: 'RETURN', quantity: 99 })
        .expect(422);
      expect(response.body.error.message).toContain('ở ngoài');
    });

    it('nhận trả đúng số đang mượn', async () => {
      await api
        .post('/api/equipment-transactions')
        .send({ equipmentId, type: 'RETURN', quantity: 4, returnedAt: '2026-10-18' })
        .expect(201);
    });

    it('trả xong thì lại cho mượn được toàn bộ', async () => {
      await api
        .post('/api/equipment-transactions')
        .send({ equipmentId, type: 'BORROW', quantity: 10 })
        .expect(201);
    });

    it('số lượng 0 bị từ chối', async () => {
      await api
        .post('/api/equipment-transactions')
        .send({ equipmentId, type: 'BORROW', quantity: 0 })
        .expect(400);
    });
  });

  // ── task_dependencies ─────────────────────────────────────────────────────
  describe('Phụ thuộc công việc', () => {
    let a: string;
    let b: string;
    let c: string;

    const makeTask = async (title: string): Promise<string> => {
      const response = await api
        .post('/api/tasks')
        .send({ schoolYearId: ctx.year.id, title, dueDate: '2026-11-10' })
        .expect(201);
      return response.body.data.id;
    };

    beforeAll(async () => {
      a = await makeTask('A — Duyệt kế hoạch');
      b = await makeTask('B — Chuẩn bị sân khấu');
      c = await makeTask('C — Tổ chức lễ');
    });

    it('gợi ý không chứa chính công việc đang sửa', async () => {
      const response = await api.get(`/api/task-dependencies/candidates?taskId=${c}`).expect(200);
      expect(response.body.data.some((t: { id: string }) => t.id === c)).toBe(false);
    });

    it('khai báo chuỗi phụ thuộc C chờ B, B chờ A', async () => {
      await api.post('/api/task-dependencies').send({ taskId: c, dependsOnId: b }).expect(201);
      await api.post('/api/task-dependencies').send({ taskId: b, dependsOnId: a }).expect(201);
    });

    it('không cho một công việc chờ chính nó', async () => {
      await api.post('/api/task-dependencies').send({ taskId: c, dependsOnId: c }).expect(422);
    });

    it('khai báo trùng trả 409', async () => {
      await api.post('/api/task-dependencies').send({ taskId: c, dependsOnId: b }).expect(409);
    });

    it('CHẶN VÒNG LẶP và nêu rõ chuỗi gây vòng', async () => {
      const response = await api
        .post('/api/task-dependencies')
        .send({ taskId: a, dependsOnId: c })
        .expect(422);
      expect(response.body.error.message).toContain('vòng lặp');
      expect(response.body.error.message).toContain('A — Duyệt kế hoạch');
    });

    it('trả về cả hai chiều và đếm việc còn phải chờ', async () => {
      const forC = await api.get(`/api/task-dependencies?taskId=${c}`).expect(200);
      expect(forC.body.data.dependsOn).toHaveLength(1);
      expect(forC.body.data.blockedBy).toBe(1);

      const forB = await api.get(`/api/task-dependencies?taskId=${b}`).expect(200);
      expect(forB.body.data.blocking).toHaveLength(1);
    });

    it('bỏ rồi thêm lại được (hồi sinh bản ghi đã xóa mềm)', async () => {
      const list = await api.get(`/api/task-dependencies?taskId=${c}`).expect(200);
      const depId = list.body.data.dependsOn[0].id;
      await api.delete(`/api/task-dependencies/${depId}`).expect(204);
      // Khóa duy nhất (taskId, dependsOnId) vẫn còn nên phải hồi sinh, không tạo mới.
      await api.post('/api/task-dependencies').send({ taskId: c, dependsOnId: b }).expect(201);
    });

    it('tài khoản chỉ xem không thêm được', async () => {
      await viewer.post('/api/task-dependencies').send({ taskId: a, dependsOnId: b }).expect(403);
    });
  });

  // ── homeroom_teachers ─────────────────────────────────────────────────────
  describe('Danh bạ giáo viên chủ nhiệm', () => {
    let teacherId: string;
    let classId: string;

    beforeAll(() => {
      classId = ctx.classes[0]!.id;
    });

    it('thêm giáo viên vào danh bạ', async () => {
      const response = await api
        .post('/api/academic/homeroom-teachers')
        .send({
          schoolYearId: ctx.year.id,
          fullName: 'Nguyễn Thị Hồng',
          phone: '0912345678',
          email: 'hong@truong.edu.vn',
        })
        .expect(201);
      teacherId = response.body.data.id;
    });

    it('trùng tên bị chặn kể cả khác dấu và khác hoa thường', async () => {
      await api
        .post('/api/academic/homeroom-teachers')
        .send({ schoolYearId: ctx.year.id, fullName: 'nguyễn thị hồng' })
        .expect(409);
    });

    it('email sai định dạng bị từ chối, để trống thì hợp lệ', async () => {
      await api
        .post('/api/academic/homeroom-teachers')
        .send({ schoolYearId: ctx.year.id, fullName: 'Sai email', email: 'khong-phai-email' })
        .expect(400);
      await api
        .post('/api/academic/homeroom-teachers')
        .send({ schoolYearId: ctx.year.id, fullName: 'Không email', email: '' })
        .expect(201);
    });

    it('gán cho lớp và đồng bộ xuống cột teacher', async () => {
      const response = await api
        .post('/api/academic/homeroom-teachers/assign')
        .send({ classId, homeroomTeacherId: teacherId })
        .expect(200);
      expect(response.body.data.teacher).toBe('Nguyễn Thị Hồng');
    });

    it('danh sách trả kèm các lớp đang chủ nhiệm', async () => {
      const response = await api
        .get(`/api/academic/homeroom-teachers?schoolYearId=${ctx.year.id}`)
        .expect(200);
      const teacher = response.body.data.find((t: { id: string }) => t.id === teacherId);
      expect(teacher.classes).toHaveLength(1);
    });

    it('không xóa được khi còn chủ nhiệm lớp', async () => {
      const response = await api.delete(`/api/academic/homeroom-teachers/${teacherId}`).expect(422);
      expect(response.body.error.message).toContain('đang chủ nhiệm');
    });

    it('đổi tên thì cột teacher của lớp đổi theo', async () => {
      await api
        .patch(`/api/academic/homeroom-teachers/${teacherId}`)
        .send({ fullName: 'Nguyễn Thị Hồng Nhung' })
        .expect(200);
      const cls = await prisma.class.findUniqueOrThrow({ where: { id: classId } });
      expect(cls.teacher).toBe('Nguyễn Thị Hồng Nhung');
    });

    it('gỡ khỏi lớp rồi xóa được', async () => {
      const unassigned = await api
        .post('/api/academic/homeroom-teachers/assign')
        .send({ classId, homeroomTeacherId: null })
        .expect(200);
      expect(unassigned.body.data.teacher).toBeNull();
      await api.delete(`/api/academic/homeroom-teachers/${teacherId}`).expect(204);
    });
  });

  // ── score_evidence ────────────────────────────────────────────────────────
  describe('Minh chứng ô điểm', () => {
    let entryId: string;
    let evidenceId: string;
    let sheetId: string;

    beforeAll(async () => {
      await api
        .patch(`/api/criteria/sets/${ctx.criteriaSet.id}`)
        .send({ status: 'ACTIVE' })
        .expect(200);
      const sheet = await api
        .post('/api/scores/sheets')
        .send({ yearId: ctx.year.id, weekId: ctx.weeks[0]!.id })
        .expect(201);
      sheetId = sheet.body.data.id;

      const entry = await api
        .put('/api/scores/entries')
        .send({
          sheetId,
          classId: ctx.classes[0]!.id,
          criteriaId: ctx.criteria[0]!.id,
          raw: '-2',
        })
        .expect(200);
      entryId = entry.body.data.entry.id;
    });

    it('trả kèm ngữ cảnh ô điểm để hiện tiêu đề', async () => {
      const response = await api.get(`/api/scores/evidence?scoreEntryId=${entryId}`).expect(200);
      expect(response.body.data.entry.criterionCode).toBe(ctx.criteria[0]!.code);
      expect(response.body.data.evidence).toHaveLength(0);
    });

    it('không có tệp lẫn ghi chú thì từ chối', async () => {
      await api.post('/api/scores/evidence').send({ scoreEntryId: entryId }).expect(400);
    });

    it('gắn minh chứng bằng ghi chú', async () => {
      const response = await api
        .post('/api/scores/evidence')
        .send({ scoreEntryId: entryId, note: 'Biên bản họp Chi đội ngày 05/10' })
        .expect(201);
      evidenceId = response.body.data.id;
    });

    it('ô điểm không tồn tại trả 404', async () => {
      await api.post('/api/scores/evidence').send({ scoreEntryId: MISSING, note: 'x' }).expect(404);
    });

    it('tài khoản chỉ xem không gắn được', async () => {
      await viewer
        .post('/api/scores/evidence')
        .send({ scoreEntryId: entryId, note: 'Chỉ xem' })
        .expect(403);
    });

    it('bảng đã khóa thì không sửa được minh chứng nhưng vẫn đọc được', async () => {
      // Nhập đủ lưới rồi đưa bảng qua hết quy trình tới LOCKED.
      const cellFor = (criterion: (typeof ctx.criteria)[number]): string =>
        Number(criterion.maxValue) <= 0 ? '-2' : '4';
      await api
        .post('/api/scores/entries/paste')
        .send({
          sheetId,
          startRow: 0,
          startCol: 0,
          matrix: ctx.classes.map(() => ctx.criteria.map(cellFor)),
          classIds: ctx.classes.map((c) => c.id),
          criteriaIds: ctx.criteria.map((c) => c.id),
        })
        .expect(200);
      for (const _ of ['COMPLETE', 'REVIEW', 'APPROVED', 'LOCKED']) {
        await api.post(`/api/scores/sheets/${sheetId}/advance`).expect(200);
      }

      await api
        .post('/api/scores/evidence')
        .send({ scoreEntryId: entryId, note: 'Thêm sau khi khóa' })
        .expect(422);
      await api.delete(`/api/scores/evidence/${evidenceId}`).expect(422);

      const response = await api.get(`/api/scores/evidence?scoreEntryId=${entryId}`).expect(200);
      expect(response.body.data.evidence).toHaveLength(1);
    });
  });

  // ── chưa đăng nhập ────────────────────────────────────────────────────────
  describe('Chưa đăng nhập thì bị chặn ở mọi điểm cuối mới', () => {
    const paths = [
      '/api/plan-targets',
      '/api/training-records',
      '/api/equipment-transactions',
      '/api/task-dependencies',
      '/api/scores/evidence',
      '/api/academic/homeroom-teachers',
    ];
    for (const path of paths) {
      it(`GET ${path} trả 401`, async () => {
        await authed('').get(path).expect(401);
      });
    }
  });
});
