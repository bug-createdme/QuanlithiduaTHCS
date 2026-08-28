import { Router } from 'express';
import { protectedCrud, type CrudColumn } from '../../lib/crud';
import { toDbDate } from '../../lib/dates';
import {
  activityCreateSchema,
  activityUpdateSchema,
  commendationCreateSchema,
  commendationUpdateSchema,
  equipmentCreateSchema,
  equipmentUpdateSchema,
  planCreateSchema,
  planUpdateSchema,
  programResultCreateSchema,
  programResultUpdateSchema,
  teamMemberCreateSchema,
  teamMemberUpdateSchema,
} from './entity.schemas';

/**
 * Chuyển các trường ngày dạng "YYYY-MM-DD" sang Date trước khi ghi xuống cột DATE.
 * Prisma không tự ép chuỗi sang Date.
 */
const withDates =
  (...fields: string[]) =>
  (data: Record<string, unknown>): Record<string, unknown> => {
    const out = { ...data };
    for (const field of fields) {
      if (field in out) out[field] = toDbDate(out[field] as string | null);
    }
    return out;
  };

/** Cột hiển thị/xuất CSV — giữ đúng entityColumns() của bản gốc. */
const PLAN_COLUMNS: CrudColumn[] = [
  { key: 'code', label: 'Mã' },
  { key: 'name', label: 'Tên kế hoạch' },
  { key: 'level', label: 'Cấp' },
  { key: 'status', label: 'Trạng thái' },
  { key: 'progress', label: 'Tiến độ' },
];

const ACTIVITY_COLUMNS: CrudColumn[] = [
  { key: 'name', label: 'Tên hoạt động' },
  { key: 'category', label: 'Nhóm' },
  { key: 'date', label: 'Thời gian' },
  { key: 'location', label: 'Địa điểm' },
  { key: 'status', label: 'Trạng thái' },
];

const ORGANIZATION_COLUMNS: CrudColumn[] = [
  { key: 'name', label: 'Họ và tên' },
  { key: 'className', label: 'Lớp' },
  { key: 'unit', label: 'Đội/ban' },
  { key: 'position', label: 'Chức vụ' },
  { key: 'term', label: 'Nhiệm kỳ' },
];

const PROGRAM_COLUMNS: CrudColumn[] = [
  { key: 'name', label: 'Chương trình/chuyên hiệu' },
  { key: 'scope', label: 'Đối tượng' },
  { key: 'result', label: 'Kết quả' },
  { key: 'recognizedDate', label: 'Ngày công nhận' },
  { key: 'status', label: 'Trạng thái' },
];

const COMMENDATION_COLUMNS: CrudColumn[] = [
  { key: 'recipient', label: 'Đối tượng' },
  { key: 'awardType', label: 'Loại khen thưởng' },
  { key: 'level', label: 'Cấp' },
  { key: 'date', label: 'Thời gian' },
  { key: 'approvalStatus', label: 'Trạng thái' },
];

const EQUIPMENT_COLUMNS: CrudColumn[] = [
  { key: 'code', label: 'Mã' },
  { key: 'name', label: 'Thiết bị/vật tư' },
  { key: 'quantity', label: 'Số lượng' },
  { key: 'condition', label: 'Tình trạng' },
  { key: 'location', label: 'Nơi lưu' },
];

export const plansRouter = protectedCrud({
  model: 'plan',
  entity: 'plans',
  label: 'Kế hoạch',
  createSchema: planCreateSchema,
  updateSchema: planUpdateSchema,
  scope: { semester: true, campus: true },
  orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
  searchFields: ['code', 'name', 'objectives', 'coordination'],
  columns: PLAN_COLUMNS,
  beforeWrite: withDates('startDate', 'endDate'),
});

export const activitiesRouter = protectedCrud({
  model: 'activity',
  entity: 'activities',
  label: 'Hoạt động Đội',
  createSchema: activityCreateSchema,
  updateSchema: activityUpdateSchema,
  scope: { semester: false, campus: true },
  orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  searchFields: ['name', 'category', 'theme', 'location', 'leader'],
  columns: ACTIVITY_COLUMNS,
  beforeWrite: withDates('date'),
});

export const organizationRouter = protectedCrud({
  model: 'teamMember',
  entity: 'team_members',
  label: 'Thành viên tổ chức Đội',
  createSchema: teamMemberCreateSchema,
  updateSchema: teamMemberUpdateSchema,
  scope: { campus: true },
  orderBy: [{ unit: 'asc' }, { name: 'asc' }],
  searchFields: ['name', 'className', 'unit', 'position', 'term', 'internalCode'],
  columns: ORGANIZATION_COLUMNS,
});

export const programsRouter = protectedCrud({
  model: 'programResult',
  entity: 'program_results',
  label: 'Kết quả rèn luyện – phong trào',
  createSchema: programResultCreateSchema,
  updateSchema: programResultUpdateSchema,
  scope: { campus: true },
  orderBy: [{ recognizedDate: 'desc' }, { createdAt: 'desc' }],
  searchFields: ['name', 'scope', 'result', 'activity'],
  columns: PROGRAM_COLUMNS,
  beforeWrite: withDates('recognizedDate'),
});

export const commendationsRouter = protectedCrud({
  model: 'commendation',
  entity: 'commendations',
  label: 'Khen thưởng',
  createSchema: commendationCreateSchema,
  updateSchema: commendationUpdateSchema,
  scope: { campus: true },
  orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  searchFields: ['recipient', 'awardType', 'level', 'achievement', 'decision'],
  columns: COMMENDATION_COLUMNS,
  beforeWrite: withDates('date'),
});

export const equipmentRouter = protectedCrud({
  model: 'equipment',
  entity: 'equipment',
  label: 'Thiết bị Đội',
  createSchema: equipmentCreateSchema,
  updateSchema: equipmentUpdateSchema,
  scope: { campus: true },
  orderBy: [{ code: 'asc' }],
  searchFields: ['name', 'code', 'groupName', 'location', 'activity'],
  columns: EQUIPMENT_COLUMNS,
  beforeWrite: withDates('inventoryDate'),
});

/** Gom các router thực thể dùng chung một chỗ để đăng ký gọn. */
export const entityRouters: Array<[path: string, router: Router]> = [
  ['/plans', plansRouter],
  ['/activities', activitiesRouter],
  ['/organization', organizationRouter],
  ['/programs', programsRouter],
  ['/commendations', commendationsRouter],
  ['/equipment', equipmentRouter],
];
