import path from 'node:path';

/**
 * Đường dẫn tương đối của tệp đính kèm trong `UPLOAD_DIR`.
 *
 * LUÔN dùng dấu `/`, không phụ thuộc hệ điều hành đang chạy.
 *
 * `path.join` sinh `\` trên Windows, và chuỗi đó được ghi thẳng vào cột
 * `storage_path`. Hậu quả có hai mặt:
 *
 *   • Mang cơ sở dữ liệu sang Linux để triển khai thì `\` không còn là dấu
 *     phân tách, nên mọi tệp đính kèm tạo trên Windows đều không mở được.
 *   • Lúc xóa vĩnh viễn, mã nguồn đếm số bản ghi dùng chung `storagePath` để
 *     biết có được xóa tệp vật lý hay không. Hai bản ghi cùng nội dung nhưng
 *     tạo trên hai hệ điều hành khác nhau sẽ có chuỗi khác nhau, phép đếm
 *     trượt, và tệp của hồ sơ còn lại bị xóa mất.
 *
 * Cây thư mục băm hai tầng theo checksum để không dồn quá nhiều tệp một chỗ.
 */
export function buildStoragePath(checksum: string, extension: string): string {
  return path.posix.join(
    checksum.slice(0, 2),
    checksum.slice(2, 4),
    `${checksum}${extension}`,
  );
}

/**
 * Ghép đường dẫn tuyệt đối từ giá trị `storage_path` đọc lên từ cơ sở dữ liệu.
 *
 * Chấp nhận cả `\` lẫn `/` để những bản ghi tạo trên Windows trước khi có
 * `buildStoragePath` vẫn mở được sau khi chuyển hệ thống sang Linux — kể cả
 * khi migration chuẩn hóa dữ liệu chưa kịp chạy.
 */
export function resolveStoragePath(uploadDir: string, storagePath: string): string {
  const segments = storagePath.split(/[\\/]+/).filter(Boolean);
  return path.join(uploadDir, ...segments);
}
