-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "YearStatus" AS ENUM ('OPEN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PlanLevel" AS ENUM ('YEAR', 'SEMESTER', 'MONTH', 'WEEK');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'DOING', 'WAITING', 'REVIEW', 'DONE', 'PAUSED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "RepeatRule" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('FINISH_TO_START', 'START_TO_START');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('PLANNED', 'ACTIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "CriteriaFormula" AS ENUM ('BASE', 'SUM', 'WEIGHTED');

-- CreateEnum
CREATE TYPE "CriteriaSetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'STOPPED');

-- CreateEnum
CREATE TYPE "CriterionDataType" AS ENUM ('SCORE', 'COUNT', 'BOOLEAN', 'CHOICE', 'NOTE');

-- CreateEnum
CREATE TYPE "SheetStatus" AS ENUM ('DRAFT', 'COMPLETE', 'REVIEW', 'APPROVED', 'LOCKED', 'UNLOCKED');

-- CreateEnum
CREATE TYPE "EntryState" AS ENUM ('VALUE', 'NA', 'EXEMPT');

-- CreateEnum
CREATE TYPE "ProgramStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AttachmentStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SYNCED');

-- CreateEnum
CREATE TYPE "EquipmentTxType" AS ENUM ('BORROW', 'RETURN', 'REPAIR', 'DISPOSE');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('WEEK', 'SCORES', 'TASKS', 'ACTIVITIES', 'EQUIPMENT', 'YEAR_SUMMARY');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('NOT_SUBMITTED', 'SUBMITTED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'NUMBER', 'DATE', 'SINGLE_CHOICE', 'MULTI_CHOICE', 'BOOLEAN', 'LINK', 'FILE');

-- CreateEnum
CREATE TYPE "SnapshotTier" AS ENUM ('MANUAL', 'DAILY', 'WEEKLY', 'MONTHLY', 'PROTECTED');

-- CreateEnum
CREATE TYPE "BackupScope" AS ENUM ('QUICK', 'FULL', 'YEAR_PACKAGE');

-- CreateEnum
CREATE TYPE "YearTransitionAction" AS ENUM ('CREATE', 'CLOSE', 'EDIT_OVERRIDE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(64) NOT NULL,
    "email" VARCHAR(160),
    "password_hash" TEXT NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'EDITOR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "blocked_until" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "auto_lock_minutes" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "user_agent" TEXT,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schools" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "code" VARCHAR(50),
    "address" VARCHAR(300),
    "reporter" VARCHAR(120),
    "reporter_title" VARCHAR(120) NOT NULL DEFAULT 'Tổng phụ trách Đội',
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campuses" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "campuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_years" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "status" "YearStatus" NOT NULL DEFAULT 'OPEN',
    "read_only" BOOLEAN NOT NULL DEFAULT false,
    "closed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "school_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semesters" (
    "id" UUID NOT NULL,
    "school_year_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "semesters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_weeks" (
    "id" UUID NOT NULL,
    "school_year_id" UUID NOT NULL,
    "semester_id" UUID,
    "number" INTEGER NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "school_weeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homeroom_teachers" (
    "id" UUID NOT NULL,
    "school_year_id" UUID NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(30),
    "email" VARCHAR(160),
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "homeroom_teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" UUID NOT NULL,
    "school_year_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "code" VARCHAR(30),
    "class_name" VARCHAR(50) NOT NULL,
    "grade" INTEGER NOT NULL,
    "teacher" VARCHAR(120),
    "homeroom_teacher_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "school_year_id" UUID NOT NULL,
    "semester_id" UUID,
    "campus_id" UUID,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "level" "PlanLevel" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "objectives" TEXT NOT NULL,
    "targets" TEXT,
    "basis" TEXT,
    "coordination" VARCHAR(200),
    "resources" VARCHAR(200),
    "risks" TEXT,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "custom_values" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_targets" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "target_value" DECIMAL(12,2),
    "actual_value" DECIMAL(12,2),
    "unit" VARCHAR(30),
    "sort_order" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "plan_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "school_year_id" UUID NOT NULL,
    "semester_id" UUID,
    "campus_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "group_name" VARCHAR(80),
    "start_date" DATE,
    "due_date" DATE NOT NULL,
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "coordination" VARCHAR(200),
    "obstacle" TEXT,
    "notes" TEXT,
    "repeat_rule" "RepeatRule" NOT NULL DEFAULT 'NONE',
    "repeat_until" DATE,
    "repeat_next_at" DATE,
    "repeat_source_id" UUID,
    "repeat_occurrence_key" VARCHAR(120),
    "custom_values" JSONB,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_check_items" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "task_check_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_dependencies" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "depends_on_id" UUID NOT NULL,
    "type" "DependencyType" NOT NULL DEFAULT 'FINISH_TO_START',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_templates" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "group_name" VARCHAR(80) NOT NULL DEFAULT 'Mẫu tham khảo',
    "default_due_offset_days" INTEGER NOT NULL DEFAULT 7,
    "sort_order" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" UUID NOT NULL,
    "school_year_id" UUID NOT NULL,
    "campus_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "date" DATE NOT NULL,
    "time" VARCHAR(5),
    "location" VARCHAR(200),
    "leader" VARCHAR(120),
    "category" VARCHAR(80) NOT NULL DEFAULT 'Hoạt động Đội',
    "reminder_hours" INTEGER NOT NULL DEFAULT 24,
    "safety" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "school_year_id" UUID NOT NULL,
    "campus_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "theme" VARCHAR(150),
    "date" DATE NOT NULL,
    "location" VARCHAR(200) NOT NULL,
    "leader" VARCHAR(120) NOT NULL,
    "participants" VARCHAR(200),
    "objectives" TEXT,
    "safety" TEXT NOT NULL,
    "backup_plan" TEXT,
    "result" TEXT,
    "status" "ActivityStatus" NOT NULL DEFAULT 'PLANNED',
    "custom_values" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "criteria_sets" (
    "id" UUID NOT NULL,
    "school_year_id" UUID NOT NULL,
    "semester_id" UUID,
    "campus_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "version" VARCHAR(20) NOT NULL DEFAULT '1.0',
    "formula" "CriteriaFormula" NOT NULL DEFAULT 'BASE',
    "base_score" DECIMAL(8,2) NOT NULL DEFAULT 100,
    "status" "CriteriaSetStatus" NOT NULL DEFAULT 'DRAFT',
    "effective_from" DATE,
    "effective_to" DATE,
    "basis" TEXT,
    "locked_version" BOOLEAN NOT NULL DEFAULT false,
    "source_set_id" UUID,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "criteria_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "criteria" (
    "id" UUID NOT NULL,
    "criteria_set_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "group_name" VARCHAR(80),
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "data_type" "CriterionDataType" NOT NULL DEFAULT 'SCORE',
    "points" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "min_value" DECIMAL(8,2),
    "max_value" DECIMAL(8,2),
    "decimals" INTEGER NOT NULL DEFAULT 0,
    "weight" DECIMAL(6,2) NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 99,
    "color" VARCHAR(7) NOT NULL DEFAULT '#0b6bcb',
    "evidence_required" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source_criteria_id" UUID,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_score_sheets" (
    "id" UUID NOT NULL,
    "school_year_id" UUID NOT NULL,
    "semester_id" UUID,
    "campus_id" UUID,
    "week_id" UUID NOT NULL,
    "criteria_set_id" UUID NOT NULL,
    "status" "SheetStatus" NOT NULL DEFAULT 'DRAFT',
    "approved_at" TIMESTAMPTZ(3),
    "approved_by_id" UUID,
    "locked_at" TIMESTAMPTZ(3),
    "locked_by_id" UUID,
    "unlocked_at" TIMESTAMPTZ(3),
    "unlock_reason" TEXT,
    "criteria_snapshot" JSONB,
    "reports_stale" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "weekly_score_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_entries" (
    "id" UUID NOT NULL,
    "sheet_id" UUID NOT NULL,
    "school_year_id" UUID NOT NULL,
    "semester_id" UUID,
    "campus_id" UUID,
    "week_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "criteria_id" UUID NOT NULL,
    "entry_state" "EntryState" NOT NULL DEFAULT 'VALUE',
    "value" DECIMAL(10,2),
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "score_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_evidence" (
    "id" UUID NOT NULL,
    "score_entry_id" UUID NOT NULL,
    "attachment_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "score_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranking_snapshots" (
    "id" UUID NOT NULL,
    "school_year_id" UUID NOT NULL,
    "semester_id" UUID,
    "campus_id" UUID,
    "week_id" UUID NOT NULL,
    "sheet_id" UUID NOT NULL,
    "criteria_set_id" UUID NOT NULL,
    "criteria_version" VARCHAR(20),
    "rows" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ranking_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_units" (
    "id" UUID NOT NULL,
    "school_year_id" UUID NOT NULL,
    "campus_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "team_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" UUID NOT NULL,
    "school_year_id" UUID NOT NULL,
    "campus_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "internal_code" VARCHAR(40),
    "class_name" VARCHAR(50) NOT NULL,
    "class_id" UUID,
    "unit" VARCHAR(120) NOT NULL,
    "team_unit_id" UUID,
    "position" VARCHAR(80) NOT NULL,
    "term" VARCHAR(60) NOT NULL,
    "training" TEXT,
    "custom_values" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_records" (
    "id" UUID NOT NULL,
    "team_member_id" UUID NOT NULL,
    "content" VARCHAR(200) NOT NULL,
    "date" DATE,
    "result" VARCHAR(120),
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "training_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" VARCHAR(80),
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_results" (
    "id" UUID NOT NULL,
    "school_year_id" UUID NOT NULL,
    "campus_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "program_id" UUID,
    "scope" VARCHAR(150) NOT NULL,
    "result" VARCHAR(200),
    "recognized_date" DATE,
    "activity" VARCHAR(200),
    "evidence" TEXT,
    "status" "ProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "custom_values" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "program_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commendations" (
    "id" UUID NOT NULL,
    "school_year_id" UUID NOT NULL,
    "campus_id" UUID,
    "award_type" VARCHAR(100) NOT NULL,
    "level" VARCHAR(80) NOT NULL,
    "recipient" VARCHAR(200) NOT NULL,
    "achievement" TEXT NOT NULL,
    "date" DATE,
    "related" VARCHAR(200),
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "decision" VARCHAR(120),
    "notes" TEXT,
    "custom_values" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "commendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_folders" (
    "id" UUID NOT NULL,
    "school_year_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "parent_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "document_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "school_year_id" UUID NOT NULL,
    "campus_id" UUID,
    "folder_id" UUID,
    "name" VARCHAR(250) NOT NULL,
    "type" VARCHAR(80) NOT NULL,
    "document_no" VARCHAR(80),
    "issuer" VARCHAR(150),
    "date" DATE,
    "related" VARCHAR(200),
    "tags" VARCHAR(250),
    "description" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "search_text" TEXT,
    "custom_values" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "file_name" VARCHAR(250) NOT NULL,
    "extension" VARCHAR(12),
    "mime_type" VARCHAR(120),
    "size" BIGINT NOT NULL DEFAULT 0,
    "checksum" CHAR(64),
    "storage_path" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "AttachmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'SYNCED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_versions" (
    "id" UUID NOT NULL,
    "attachment_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "file_name" VARCHAR(250) NOT NULL,
    "size" BIGINT NOT NULL DEFAULT 0,
    "checksum" CHAR(64),
    "storage_path" TEXT NOT NULL,
    "replaced_at" TIMESTAMPTZ(3),
    "replaced_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "file_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_links" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "entity_type" VARCHAR(60) NOT NULL,
    "entity_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "document_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" UUID NOT NULL,
    "school_year_id" UUID NOT NULL,
    "campus_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "group_name" VARCHAR(80),
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unit" VARCHAR(30) NOT NULL,
    "condition" VARCHAR(40) NOT NULL,
    "location" VARCHAR(150),
    "inventory_date" DATE,
    "activity" VARCHAR(200),
    "notes" TEXT,
    "custom_values" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_transactions" (
    "id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "type" "EquipmentTxType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "borrower" VARCHAR(120),
    "borrowed_at" TIMESTAMPTZ(3),
    "due_at" TIMESTAMPTZ(3),
    "returned_at" TIMESTAMPTZ(3),
    "condition_before" VARCHAR(40),
    "condition_after" VARCHAR(40),
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "equipment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_reports" (
    "id" UUID NOT NULL,
    "school_year_id" UUID NOT NULL,
    "campus_id" UUID,
    "name" VARCHAR(250) NOT NULL,
    "type" "ReportType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "immutable" BOOLEAN NOT NULL DEFAULT false,
    "recipient" VARCHAR(200),
    "submission_status" "SubmissionStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "filters" JSONB,
    "scope" JSONB,
    "content_html" TEXT,
    "content_text" TEXT,
    "content_checksum" CHAR(64),
    "source_checksum" CHAR(64),
    "source_record_count" INTEGER NOT NULL DEFAULT 0,
    "config_snapshot" JSONB,
    "generated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalized_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "generated_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_packages" (
    "id" UUID NOT NULL,
    "school_year_id" UUID NOT NULL,
    "name" VARCHAR(250) NOT NULL,
    "checksum" CHAR(64),
    "report_count" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "report_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_categories" (
    "id" UUID NOT NULL,
    "key" VARCHAR(60) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "config_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_items" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "category_key" VARCHAR(60) NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "color" VARCHAR(7) NOT NULL DEFAULT '#0b6bcb',
    "icon" VARCHAR(8) NOT NULL DEFAULT '•',
    "sort_order" INTEGER NOT NULL DEFAULT 99,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "search_text" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "config_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_definitions" (
    "id" UUID NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "field_type" "CustomFieldType" NOT NULL DEFAULT 'SHORT_TEXT',
    "options" TEXT,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 99,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" VARCHAR(80) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "action" VARCHAR(60) NOT NULL,
    "entity" VARCHAR(60) NOT NULL,
    "entity_id" UUID,
    "summary" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "reason" TEXT,
    "user_id" UUID,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snapshots" (
    "id" UUID NOT NULL,
    "name" VARCHAR(250) NOT NULL,
    "tier" "SnapshotTier" NOT NULL DEFAULT 'MANUAL',
    "protected" BOOLEAN NOT NULL DEFAULT false,
    "reason" VARCHAR(80),
    "school_year_id" UUID,
    "record_count" INTEGER NOT NULL DEFAULT 0,
    "counts" JSONB,
    "checksum" CHAR(64),
    "payload" JSONB NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_records" (
    "id" UUID NOT NULL,
    "name" VARCHAR(250) NOT NULL,
    "scope" "BackupScope" NOT NULL DEFAULT 'QUICK',
    "size" BIGINT NOT NULL DEFAULT 0,
    "checksum" CHAR(64),
    "record_count" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_logs" (
    "id" UUID NOT NULL,
    "from_schema" INTEGER,
    "to_schema" INTEGER,
    "status" VARCHAR(40) NOT NULL,
    "detail" JSONB,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "migration_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "year_transition_logs" (
    "id" UUID NOT NULL,
    "from_year_id" UUID,
    "to_year_id" UUID,
    "action" "YearTransitionAction" NOT NULL,
    "reason" TEXT,
    "detail" JSONB,
    "user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "year_transition_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_active_idx" ON "users"("active");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_token_hash_idx" ON "sessions"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "campuses_code_key" ON "campuses"("code");

-- CreateIndex
CREATE INDEX "campuses_school_id_idx" ON "campuses"("school_id");

-- CreateIndex
CREATE INDEX "school_years_is_current_idx" ON "school_years"("is_current");

-- CreateIndex
CREATE UNIQUE INDEX "school_years_school_id_name_key" ON "school_years"("school_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "semesters_school_year_id_name_key" ON "semesters"("school_year_id", "name");

-- CreateIndex
CREATE INDEX "school_weeks_school_year_id_start_date_idx" ON "school_weeks"("school_year_id", "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "school_weeks_school_year_id_number_key" ON "school_weeks"("school_year_id", "number");

-- CreateIndex
CREATE INDEX "homeroom_teachers_school_year_id_idx" ON "homeroom_teachers"("school_year_id");

-- CreateIndex
CREATE INDEX "classes_campus_id_idx" ON "classes"("campus_id");

-- CreateIndex
CREATE INDEX "classes_school_year_id_active_idx" ON "classes"("school_year_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "classes_school_year_id_class_name_key" ON "classes"("school_year_id", "class_name");

-- CreateIndex
CREATE INDEX "plans_school_year_id_campus_id_idx" ON "plans"("school_year_id", "campus_id");

-- CreateIndex
CREATE INDEX "plans_status_idx" ON "plans"("status");

-- CreateIndex
CREATE INDEX "plan_targets_plan_id_sort_order_idx" ON "plan_targets"("plan_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_repeat_occurrence_key_key" ON "tasks"("repeat_occurrence_key");

-- CreateIndex
CREATE INDEX "tasks_school_year_id_status_idx" ON "tasks"("school_year_id", "status");

-- CreateIndex
CREATE INDEX "tasks_due_date_idx" ON "tasks"("due_date");

-- CreateIndex
CREATE INDEX "tasks_campus_id_idx" ON "tasks"("campus_id");

-- CreateIndex
CREATE INDEX "tasks_repeat_next_at_idx" ON "tasks"("repeat_next_at");

-- CreateIndex
CREATE INDEX "task_check_items_task_id_sort_order_idx" ON "task_check_items"("task_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "task_dependencies_task_id_depends_on_id_key" ON "task_dependencies"("task_id", "depends_on_id");

-- CreateIndex
CREATE INDEX "task_templates_active_sort_order_idx" ON "task_templates"("active", "sort_order");

-- CreateIndex
CREATE INDEX "calendar_events_school_year_id_date_idx" ON "calendar_events"("school_year_id", "date");

-- CreateIndex
CREATE INDEX "calendar_events_campus_id_idx" ON "calendar_events"("campus_id");

-- CreateIndex
CREATE INDEX "activities_school_year_id_date_idx" ON "activities"("school_year_id", "date");

-- CreateIndex
CREATE INDEX "activities_status_idx" ON "activities"("status");

-- CreateIndex
CREATE INDEX "criteria_sets_status_idx" ON "criteria_sets"("status");

-- CreateIndex
CREATE UNIQUE INDEX "criteria_sets_school_year_id_name_version_key" ON "criteria_sets"("school_year_id", "name", "version");

-- CreateIndex
CREATE INDEX "criteria_criteria_set_id_sort_order_idx" ON "criteria"("criteria_set_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "criteria_criteria_set_id_code_key" ON "criteria"("criteria_set_id", "code");

-- CreateIndex
CREATE INDEX "weekly_score_sheets_school_year_id_status_idx" ON "weekly_score_sheets"("school_year_id", "status");

-- CreateIndex
CREATE INDEX "weekly_score_sheets_week_id_idx" ON "weekly_score_sheets"("week_id");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_score_sheets_week_id_criteria_set_id_campus_id_key" ON "weekly_score_sheets"("week_id", "criteria_set_id", "campus_id");

-- CreateIndex
CREATE INDEX "score_entries_sheet_id_idx" ON "score_entries"("sheet_id");

-- CreateIndex
CREATE INDEX "score_entries_class_id_idx" ON "score_entries"("class_id");

-- CreateIndex
CREATE INDEX "score_entries_week_id_idx" ON "score_entries"("week_id");

-- CreateIndex
CREATE UNIQUE INDEX "score_entries_sheet_id_class_id_criteria_id_key" ON "score_entries"("sheet_id", "class_id", "criteria_id");

-- CreateIndex
CREATE INDEX "score_evidence_score_entry_id_idx" ON "score_evidence"("score_entry_id");

-- CreateIndex
CREATE INDEX "ranking_snapshots_week_id_idx" ON "ranking_snapshots"("week_id");

-- CreateIndex
CREATE INDEX "ranking_snapshots_sheet_id_idx" ON "ranking_snapshots"("sheet_id");

-- CreateIndex
CREATE INDEX "team_units_school_year_id_active_idx" ON "team_units"("school_year_id", "active");

-- CreateIndex
CREATE INDEX "team_members_school_year_id_unit_idx" ON "team_members"("school_year_id", "unit");

-- CreateIndex
CREATE INDEX "training_records_team_member_id_idx" ON "training_records"("team_member_id");

-- CreateIndex
CREATE INDEX "program_results_school_year_id_status_idx" ON "program_results"("school_year_id", "status");

-- CreateIndex
CREATE INDEX "commendations_school_year_id_approval_status_idx" ON "commendations"("school_year_id", "approval_status");

-- CreateIndex
CREATE UNIQUE INDEX "document_folders_school_year_id_parent_id_name_key" ON "document_folders"("school_year_id", "parent_id", "name");

-- CreateIndex
CREATE INDEX "documents_school_year_id_folder_id_idx" ON "documents"("school_year_id", "folder_id");

-- CreateIndex
CREATE INDEX "documents_pinned_updated_at_idx" ON "documents"("pinned", "updated_at");

-- CreateIndex
CREATE INDEX "documents_deleted_at_idx" ON "documents"("deleted_at");

-- CreateIndex
CREATE INDEX "attachments_document_id_version_idx" ON "attachments"("document_id", "version");

-- CreateIndex
CREATE INDEX "attachments_checksum_idx" ON "attachments"("checksum");

-- CreateIndex
CREATE UNIQUE INDEX "file_versions_attachment_id_version_key" ON "file_versions"("attachment_id", "version");

-- CreateIndex
CREATE INDEX "document_links_entity_type_entity_id_idx" ON "document_links"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_links_document_id_entity_type_entity_id_key" ON "document_links"("document_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "equipment_campus_id_idx" ON "equipment"("campus_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_school_year_id_code_key" ON "equipment"("school_year_id", "code");

-- CreateIndex
CREATE INDEX "equipment_transactions_equipment_id_borrowed_at_idx" ON "equipment_transactions"("equipment_id", "borrowed_at");

-- CreateIndex
CREATE INDEX "generated_reports_status_generated_at_idx" ON "generated_reports"("status", "generated_at");

-- CreateIndex
CREATE UNIQUE INDEX "generated_reports_school_year_id_type_version_key" ON "generated_reports"("school_year_id", "type", "version");

-- CreateIndex
CREATE INDEX "report_packages_school_year_id_idx" ON "report_packages"("school_year_id");

-- CreateIndex
CREATE UNIQUE INDEX "config_categories_key_key" ON "config_categories"("key");

-- CreateIndex
CREATE INDEX "config_items_category_key_active_sort_order_idx" ON "config_items"("category_key", "active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "config_items_category_id_code_key" ON "config_items"("category_id", "code");

-- CreateIndex
CREATE INDEX "custom_field_definitions_entity_type_active_sort_order_idx" ON "custom_field_definitions"("entity_type", "active", "sort_order");

-- CreateIndex
CREATE INDEX "audit_logs_entity_created_at_idx" ON "audit_logs"("entity", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_id_idx" ON "audit_logs"("entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "snapshots_created_at_idx" ON "snapshots"("created_at");

-- CreateIndex
CREATE INDEX "snapshots_tier_protected_idx" ON "snapshots"("tier", "protected");

-- CreateIndex
CREATE INDEX "backup_records_completed_at_idx" ON "backup_records"("completed_at");

-- CreateIndex
CREATE INDEX "year_transition_logs_created_at_idx" ON "year_transition_logs"("created_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campuses" ADD CONSTRAINT "campuses_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_years" ADD CONSTRAINT "school_years_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_weeks" ADD CONSTRAINT "school_weeks_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_weeks" ADD CONSTRAINT "school_weeks_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homeroom_teachers" ADD CONSTRAINT "homeroom_teachers_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_homeroom_teacher_id_fkey" FOREIGN KEY ("homeroom_teacher_id") REFERENCES "homeroom_teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_targets" ADD CONSTRAINT "plan_targets_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_repeat_source_id_fkey" FOREIGN KEY ("repeat_source_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_check_items" ADD CONSTRAINT "task_check_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_depends_on_id_fkey" FOREIGN KEY ("depends_on_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "criteria_sets" ADD CONSTRAINT "criteria_sets_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "criteria_sets" ADD CONSTRAINT "criteria_sets_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "criteria_sets" ADD CONSTRAINT "criteria_sets_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "criteria_sets" ADD CONSTRAINT "criteria_sets_source_set_id_fkey" FOREIGN KEY ("source_set_id") REFERENCES "criteria_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "criteria" ADD CONSTRAINT "criteria_criteria_set_id_fkey" FOREIGN KEY ("criteria_set_id") REFERENCES "criteria_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "criteria" ADD CONSTRAINT "criteria_source_criteria_id_fkey" FOREIGN KEY ("source_criteria_id") REFERENCES "criteria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_score_sheets" ADD CONSTRAINT "weekly_score_sheets_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_score_sheets" ADD CONSTRAINT "weekly_score_sheets_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_score_sheets" ADD CONSTRAINT "weekly_score_sheets_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_score_sheets" ADD CONSTRAINT "weekly_score_sheets_week_id_fkey" FOREIGN KEY ("week_id") REFERENCES "school_weeks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_score_sheets" ADD CONSTRAINT "weekly_score_sheets_criteria_set_id_fkey" FOREIGN KEY ("criteria_set_id") REFERENCES "criteria_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_score_sheets" ADD CONSTRAINT "weekly_score_sheets_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_score_sheets" ADD CONSTRAINT "weekly_score_sheets_locked_by_id_fkey" FOREIGN KEY ("locked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_entries" ADD CONSTRAINT "score_entries_sheet_id_fkey" FOREIGN KEY ("sheet_id") REFERENCES "weekly_score_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_entries" ADD CONSTRAINT "score_entries_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_entries" ADD CONSTRAINT "score_entries_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_entries" ADD CONSTRAINT "score_entries_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_entries" ADD CONSTRAINT "score_entries_week_id_fkey" FOREIGN KEY ("week_id") REFERENCES "school_weeks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_entries" ADD CONSTRAINT "score_entries_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_entries" ADD CONSTRAINT "score_entries_criteria_id_fkey" FOREIGN KEY ("criteria_id") REFERENCES "criteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_evidence" ADD CONSTRAINT "score_evidence_score_entry_id_fkey" FOREIGN KEY ("score_entry_id") REFERENCES "score_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_evidence" ADD CONSTRAINT "score_evidence_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_snapshots" ADD CONSTRAINT "ranking_snapshots_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_snapshots" ADD CONSTRAINT "ranking_snapshots_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_snapshots" ADD CONSTRAINT "ranking_snapshots_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_snapshots" ADD CONSTRAINT "ranking_snapshots_week_id_fkey" FOREIGN KEY ("week_id") REFERENCES "school_weeks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_snapshots" ADD CONSTRAINT "ranking_snapshots_sheet_id_fkey" FOREIGN KEY ("sheet_id") REFERENCES "weekly_score_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_snapshots" ADD CONSTRAINT "ranking_snapshots_criteria_set_id_fkey" FOREIGN KEY ("criteria_set_id") REFERENCES "criteria_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_units" ADD CONSTRAINT "team_units_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_units" ADD CONSTRAINT "team_units_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_unit_id_fkey" FOREIGN KEY ("team_unit_id") REFERENCES "team_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_results" ADD CONSTRAINT "program_results_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_results" ADD CONSTRAINT "program_results_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_results" ADD CONSTRAINT "program_results_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commendations" ADD CONSTRAINT "commendations_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commendations" ADD CONSTRAINT "commendations_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "document_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "document_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_transactions" ADD CONSTRAINT "equipment_transactions_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_packages" ADD CONSTRAINT "report_packages_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_packages" ADD CONSTRAINT "report_packages_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_items" ADD CONSTRAINT "config_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "config_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_records" ADD CONSTRAINT "backup_records_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "year_transition_logs" ADD CONSTRAINT "year_transition_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
