/**
 * Kiểu dữ liệu nghiệp vụ, phản chiếu schema Prisma của backend.
 * Ngày tháng đi qua REST dưới dạng chuỗi ISO nên khai báo là string.
 */

export type UserRole = 'ADMIN' | 'EDITOR' | 'VIEWER';
export type YearStatus = 'OPEN' | 'ARCHIVED';
export type PlanLevel = 'YEAR' | 'SEMESTER' | 'MONTH' | 'WEEK';
export type PlanStatus = 'DRAFT' | 'ACTIVE' | 'FINISHED';
export type TaskStatus = 'TODO' | 'DOING' | 'WAITING' | 'REVIEW' | 'DONE' | 'PAUSED';
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type RepeatRule = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type ActivityStatus = 'PLANNED' | 'ACTIVE' | 'FINISHED';
export type CriteriaFormula = 'BASE' | 'SUM' | 'WEIGHTED';
export type CriteriaSetStatus = 'DRAFT' | 'ACTIVE' | 'STOPPED';
export type CriterionDataType = 'SCORE' | 'COUNT' | 'BOOLEAN' | 'CHOICE' | 'NOTE';
export type SheetStatus = 'DRAFT' | 'COMPLETE' | 'REVIEW' | 'APPROVED' | 'LOCKED' | 'UNLOCKED';
export type EntryState = 'VALUE' | 'NA' | 'EXEMPT';
export type ProgramStatus = 'DRAFT' | 'APPROVED';
export type ApprovalStatus = 'DRAFT' | 'REVIEW' | 'APPROVED';
export type DocumentStatus = 'DRAFT' | 'APPROVED' | 'ARCHIVED';
export type ReportType = 'WEEK' | 'SCORES' | 'TASKS' | 'ACTIVITIES' | 'EQUIPMENT' | 'YEAR_SUMMARY';
export type ReportStatus = 'DRAFT' | 'FINALIZED';
export type SubmissionStatus = 'NOT_SUBMITTED' | 'SUBMITTED' | 'ACCEPTED';
export type CustomFieldType =
  | 'SHORT_TEXT' | 'LONG_TEXT' | 'NUMBER' | 'DATE'
  | 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'BOOLEAN' | 'LINK' | 'FILE';
export type SnapshotTier = 'MANUAL' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'PROTECTED';
export type BackupScope = 'QUICK' | 'FULL' | 'YEAR_PACKAGE';

/** Trường chung của mọi bản ghi nghiệp vụ. */
export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  revision: number;
}

export interface CurrentUser {
  id: string;
  username: string;
  email: string | null;
  fullName: string;
  role: UserRole;
  autoLockMinutes: number;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
}

export interface School extends BaseRecord {
  name: string;
  code: string | null;
  address: string | null;
  reporter: string | null;
  reporterTitle: string;
  isSample: boolean;
}

export interface Campus extends BaseRecord {
  schoolId: string;
  name: string;
  code: string;
  _count?: { classes: number };
}

export interface SchoolYear extends BaseRecord {
  schoolId: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: YearStatus;
  readOnly: boolean;
  closedAt: string | null;
  _count?: { semesters: number; weeks: number; classes: number };
}

export interface Semester extends BaseRecord {
  schoolYearId: string;
  name: string;
  startDate: string;
  endDate: string;
  sortOrder: number;
}

export interface SchoolWeek extends BaseRecord {
  schoolYearId: string;
  semesterId: string | null;
  number: number;
  name: string;
  startDate: string;
  endDate: string;
}

export interface SchoolClass extends BaseRecord {
  schoolYearId: string;
  campusId: string;
  code: string | null;
  className: string;
  grade: number;
  /** Ô văn bản tự do giữ nguyên từ bản gốc. */
  teacher: string | null;
  /** Liên kết chuẩn hóa tùy chọn tới danh bạ giáo viên chủ nhiệm. */
  homeroomTeacherId: string | null;
  active: boolean;
  isSample: boolean;
  campus?: Pick<Campus, 'id' | 'name' | 'code'>;
}

