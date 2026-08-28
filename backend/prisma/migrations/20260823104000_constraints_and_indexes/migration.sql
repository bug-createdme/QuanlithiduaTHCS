-- ============================================================================
--  Ràng buộc CHECK, extension và index không biểu diễn được trong schema.prisma
--  Nguồn: DATABASE_DESIGN.md §5.2 và §5.3
-- ============================================================================

-- --- Extension phục vụ tìm kiếm tiếng Việt bỏ dấu ---------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- --- CHECK: năm học ---------------------------------------------------------
ALTER TABLE "school_years"
  ADD CONSTRAINT "chk_year_dates" CHECK ("end_date" > "start_date");

-- --- CHECK: học kỳ ----------------------------------------------------------
ALTER TABLE "semesters"
  ADD CONSTRAINT "chk_semester_dates" CHECK ("end_date" >= "start_date");

-- --- CHECK: tuần học --------------------------------------------------------
ALTER TABLE "school_weeks"
  ADD CONSTRAINT "chk_week_dates" CHECK ("end_date" >= "start_date"),
  ADD CONSTRAINT "chk_week_number" CHECK ("number" >= 1 AND "number" <= 60);

-- --- CHECK: lớp -------------------------------------------------------------
ALTER TABLE "classes"
  ADD CONSTRAINT "chk_class_grade" CHECK ("grade" BETWEEN 1 AND 9);

-- --- CHECK: kế hoạch --------------------------------------------------------
ALTER TABLE "plans"
  ADD CONSTRAINT "chk_plan_progress" CHECK ("progress" BETWEEN 0 AND 100),
  ADD CONSTRAINT "chk_plan_dates" CHECK ("end_date" >= "start_date");

-- --- CHECK: công việc -------------------------------------------------------
ALTER TABLE "tasks"
  ADD CONSTRAINT "chk_task_progress" CHECK ("progress" BETWEEN 0 AND 100),
  ADD CONSTRAINT "chk_task_dates" CHECK ("start_date" IS NULL OR "due_date" >= "start_date");

-- --- CHECK: phụ thuộc công việc không tự trỏ vào chính nó -------------------
ALTER TABLE "task_dependencies"
  ADD CONSTRAINT "chk_dependency_no_self" CHECK ("task_id" <> "depends_on_id");

-- --- CHECK: bộ tiêu chí -----------------------------------------------------
ALTER TABLE "criteria_sets"
  ADD CONSTRAINT "chk_set_effective_range"
    CHECK ("effective_to" IS NULL OR "effective_from" IS NULL OR "effective_to" >= "effective_from");

-- --- CHECK: tiêu chí --------------------------------------------------------
ALTER TABLE "criteria"
  ADD CONSTRAINT "chk_criterion_range"
    CHECK ("min_value" IS NULL OR "max_value" IS NULL OR "max_value" >= "min_value"),
  ADD CONSTRAINT "chk_criterion_decimals" CHECK ("decimals" BETWEEN 0 AND 3),
  ADD CONSTRAINT "chk_criterion_weight" CHECK ("weight" >= 0);

-- --- CHECK: ô điểm ----------------------------------------------------------
-- VALUE bắt buộc có số; NA/EXEMPT bắt buộc không có số.
ALTER TABLE "score_entries"
  ADD CONSTRAINT "chk_entry_value_state" CHECK (
    ("entry_state" = 'VALUE'  AND "value" IS NOT NULL) OR
    ("entry_state" <> 'VALUE' AND "value" IS NULL)
  );

-- --- CHECK: thiết bị --------------------------------------------------------
ALTER TABLE "equipment"
  ADD CONSTRAINT "chk_equipment_quantity" CHECK ("quantity" >= 0);

ALTER TABLE "equipment_transactions"
  ADD CONSTRAINT "chk_equipment_tx_quantity" CHECK ("quantity" > 0);

-- --- CHECK: mã cơ sở chỉ gồm ký tự an toàn ----------------------------------
ALTER TABLE "campuses"
  ADD CONSTRAINT "chk_campus_code_format" CHECK ("code" ~ '^[A-Za-z0-9_-]+$');

-- --- CHECK: mã mục cấu hình -------------------------------------------------
ALTER TABLE "config_items"
  ADD CONSTRAINT "chk_config_code_format" CHECK ("code" ~ '^[A-Za-z0-9_-]+$');

-- --- CHECK: báo cáo đã chốt phải bất biến -----------------------------------
ALTER TABLE "generated_reports"
  ADD CONSTRAINT "chk_report_immutable_consistency" CHECK (
    ("status" = 'FINALIZED' AND "immutable" = true) OR "status" <> 'FINALIZED'
  );

-- --- Index tìm kiếm mờ bỏ dấu ----------------------------------------------
CREATE INDEX "documents_search_text_trgm_idx"
  ON "documents" USING GIN ("search_text" gin_trgm_ops);

CREATE INDEX "config_items_search_text_trgm_idx"
  ON "config_items" USING GIN ("search_text" gin_trgm_ops);

-- --- Index một phần: chỉ đúng MỘT năm học được đánh dấu hiện hành -----------
CREATE UNIQUE INDEX "school_years_only_one_current_idx"
  ON "school_years" ("school_id")
  WHERE "is_current" = true;

-- --- Index một phần: bỏ qua bản ghi đã xóa mềm trong truy vấn nóng ----------
CREATE INDEX "tasks_active_due_idx"
  ON "tasks" ("school_year_id", "due_date")
  WHERE "deleted_at" IS NULL;

CREATE INDEX "score_entries_active_sheet_idx"
  ON "score_entries" ("sheet_id")
  WHERE "deleted_at" IS NULL;

CREATE INDEX "documents_active_idx"
  ON "documents" ("school_year_id", "updated_at" DESC)
  WHERE "deleted_at" IS NULL;
