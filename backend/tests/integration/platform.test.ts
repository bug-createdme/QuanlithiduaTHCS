import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authed, login, scopeQuery } from '../helpers/api';
import { disconnect, prisma, resetDatabase, seedContext } from '../helpers/db';

type Ctx = Awaited<ReturnType<typeof seedContext>>;

describe('Báo cáo, cấu hình, sao lưu và trợ lý', () => {
  let api: ReturnType<typeof authed>;
  let ctx: Ctx;
  let query: string;

  beforeAll(async () => {
    await resetDatabase();
    const session = await login();
    api = authed(session.accessToken);
    ctx = await seedContext();
    query = scopeQuery({ yearId: ctx.year.id, weekId: ctx.weeks[0]!.id });
  });

  afterAll(async () => {
    await disconnect();
  });

  describe('Tổng quan', () => {
    it('trả đủ sáu chỉ số KPI', async () => {
      const response = await api.get(`/api/analytics/dashboard?${query}`).expect(200);
      expect(response.body.data.kpis).toHaveProperty('dueToday');
      expect(response.body.data.kpis).toHaveProperty('soon');
      expect(response.body.data.kpis).toHaveProperty('overdue');
      expect(response.body.data.kpis).toHaveProperty('upcomingEvents');
      expect(response.body.data.kpis).toHaveProperty('classesMissingScores');
      expect(response.body.data.kpis).toHaveProperty('classesInApprovedSheet');
    });

    it('đếm đúng số lớp chưa nhập thi đua trên dữ liệu khởi tạo', async () => {
      const response = await api.get(`/api/analytics/dashboard?${query}`).expect(200);
      // Chưa nhập ô nào nên cả 16 lớp đều thiếu.
      expect(response.body.data.kpis.classesMissingScores).toBe(16);
      expect(response.body.data.totalClasses).toBe(16);
    });

    it('thiếu năm học trả 400', async () => {
      await api.get('/api/analytics/dashboard').expect(400);
    });
  });

  describe('Hôm nay', () => {
    it('trả việc và lịch trong ngày', async () => {
      const response = await api.get(`/api/analytics/today?${query}`).expect(200);
      expect(response.body.data).toHaveProperty('date');
      expect(Array.isArray(response.body.data.tasks)).toBe(true);
      expect(Array.isArray(response.body.data.events)).toBe(true);
    });
  });

  describe('Ghi nhận nhanh', () => {
    it('lưu vào hồ sơ và cảnh báo không tác động điểm thi đua', async () => {
      const response = await api
        .post('/api/analytics/quick-note')
        .send({
          schoolYearId: ctx.year.id,
          kind: 'incident',
          subject: 'Lớp 7/A1',
          type: 'Điểm trừ đề xuất',
          description: 'Chưa trực nhật đúng giờ',
        })
        .expect(201);

      expect(response.body.data.type).toBe('Ghi nhận nhanh');
      expect(response.body.warnings[0]).toMatch(/không tự động thay đổi bảng thi đua/);
    });

    it('thiếu nội dung bị từ chối', async () => {
      await api
        .post('/api/analytics/quick-note')
        .send({ schoolYearId: ctx.year.id, kind: 'note', description: '' })
        .expect(400);
    });
  });

  describe('Tìm kiếm toàn cục', () => {
    it('tìm được lớp theo tên', async () => {
      const response = await api
        .get(`/api/analytics/search?yearId=${ctx.year.id}&q=${encodeURIComponent('6/A1')}`)
        .expect(200);
      const classGroup = response.body.data.groups.find((g: { page: string }) => g.page === 'scores');
      expect(classGroup?.items.length).toBeGreaterThan(0);
    });

    it('từ khóa rỗng bị từ chối', async () => {
      await api.get(`/api/analytics/search?yearId=${ctx.year.id}&q=`).expect(400);
    });
  });

  describe('Trợ lý tổng hợp', () => {
    it('trả về 8 câu hỏi nhanh của bản gốc', async () => {
      const response = await api.get('/api/analytics/assistant/prompts').expect(200);
      expect(response.body.data).toHaveLength(8);
      expect(response.body.data[0]).toBe('Hôm nay tôi cần làm gì?');
    });

    it('nhận diện câu hỏi về việc quá hạn', async () => {
      const response = await api
        .post('/api/analytics/assistant/ask')
        .send({ yearId: ctx.year.id, weekId: ctx.weeks[0]!.id, question: 'Việc nào đang quá hạn?' })
        .expect(200);

      expect(response.body.data.recognized).toBe(true);
      expect(response.body.data.title).toBe('Công việc quá hạn');
      expect(response.body.data.sourcePage).toBe('tasks');
    });

    it('nhận diện câu hỏi bằng từ khóa đã bỏ dấu', async () => {
      const response = await api
        .post('/api/analytics/assistant/ask')
        .send({ yearId: ctx.year.id, weekId: ctx.weeks[0]!.id, question: 'lop nao chua nhap thi dua' })
        .expect(200);
      expect(response.body.data.title).toBe('Lớp chưa nhập thi đua');
      expect(response.body.data.badges?.length).toBe(16);
    });

    it('luôn kèm dấu thời gian và phạm vi để minh bạch nguồn số liệu', async () => {
      const response = await api
        .post('/api/analytics/assistant/ask')
        .send({ yearId: ctx.year.id, weekId: ctx.weeks[0]!.id, question: 'Tóm tắt tiến độ tháng' })
        .expect(200);
      expect(response.body.data.stamp).toMatch(/Dữ liệu lúc/);
    });

    it('câu hỏi lạ trả về hướng dẫn thay vì đoán bừa', async () => {
      // Câu này cố tình không chứa từ khóa nào trong bảng nhận diện.
      const response = await api
        .post('/api/analytics/assistant/ask')
        .send({ yearId: ctx.year.id, question: 'giá vàng thế giới ra sao' })
        .expect(200);
      expect(response.body.data.recognized).toBe(false);
      expect(response.body.data.lines[0]).toMatch(/chưa nhận diện được câu hỏi/i);
    });

    it('so khớp từ khóa là so khớp chuỗi đơn giản, giống hệt bản gốc', async () => {
      // "hôm nay" xuất hiện trong câu nên vẫn rơi vào nhánh việc hôm nay.
      // Ghi lại hành vi này để nếu sau có đổi sang nhận diện tinh vi hơn thì
      // test sẽ báo, chứ không phải là lỗi.
      const response = await api
        .post('/api/analytics/assistant/ask')
        .send({ yearId: ctx.year.id, question: 'thời tiết hôm nay thế nào' })
        .expect(200);
      expect(response.body.data.title).toBe('Việc cần làm hôm nay');
    });
  });

  describe('Báo cáo', () => {
    it('xem trước báo cáo tuần trả cấu trúc đầy đủ', async () => {
      const response = await api.get(`/api/reports/preview?${query}&type=WEEK`).expect(200);
      expect(response.body.data.title).toBe('BÁO CÁO CÔNG TÁC TUẦN');
      expect(Array.isArray(response.body.data.sections)).toBe(true);
      expect(response.body.data.signatures).toEqual([
        'Người lập báo cáo',
        'Xác nhận của nhà trường',
      ]);
    });

    it('báo cáo thi đua từ chối xếp hạng khi bảng chưa duyệt', async () => {
      const response = await api.get(`/api/reports/preview?${query}&type=SCORES`).expect(200);
      const notice = response.body.data.sections.find(
        (s: { notice?: { text: string } }) => s.notice,
      );
      expect(notice.notice.text).toMatch(/chưa được duyệt/);
    });

    it('lưu nháp tạo phiên bản 1 kèm checksum', async () => {
      const response = await api
        .post('/api/reports')
        .send({ yearId: ctx.year.id, weekId: ctx.weeks[0]!.id, type: 'WEEK', status: 'DRAFT' })
        .expect(201);

      expect(response.body.data.version).toBe(1);
      expect(response.body.data.status).toBe('DRAFT');
      expect(response.body.data.immutable).toBe(false);
      expect(response.body.data.sourceChecksum).toHaveLength(64);
    });

    it('lưu tiếp thì tăng số phiên bản', async () => {
      const response = await api
        .post('/api/reports')
        .send({ yearId: ctx.year.id, weekId: ctx.weeks[0]!.id, type: 'WEEK', status: 'DRAFT' })
        .expect(201);
      expect(response.body.data.version).toBe(2);
    });

    it('chốt báo cáo bắt buộc tick xác nhận', async () => {
      const response = await api
        .post('/api/reports')
        .send({
          yearId: ctx.year.id,
          weekId: ctx.weeks[0]!.id,
          type: 'WEEK',
          status: 'FINALIZED',
          confirmed: false,
        })
        .expect(422);
      expect(response.body.error.message).toMatch(/xác nhận đã đối chiếu/);
    });

    it('chốt báo cáo đặt cờ bất biến và tạo điểm khôi phục', async () => {
      const response = await api
        .post('/api/reports')
        .send({
          yearId: ctx.year.id,
          weekId: ctx.weeks[0]!.id,
          type: 'WEEK',
          status: 'FINALIZED',
          confirmed: true,
          recipient: 'Ban Giám hiệu',
          submissionStatus: 'SUBMITTED',
        })
        .expect(201);

      expect(response.body.data.status).toBe('FINALIZED');
      expect(response.body.data.immutable).toBe(true);
      expect(response.body.data.finalizedAt).not.toBeNull();

      const snapshot = await prisma.snapshot.findFirst({
        where: { reason: 'after-finalized-report' },
      });
      expect(snapshot?.protected).toBe(true);
    });

    it('báo cáo đã chốt không cho sửa', async () => {
      const finalized = await prisma.generatedReport.findFirstOrThrow({
        where: { status: 'FINALIZED' },
      });
      const response = await api
        .patch(`/api/reports/${finalized.id}`)
        .send({ recipient: 'Đổi nơi nhận' })
        .expect(409);
      expect(response.body.error.code).toBe('IMMUTABLE_RECORD');
    });

    it('bản nháp vẫn sửa được nơi nhận và trạng thái gửi', async () => {
      const draft = await prisma.generatedReport.findFirstOrThrow({ where: { status: 'DRAFT' } });
      const response = await api
        .patch(`/api/reports/${draft.id}`)
        .send({ recipient: 'Phòng GD&ĐT', submissionStatus: 'ACCEPTED' })
        .expect(200);
      expect(response.body.data.recipient).toBe('Phòng GD&ĐT');
    });

    it('gói báo cáo chốt gom đúng số bản đã chốt', async () => {
      const response = await api.post('/api/reports/packages').send({ yearId: ctx.year.id }).expect(201);
      expect(response.body.data.reportCount).toBeGreaterThan(0);
      expect(response.body.data.checksum).toHaveLength(64);
    });

    it('xuất CSV báo cáo có BOM UTF-8', async () => {
      const response = await api.get(`/api/reports/export/csv?${query}&type=TASKS`).expect(200);
      expect(response.text.codePointAt(0)).toBe(0xfeff);
    });
  });

  describe('Danh mục cấu hình động', () => {
    it('có đủ 21 nhóm danh mục của bản gốc', async () => {
      const response = await api.get('/api/config/categories').expect(200);
      expect(response.body.data).toHaveLength(21);
    });

    it('lấy nhanh mục theo khóa danh mục', async () => {
      const response = await api.get('/api/config/items/task_status').expect(200);
      expect(response.body.data.length).toBe(6);
      expect(response.body.data[0].label).toBe('Chưa làm');
    });

    it('thêm mục mới vào danh mục', async () => {
      const response = await api
        .post('/api/config/categories/task_status/items')
        .send({ label: 'Chờ vật tư', code: 'CHO_VAT_TU' })
        .expect(201);
      expect(response.body.data.categoryKey).toBe('task_status');
    });

    it('trùng mã trong cùng danh mục bị từ chối', async () => {
      const response = await api
        .post('/api/config/categories/task_status/items')
        .send({ label: 'Khác', code: 'CHO_VAT_TU' })
        .expect(409);
      expect(response.body.error.message).toBe('Mã đã tồn tại trong danh mục.');
    });

    it('mã có ký tự không hợp lệ bị từ chối', async () => {
      await api
        .post('/api/config/categories/task_status/items')
        .send({ label: 'Sai mã', code: 'MA SAI!' })
        .expect(400);
    });

    it('ngừng dùng không xóa dữ liệu, chỉ ẩn khỏi danh sách mặc định', async () => {
      const item = await prisma.configItem.findFirstOrThrow({ where: { code: 'CHO_VAT_TU' } });
      await api.patch(`/api/config/items/${item.id}`).send({ active: false }).expect(200);

      const active = await api.get('/api/config/items/task_status').expect(200);
      expect(active.body.data.some((i: { code: string }) => i.code === 'CHO_VAT_TU')).toBe(false);

      const all = await api.get('/api/config/items/task_status?includeInactive=true').expect(200);
      expect(all.body.data.some((i: { code: string }) => i.code === 'CHO_VAT_TU')).toBe(true);
    });

    it('khôi phục mẫu bật lại các mục mặc định đã tắt', async () => {
      const item = await prisma.configItem.findFirstOrThrow({
        where: { categoryKey: 'task_status', isDefault: true },
      });
      await api.patch(`/api/config/items/${item.id}`).send({ active: false }).expect(200);

      const response = await api
        .post('/api/config/categories/task_status/restore-defaults')
        .expect(200);
      expect(response.body.data.restored).toBe(6);

      const restored = await prisma.configItem.findUniqueOrThrow({ where: { id: item.id } });
      expect(restored.active).toBe(true);
    });

    it('xuất và nhập lại cấu hình giữ nguyên dữ liệu', async () => {
      const exported = await api.get('/api/config/export').expect(200);
      const payload = JSON.parse(exported.text);
      expect(payload.format).toBe('TPT-CONFIG-1');

      const response = await api.post('/api/config/import').send(payload).expect(200);
      expect(response.body.data.imported).toBeGreaterThan(0);
    });

    it('từ chối tệp sai định dạng', async () => {
      await api.post('/api/config/import').send({ format: 'KHONG-PHAI', categories: [] }).expect(400);
    });
  });

  describe('Trường tùy chỉnh', () => {
    it('tạo trường mới cho công việc', async () => {
      const response = await api
        .post('/api/settings/custom-fields')
        .send({ entityType: 'tasks', name: 'Mức độ ảnh hưởng', fieldType: 'SHORT_TEXT' })
        .expect(201);
      expect(response.body.data.entityType).toBe('tasks');
    });

    it('kiểu lựa chọn bắt buộc khai báo giá trị', async () => {
      const response = await api
        .post('/api/settings/custom-fields')
        .send({ entityType: 'tasks', name: 'Thiếu lựa chọn', fieldType: 'SINGLE_CHOICE' })
        .expect(422);
      expect(response.body.error.message).toMatch(/ngăn bằng dấu \|/);
    });

    it('thực thể không hợp lệ bị từ chối', async () => {
      await api
        .post('/api/settings/custom-fields')
        .send({ entityType: 'khong-ton-tai', name: 'X', fieldType: 'SHORT_TEXT' })
        .expect(400);
    });
  });

  describe('Thiết lập ứng dụng', () => {
    it('đọc được toàn bộ thiết lập dạng key-value', async () => {
      const response = await api.get('/api/settings').expect(200);
      expect(response.body.data).toHaveProperty('paper_orientation');
      expect(response.body.data).toHaveProperty('max_file_mb');
    });

    it('ba ngưỡng dung lượng phải tăng dần', async () => {
      const response = await api
        .put('/api/settings')
        .send({
          storage_warning_low: 90,
          storage_warning_high: 80,
          storage_warning_critical: 95,
        })
        .expect(422);
      expect(response.body.error.message).toBe('Ba ngưỡng phải tăng dần: sớm < cao < nguy cấp.');
    });

    it('lưu thiết lập hợp lệ', async () => {
      const response = await api
        .put('/api/settings')
        .send({ paper_orientation: 'portrait', max_file_mb: 30 })
        .expect(200);
      expect(response.body.data.paper_orientation).toBe('portrait');
    });
  });

  describe('Dữ liệu mẫu', () => {
    it('báo đúng số bản ghi mẫu đang có', async () => {
      const response = await api.get('/api/settings/sample/status').expect(200);
      expect(response.body.data.present).toBe(true);
      expect(response.body.data.classes).toBe(16);
    });

    it('từ chối xóa khi lớp mẫu đã phát sinh điểm', async () => {
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

      const response = await api.delete('/api/settings/sample').expect(422);
      expect(response.body.error.message).toMatch(/đã có điểm thi đua/);

      await prisma.scoreEntry.deleteMany({ where: { sheetId: sheet.id } });
      await prisma.weeklyScoreSheet.delete({ where: { id: sheet.id } });
    });

    it('xóa được khi chưa phát sinh điểm', async () => {
      const response = await api.delete('/api/settings/sample').expect(200);
      expect(response.body.data.classes).toBe(16);

      const remaining = await prisma.class.count({ where: { isSample: true, deletedAt: null } });
      expect(remaining).toBe(0);
    });
  });

  describe('Sao lưu', () => {
    it('tổng quan báo đúng nguồn lưu trữ là PostgreSQL', async () => {
      const response = await api.get('/api/backup/overview').expect(200);
      expect(response.body.data.storage.kind).toBe('postgresql');
    });

    it('xuất bản sao lưu kèm manifest và ghi nhật ký', async () => {
      const response = await api.get('/api/backup/export?scope=QUICK').expect(200);
      const payload = JSON.parse(response.text);

      expect(payload.format).toBe('TPT-BACKUP-3');
      expect(payload.manifest.recordCount).toBeGreaterThan(0);
      expect(response.headers['x-backup-checksum']).toHaveLength(64);

      const record = await prisma.backupRecord.findFirst({ orderBy: { createdAt: 'desc' } });
      expect(record?.scope).toBe('QUICK');
    });

    it('gói năm học bắt buộc chọn năm', async () => {
      await api.get('/api/backup/export?scope=YEAR_PACKAGE').expect(422);
    });

    it('kiểm tra tệp sao lưu hợp lệ trước khi ghi', async () => {
      const exported = await api.get('/api/backup/export?scope=QUICK').expect(200);
      const payload = JSON.parse(exported.text);

      const response = await api.post('/api/backup/verify').send(payload).expect(200);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.issues).toEqual([]);
    });

    it('phát hiện tệp sai định dạng', async () => {
      const response = await api
        .post('/api/backup/verify')
        .send({ format: 'SAI-DINH-DANG', data: {} })
        .expect(200);
      expect(response.body.data.valid).toBe(false);
      expect(response.body.data.issues[0]).toMatch(/không phải TPT-BACKUP-3/);
    });

    it('phục hồi bắt buộc xác nhận', async () => {
      const exported = await api.get('/api/backup/export?scope=QUICK').expect(200);
      const payload = JSON.parse(exported.text);
      await api
        .post('/api/backup/restore')
        .send({ ...payload, confirmed: false })
        .expect(422);
    });

    it('tạo điểm khôi phục thủ công', async () => {
      const response = await api
        .post('/api/backup/snapshots')
        .send({ yearId: ctx.year.id })
        .expect(201);
      expect(response.body.data.checksum).toHaveLength(64);
      expect(response.body.data.recordCount).toBeGreaterThan(0);
    });

    it('nhật ký kiểm toán ghi lại thao tác', async () => {
      const response = await api.get('/api/backup/audit?limit=50').expect(200);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty('action');
    });
  });
});
