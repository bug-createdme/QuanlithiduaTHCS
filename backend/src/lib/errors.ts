/**
 * Phân loại lỗi theo đúng các nhóm Phase 12 yêu cầu:
 * Validation · Database · API · Auth · Permission · Network · Not Found · Conflict.
 * Mỗi lỗi mang mã máy đọc được (`code`) và thông điệp tiếng Việt cho người dùng.
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTH_REQUIRED'
  | 'AUTH_INVALID'
  | 'AUTH_BLOCKED'
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'REVISION_CONFLICT'
  | 'IMMUTABLE_RECORD'
  | 'READ_ONLY_YEAR'
  | 'BUSINESS_RULE'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'DATABASE_ERROR'
  | 'INTERNAL_ERROR';

export interface FieldIssue {
  field: string;
  message: string;
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly issues?: FieldIssue[];
  readonly details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    options?: { issues?: FieldIssue[]; details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.issues = options?.issues;
    this.details = options?.details;
    Error.captureStackTrace?.(this, AppError);
  }
}

export const badRequest = (message: string, issues?: FieldIssue[]) =>
  new AppError(400, 'VALIDATION_ERROR', message, { issues });

export const unauthorized = (message = 'Phiên làm việc đã hết hạn. Hãy đăng nhập lại.') =>
  new AppError(401, 'AUTH_REQUIRED', message);

export const invalidCredentials = (message = 'Tên đăng nhập hoặc mật khẩu không đúng.') =>
  new AppError(401, 'AUTH_INVALID', message);

export const blocked = (waitSeconds: number) =>
  new AppError(429, 'AUTH_BLOCKED', `Sai mật khẩu nhiều lần. Thử lại sau ${waitSeconds} giây.`, {
    details: { waitSeconds },
  });

export const forbidden = (message = 'Tài khoản không có quyền thực hiện thao tác này.') =>
  new AppError(403, 'PERMISSION_DENIED', message);

export const notFound = (what = 'Bản ghi') => new AppError(404, 'NOT_FOUND', `${what} không tồn tại.`);

export const conflict = (message: string, details?: Record<string, unknown>) =>
  new AppError(409, 'CONFLICT', message, { details });

/** Tái hiện RevisionConflictError của bản gốc. */
export const revisionConflict = (currentRevision: number) =>
  new AppError(409, 'REVISION_CONFLICT', 'Bản ghi đã thay đổi ở nơi khác; dữ liệu chưa được ghi đè.', {
    details: { currentRevision },
  });

export const immutable = (message: string) => new AppError(409, 'IMMUTABLE_RECORD', message);

export const readOnlyYear = () =>
  new AppError(
    409,
    'READ_ONLY_YEAR',
    'Năm học đã đóng và đang ở chế độ chỉ đọc. Hãy mở quyền sửa có lý do trước khi thay đổi.',
  );

/** Vi phạm quy tắc nghiệp vụ — dữ liệu đúng định dạng nhưng sai luật. */
export const businessRule = (message: string, details?: Record<string, unknown>) =>
  new AppError(422, 'BUSINESS_RULE', message, { details });

export const payloadTooLarge = (maxMb: number) =>
  new AppError(413, 'PAYLOAD_TOO_LARGE', `Tệp vượt quá giới hạn ${maxMb} MB.`, { details: { maxMb } });
