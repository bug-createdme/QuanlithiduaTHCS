-- Tổng điểm thi đua từng lớp trong một tuần, tính đúng công thức của ứng dụng.
-- Thay :week_id bằng UUID tuần cần xem.
--   docker compose exec -T postgres psql -U tpt -d tpt_doi_thcs \
--     -v week_id="'<uuid>'" -f - < database/queries/competition-report.sql

SELECT
  c.class_name                                   AS lop,
  cam.name                                       AS co_so,
  cs.base_score
    + COALESCE(SUM(
        CASE
          WHEN e.entry_state <> 'VALUE' THEN 0
          WHEN cr.data_type = 'COUNT'   THEN e.value * cr.points
          WHEN cr.data_type = 'BOOLEAN' THEN CASE WHEN e.value <> 0 THEN cr.points ELSE 0 END
          WHEN cr.data_type = 'NOTE'    THEN 0
          ELSE e.value
        END
        * CASE WHEN cs.formula = 'WEIGHTED' THEN cr.weight ELSE 1 END
      ), 0)                                      AS tong_diem,
  count(e.id)                                    AS so_o_da_nhap,
  (SELECT count(*) FROM criteria x
     WHERE x.criteria_set_id = cs.id AND x.active AND x.deleted_at IS NULL) AS tong_tieu_chi,
  s.status                                       AS trang_thai_bang
FROM weekly_score_sheets s
JOIN criteria_sets cs ON cs.id = s.criteria_set_id
JOIN classes c        ON c.school_year_id = s.school_year_id AND c.active AND c.deleted_at IS NULL
LEFT JOIN campuses cam ON cam.id = c.campus_id
LEFT JOIN score_entries e ON e.sheet_id = s.id AND e.class_id = c.id AND e.deleted_at IS NULL
LEFT JOIN criteria cr     ON cr.id = e.criteria_id
WHERE s.week_id = :week_id AND s.deleted_at IS NULL
GROUP BY c.class_name, cam.name, cs.base_score, cs.id, s.status
ORDER BY tong_diem DESC, c.class_name;
