import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authed, login, scopeQuery } from '../helpers/api';
import { disconnect, prisma, resetDatabase, seedContext } from '../helpers/db';

type Ctx = Awaited<ReturnType<typeof seedContext>>;

describe('Thi đua lớp', () => {
  let api: ReturnType<typeof authed>;
  let ctx: Ctx;
  let query: string;

  /** Giá trị hợp lệ cho từng tiêu chí: tiêu chí trừ điểm có max ≤ 0. */
  const cellFor = (criterion: Ctx['criteria'][number]): string =>
    Number(criterion.maxValue) <= 0 ? '-3' : '5';

  beforeAll(async () => {
    await resetDatabase();
    const session = await login();
    api = authed(session.accessToken);
    ctx = await seedContext();
    query = scopeQuery({ yearId: ctx.year.id, weekId: ctx.weeks[0]!.id });

    // Bộ tiêu chí seed ở trạng thái DRAFT; kích hoạt để dùng cho bảng tuần.
    await api.patch(`/api/criteria/sets/${ctx.criteriaSet.id}`).send({ status: 'ACTIVE' }).expect(200);
  });

  afterAll(async () => {
    await disconnect();
  });

  describe('Ngữ cảnh chấm điểm', () => {
    it('trả đủ lớp, tiêu chí và số ô kỳ vọng', async () => {
      const response = await api.get(`/api/scores/context?${query}`).expect(200);
      const data = response.body.data;

      expect(data.classes).toHaveLength(16);
      expect(data.criteria).toHaveLength(5);
      expect(data.expectedCells).toBe(80);
      expect(data.sheet).toBeNull();
      expect(data.workflowLabel).toBe('Khởi tạo bảng tuần');
    });

    it('sắp xếp lớp theo thứ tự tự nhiên tiếng Việt', async () => {
      const response = await api.get(`/api/scores/context?${query}`).expect(200);
      const names = response.body.data.classes.map((c: { className: string }) => c.className);
      expect(names[0]).toBe('6/A1');
      expect(names.indexOf('6/A2')).toBeLessThan(names.indexOf('9/B2'));
    });

    it('thiếu năm học trả 400', async () => {
      const response = await api.get(`/api/scores/context?weekId=${ctx.weeks[0]!.id}`).expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('chấp nhận cả yearId lẫn schoolYearId cho cùng một ý nghĩa', async () => {
      await api
        .get(`/api/scores/context?schoolYearId=${ctx.year.id}&weekId=${ctx.weeks[0]!.id}`)
        .expect(200);
    });
  });

  describe('Khởi tạo bảng tuần', () => {
    it('tạo bảng mới ở trạng thái DRAFT', async () => {
      const response = await api
        .post('/api/scores/sheets')
        .send({ yearId: ctx.year.id, weekId: ctx.weeks[0]!.id })
        .expect(201);
      expect(response.body.data.status).toBe('DRAFT');
    });

    it('không cho tạo trùng cho cùng tuần và bộ tiêu chí', async () => {
      const response = await api
        .post('/api/scores/sheets')
        .send({ yearId: ctx.year.id, weekId: ctx.weeks[0]!.id })
        .expect(409);
      expect(response.body.error.code).toBe('CONFLICT');
    });
  });

  describe('Nhập từng ô điểm', () => {
    let sheetId: string;
    let nnCriterion: Ctx['criteria'][number];
    let htCriterion: Ctx['criteria'][number];

    beforeAll(async () => {
      const response = await api.get(`/api/scores/context?${query}`).expect(200);
      sheetId = response.body.data.sheet.id;
      nnCriterion = ctx.criteria.find((c) => c.code === 'NN01')!;
      htCriterion = ctx.criteria.find((c) => c.code === 'HT01')!;
    });

    const put = (criteriaId: string, raw: string) =>
      api.put('/api/scores/entries').send({ sheetId, classId: ctx.classes[0]!.id, criteriaId, raw });

    it('lưu giá trị hợp lệ', async () => {
      const response = await put(nnCriterion.id, '-5').expect(200);
      expect(Number(response.body.data.entry.value)).toBe(-5);
      expect(response.body.data.entry.entryState).toBe('VALUE');
    });

    it('từ chối giá trị ngoài khoảng cho phép', async () => {
      const response = await put(nnCriterion.id, '-99').expect(422);
      expect(response.body.error.code).toBe('BUSINESS_RULE');
      expect(response.body.error.message).toMatch(/Giá trị phải trong khoảng/);
    });

    it('từ chối chuỗi không phải số', async () => {
      await put(nnCriterion.id, 'abc').expect(422);
    });

    it('KAD lưu thành trạng thái NA, không có giá trị số', async () => {
      const response = await put(htCriterion.id, 'KAD').expect(200);
      expect(response.body.data.entry.entryState).toBe('NA');
      expect(response.body.data.entry.value).toBeNull();
    });

    it('MIỄN lưu thành trạng thái EXEMPT', async () => {
      const response = await put(htCriterion.id, 'MIỄN').expect(200);
      expect(response.body.data.entry.entryState).toBe('EXEMPT');
    });

    it('chấp nhận dấu phẩy thập phân', async () => {
      const response = await put(htCriterion.id, '7,5').expect(200);
      expect(Number(response.body.data.entry.value)).toBe(7.5);
    });

    it('ô rỗng xóa hẳn bản ghi', async () => {
      const response = await put(htCriterion.id, '').expect(200);
      expect(response.body.data.cleared).toBe(true);
      expect(response.body.data.entry).toBeNull();

      const remaining = await prisma.scoreEntry.count({
        where: { sheetId, classId: ctx.classes[0]!.id, criteriaId: htCriterion.id },
      });
      expect(remaining).toBe(0);
    });

    it('ghi nhật ký kiểm toán cho mỗi thay đổi', async () => {
      await put(nnCriterion.id, '-4').expect(200);
      const logs = await prisma.auditLog.findMany({
        where: { entity: 'score_entries' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });
      expect(logs[0]?.action).toMatch(/score_(create|update)/);
      expect(logs[0]?.reason).toBe('Nhập trực tiếp bảng tuần');
    });

    it('hoàn tác khôi phục giá trị trước đó', async () => {
      const saved = await put(nnCriterion.id, '-7').expect(200);
      const undo = saved.body.data.undo;
      expect(undo).toBeTruthy();

      await api.post('/api/scores/entries/undo').send(undo).expect(200);

      const entry = await prisma.scoreEntry.findFirst({
        where: { sheetId, classId: ctx.classes[0]!.id, criteriaId: nnCriterion.id },
      });
      // undo kiểu "restore" đưa về giá trị cũ, kiểu "delete" xóa hẳn.
      if (undo.type === 'restore') expect(Number(entry?.value)).toBe(Number(undo.row.value));
      else expect(entry).toBeNull();
    });
  });

  describe('Dán vùng dữ liệu từ bảng tính', () => {
    let sheetId: string;

    beforeAll(async () => {
      const response = await api.get(`/api/scores/context?${query}`).expect(200);
      sheetId = response.body.data.sheet.id;
    });

    it('bỏ qua ô vi phạm giới hạn, chỉ ghi ô hợp lệ', async () => {
      // Cột 0 là NN01 (max = 0) nên giá trị 5 phải bị bỏ qua.
      const response = await api
        .post('/api/scores/entries/paste')
        .send({
          sheetId,
          startRow: 0,
          startCol: 0,
          matrix: [['5']],
          classIds: ctx.classes.map((c) => c.id),
          criteriaIds: ctx.criteria.map((c) => c.id),
        })
        .expect(422);
      expect(response.body.error.code).toBe('BUSINESS_RULE');
    });

    it('ghi toàn bộ 80 ô khi dữ liệu hợp lệ', async () => {
      const matrix = ctx.classes.map(() => ctx.criteria.map(cellFor));
      const response = await api
        .post('/api/scores/entries/paste')
        .send({
          sheetId,
          startRow: 0,
          startCol: 0,
          matrix,
          classIds: ctx.classes.map((c) => c.id),
          criteriaIds: ctx.criteria.map((c) => c.id),
        })
        .expect(200);

      expect(response.body.data.applied).toBe(80);
      expect(response.body.data.skipped).toBe(0);
    });

    it('ghi một bản nhật ký tổng cho cả lượt dán', async () => {
      const log = await prisma.auditLog.findFirst({
        where: { action: 'score_bulk_paste' },
        orderBy: { createdAt: 'desc' },
      });
      expect(log?.summary).toMatch(/Dán \d+ ô điểm/);
    });
  });

  describe('Quy trình duyệt và khóa', () => {
    let sheetId: string;

    beforeAll(async () => {
      const response = await api.get(`/api/scores/context?${query}`).expect(200);
      sheetId = response.body.data.sheet.id;
    });

    it('đi đúng chuỗi DRAFT → COMPLETE → REVIEW → APPROVED → LOCKED', async () => {
      for (const expected of ['COMPLETE', 'REVIEW', 'APPROVED', 'LOCKED']) {
        const response = await api.post(`/api/scores/sheets/${sheetId}/advance`).expect(200);
        expect(response.body.data.status).toBe(expected);
      }
    });

    it('khóa bảng thì đóng băng bộ tiêu chí và chốt bảng xếp hạng', async () => {
      const sheet = await prisma.weeklyScoreSheet.findUniqueOrThrow({ where: { id: sheetId } });
      expect(sheet.criteriaSnapshot).toBeTruthy();
      expect(sheet.lockedAt).not.toBeNull();

      const snapshot = await prisma.rankingSnapshot.findFirst({ where: { sheetId } });
      expect(snapshot).toBeTruthy();
      expect(Array.isArray(snapshot?.rows)).toBe(true);
    });

    it('khóa bảng tạo điểm khôi phục bảo vệ', async () => {
      const snapshot = await prisma.snapshot.findFirst({ where: { reason: 'before-score-lock' } });
      expect(snapshot?.protected).toBe(true);
      expect(snapshot?.tier).toBe('PROTECTED');
    });

    it('bảng đã khóa không cho sửa điểm', async () => {
      const response = await api
        .put('/api/scores/entries')
        .send({
          sheetId,
          classId: ctx.classes[0]!.id,
          criteriaId: ctx.criteria[0]!.id,
          raw: '-1',
        })
        .expect(422);
      expect(response.body.error.message).toMatch(/đã khóa/);
    });

    it('bảng đã khóa không đi tiếp bằng advance', async () => {
      const response = await api.post(`/api/scores/sheets/${sheetId}/advance`).expect(422);
      expect(response.body.error.message).toMatch(/mở khóa/);
    });

    it('mở khóa bắt buộc lý do tối thiểu 5 ký tự', async () => {
      const response = await api
        .post(`/api/scores/sheets/${sheetId}/unlock`)
        .send({ reason: 'abc' })
        .expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('mở khóa có lý do chuyển sang UNLOCKED và đánh dấu báo cáo cần cập nhật', async () => {
      const response = await api
        .post(`/api/scores/sheets/${sheetId}/unlock`)
        .send({ reason: 'Sai sót nhập liệu tuần 1, cần chỉnh lại' })
        .expect(200);

      expect(response.body.data.status).toBe('UNLOCKED');
      expect(response.body.data.reportsStale).toBe(true);
      expect(response.body.data.unlockReason).toMatch(/Sai sót/);
    });

    it('mở khóa tạo điểm khôi phục bảo vệ và ghi lý do vào nhật ký', async () => {
      const snapshot = await prisma.snapshot.findFirst({ where: { reason: 'before-score-unlock' } });
      expect(snapshot?.protected).toBe(true);

      const log = await prisma.auditLog.findFirst({ where: { action: 'sheet_unlock' } });
      expect(log?.reason).toMatch(/Sai sót/);
    });

    it('sau khi mở khóa thì quay lại bước kiểm tra', async () => {
      const response = await api.post(`/api/scores/sheets/${sheetId}/advance`).expect(200);
      expect(response.body.data.status).toBe('REVIEW');
    });
  });

  describe('Xếp hạng', () => {
    it('tính tổng đúng theo công thức điểm chuẩn', async () => {
      const expectedTotal =
        Number(ctx.criteriaSet.baseScore) +
        ctx.criteria.reduce((sum, c) => sum + Number(cellFor(c)), 0);

      const response = await api.get(`/api/scores/ranking?${query}`).expect(200);
      const rows = response.body.data.rows;

      expect(rows).toHaveLength(16);
      expect(rows[0].total).toBe(expectedTotal);
    });

    it('mọi lớp cùng điểm thì cùng hạng 1', async () => {
      const response = await api.get(`/api/scores/ranking?${query}`).expect(200);
      expect(response.body.data.rows.every((r: { rank: number }) => r.rank === 1)).toBe(true);
    });

    it('official=true không trả kết quả khi bảng chưa duyệt', async () => {
      const response = await api.get(`/api/scores/ranking?${query}&official=true`).expect(200);
      // Bảng đang ở REVIEW nên chưa phải kết quả chính thức.
      expect(response.body.data.official).toBe(false);
      expect(response.body.data.rows).toEqual([]);
    });
  });

  describe('Kiểm tra bất thường', () => {
    it('không còn cảnh báo khi mọi lớp đã nhập đủ', async () => {
      const response = await api.get(`/api/scores/anomalies?${query}`).expect(200);
      expect(response.body.data).toEqual([]);
    });

    it('cảnh báo lớp chưa có dữ liệu', async () => {
      const them = await prisma.class.create({
        data: {
          schoolYearId: ctx.year.id,
          campusId: ctx.campuses[0]!.id,
          className: '9/Z9',
          grade: 9,
          active: true,
        },
      });

      const response = await api.get(`/api/scores/anomalies?${query}`).expect(200);
      expect(
        response.body.data.some(
          (a: { level: string; text: string }) => a.level === 'red' && a.text.includes('9/Z9'),
        ),
      ).toBe(true);

      await prisma.class.delete({ where: { id: them.id } });
    });
  });

  describe('Nhật ký điều chỉnh', () => {
    it('chỉ trả nhật ký liên quan tới điểm và bảng tuần', async () => {
      const response = await api.get('/api/scores/history?limit=200').expect(200);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(
        response.body.data.every((log: { entity: string }) =>
          ['score_entries', 'weekly_score_sheets'].includes(log.entity),
        ),
      ).toBe(true);
    });
  });

  describe('Khóa cấu trúc bộ tiêu chí', () => {
    it('bộ đã phát sinh điểm được đánh dấu locked', async () => {
      const response = await api.get(`/api/criteria/sets/${ctx.criteriaSet.id}`).expect(200);
      expect(response.body.data.locked).toBe(true);
    });

    it('không cho đổi công thức của bộ đã dùng', async () => {
      const response = await api
        .patch(`/api/criteria/sets/${ctx.criteriaSet.id}`)
        .send({ formula: 'SUM' })
        .expect(409);
      expect(response.body.error.code).toBe('IMMUTABLE_RECORD');
    });

    it('không cho thêm tiêu chí vào bộ đã dùng', async () => {
      await api
        .post(`/api/criteria/sets/${ctx.criteriaSet.id}/criteria`)
        .send({ code: 'XX01', name: 'Tiêu chí mới', dataType: 'SCORE', minValue: 0, maxValue: 10 })
        .expect(409);
    });

    it('nhân bản tạo phiên bản mới ở trạng thái dự thảo, giữ nguyên dữ liệu cũ', async () => {
      const response = await api.post(`/api/criteria/sets/${ctx.criteriaSet.id}/clone`).expect(201);
      expect(response.body.data.version).toBe('1.1');
      expect(response.body.data.status).toBe('DRAFT');
      expect(response.body.data.sourceSetId).toBe(ctx.criteriaSet.id);

      const cloned = await prisma.criterion.count({
        where: { criteriaSetId: response.body.data.id },
      });
      expect(cloned).toBe(5);

      // Điểm của bộ gốc không đổi.
      const entries = await prisma.scoreEntry.count({
        where: { criterion: { criteriaSetId: ctx.criteriaSet.id } },
      });
      expect(entries).toBe(80);
    });
  });
});