export interface Plan extends BaseRecord {
  schoolYearId: string;
  semesterId: string | null;
  campusId: string | null;
  code: string;
  name: string;
  level: PlanLevel;
  startDate: string;
  endDate: string;
  objectives: string;
  targets: string | null;
  basis: string | null;
  coordination: string | null;
  resources: string | null;
  risks: string | null;
  status: PlanStatus;
  progress: number;
  customValues: Record<string, unknown> | null;
}

export interface TaskCheckItem extends BaseRecord {
  taskId: string;
  label: string;
  required: boolean;
  done: boolean;
  sortOrder: number;
}

export interface Task extends BaseRecord {
  schoolYearId: string;
  semesterId: string | null;
  campusId: string | null;
  title: string;
  groupName: string | null;
  startDate: string | null;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  progress: number;
  coordination: string | null;
  obstacle: string | null;
  notes: string | null;
  repeatRule: RepeatRule;
  repeatUntil: string | null;
  repeatNextAt: string | null;
  repeatSourceId: string | null;
  customValues: Record<string, unknown> | null;
  isSample: boolean;
  checkItems?: TaskCheckItem[];
  campus?: Pick<Campus, 'id' | 'name'>;
}

export interface TaskTemplate extends BaseRecord {
  title: string;
  groupName: string;
  defaultDueOffsetDays: number;
  sortOrder: number;
  active: boolean;
}

export interface CalendarEvent extends BaseRecord {
  schoolYearId: string;
  campusId: string | null;
  title: string;
  date: string;
  time: string | null;
  location: string | null;
  leader: string | null;
  category: string;
  reminderHours: number;
  safety: string | null;
  campus?: Pick<Campus, 'id' | 'name'>;
}

export interface Activity extends BaseRecord {
  schoolYearId: string;
  campusId: string | null;
  name: string;
  category: string;
  theme: string | null;
  date: string;
  location: string;
  leader: string;
  participants: string | null;
  objectives: string | null;
  safety: string;
  backupPlan: string | null;
  result: string | null;
  status: ActivityStatus;
  customValues: Record<string, unknown> | null;
}

export interface Criterion extends BaseRecord {
  criteriaSetId: string;
  code: string;
  groupName: string | null;
  name: string;
  description: string | null;
  dataType: CriterionDataType;
  points: string;
  minValue: string | null;
  maxValue: string | null;
  decimals: number;
  weight: string;
  sortOrder: number;
  color: string;
  evidenceRequired: boolean;
  active: boolean;
}

export interface CriteriaSet extends BaseRecord {
  schoolYearId: string;
  semesterId: string | null;
  campusId: string | null;
  name: string;
  version: string;
  formula: CriteriaFormula;
  baseScore: string;
  status: CriteriaSetStatus;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  basis: string | null;
  lockedVersion: boolean;
  sourceSetId: string | null;
  locked?: boolean;
  criteria?: Criterion[];
  _count?: { criteria: number; scoreSheets: number };
}

export interface WeeklyScoreSheet extends BaseRecord {
  schoolYearId: string;
  semesterId: string | null;
  campusId: string | null;
  weekId: string;
  criteriaSetId: string;
  status: SheetStatus;
  approvedAt: string | null;
  lockedAt: string | null;
  unlockedAt: string | null;
  unlockReason: string | null;
  reportsStale: boolean;
  workflowLabel?: string;
}

export interface ScoreEntry extends BaseRecord {
  sheetId: string;
  classId: string;
  criteriaId: string;
  weekId: string;
  entryState: EntryState;
  value: string | null;
  reason: string | null;
}

export interface ScoreContext {
  sets: CriteriaSet[];
  set: CriteriaSet | null;
  criteria: Criterion[];
  classes: SchoolClass[];
  sheet: WeeklyScoreSheet | null;
  entries: ScoreEntry[];
  workflowLabel: string;
  expectedCells: number;
}

