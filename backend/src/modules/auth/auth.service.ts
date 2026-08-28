import crypto from 'node:crypto';
import type { User, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { blocked, forbidden, invalidCredentials, notFound, unauthorized } from '../../lib/errors';
import { prisma } from '../../lib/prisma';

export interface AccessTokenPayload {
  sub: string;
  username: string;
  role: UserRole;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: PublicUser;
}

export interface PublicUser {
  id: string;
  username: string;
  email: string | null;
  fullName: string;
  role: UserRole;
  autoLockMinutes: number;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    autoLockMinutes: user.autoLockMinutes,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  };
}

const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Backoff khi nhập sai mật khẩu — giữ đúng thuật toán của bản gốc:
 *   delay = attempts < 3 ? 0 : min(30, 2^(attempts-3))  (giây)
 * Khác biệt: nay chạy phía server nên không thể bỏ qua bằng DevTools.
 */
export function backoffSeconds(failedAttempts: number): number {
  if (failedAttempts < 3) return 0;
  return Math.min(30, 2 ** (failedAttempts - 3));
}

function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as SignOptions);
}

function refreshExpiryDate(): Date {
  const match = /^(\d+)([smhd])$/.exec(env.JWT_REFRESH_EXPIRES_IN);
  const multipliers: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  const ms = match ? Number(match[1]) * (multipliers[match[2]!] ?? 86_400_000) : 7 * 86_400_000;
  return new Date(Date.now() + ms);
}

/** Số giây sống của access token — frontend dùng để lên lịch làm mới. */
function accessTokenTtlSeconds(): number {
  const match = /^(\d+)([smhd])$/.exec(env.JWT_EXPIRES_IN);
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3_600, d: 86_400 };
  return match ? Number(match[1]) * (multipliers[match[2]!] ?? 60) : 900;
}

async function issueSession(
  user: User,
  context: { userAgent?: string; ipAddress?: string },
): Promise<AuthResult> {
  const refreshToken = crypto.randomBytes(48).toString('hex');

  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshExpiryDate(),
      userAgent: context.userAgent ?? null,
      ipAddress: context.ipAddress ?? null,
    },
  });

  return {
    accessToken: signAccessToken({ sub: user.id, username: user.username, role: user.role }),
    refreshToken,
    expiresIn: accessTokenTtlSeconds(),
    user: toPublicUser(user),
  };
}

export async function login(
  username: string,
  password: string,
  context: { userAgent?: string; ipAddress?: string },
): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { username } });

  // Không tiết lộ tài khoản có tồn tại hay không.
  if (!user || user.deletedAt) throw invalidCredentials();
  if (!user.active) throw forbidden('Tài khoản đã bị vô hiệu hóa. Hãy liên hệ quản trị viên.');

  if (user.blockedUntil && user.blockedUntil.getTime() > Date.now()) {
    throw blocked(Math.ceil((user.blockedUntil.getTime() - Date.now()) / 1000));
  }

  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) {
    const failedAttempts = user.failedAttempts + 1;
    const wait = backoffSeconds(failedAttempts);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts,
        blockedUntil: wait > 0 ? new Date(Date.now() + wait * 1000) : null,
      },
    });
    throw wait > 0 ? blocked(wait) : invalidCredentials();
  }

  const refreshed = await prisma.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, blockedUntil: null, lastLoginAt: new Date() },
  });

  return issueSession(refreshed, context);
}

export async function refresh(
  refreshToken: string,
  context: { userAgent?: string; ipAddress?: string },
): Promise<AuthResult> {
  const session = await prisma.session.findFirst({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null, expiresAt: { gt: new Date() } },
    include: { user: true },
  });

  if (!session || !session.user.active || session.user.deletedAt) {
    throw unauthorized('Phiên làm việc không còn hiệu lực. Hãy đăng nhập lại.');
  }

  // Xoay vòng refresh token: token cũ bị thu hồi ngay khi cấp token mới.
  await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });

  return issueSession(session.user, context);
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  await prisma.session.updateMany({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function logoutAll(userId: string): Promise<void> {
  await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
  } catch {
    throw unauthorized();
  }
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('Tài khoản');

  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw invalidCredentials('Mật khẩu hiện tại không đúng.');
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS),
        mustChangePassword: false,
      },
    }),
    // Đổi mật khẩu thì mọi phiên cũ phải mất hiệu lực.
    prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

export async function getUser(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) throw notFound('Tài khoản');
  return toPublicUser(user);
}

export async function updateAutoLock(userId: string, minutes: number): Promise<PublicUser> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { autoLockMinutes: minutes },
  });
  return toPublicUser(user);
}

/** Dọn phiên hết hạn — gọi định kỳ lúc khởi động và mỗi ngày. */
export async function purgeExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }] },
  });
  return result.count;
}
