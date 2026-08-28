import { z } from 'zod';

/** Chuỗi rỗng từ form HTML nên hiểu là "không có giá trị". */
export const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === '' || v === undefined ? null : v), schema.nullable());

export const optionalText = (max: number) => emptyToNull(z.string().trim().max(max));
export const optionalLongText = () => emptyToNull(z.string().trim().max(20_000));
export const optionalDate = () =>
  emptyToNull(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải theo dạng YYYY-MM-DD'));
export const optionalUuid = () => emptyToNull(z.string().uuid());
export const requiredDate = () =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải theo dạng YYYY-MM-DD');

/**
 * Cột JSON của Prisma không nhận `null`, nên null từ form được quy về `undefined`
 * (nghĩa là "không đụng tới trường này") thay vì cố ghi null xuống DB.
 */
export const customValuesSchema = z
  .record(z.string(), z.unknown())
  .nullish()
  .transform((v) => v ?? undefined);

/**
 * Trường phạm vi có ở MỌI bảng nghiệp vụ.
 *
 * Cố tình KHÔNG có `semesterId`: chỉ `plans` và `tasks` mới có cột đó.
 * Nếu để chung, Prisma sẽ từ chối lệnh tạo bản ghi ở các bảng còn lại vì
 * nhận phải tham số không tồn tại. Zod tự loại khóa lạ nên frontend cứ gửi
 * thừa `semesterId` cũng không sao.
 */
export const scopeFields = {
  schoolYearId: z.string().uuid('Hãy chọn năm học.'),
  campusId: optionalUuid(),
};

/** Dùng cho hai bảng thực sự có cột `semester_id`. */
export const scopeFieldsWithSemester = {
  ...scopeFields,
  semesterId: optionalUuid(),
};

/** Bỏ qua các khóa không thuộc schema (ví dụ `revision` do client gửi kèm). */
export const partialOf = <T extends z.ZodObject<z.ZodRawShape>>(schema: T) => schema.partial();

// ─────────────────────────── Kế hoạch ──────────────────────────────────────

export const planCreateSchema = z.object({
  ...scopeFieldsWithSemester,
  code: z.string().trim().min(1, 'Hãy nhập mã kế hoạch.').max(50),
  name: z.string().trim().min(1, 'Hãy nhập tên kế hoạch.').max(200),
  level: z.enum(['YEAR', 'SEMESTER', 'MONTH', 'WEEK'], {
    errorMap: () => ({ message: 'Hãy chọn cấp kế hoạch.' }),
  }),
  startDate: requiredDate(),
  endDate: requiredDate(),
  objectives: z.string().trim().min(1, 'Hãy nhập mục tiêu.').max(20_000),
  targets: optionalLongText(),
  basis: optionalLongText(),
  coordination: optionalText(200),
  resources: optionalText(200),
  risks: optionalLongText(),
  status: z.enum(['DRAFT', 'ACTIVE', 'FINISHED']).default('DRAFT'),
  progress: z.coerce.number().int().min(0).max(100).default(0),
  customValues: customValuesSchema,
});
export const planUpdateSchema = partialOf(planCreateSchema);

// ─────────────────────────── Hoạt động Đội ─────────────────────────────────

export const activityCreateSchema = z.object({
  ...scopeFields,
  name: z.string().trim().min(1, 'Hãy nhập tên hoạt động.').max(200),
  category: z.string().trim().min(1, 'Hãy chọn nhóm hoạt động.').max(100),
  theme: optionalText(150),
  date: requiredDate(),
  location: z.string().trim().min(1, 'Hãy nhập địa điểm.').max(200),
  leader: z.string().trim().min(1, 'Hãy nhập người phụ trách.').max(120),
  participants: optionalText(200),
  objectives: optionalLongText(),
  safety: z.string().trim().min(1, 'Hãy nhập phương án an toàn.').max(20_000),
  backupPlan: optionalLongText(),
  result: optionalLongText(),
  status: z.enum(['PLANNED', 'ACTIVE', 'FINISHED']).default('PLANNED'),
  customValues: customValuesSchema,
});
export const activityUpdateSchema = partialOf(activityCreateSchema);

// ────────────────────── Tổ chức Liên đội (team members) ────────────────────

export const teamMemberCreateSchema = z.object({
  ...scopeFields,
  name: z.string().trim().min(1, 'Hãy nhập họ và tên.').max(120),
  internalCode: optionalText(40),
  className: z.string().trim().min(1, 'Hãy nhập lớp.').max(50),
  classId: optionalUuid(),
  unit: z.string().trim().min(1, 'Hãy chọn đội/ban.').max(120),
  teamUnitId: optionalUuid(),
  position: z.string().trim().min(1, 'Hãy nhập chức vụ.').max(80),
  term: z.string().trim().min(1, 'Hãy nhập nhiệm kỳ.').max(60),
  training: optionalLongText(),
  customValues: customValuesSchema,
});
export const teamMemberUpdateSchema = partialOf(teamMemberCreateSchema);

// ──────────────────── Rèn luyện – phong trào (kết quả) ─────────────────────

export const programResultCreateSchema = z.object({
  ...scopeFields,
  name: z.string().trim().min(1, 'Hãy nhập tên chương trình/chuyên hiệu.').max(200),
  programId: optionalUuid(),
  scope: z.string().trim().min(1, 'Hãy nhập đối tượng/lớp.').max(150),
  result: optionalText(200),
  recognizedDate: optionalDate(),
  activity: optionalText(200),
  evidence: optionalLongText(),
  status: z.enum(['DRAFT', 'APPROVED']).default('DRAFT'),
  customValues: customValuesSchema,
});
export const programResultUpdateSchema = partialOf(programResultCreateSchema);

// ─────────────────────────── Khen thưởng ───────────────────────────────────

export const commendationCreateSchema = z.object({
  ...scopeFields,
  awardType: z.string().trim().min(1, 'Hãy chọn loại khen thưởng.').max(100),
  level: z.string().trim().min(1, 'Hãy chọn cấp khen thưởng.').max(80),
  recipient: z.string().trim().min(1, 'Hãy nhập đối tượng.').max(200),
  achievement: z.string().trim().min(1, 'Hãy nhập thành tích.').max(20_000),
  date: optionalDate(),
  related: optionalText(200),
  approvalStatus: z.enum(['DRAFT', 'REVIEW', 'APPROVED']).default('DRAFT'),
  decision: optionalText(120),
  notes: optionalLongText(),
  customValues: customValuesSchema,
});
export const commendationUpdateSchema = partialOf(commendationCreateSchema);

// ─────────────────────────── Thiết bị Đội ──────────────────────────────────

export const equipmentCreateSchema = z.object({
  ...scopeFields,
  name: z.string().trim().min(1, 'Hãy nhập tên thiết bị/vật tư.').max(200),
  code: z.string().trim().min(1, 'Hãy nhập mã thiết bị.').max(50),
  groupName: optionalText(80),
  quantity: z.coerce.number().int().min(0, 'Số lượng không được âm.'),
  unit: z.string().trim().min(1, 'Hãy nhập đơn vị tính.').max(30),
  condition: z.string().trim().min(1, 'Hãy chọn tình trạng.').max(40),
  location: optionalText(150),
  inventoryDate: optionalDate(),
  activity: optionalText(200),
  notes: optionalLongText(),
  customValues: customValuesSchema,
});
export const equipmentUpdateSchema = partialOf(equipmentCreateSchema);

// ─────────────────────────── Lịch hoạt động ────────────────────────────────

export const calendarEventCreateSchema = z.object({
  ...scopeFields,
  title: z.string().trim().min(1, 'Hãy nhập tên sự kiện.').max(200),
  date: requiredDate(),
  time: emptyToNull(z.string().regex(/^\d{2}:\d{2}$/, 'Giờ phải theo dạng HH:MM')),
  location: optionalText(200),
  leader: optionalText(120),
  category: z.string().trim().max(80).default('Hoạt động Đội'),
  reminderHours: z.coerce.number().int().min(0).max(720).default(24),
  safety: optionalLongText(),
});
export const calendarEventUpdateSchema = partialOf(calendarEventCreateSchema);