export interface RankedRow {
  classId: string;
  className: string;
  campusId: string | null;
  total: number;
  filled: number;
  complete: boolean;
  rank: number;
}

export interface Anomaly {
  level: 'red' | 'yellow';
  text: string;
}

export interface TeamMember extends BaseRecord {
  schoolYearId: string;
  campusId: string | null;
  name: string;
  internalCode: string | null;
  className: string;
  unit: string;
  position: string;
  term: string;
  training: string | null;
  customValues: Record<string, unknown> | null;
}

export interface ProgramResult extends BaseRecord {
  schoolYearId: string;
  campusId: string | null;
  name: string;
  scope: string;
  result: string | null;
  recognizedDate: string | null;
  activity: string | null;
  evidence: string | null;
  status: ProgramStatus;
  customValues: Record<string, unknown> | null;
}

export interface Commendation extends BaseRecord {
  schoolYearId: string;
  campusId: string | null;
  awardType: string;
  level: string;
  recipient: string;
  achievement: string;
  date: string | null;
  related: string | null;
  approvalStatus: ApprovalStatus;
  decision: string | null;
  notes: string | null;
  customValues: Record<string, unknown> | null;
}

export interface Equipment extends BaseRecord {
  schoolYearId: string;
  campusId: string | null;
  name: string;
  code: string;
  groupName: string | null;
  quantity: number;
  unit: string;
  condition: string;
  location: string | null;
  inventoryDate: string | null;
  activity: string | null;
  notes: string | null;
  customValues: Record<string, unknown> | null;
}

export interface Attachment extends BaseRecord {
  documentId: string;
  fileName: string;
  extension: string | null;
  mimeType: string | null;
  size: string;
  checksum: string | null;
  version: number;
  status: 'ACTIVE' | 'ARCHIVED';
}

export interface DocumentFolder extends BaseRecord {
  schoolYearId: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  _count?: { documents: number };
}

export interface DocumentRecord extends BaseRecord {
  schoolYearId: string;
  campusId: string | null;
  folderId: string | null;
  name: string;
  type: string;
  documentNo: string | null;
  issuer: string | null;
  date: string | null;
  related: string | null;
  tags: string | null;
  description: string | null;
  status: DocumentStatus;
  pinned: boolean;
  attachments?: Attachment[];
}

export interface ConfigItem extends BaseRecord {
  categoryId: string;
  categoryKey: string;
  label: string;
  code: string;
  color: string;
  icon: string;
  sortOrder: number;
  description: string | null;
  active: boolean;
  isDefault: boolean;
}

export interface ConfigCategory extends BaseRecord {
  key: string;
  name: string;
  sortOrder: number;
  items: ConfigItem[];
}

export interface CustomFieldDefinition extends BaseRecord {
  entityType: string;
  name: string;
  fieldType: CustomFieldType;
  options: string | null;
  description: string | null;
  required: boolean;
  sortOrder: number;
  active: boolean;
}

export interface GeneratedReport extends BaseRecord {
  schoolYearId: string;
  name: string;
  type: ReportType;
  version: number;
  status: ReportStatus;
  immutable: boolean;
  recipient: string | null;
  submissionStatus: SubmissionStatus;
  contentText: string | null;
  contentChecksum: string | null;
  sourceChecksum: string | null;
  sourceRecordCount: number;
  generatedAt: string;
  finalizedAt: string | null;
  createdBy?: { fullName: string };
}

export interface ReportSection {
  heading?: string;
  paragraph?: string;
  table?: { head: string[]; rows: string[][] };
  notice?: { tone: 'warn' | 'info'; text: string };
}

export interface ReportPayload {
  title: string;
  schoolName: string;
  scopeLabel: string;
  generatedAt: string;
  sections: ReportSection[];
  signatures: [string, string];
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  summary: string | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
  user?: { fullName: string; username: string } | null;
}

