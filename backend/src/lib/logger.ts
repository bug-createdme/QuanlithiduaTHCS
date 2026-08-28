import pino from 'pino';
import { env } from '../config/env';

/**
 * Logger cấu trúc. Thay cho console.log — Phase 12 cấm dùng console.log
 * làm cơ chế xử lý lỗi chính.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'tpt-doi-thcs-api' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.currentPassword',
      'req.body.newPassword',
      'res.headers["set-cookie"]',
    ],
    censor: '[đã ẩn]',
  },
  transport: env.isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname,service' },
      },
});
