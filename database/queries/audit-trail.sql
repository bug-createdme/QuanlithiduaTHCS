-- Truy vết mọi thay đổi điểm thi đua và trạng thái bảng tuần.
SELECT
  a.created_at            AS thoi_gian,
  u.full_name             AS nguoi_thuc_hien,
  a.action                AS hanh_dong,
  a.entity                AS bang,
  a.summary               AS noi_dung,
  a.old_value             AS gia_tri_cu,
  a.new_value             AS gia_tri_moi,
  a.reason                AS ly_do
FROM audit_logs a
LEFT JOIN users u ON u.id = a.user_id
WHERE a.entity IN ('score_entries', 'weekly_score_sheets')
ORDER BY a.created_at DESC
LIMIT 200;
