import type {
  ActivityStatus,
  ApprovalStatus,
  CriteriaFormula,
  CriteriaSetStatus,
  CriterionDataType,
  DocumentStatus,
  PlanLevel,
  PlanStatus,
  ProgramStatus,
  RepeatRule,
  ReportStatus,
  ReportType,
  SheetStatus,
  SubmissionStatus,
  TaskPriority,
  TaskStatus,
  UserRole,
} from '@/types';

/**
 * Ánh xạ enum của backend sang nhãn tiếng Việt.
 * Câu chữ lấy nguyên từ statusLabel() và các <option> của website gốc.
 */
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: 'Chưa làm',
  DOING: 'Đang làm',
  WAITING: 'Chờ phối hợp',
  REVIEW: 'Chờ duyệt',
  DONE: 'Hoàn thành',
  PAUSED: 'Tạm dừng',
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: 'Thấp',
  NORMAL: 'Bình thường',
  HIGH: 'Cao',
  URGENT: 'Khẩn',
};

export const REPEAT_RULE_LABEL: Record<RepeatRule, string> = {
  NONE: 'Không lặp',
  DAILY: 'Hằng ngày',
  WEEKLY: 'Hằng tuần',
  MONTHLY: 'Hằng tháng',
  YEARLY: 'Hằng năm',
};

export const PLAN_LEVEL_LABEL: Record<PlanLevel, string> = {
  YEAR: 'Năm học',
  SEMESTER: 'Học kỳ',
  MONTH: 'Tháng',
  WEEK: 'Tuần',
};

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  DRAFT: 'Dự thảo',
  ACTIVE: 'Đang thực hiện',
  FINISHED: 'Đã kết thúc',
};

export const ACTIVITY_STATUS_LABEL: Record<ActivityStatus, string> = {
  PLANNED: 'Dự kiến',
  ACTIVE: 'Đang thực hiện',
  FINISHED: 'Đã kết thúc',
};

export const SHEET_STATUS_LABEL: Record<SheetStatus, string> = {
  DRAFT: 'Bản nháp',
  COMPLETE: 'Đã nhập đủ',
  REVIEW: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  LOCKED: 'Đã khóa',
  UNLOCKED: 'Đã mở khóa',
};

export const CRITERIA_FORMULA_LABEL: Record<CriteriaFormula, string> = {
  BASE: 'Điểm chuẩn rồi cộng/trừ',
  SUM: 'Cộng các thành phần',
  WEIGHTED: 'Trọng số theo tiêu chí',
};

export const CRITERIA_SET_STATUS_LABEL: Record<CriteriaSetStatus, string> = {
  DRAFT: 'Dự thảo',
  ACTIVE: 'Đang áp dụng',
  STOPPED: 'Ngừng áp dụng',
};

export const CRITERION_DATA_TYPE_LABEL: Record<CriterionDataType, string> = {
  SCORE: 'Điểm trực tiếp',
  COUNT: 'Số lần',
  BOOLEAN: 'Đạt/không đạt',
  CHOICE: 'Mức lựa chọn',
  NOTE: 'Ghi chú',
};

export const PROGRAM_STATUS_LABEL: Record<ProgramStatus, string> = {
  DRAFT: 'Đang theo dõi',
  APPROVED: 'Đã công nhận',
};

export const APPROVAL_STATUS_LABEL: Record<ApprovalStatus, string> = {
  DRAFT: 'Dự thảo',
  REVIEW: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
};

export const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = {
  DRAFT: 'Bản nháp',
  APPROVED: 'Đã xác nhận',
  ARCHIVED: 'Lưu trữ',
};

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  WEEK: 'Báo cáo công tác tuần',
  SCORES: 'Tổng hợp thi đua lớp',
  TASKS: 'Tiến độ công việc',
  ACTIVITIES: 'Báo cáo hoạt động',
  EQUIPMENT: 'Báo cáo thiết bị',
  YEAR_SUMMARY: 'Báo cáo tổng kết năm học',
};

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  DRAFT: 'Bản nháp',
  FINALIZED: 'Đã chốt',
};

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  NOT_SUBMITTED: 'Chưa gửi',
  SUBMITTED: 'Đã gửi',
  ACCEPTED: 'Đã tiếp nhận',
};

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: 'Quản trị',
  EDITOR: 'Biên tập',
  VIEWER: 'Chỉ xem',
};

/**
 * Trạng thái dẫn xuất ở giao diện, không có trong enum của backend.
 * "Quá hạn" được tính tại chỗ từ hạn hoàn thành so với ngày hôm nay; thiếu bảng
 * này thì badge hiện mã thô "OVERDUE" cho người dùng.
 */
export const DERIVED_STATUS_LABEL: Record<string, string> = {
  OVERDUE: 'Quá hạn',
};

/** Tông màu badge theo trạng thái — giữ quy tắc phối màu của statusBadge() gốc. */
export type BadgeTone = 'default' | 'green' | 'blue' | 'yellow' | 'red';

const GREEN = new Set(['DONE', 'APPROVED', 'LOCKED', 'FINISHED', 'ACCEPTED', 'COMPLETE']);
const BLUE = new Set(['DOING', 'REVIEW', 'ACTIVE', 'SUBMITTED']);
const RED = new Set(['OVERDUE', 'URGENT', 'STOPPED']);

export function statusTone(value: string | null | undefined): BadgeTone {
  if (!value) return 'default';
  const key = value.toUpperCase();
  if (GREEN.has(key)) return 'green';
  if (RED.has(key)) return 'red';
  if (BLUE.has(key)) return 'blue';
  return 'yellow';
}

/** Tra nhãn qua nhiều bảng ánh xạ; không tìm thấy thì trả nguyên giá trị. */
export function statusLabel(value: string | null | undefined): string {
  if (!value) return '—';
  const tables: Array<Record<string, string>> = [
    DERIVED_STATUS_LABEL,
    TASK_STATUS_LABEL,
    SHEET_STATUS_LABEL,
    PLAN_STATUS_LABEL,
    ACTIVITY_STATUS_LABEL,
    APPROVAL_STATUS_LABEL,
    PROGRAM_STATUS_LABEL,
    DOCUMENT_STATUS_LABEL,
    CRITERIA_SET_STATUS_LABEL,
    REPORT_STATUS_LABEL,
    SUBMISSION_STATUS_LABEL,
  ];
  for (const table of tables) {
    if (value in table) return table[value]!;
  }
  return value;
}

/** Chuyển bảng nhãn thành mảng option cho thẻ <select>. */
export function toOptions<T extends string>(table: Record<T, string>): Array<{ value: T; label: string }> {
  return (Object.keys(table) as T[]).map((value) => ({ value, label: table[value] }));
}
