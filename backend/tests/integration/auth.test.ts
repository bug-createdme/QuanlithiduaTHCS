import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authed, login, request } from '../helpers/api';
import { disconnect, prisma, resetDatabase } from '../helpers/db';

describe('Xác thực', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnect();
  });

  describe('POST /api/auth/login', () => {
    it('đăng nhập đúng trả access token và thông tin tài khoản', async () => {
      const response = await request()
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin@' })
        .expect(200);

      expect(response.body.data.accessToken).toBeTypeOf('string');
      expect(response.body.data.expiresIn).toBeGreaterThan(0);
      expect(response.body.data.user).toMatchObject({
        username: 'admin',
        role: 'ADMIN',
        mustChangePassword: true,
      });
    });

    it('đặt refresh token vào cookie HttpOnly, không trả trong body', async () => {
      const response = await request()
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin@' })
        .expect(200);

      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((c) => c.startsWith('tpt_refresh='))).toBe(true);
      expect(cookies.some((c) => c.includes('HttpOnly'))).toBe(true);
      expect(response.body.data).not.toHaveProperty('refreshToken');
    });

    it('không lộ mật khẩu băm ra ngoài', async () => {
      const response = await request()
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin@' })
        .expect(200);
      expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    });

    it('sai mật khẩu trả 401 với mã AUTH_INVALID', async () => {
      const response = await request()
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'sai-mat-khau' })
        .expect(401);
      expect(response.body.error.code).toBe('AUTH_INVALID');
    });

    it('không tiết lộ tài khoản có tồn tại hay không', async () => {
      const khongTonTai = await request()
        .post('/api/auth/login')
        .send({ username: 'khong-ton-tai', password: 'x' })
        .expect(401);
      expect(khongTonTai.body.error.code).toBe('AUTH_INVALID');
    });

    it('thiếu trường bắt buộc trả 400 kèm lỗi theo trường', async () => {
      const response = await request().post('/api/auth/login').send({ username: 'admin' }).expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.issues.some((i: { field: string }) => i.field === 'password')).toBe(true);
    });
  });

  describe('Chống dò mật khẩu', () => {
    it('chặn tạm thời sau ba lần sai liên tiếp', async () => {
      await prisma.user.update({
        where: { username: 'admin' },
        data: { failedAttempts: 0, blockedUntil: null },
      });

      // Hai lần đầu chỉ báo sai, chưa chặn.
      for (let i = 0; i < 2; i += 1) {
        const r = await request()
          .post('/api/auth/login')
          .send({ username: 'admin', password: 'sai' });
        expect(r.body.error.code).toBe('AUTH_INVALID');
      }

      // Lần thứ ba bắt đầu áp thời gian chờ.
      const blocked = await request()
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'sai' })
        .expect(429);
      expect(blocked.body.error.code).toBe('AUTH_BLOCKED');
      expect(blocked.body.error.details.waitSeconds).toBeGreaterThan(0);

      // Dọn để không ảnh hưởng các test sau.
      await prisma.user.update({
        where: { username: 'admin' },
        data: { failedAttempts: 0, blockedUntil: null },
      });
    });

    it('đăng nhập thành công đặt lại bộ đếm sai', async () => {
      await prisma.user.update({
        where: { username: 'admin' },
        data: { failedAttempts: 2, blockedUntil: null },
      });
      await login();
      const user = await prisma.user.findUniqueOrThrow({ where: { username: 'admin' } });
      expect(user.failedAttempts).toBe(0);
      expect(user.blockedUntil).toBeNull();
      expect(user.lastLoginAt).not.toBeNull();
    });
  });

  describe('Bảo vệ điểm cuối', () => {
    it('không có token trả 401', async () => {
      const response = await request().get('/api/academic/years').expect(401);
      expect(response.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('token sai định dạng trả 401', async () => {
      await request()
        .get('/api/academic/years')
        .set('Authorization', 'Bearer khong-phai-jwt')
        .expect(401);
    });

    it('có token hợp lệ thì truy cập được', async () => {
      const session = await login();
      const response = await authed(session.accessToken).get('/api/academic/years').expect(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Vòng đời phiên', () => {
    it('/auth/me trả đúng tài khoản đang đăng nhập', async () => {
      const session = await login();
      const response = await authed(session.accessToken).get('/api/auth/me').expect(200);
      expect(response.body.data.username).toBe('admin');
    });

    it('/auth/refresh cấp token mới và xoay vòng refresh token', async () => {
      const session = await login();
      const response = await request()
        .post('/api/auth/refresh')
        .set('Cookie', session.cookies)
        .expect(200);

      expect(response.body.data.accessToken).toBeTypeOf('string');
      // Token cũ phải bị thu hồi ngay sau khi cấp token mới.
      await request().post('/api/auth/refresh').set('Cookie', session.cookies).expect(401);
    });

    it('/auth/logout thu hồi phiên hiện tại', async () => {
      const session = await login();
      await request().post('/api/auth/logout').set('Cookie', session.cookies).expect(200);
      await request().post('/api/auth/refresh').set('Cookie', session.cookies).expect(401);
    });
  });

  describe('Đổi mật khẩu', () => {
    // Nhóm này đổi mật khẩu tài khoản seed nên phải dựng lại dữ liệu sau khi
    // chạy xong. Không khôi phục qua API được vì mật khẩu seed "admin@" chỉ
    // dài 6 ký tự, trong khi endpoint đổi mật khẩu yêu cầu tối thiểu 8.
    afterAll(async () => {
      await resetDatabase();
    });

    it('sai mật khẩu hiện tại bị từ chối', async () => {
      const session = await login();
      const response = await authed(session.accessToken)
        .post('/api/auth/change-password')
        .send({ currentPassword: 'sai', newPassword: 'MatKhauMoi@1', confirmPassword: 'MatKhauMoi@1' })
        .expect(401);
      expect(response.body.error.code).toBe('AUTH_INVALID');
    });

    it('xác nhận không khớp bị từ chối', async () => {
      const session = await login();
      const response = await authed(session.accessToken)
        .post('/api/auth/change-password')
        .send({ currentPassword: 'admin@', newPassword: 'MatKhauMoi@1', confirmPassword: 'Khac@1' })
        .expect(400);
      expect(
        response.body.error.issues.some((i: { field: string }) => i.field === 'confirmPassword'),
      ).toBe(true);
    });

    it('mật khẩu mới quá ngắn bị từ chối', async () => {
      const session = await login();
      await authed(session.accessToken)
        .post('/api/auth/change-password')
        .send({ currentPassword: 'admin@', newPassword: 'ngan', confirmPassword: 'ngan' })
        .expect(400);
    });

    it('mật khẩu mới trùng mật khẩu cũ bị từ chối', async () => {
      const session = await login();
      await authed(session.accessToken)
        .post('/api/auth/change-password')
        .send({ currentPassword: 'admin@', newPassword: 'admin@', confirmPassword: 'admin@' })
        .expect(400);
    });

    it('đổi thành công thì bỏ cờ buộc đổi và thu hồi mọi phiên cũ', async () => {
      const session = await login();
      await authed(session.accessToken)
        .post('/api/auth/change-password')
        .send({
          currentPassword: 'admin@',
          newPassword: 'MatKhauMoi@2026',
          confirmPassword: 'MatKhauMoi@2026',
        })
        .expect(200);

      // Phiên cũ mất hiệu lực.
      await request().post('/api/auth/refresh').set('Cookie', session.cookies).expect(401);
      // Mật khẩu cũ không dùng được nữa.
      await request().post('/api/auth/login').send({ username: 'admin', password: 'admin@' }).expect(401);

      const moi = await login('admin', 'MatKhauMoi@2026');
      expect(moi.user.mustChangePassword).toBe(false);
    });
  });

  describe('Tự khóa phiên', () => {
    it('chỉ nhận 5, 10, 15 hoặc 30 phút', async () => {
      const session = await login();
      await authed(session.accessToken).patch('/api/auth/auto-lock').send({ autoLockMinutes: 15 }).expect(200);
      await authed(session.accessToken).patch('/api/auth/auto-lock').send({ autoLockMinutes: 7 }).expect(400);
    });
  });

  describe('GET /api/health', () => {
    it('không cần đăng nhập và báo trạng thái database', async () => {
      const response = await request().get('/api/health').expect(200);
      expect(response.body.data).toMatchObject({ status: 'ok', database: 'connected' });
    });
  });
});
