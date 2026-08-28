import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env';
import { unauthorized } from '../../lib/errors';
import { asyncHandler, ok, parseOrThrow } from '../../lib/http';
import { currentUserId, requireAuth } from '../../middleware/auth';
import * as auth from './auth.service';

const REFRESH_COOKIE = 'tpt_refresh';

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Hãy nhập tên đăng nhập.').max(64),
  password: z.string().min(1, 'Hãy nhập mật khẩu.').max(200),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Hãy nhập mật khẩu hiện tại.'),
    newPassword: z
      .string()
      .min(8, 'Mật khẩu mới phải có ít nhất 8 ký tự.')
      .max(200, 'Mật khẩu mới quá dài.'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Xác nhận mật khẩu không khớp.',
    path: ['confirmPassword'],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
    path: ['newPassword'],
  });

const autoLockSchema = z.object({
  autoLockMinutes: z.coerce.number().int().refine((v) => [5, 10, 15, 30].includes(v), {
    message: 'Chỉ nhận 5, 10, 15 hoặc 30 phút.',
  }),
});

/** Giới hạn riêng, chặt hơn cho các điểm cuối xác thực. */
const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Quá nhiều lần thử. Hãy đợi một phút rồi thao tác lại.' },
  },
});

const cookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'lax' as const,
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const authRouter = Router();

authRouter.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(loginSchema, req.body);
    const result = await auth.login(body.username, body.password, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions);
    return ok(res, {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    });
  }),
);

authRouter.post(
  '/refresh',
  authLimiter,
  asyncHandler(async (req, res) => {
    const token =
      (req.cookies?.[REFRESH_COOKIE] as string | undefined) ??
      (typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined);
    if (!token) throw unauthorized('Không tìm thấy phiên làm việc. Hãy đăng nhập lại.');

    const result = await auth.refresh(token, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions);
    return ok(res, {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await auth.logout(req.cookies?.[REFRESH_COOKIE] as string | undefined);
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions, maxAge: undefined });
    return ok(res, { message: 'Đã đóng phiên làm việc.' });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => ok(res, await auth.getUser(currentUserId(req)))),
);

authRouter.post(
  '/change-password',
  requireAuth,
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(changePasswordSchema, req.body);
    await auth.changePassword(currentUserId(req), body.currentPassword, body.newPassword);
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions, maxAge: undefined });
    return ok(res, { message: 'Đã đổi mật khẩu. Hãy đăng nhập lại bằng mật khẩu mới.' });
  }),
);

authRouter.patch(
  '/auto-lock',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(autoLockSchema, req.body);
    return ok(res, await auth.updateAutoLock(currentUserId(req), body.autoLockMinutes));
  }),
);

authRouter.post(
  '/logout-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    await auth.logoutAll(currentUserId(req));
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions, maxAge: undefined });
    return ok(res, { message: 'Đã đóng toàn bộ phiên trên mọi thiết bị.' });
  }),
);