export interface Snapshot {
  id: string;
  name: string;
  tier: SnapshotTier;
  protected: boolean;
  reason: string | null;
  recordCount: number;
  counts: Record<string, number> | null;
  checksum: string | null;
  createdAt: string;
}

export interface BackupRecord {
  id: string;
  name: string;
  scope: BackupScope;
  size: string;
  checksum: string | null;
  recordCount: number;
  completedAt: string | null;
  createdAt: string;
}

export interface DashboardPayload {
  kpis: {
    dueToday: number;
    soon: number;
    overdue: number;
    upcomingEvents: number;
    classesMissingScores: number;
    classesInApprovedSheet: number;
  };
  openTasks: Array<Task & { overdue: boolean }>;
  upcoming: CalendarEvent[];
  topClasses: RankedRow[];
  progress: { done: number; total: number; percent: number };
  sheetStatus: SheetStatus | null;
  filledClasses: number;
  totalClasses: number;
  lastBackupAt: string | null;
}

export interface TodayPayload {
  date: string;
  tasks: Task[];
  events: CalendarEvent[];
  waitingCount: number;
  completedToday: number;
  remaining: number;
}

export interface AssistantAnswer {
  title: string;
  lines: string[];
  badges?: string[];
  sourcePage: 'tasks' | 'scores' | 'calendar' | 'backup' | 'reports';
  stamp: string;
  recognized: boolean;
}

export interface SearchGroup {
  page: string;
  label: string;
  items: Array<{ id: string; text: string }>;
}

/** Phạm vi dữ liệu toàn cục — 4 dropdown ở thanh trên cùng. */
export interface DataScope {
  yearId: string;
  semesterId: string;
  weekId: string;
  campusId: string;
}

export interface PageMeta {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/* ─────────────── Bảng con: chỉ tiêu, phụ thuộc, minh chứng, sổ mượn ─────── */

export type DependencyType = 'FINISH_TO_START' | 'START_TO_START';
export type EquipmentTxType = 'BORROW' | 'RETURN' | 'REPAIR' | 'DISPOSE';

export interface PlanTarget extends BaseRecord {
  planId: string;
  name: string;
  targetValue: string | null;
  actualValue: string | null;
  unit: string | null;
  sortOrder: number;
}

export interface TrainingRecord extends BaseRecord {
  teamMemberId: string;
  content: string;
  date: string | null;
  result: string | null;
  note: string | null;
}

export interface EquipmentTransaction extends BaseRecord {
  equipmentId: string;
  type: EquipmentTxType;
  quantity: number;
  borrower: string | null;
  borrowedAt: string | null;
  dueAt: string | null;
  returnedAt: string | null;
  conditionBefore: string | null;
  conditionAfter: string | null;
  note: string | null;
}

/** Công việc rút gọn dùng trong danh sách phụ thuộc. */
export interface TaskBrief {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string;
}

export interface TaskDependency extends BaseRecord {
  taskId: string;
  dependsOnId: string;
  type: DependencyType;
  dependsOn?: TaskBrief;
  task?: TaskBrief;
}

export interface TaskDependencyView {
  dependsOn: Array<TaskDependency & { dependsOn: TaskBrief }>;
  blocking: Array<TaskDependency & { task: TaskBrief }>;
  /** Số việc phải chờ mà chưa hoàn thành. */
  blockedBy: number;
}

export interface ScoreEvidence extends BaseRecord {
  scoreEntryId: string;
  attachmentId: string | null;
  note: string | null;
  attachment: {
    id: string;
    fileName: string;
    extension: string | null;
    size: number;
    mimeType: string | null;
  } | null;
}

export interface ScoreEvidenceView {
  evidence: ScoreEvidence[];
  entry: {
    id: string;
    className: string;
    criterionCode: string;
    criterionName: string;
    evidenceRequired: boolean;
  };
}

export interface HomeroomTeacher extends BaseRecord {
  schoolYearId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  note: string | null;
  classes?: Array<{ id: string; className: string }>;
}
