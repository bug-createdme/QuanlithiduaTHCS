import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authed, login, request, scopeQuery } from '../helpers/api';
import { disconnect, prisma, resetDatabase, seedContext } from '../helpers/db';

/**
 * Bài kiểm hồi quy cho các lỗi đã phát hiện trong đợt kiểm thử bàn giao.
 *
 * Mỗi khối dưới đây tái hiện đúng thao tác đã làm lộ lỗi, để nếu lỗi quay lại
 * thì bộ kiểm thử báo ngay chứ không phải chờ phát hiện lúc dùng thật.
 *
 * Hai lỗi KHÔNG có mặt ở đây, vì môi trường test không kiểm chứng được:
 *   • Hạn mức tần suất của /auth/refresh — test-env cố ý nới
 *     AUTH_RATE_LIMIT_MAX lên 100000 nên mọi hạn mức đều không còn hiệu lực.
 *   • Nhãn biểu mẫu gắn với ô nhập — dự án chưa có hạ tầng test render React.
 */

const VIEWER_PASSWORD = 'Viewer@12345';

describe('Hồi quy — lỗi đã sửa trong đợt kiểm thử bàn giao', () => {
  let api: ReturnType<typeof authed>;
  let viewer: ReturnType<typeof authed>;
  let ctx: Awaited<ReturnType<typeof seedContext>>;
  /** Cần riêng cho các bài tải tệp: supertest .attach() không dùng được helper authed(). */
  let adminToken = '';

  beforeAll(async () => {
    await resetDatabase();
    const session = await login();
    adminToken = session.accessToken;
    api = authed(session.accessToken);
    ctx = await seedContext();

    await prisma.user.create({
      data: {
        username: 'viewer_regression',
        passwordHash: await bcrypt.hash(VIEWER_PASSWORD, 4),
        fullName: 'Tài khoản chỉ xem',
        role: 'VIEWER',
        active: true,
      },
    });
    const viewerSession = await login('viewer_regression', VIEWER_PASSWORD);
    viewer = authed(viewerSession.accessToken);
  });

  afterAll(async () => {
    await disconnect();
  });

  // ── BUG-001 ───────────────────────────────────────────────────────────────
  describe('BUG-001 · Ghi nhận nhanh phải chặn tài khoản chỉ xem', () => {
    const body = () => ({
      schoolYearId: ctx.year.id,
      kind: 'incident' as const,
      subject: 'Kiểm hồi quy',
      type: 'Sự việc',
      description: 'Tài khoản chỉ xem không được phép tạo bản ghi này.',
    });

    it('VIEWER bị từ chối với 403', async () => {
      const response = await viewer.post('/api/analytics/quick-note').send(body()).expect(403);
      expect(response.body.error.code).toBe('PERMISSION_DENIED');
    });

    it('VIEWER không tạo được bản ghi nào', async () => {
      const before = await prisma.document.count({ where: { deletedAt: null } });
      await viewer.post('/api/analytics/quick-note').send(body()).expect(403);
      expect(await prisma.document.count({ where: { deletedAt: null } })).toBe(before);
    });

    it('tài khoản có quyền ghi vẫn dùng được bình thường', async () => {
      const response = await api.post('/api/analytics/quick-note').send(body()).expect(201);
      expect(response.body.data.name).toContain('Kiểm hồi quy');
    });

    it('lưu search_text đã bỏ dấu để tìm được bằng từ khóa không dấu (BUG-007)', async () => {
      await api
        .post('/api/analytics/quick-note')
        .send({
          schoolYearId: ctx.year.id,
          kind: 'incident',
          subject: 'Kiểm chứng Đội',
          type: 'Ghi nhận',
          description: 'Nội dung ghi nhận',
        })
        .expect(201);

      const unaccented = await api
        .get(`/api/documents?schoolYearId=${ctx.year.id}&q=${encodeURIComponent('kiem chung')}`)
        .expect(200);
      expect(unaccented.body.data.count).toBeGreaterThan(0);

      const accented = await api
        .get(`/api/documents?schoolYearId=${ctx.year.id}&q=${encodeURIComponent('Kiểm chứng')}`)
        .expect(200);
      expect(accented.body.data.count).toBeGreaterThan(0);
    });
  });

  // ── BUG-002 ───────────────────────────────────────────────────────────────
  describe('BUG-002 · Hoàn tác không được vượt qua khóa bảng thi đua', () => {
    let sheetId: string;
    let query: string;
    let victimId: string;

    beforeAll(async () => {
      query = scopeQuery({ yearId: ctx.year.id, weekId: ctx.weeks[1]!.id });
      await api
        .patch(`/api/criteria/sets/${ctx.criteriaSet.id}`)
        .send({ status: 'ACTIVE' })
        .expect(200);

      const created = await api
        .post('/api/scores/sheets')
        .send({ yearId: ctx.year.id, weekId: ctx.weeks[1]!.id })
        .expect(201);
      sheetId = created.body.data.id;

      // Nhập đủ lưới điểm rồi đưa bảng đi hết quy trình tới trạng thái LOCKED.
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

      const entry = await prisma.scoreEntry.findFirstOrThrow({ where: { sheetId } });
      victimId = entry.id;
    });

    it('bảng đang ở trạng thái LOCKED', async () => {
      const response = await api.get(`/api/scores/context?${query}`).expect(200);
      expect(response.body.data.sheet.status).toBe('LOCKED');
      expect(response.body.data.entries).toHaveLength(ctx.classes.length * ctx.criteria.length);
    });

    it('hoàn tác kiểu delete bị chặn khi bảng đã khóa', async () => {
      const response = await api
        .post('/api/scores/entries/undo')
        .send({ type: 'delete', id: victimId })
        .expect(422);
      expect(response.body.error.code).toBe('BUSINESS_RULE');
    });

    it('không ô điểm nào bị xóa khỏi bảng đã khóa', async () => {
      const before = await prisma.scoreEntry.count({ where: { sheetId } });
      await api.post('/api/scores/entries/undo').send({ type: 'delete', id: victimId }).expect(422);
      expect(await prisma.scoreEntry.count({ where: { sheetId } })).toBe(before);
    });

    it('hoàn tác ô điểm không tồn tại trả 404', async () => {
      await api
        .post('/api/scores/entries/undo')
        .send({ type: 'delete', id: '00000000-0000-0000-0000-000000000000' })
        .expect(404);
    });

    it('sau khi mở khóa có lý do thì hoàn tác chạy lại bình thường', async () => {
      await api
        .post(`/api/scores/sheets/${sheetId}/unlock`)
        .send({ reason: 'Kiểm hồi quy chức năng hoàn tác' })
        .expect(200);

      const before = await prisma.scoreEntry.count({ where: { sheetId } });
      await api.post('/api/scores/entries/undo').send({ type: 'delete', id: victimId }).expect(200);
      expect(await prisma.scoreEntry.count({ where: { sheetId } })).toBe(before - 1);
    });
  });

  // ── BUG-004 ───────────────────────────────────────────────────────────────
  describe('BUG-004 · Xóa vĩnh viễn không được làm mất tệp của hồ sơ khác', () => {
    /** Hai hồ sơ có nội dung giống hệt nhau nên dùng chung một tệp trên đĩa. */
    const CONTENT = Buffer.from('noi dung giong nhau cho hai ho so kiem hoi quy');

    const upload = async (fileName: string): Promise<{ id: string; attachmentId: string }> => {
      const response = await request()
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('schoolYearId', ctx.year.id)
        .attach('files', CONTENT, fileName)
        .expect(201);
      const doc = response.body.data[0];
      const detail = await api.get(`/api/documents/${doc.id}`).expect(200);
      return { id: doc.id, attachmentId: detail.body.data.attachments[0].id };
    };

    let first: { id: string; attachmentId: string };
    let second: { id: string; attachmentId: string };

    beforeAll(async () => {
      first = await upload('ho-so-mot.txt');
      second = await upload('ho-so-hai.txt');
    });

    it('hai hồ sơ dùng chung một đường dẫn lưu trữ', async () => {
      const [a, b] = await Promise.all([
        prisma.attachment.findUniqueOrThrow({ where: { id: first.attachmentId } }),
        prisma.attachment.findUniqueOrThrow({ where: { id: second.attachmentId } }),
      ]);
      expect(a.storagePath).toBe(b.storagePath);
    });

    it('không xóa vĩnh viễn được hồ sơ chưa nằm trong thùng rác', async () => {
      const response = await api.delete(`/api/documents/${first.id}/purge`).expect(422);
      expect(response.body.error.code).toBe('BUSINESS_RULE');
      await api.get(`/api/documents/${first.id}`).expect(200);
    });

    it('xóa vĩnh viễn hồ sơ trong thùng rác vẫn giữ tệp cho hồ sơ còn lại', async () => {
      await api.delete(`/api/documents/${first.id}`).expect(204);
      await api.delete(`/api/documents/${first.id}/purge`).expect(204);

      await api.get(`/api/documents/${first.id}`).expect(404);
      await api.get(`/api/documents/attachments/${second.attachmentId}/download`).expect(200);
    });

    it('xóa nốt hồ sơ cuối cùng thì tệp trên đĩa mới được dọn', async () => {
      await api.delete(`/api/documents/${second.id}`).expect(204);
      await api.delete(`/api/documents/${second.id}/purge`).expect(204);
      await api.get(`/api/documents/attachments/${second.attachmentId}/download`).expect(404);
    });
  });

  // ── BUG-005 ───────────────────────────────────────────────────────────────
  describe('BUG-005 · Tệp sai định dạng phải trả 400 kèm lý do', () => {
    const uploadNamed = (fileName: string) =>
      request()
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('schoolYearId', ctx.year.id)
        .attach('files', Buffer.from('x'), fileName);

    it('phần mở rộng không được phép trả 400, không phải 500', async () => {
      const response = await uploadNamed('malware.exe').expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('thông báo lỗi nói rõ định dạng bị từ chối', async () => {
      const response = await uploadNamed('script.sh').expect(400);
      expect(response.body.error.message).toContain('.sh');
    });

    it('tệp không có phần mở rộng cũng bị từ chối bằng 400', async () => {
      await uploadNamed('khong-co-duoi').expect(400);
    });

    it('định dạng hợp lệ vẫn tải lên được', async () => {
      await request()
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('schoolYearId', ctx.year.id)
        .attach('files', Buffer.from('%PDF-1.4'), 'van-ban.pdf')
        .expect(201);
    });
  });

  // ── BUG-006 ───────────────────────────────────────────────────────────────
  describe('BUG-006 · Ký tự % và _ trong từ khóa là ký tự thường', () => {
    beforeAll(async () => {
      await api
        .post('/api/tasks')
        .send({
          schoolYearId: ctx.year.id,
          title: 'Hoàn thành 100% chỉ tiêu Đội',
          dueDate: '2026-11-20',
        })
        .expect(201);
      await api
        .post('/api/tasks')
        .send({ schoolYearId: ctx.year.id, title: 'Công việc không có ký tự đặc biệt', dueDate: '2026-11-21' })
        .expect(201);
    });

    const search = async (keyword: string) => {
      const response = await api
        .get(`/api/tasks?yearId=${ctx.year.id}&all=true&q=${encodeURIComponent(keyword)}`)
        .expect(200);
      return response.body.data as Array<{ title: string }>;
    };

    it('% chỉ khớp bản ghi thật sự chứa dấu phần trăm', async () => {
      const rows = await search('%');
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.title.includes('%'))).toBe(true);
    });

    it('_ không khớp toàn bộ bản ghi', async () => {
      const all = await search('');
      const rows = await search('_');
      expect(rows.length).toBeLessThan(all.length);
    });

    it('tìm kiếm tiếng Việt có dấu vẫn hoạt động', async () => {
      const rows = await search('chỉ tiêu');
      expect(rows.some((r) => r.title.includes('chỉ tiêu'))).toBe(true);
    });

    it('chuỗi giống lệnh SQL được xử lý như văn bản thường', async () => {
      expect(await search("' OR 1=1 --")).toHaveLength(0);
    });
  });

  // ── BUG-007 ───────────────────────────────────────────────────────────────
  describe('BUG-007 · Tìm kiếm toàn cục tra cùng một chỉ mục với trang Hồ sơ', () => {
    it('tìm được hồ sơ bằng từ khóa không dấu', async () => {
      const response = await api
        .get(`/api/analytics/search?yearId=${ctx.year.id}&q=${encodeURIComponent('kiem hoi quy')}`)
        .expect(200);
      const documents = response.body.data.groups.find(
        (g: { page: string }) => g.page === 'documents',
      );
      expect(documents?.items?.length ?? 0).toBeGreaterThan(0);
    });

    it('ký tự đại diện trong tìm kiếm toàn cục cũng bị vô hiệu hóa', async () => {
      const response = await api
        .get(`/api/analytics/search?yearId=${ctx.year.id}&q=${encodeURIComponent('%')}`)
        .expect(200);
      const items = (response.body.data.groups as Array<{ items: unknown[] }>).flatMap(
        (g) => g.items,
      );
      // Chỉ những bản ghi thật sự chứa dấu % mới được trả về.
      expect(items.length).toBeLessThan(ctx.classes.length);
    });
  });

  // ── BD-01 ─────────────────────────────────────────────────────────────────
  /**
   * Đặt cuối tệp có chủ ý: hai thao tác này đóng năm học và xóa dữ liệu mẫu,
   * nên phải chạy sau tất cả các khối kiểm khác trong cùng tệp.
   */
  describe('BD-01 · Đóng năm học và xóa dữ liệu mẫu chỉ dành cho ADMIN', () => {
    let editor: ReturnType<typeof authed>;

    beforeAll(async () => {
      await prisma.user.create({
        data: {
          username: 'editor_regression',
          passwordHash: await bcrypt.hash(VIEWER_PASSWORD, 4),
          fullName: 'Tài khoản biên tập',
          role: 'EDITOR',
          active: true,
        },
      });
      editor = authed((await login('editor_regression', VIEWER_PASSWORD)).accessToken);
    });

    it('EDITOR không đóng được năm học', async () => {
      const response = await editor
        .post(`/api/academic/years/${ctx.year.id}/close`)
        .send({ reason: 'Kiểm hồi quy phân quyền' })
        .expect(403);
      expect(response.body.error.code).toBe('PERMISSION_DENIED');
    });

    it('năm học vẫn mở sau khi EDITOR thử đóng', async () => {
      const year = await prisma.schoolYear.findUniqueOrThrow({ where: { id: ctx.year.id } });
      expect(year.status).toBe('OPEN');
      expect(year.readOnly).toBe(false);
    });

    it('VIEWER cũng không đóng được năm học', async () => {
      await viewer
        .post(`/api/academic/years/${ctx.year.id}/close`)
        .send({ reason: 'Kiểm hồi quy phân quyền' })
        .expect(403);
    });

    it('EDITOR không xóa được dữ liệu mẫu', async () => {
      const response = await editor.delete('/api/settings/sample').expect(403);
      expect(response.body.error.code).toBe('PERMISSION_DENIED');
    });

    it('dữ liệu mẫu còn nguyên sau khi EDITOR thử xóa', async () => {
      expect(await prisma.class.count({ where: { isSample: true, deletedAt: null } })).toBe(16);
    });

    it('EDITOR vẫn làm được các thao tác ghi thông thường', async () => {
      await editor
        .post('/api/tasks')
        .send({
          schoolYearId: ctx.year.id,
          title: 'EDITOR vẫn tạo được công việc',
          dueDate: '2026-12-01',
        })
        .expect(201);
    });

    it('kiểm tra trước khi đóng năm vẫn mở cho mọi tài khoản đăng nhập', async () => {
      await editor.get(`/api/academic/years/${ctx.year.id}/close-check`).expect(200);
      await viewer.get(`/api/academic/years/${ctx.year.id}/close-check`).expect(200);
    });

    it('ADMIN đi qua được cửa phân quyền của lệnh xóa dữ liệu mẫu', async () => {
      // Ở thời điểm này lớp mẫu đã phát sinh điểm thi đua từ khối kiểm BUG-002,
      // nên quy tắc nghiệp vụ chặn lại bằng 422. Điều cần khẳng định ở đây là
      // ADMIN KHÔNG bị chặn ở tầng phân quyền (403) như EDITOR.
      const response = await api.delete('/api/settings/sample');
      expect(response.status).not.toBe(403);
      expect(response.status).toBe(422);
      expect(response.body.error.message).toContain('lớp mẫu đã có điểm thi đua');
    });

    it('ADMIN vẫn đóng được năm học', async () => {
      const response = await api
        .post(`/api/academic/years/${ctx.year.id}/close`)
        .send({ reason: 'Kiểm hồi quy phân quyền' })
        .expect(200);
      expect(response.body.data.status).toBe('ARCHIVED');
      expect(response.body.data.readOnly).toBe(true);
    });
  });
});
