-- Kiểm tra nhanh tình trạng cơ sở dữ liệu sau khi cài đặt.
-- Dùng: docker compose exec -T postgres psql -U tpt -d tpt_doi_thcs -f - < database/queries/health-check.sql

\echo '=== Số bảng nghiệp vụ ==='
SELECT count(*) AS tables
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

\echo '=== Extension bắt buộc (cần có pg_trgm và unaccent) ==='
SELECT extname FROM pg_extension ORDER BY 1;

\echo '=== Ràng buộc CHECK tự đặt ==='
SELECT count(*) AS check_constraints
FROM pg_constraint WHERE contype = 'c' AND conname LIKE 'chk_%';

\echo '=== Dữ liệu khởi tạo ==='
SELECT
  (SELECT count(*) FROM schools)        AS truong,
  (SELECT count(*) FROM campuses)       AS co_so,
  (SELECT count(*) FROM school_years)   AS nam_hoc,
  (SELECT count(*) FROM semesters)      AS hoc_ky,
  (SELECT count(*) FROM school_weeks)   AS tuan,
  (SELECT count(*) FROM classes)        AS lop,
  (SELECT count(*) FROM criteria)       AS tieu_chi,
  (SELECT count(*) FROM config_items)   AS muc_cau_hinh,
  (SELECT count(*) FROM task_templates) AS mau_cong_viec,
  (SELECT count(*) FROM users)          AS tai_khoan;

\echo '=== Chỉ được có ĐÚNG MỘT năm học hiện hành ==='
SELECT count(*) AS nam_hien_hanh FROM school_years WHERE is_current;
