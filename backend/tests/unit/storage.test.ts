import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildStoragePath, resolveStoragePath } from '../../src/lib/storage';

const CHECKSUM = 'b34b56459885ca93b562c65bcd6487033e4724d9173bdc2cdab9c48ec0077476';
/** Chuỗi một ký tự `\` — viết tách ra cho khỏi rối khi đọc các bài kiểm dưới. */
const BS = '\\';

describe('buildStoragePath', () => {
  /**
   * Bài kiểm quan trọng nhất của tệp này, và là bài duy nhất phân biệt được
   * đúng/sai ngay trên Windows: `path.join` cũ sinh `\` và chuỗi đó bị ghi
   * thẳng vào cột `storage_path`, để rồi hỏng khi hệ thống chuyển sang Linux.
   */
  it('luôn dùng dấu / bất kể hệ điều hành đang chạy', () => {
    const result = buildStoragePath(CHECKSUM, '.jpg');
    expect(result).toBe(`b3/4b/${CHECKSUM}.jpg`);
    expect(result).not.toContain(BS);
  });

  it('tách hai tầng thư mục từ bốn ký tự đầu của checksum', () => {
    expect(buildStoragePath(CHECKSUM, '.pdf').split('/')).toEqual([
      'b3',
      '4b',
      `${CHECKSUM}.pdf`,
    ]);
  });

  it('chấp nhận tệp không có phần mở rộng', () => {
    expect(buildStoragePath(CHECKSUM, '')).toBe(`b3/4b/${CHECKSUM}`);
  });
});

describe('resolveStoragePath', () => {
  const uploadDir = path.join('C:', 'du-lieu', 'uploads');
  const expected = path.join(uploadDir, 'b3', '4b', `${CHECKSUM}.jpg`);
  /** Đúng dạng chuỗi mà bản chạy trên Windows trước đây đã ghi vào cơ sở dữ liệu. */
  const legacyWindows = `b3${BS}4b${BS}${CHECKSUM}.jpg`;

  it('ghép được đường dẫn kiểu POSIX', () => {
    expect(resolveStoragePath(uploadDir, `b3/4b/${CHECKSUM}.jpg`)).toBe(expected);
  });

  it('ghép được cả bản ghi cũ lưu dấu \\ của Windows', () => {
    // Trên Linux, path.join() cũ coi cả chuỗi `b3\4b\xxx.jpg` là MỘT tên tệp
    // nên không tìm thấy tệp. Trên Windows thì `\` vẫn là dấu phân tách hợp lệ,
    // nên bài kiểm này chỉ thực sự bắt được lỗi khi chạy trên Linux.
    expect(resolveStoragePath(uploadDir, legacyWindows)).toBe(expected);
  });

  it('hai kiểu dấu phân tách cho ra cùng một đường dẫn tuyệt đối', () => {
    expect(resolveStoragePath(uploadDir, legacyWindows)).toBe(
      resolveStoragePath(uploadDir, `b3/4b/${CHECKSUM}.jpg`),
    );
  });

  it('bỏ qua dấu phân tách thừa và lặp', () => {
    expect(resolveStoragePath(uploadDir, `/b3//4b/${CHECKSUM}.jpg`)).toBe(expected);
  });
});
