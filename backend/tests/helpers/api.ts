import '../setup/test-env';

import type { Express } from 'express';
import supertest from 'supertest';
import { createApp } from '../../src/app';

/**
 * Client gọi API trong cùng tiến trình test (không cần chạy `npm run dev`).
 * Supertest tự mở cổng tạm cho từng yêu cầu.
 */
let app: Express | null = null;

export function testApp(): Express {
  app ??= createApp();
  return app;
}

export const request = () => supertest(testApp());

export interface AuthSession {
  accessToken: string;
  /** Cookie refresh, cần cho các test gọi /auth/refresh. */
  cookies: string[];
  user: { id: string; username: string; role: string; mustChangePassword: boolean };
}

/** Đăng nhập và trả token; mặc định dùng tài khoản seed. */
export async function login(
  username = 'admin',
  password = 'admin@',
): Promise<AuthSession> {
  const response = await request()
    .post('/api/auth/login')
    .send({ username, password })
    .expect(200);

  const raw = response.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];

  return { accessToken: response.body.data.accessToken, cookies, user: response.body.data.user };
}

/** Bộ helper gắn sẵn Authorization để test khỏi lặp lại. */
export function authed(token: string) {
  const bearer = `Bearer ${token}`;
  return {
    get: (path: string) => request().get(path).set('Authorization', bearer),
    post: (path: string) => request().post(path).set('Authorization', bearer),
    put: (path: string) => request().put(path).set('Authorization', bearer),
    patch: (path: string) => request().patch(path).set('Authorization', bearer),
    delete: (path: string) => request().delete(path).set('Authorization', bearer),
  };
}

/** Ghép tham số phạm vi thành query string. */
export function scopeQuery(scope: {
  yearId: string;
  semesterId?: string;
  weekId?: string;
  campusId?: string;
}): string {
  const params = new URLSearchParams({ yearId: scope.yearId });
  if (scope.semesterId) params.set('semesterId', scope.semesterId);
  if (scope.weekId) params.set('weekId', scope.weekId);
  if (scope.campusId) params.set('campusId', scope.campusId);
  return params.toString();
}
