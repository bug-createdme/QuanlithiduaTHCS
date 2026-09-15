-- Chuẩn hóa dấu phân tách trong `storage_path` về `/`.
--
-- `path.join` sinh dấu gạch ngược trên Windows và chuỗi đó được ghi thẳng vào
-- cột này. Hậu quả khi mang cơ sở dữ liệu sang Linux để triển khai:
--
--   • Gạch ngược không còn là dấu phân tách, nên mọi tệp đính kèm tạo trên
--     Windows đều không mở được — bản ghi vẫn còn nhưng tệp coi như mất.
--   • Lúc xóa vĩnh viễn, mã nguồn đếm số bản ghi dùng chung `storage_path` để
--     quyết định có xóa tệp vật lý hay không. Hai bản ghi cùng nội dung nhưng
--     tạo trên hai hệ điều hành khác nhau sẽ có chuỗi khác nhau, phép đếm
--     trượt, và tệp của hồ sơ còn lại bị xóa oan.
--
-- Mã nguồn đã chuyển sang `buildStoragePath()` (luôn sinh `/`); migration này
-- dọn nốt dữ liệu đã ghi trước đó. Không đụng `updated_at` và `revision` vì
-- đây là sửa kỹ thuật, không phải người dùng chỉnh sửa hồ sơ.
--
-- Dùng cú pháp chuỗi thoát E'...' để biểu diễn một ký tự gạch ngược, không phụ
-- thuộc vào tham số standard_conforming_strings của máy chủ.

UPDATE "attachments"
SET "storage_path" = replace("storage_path", E'\\', '/')
WHERE position(E'\\' in "storage_path") > 0;

UPDATE "file_versions"
SET "storage_path" = replace("storage_path", E'\\', '/')
WHERE position(E'\\' in "storage_path") > 0;
