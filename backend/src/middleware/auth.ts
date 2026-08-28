import type { UserRole } from '@prisma/client';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { forbidden, unauthorized } from '../lib/errors';
import { verifyAccessToken, type AccessTokenPayload } from '../modules/auth/auth.service';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

function readBearer(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return undefined;
}

/** Chặn mọi request chưa có access token hợp lệ. */
export const requireAuth: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const token = readBearer(req);
  if (!token) return next(unauthorized('Thiếu thông tin xác thực. Hãy đăng nhập.'));
  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch (error) {
    return next(error);
  }
};

/** Giới hạn theo vai trò. ADMIN luôn được đi qua. */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (req.user.role === 'ADMIN' || roles.includes(req.user.role)) return next();
    return next(forbidden());
  };
}

/** Chặn thao tác ghi đối với tài khoản chỉ xem. */
export const requireWrite: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(unauthorized());
  if (req.user.role === 'VIEWER') {
    return next(forbidden('Tài khoản chỉ có quyền xem, không thể thay đổi dữ liệu.'));
  }
  return next();
};

/** Lấy id người dùng hiện tại; ném lỗi nếu chưa xác thực. */
export function currentUserId(req: Request): string {
  if (!req.user) throw unauthorized();
  return req.user.sub;
}
