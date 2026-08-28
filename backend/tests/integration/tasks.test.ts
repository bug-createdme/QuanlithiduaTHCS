import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authed, login, scopeQuery } from '../helpers/api';
import { disconnect, prisma, resetDatabase, seedContext } from '../helpers/db';

type Ctx = Awaited<ReturnType<typeof seedContext>>;

const todayISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const shiftDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('Công việc và checklist', () => {
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

  const createTask = (overrides: Record<string, unknown> = {}) =>
    api.post('/api/tasks').send({
      schoolYearId: ctx.year.id,
      title: 'Công việc kiểm thử',
      dueDate: todayISO(),
      startDate: todayISO(),
      priority: 'NORMAL',
      status: 'TODO',
      progress: 0,
      ...overrides,
    });

  describe('Tạo và sửa', () => {
    it('tạo công việc trả về bản ghi kèm checklist rỗng', async () => {
      const response = await createTask().expect(201);
      expect(response.body.data.title).toBe('Công việc kiểm thử');
      expect(response.body.data.checkItems).toEqual([]);
    });

    it('thiếu tiêu đề bị từ chối', async () => {
      const response = await createTask({ title: '' }).expect(400);
      expect(response.body.error.issues.some((i: { field: string }) => i.field === 'title')).toBe(true);
    });

    it('hạn trước ngày bắt đầu bị chặn', async () => {
      const response = await createTask({
        startDate: todayISO(),
        dueDate: shiftDays(todayISO(), -2),
      }).expect(422);
      expect(response.body.error.message).toBe('Hạn hoàn thành phải từ ngày bắt đầu trở đi.');
    });

    it('tiến độ ngoài 0–100 bị từ chối', async () => {
      await createTask({ progress: 150 }).expect(400);
    });
  });

  describe('Checklist con', () => {
    it('phân tích textarea thành các mục, ! là bắt buộc', async () => {
      const response = await createTask({
        title: 'Việc có checklist',
        checklist: '! Mục bắt buộc\nMục thường',
      }).expect(201);

      const items = response.body.data.checkItems;
      expect(items).toHaveLength(2);
      expect(items[0]).toMatchObject({ label: 'Mục bắt buộc', required: true, done: false });
      expect(items[1]).toMatchObject({ label: 'Mục thường', required: false });
    });

    it('không cho hoàn thành khi còn mục bắt buộc chưa xong', async () => {
      const created = await createTask({
        title: 'Việc chặn hoàn thành',
        checklist: '! Phải xong trước',
      }).expect(201);

      const response = await api
        .patch(`/api/tasks/${created.body.data.id}`)
        .send({ status: 'DONE' })
        .expect(422);
      expect(response.body.error.message).toBe(
        'Chưa thể hoàn thành vì còn checklist bắt buộc chưa xong.',
      );
    });

    it('tick xong mục bắt buộc thì cho phép hoàn thành', async () => {
      const created = await createTask({
        title: 'Việc mở khóa hoàn thành',
        checklist: '! Phải xong trước',
      }).expect(201);

      const itemId = created.body.data.checkItems[0].id;
      await api.patch(`/api/tasks/check-items/${itemId}`).send({ done: true }).expect(200);

      const response = await api
        .patch(`/api/tasks/${created.body.data.id}`)
        .send({ status: 'DONE' })
        .expect(200);
      expect(response.body.data.status).toBe('DONE');
    });

    it('sửa checklist giữ nguyên trạng thái đã tick của mục trùng nhãn', async () => {
      const created = await createTask({
        title: 'Việc giữ trạng thái',
        checklist: 'Mục A\nMục B',
      }).expect(201);

      const itemA = created.body.data.checkItems.find(
        (i: { label: string }) => i.label === 'Mục A',
      );
      await api.patch(`/api/tasks/check-items/${itemA.id}`).send({ done: true }).expect(200);

      // Thêm mục mới, giữ nguyên Mục A.
      const updated = await api
        .patch(`/api/tasks/${created.body.data.id}`)
        .send({ checklist: 'Mục A\nMục B\nMục C' })
        .expect(200);

      const items = updated.body.data.checkItems;
      expect(items).toHaveLength(3);
      expect(items.find((i: { label: string }) => i.label === 'Mục A').done).toBe(true);
    });

    it('bỏ mục khỏi textarea thì mục đó biến mất', async () => {
      const created = await createTask({
        title: 'Việc rút gọn checklist',
        checklist: 'Giữ lại\nSẽ bỏ',
      }).expect(201);

      const updated = await api
        .patch(`/api/tasks/${created.body.data.id}`)
        .send({ checklist: 'Giữ lại' })
        .expect(200);

      expect(updated.body.data.checkItems).toHaveLength(1);
      expect(updated.body.data.checkItems[0].label).toBe('Giữ lại');
    });
  });

  describe('Bộ lọc nhanh từ trang Tổng quan', () => {
    beforeAll(async () => {
      await prisma.task.deleteMany({ where: { schoolYearId: ctx.year.id } });
      await createTask({ title: 'Việc hôm nay', dueDate: todayISO() }).expect(201);
      await createTask({
        title: 'Việc sắp tới',
        startDate: todayISO(),
        dueDate: shiftDays(todayISO(), 2),
      }).expect(201);
      await createTask({
        title: 'Việc quá hạn',
        startDate: shiftDays(todayISO(), -10),
        dueDate: shiftDays(todayISO(), -5),
      }).expect(201);
    });

    it('filter=today chỉ lấy việc đến hạn hôm nay', async () => {
      const response = await api.get(`/api/tasks?${query}&filter=today`).expect(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('Việc hôm nay');
    });

    it('filter=soon lấy việc đến hạn trong 3 ngày tới', async () => {
      const response = await api.get(`/api/tasks?${query}&filter=soon`).expect(200);
      expect(response.body.data.map((t: { title: string }) => t.title)).toEqual(['Việc sắp tới']);
    });

    it('filter=overdue chỉ lấy việc chưa xong và đã quá hạn', async () => {
      const response = await api.get(`/api/tasks?${query}&filter=overdue`).expect(200);
      expect(response.body.data.map((t: { title: string }) => t.title)).toEqual(['Việc quá hạn']);
    });

    it('tìm kiếm theo tiêu đề', async () => {
      const response = await api.get(`/api/tasks?${query}&q=quá hạn`).expect(200);
      expect(response.body.data).toHaveLength(1);
    });

    it('trả kèm thông tin phân trang', async () => {
      const response = await api.get(`/api/tasks?${query}&page=1&pageSize=2`).expect(200);
      expect(response.body.meta).toMatchObject({ page: 1, pageSize: 2, total: 3, pageCount: 2 });
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('Nhân bản', () => {
    it('tạo bản sao có hậu tố và đặt lại trạng thái', async () => {
      const created = await createTask({
        title: 'Việc gốc',
        status: 'DOING',
        progress: 60,
        checklist: '! Mục bắt buộc',
      }).expect(201);

      const response = await api.post(`/api/tasks/${created.body.data.id}/clone`).expect(201);
      expect(response.body.data.title).toBe('Việc gốc (bản sao)');
      expect(response.body.data.status).toBe('TODO');
      expect(response.body.data.progress).toBe(0);
      // Checklist được sao chép nhưng chưa tick mục nào.
      expect(response.body.data.checkItems).toHaveLength(1);
      expect(response.body.data.checkItems[0].done).toBe(false);
    });
  });

  describe('Công việc lặp', () => {
    it('sinh bản lặp cho các mốc đã đến hạn', async () => {
      await prisma.task.deleteMany({ where: { schoolYearId: ctx.year.id } });

      // Việc lặp hằng tuần có mốc kế tiếp đã trôi qua.
      await createTask({
        title: 'Sinh hoạt dưới cờ',
        startDate: shiftDays(todayISO(), -14),
        dueDate: shiftDays(todayISO(), -14),
        repeatRule: 'WEEKLY',
      }).expect(201);

      const response = await api
        .post('/api/tasks/generate-recurring')
        .send({ schoolYearId: ctx.year.id })
        .expect(200);

      expect(response.body.data.created).toBeGreaterThan(0);

      const generated = await prisma.task.findMany({
        where: { schoolYearId: ctx.year.id, repeatSourceId: { not: null } },
      });
      expect(generated.length).toBeGreaterThan(0);
      // Bản sinh ra không tự lặp tiếp.
      expect(generated.every((t) => t.repeatRule === 'NONE')).toBe(true);
    });

    it('chạy lại không tạo trùng nhờ khóa chống trùng', async () => {
      const before = await prisma.task.count({ where: { repeatSourceId: { not: null } } });
      await api
        .post('/api/tasks/generate-recurring')
        .send({ schoolYearId: ctx.year.id })
        .expect(200);
      const after = await prisma.task.count({ where: { repeatSourceId: { not: null } } });
      expect(after).toBe(before);
    });
  });

  describe('Thư viện mẫu', () => {
    it('trả về 16 mẫu công việc của bản gốc', async () => {
      const response = await api.get('/api/tasks/templates').expect(200);
      expect(response.body.data).toHaveLength(16);
      expect(response.body.data[0].title).toBe('Chuẩn bị nội dung sinh hoạt dưới cờ');
    });

    it('áp dụng mẫu tạo công việc mới', async () => {
      const templates = await api.get('/api/tasks/templates').expect(200);
      const ids = templates.body.data.slice(0, 3).map((t: { id: string }) => t.id);

      const response = await api
        .post('/api/tasks/templates/apply')
        .send({ schoolYearId: ctx.year.id, templateIds: ids })
        .expect(201);

      expect(response.body.data).toHaveLength(3);
      expect(response.body.data[0].groupName).toBe('Mẫu tham khảo');
    });

    it('không chọn mẫu nào thì bị từ chối', async () => {
      await api
        .post('/api/tasks/templates/apply')
        .send({ schoolYearId: ctx.year.id, templateIds: [] })
        .expect(400);
    });
  });

  describe('Xóa mềm', () => {
    it('xóa giữ lại bản ghi kèm dấu thời gian và ghi nhật ký', async () => {
      const created = await createTask({ title: 'Việc sẽ xóa' }).expect(201);
      const id = created.body.data.id;

      await api.delete(`/api/tasks/${id}`).expect(204);

      const row = await prisma.task.findUnique({ where: { id } });
      expect(row).not.toBeNull();
      expect(row?.deletedAt).not.toBeNull();

      const log = await prisma.auditLog.findFirst({
        where: { entity: 'tasks', entityId: id, action: 'delete' },
      });
      expect(log).toBeTruthy();
    });

    it('bản ghi đã xóa không còn trong danh sách', async () => {
      const response = await api.get(`/api/tasks?${query}&q=Việc sẽ xóa`).expect(200);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('Khóa lạc quan', () => {
    it('revision lệch thì trả 409 thay vì ghi đè', async () => {
      const created = await createTask({ title: 'Việc tranh chấp' }).expect(201);
      const id = created.body.data.id;

      // Lần sửa thứ nhất thành công và tăng revision.
      await api.patch(`/api/tasks/${id}`).send({ title: 'Sửa lần 1', revision: 1 }).expect(200);

      // Lần sửa thứ hai vẫn gửi revision cũ.
      const response = await api
        .patch(`/api/tasks/${id}`)
        .send({ title: 'Sửa lần 2', revision: 1 })
        .expect(409);
      expect(response.body.error.code).toBe('REVISION_CONFLICT');

      const row = await prisma.task.findUniqueOrThrow({ where: { id } });
      expect(row.title).toBe('Sửa lần 1');
    });
  });
});
