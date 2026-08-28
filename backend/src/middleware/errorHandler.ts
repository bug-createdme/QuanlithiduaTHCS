import { Prisma } from '@prisma/client';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { AppError, type ErrorCode } from '../lib/errors';
import { zodIssues } from '../lib/http';
import { logger } from '../lib/logger';

interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    issues?: Array<{ field: string; message: string }>;
    details?: Record<string, unknown>;
    stack?: string;
  };
}

/** Dịch mã lỗi Prisma sang thông điệp tiếng Việt người dùng hiểu được. */
function fromPrisma(error: Prisma.PrismaClientKnownRequestError): AppError {
  const target = (error.meta?.target as string[] | string | undefined) ?? [];
  const fields = Array.isArray(target) ? target.join(', ') : String(target);

  switch (error.code) {
    case 'P2002':
      return new AppError(409, 'CONFLICT', `Giá trị đã tồn tại (${fields || 'trường duy nhất'}).`, {
        details: { fields: target },
      });
    case 'P2003':
      return new AppError(409, 'CONFLICT', 'Không thể thao tác vì bản ghi đang được dữ liệu khác tham chiếu.', {
        details: { field: error.meta?.field_name },
      });
    case 'P2025':
      return new AppError(404, 'NOT_FOUND', 'Bản ghi không tồn tại hoặc đã bị xóa.');
    case 'P2000':
      return new AppError(400, 'VALIDATION_ERROR', `Giá trị quá dài cho trường ${fields}.`);
    case 'P2011':
      return new AppError(400, 'VALIDATION_ERROR', `Trường bắt buộc đang để trống (${fields}).`);
    default:
      return new AppError(500, 'DATABASE_ERROR', 'Lỗi cơ sở dữ liệu. Thao tác chưa được ghi.', {
        details: { prismaCode: error.code },
      });
  }
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let appError: AppError;

  if (err instanceof AppError) {
    appError = err;
  } else if (err instanceof ZodError) {
    appError = new AppError(400, 'VALIDATION_ERROR', 'Dữ liệu gửi lên không hợp lệ.', {
      issues: zodIssues(err),
    });
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    appError = fromPrisma(err);
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    appError = new AppError(400, 'VALIDATION_ERROR', 'Truy vấn dữ liệu không hợp lệ.');
  } else if (err instanceof Prisma.PrismaClientInitializationError) {
    appError = new AppError(503, 'DATABASE_ERROR', 'Không kết nối được cơ sở dữ liệu. Hãy kiểm tra PostgreSQL.');
  } else if (err instanceof multer.MulterError) {
    appError =
      err.code === 'LIMIT_FILE_SIZE'
        ? new AppError(413, 'PAYLOAD_TOO_LARGE', `Tệp vượt quá giới hạn ${env.MAX_FILE_MB} MB.`)
        : new AppError(400, 'VALIDATION_ERROR', `Lỗi tải tệp: ${err.message}`);
  } else {
    appError = new AppError(500, 'INTERNAL_ERROR', 'Đã xảy ra lỗi không mong muốn trên máy chủ.');
  }

  const log = { err, code: appError.code, method: req.method, url: req.originalUrl };
  if (appError.statusCode >= 500) logger.error(log, appError.message);
  else logger.warn(log, appError.message);

  const body: ErrorBody = {
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.issues ? { issues: appError.issues } : {}),
      ...(appError.details ? { details: appError.details } : {}),
      ...(env.isProduction ? {} : { stack: (err as Error)?.stack }),
    },
  };

  res.status(appError.statusCode).json(body);
};

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND' satisfies ErrorCode,
      message: `Không tìm thấy điểm cuối ${req.method} ${req.originalUrl}.`,
    },
  });
};
