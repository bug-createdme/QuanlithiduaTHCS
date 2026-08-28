/**
 * Cấu hình 6 trang CRUD dùng chung — dịch trực tiếp từ hằng số ENTITY
 * trong website gốc. Nhãn, thứ tự trường và cờ bắt buộc giữ nguyên 100%.
 */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select';

export interface EntityField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** Lựa chọn cố định dạng "value: nhãn" hoặc chỉ "nhãn". */
  options?: Array<{ value: string; label: string }>;
  /** Khóa danh mục cấu hình động; nếu có dữ liệu sẽ ghi đè `options`. */
  configKey?: string;
  full?: boolean;
  max?: number;
}

export interface EntityColumn {
  key: string;
  label: string;
  /** Cách hiển thị ô trong bảng. */
  render?: 'status' | 'date' | 'percent' | 'text';
}

export interface EntityConfig {
  /** Khóa route, ví dụ 'plans'. */
  key: string;
  title: string;
  description: string;
  /** Đường dẫn API, ví dụ '/plans'. */
  endpoint: string;
  /** Trường tùy chỉnh gắn với thực thể nào (khớp entityType của backend). */
  customEntity?: string;
  fields: EntityField[];
  columns: EntityColumn[];
  /** Trường dùng làm nhãn trong hộp thoại xác nhận xóa. */
  labelField: string;
}

const opts = (...pairs: Array<[string, string]>) =>
  pairs.map(([value, label]) => ({ value, label }));

export const ENTITY_CONFIGS: Record<string, EntityConfig> = {
  plans: {
    key: 'plans',
    title: 'Kế hoạch',
    description: 'Kế hoạch năm học, học kỳ, tháng và tuần.',
    endpoint: '/plans',
    customEntity: 'plans',
    labelField: 'name',
    fields: [
      { name: 'code', label: 'Mã kế hoạch', type: 'text', required: true, max: 50 },
      { name: 'name', label: 'Tên kế hoạch', type: 'text', required: true, max: 200 },
      {
        name: 'level',
        label: 'Cấp kế hoạch',
        type: 'select',
        required: true,
        options: opts(
          ['YEAR', 'Năm học'],
          ['SEMESTER', 'Học kỳ'],
          ['MONTH', 'Tháng'],
          ['WEEK', 'Tuần'],
        ),
      },
      { name: 'startDate', label: 'Bắt đầu', type: 'date', required: true },
      { name: 'endDate', label: 'Kết thúc', type: 'date', required: true },
      { name: 'objectives', label: 'Mục tiêu', type: 'textarea', required: true, full: true },
      { name: 'targets', label: 'Chỉ tiêu đo được', type: 'textarea', full: true },
      { name: 'basis', label: 'Căn cứ/văn bản liên quan', type: 'textarea', full: true },
      { name: 'coordination', label: 'Đơn vị phối hợp', type: 'text', max: 200 },
      { name: 'resources', label: 'Nguồn lực', type: 'text', max: 200 },
      { name: 'risks', label: 'Rủi ro và phương án', type: 'textarea', full: true },
      {
        name: 'status',
        label: 'Trạng thái',
        type: 'select',
        required: true,
        options: opts(['DRAFT', 'Dự thảo'], ['ACTIVE', 'Đang thực hiện'], ['FINISHED', 'Đã kết thúc']),
      },
      { name: 'progress', label: 'Tiến độ (%)', type: 'number' },
    ],
    columns: [
      { key: 'code', label: 'Mã' },
      { key: 'name', label: 'Tên kế hoạch' },
      { key: 'level', label: 'Cấp', render: 'status' },
      { key: 'status', label: 'Trạng thái', render: 'status' },
      { key: 'progress', label: 'Tiến độ', render: 'percent' },
    ],
  },

  activities: {
    key: 'activities',
    title: 'Hoạt động Đội',
    description: 'Tổ chức, theo dõi hoạt động và phương án an toàn.',
    endpoint: '/activities',
    customEntity: 'activities',
    labelField: 'name',
    fields: [
      { name: 'name', label: 'Tên hoạt động', type: 'text', required: true, max: 200 },
      {
        name: 'category',
        label: 'Nhóm hoạt động',
        type: 'select',
        required: true,
        configKey: 'activity_type',
        options: opts(
          ['Truyền thống – đạo đức', 'Truyền thống – đạo đức'],
          ['Học tập – sáng tạo', 'Học tập – sáng tạo'],
          ['Kỹ năng sống – an toàn', 'Kỹ năng sống – an toàn'],
          ['Văn nghệ – thể thao', 'Văn nghệ – thể thao'],
          ['Môi trường', 'Môi trường'],
          ['Tình nguyện – nhân đạo', 'Tình nguyện – nhân đạo'],
          ['Rèn luyện đội viên', 'Rèn luyện đội viên'],
          ['Xây dựng tổ chức Đội', 'Xây dựng tổ chức Đội'],
        ),
      },
      { name: 'theme', label: 'Chủ điểm', type: 'text', max: 150 },
      { name: 'date', label: 'Ngày tổ chức', type: 'date', required: true },
      { name: 'location', label: 'Địa điểm', type: 'text', required: true, max: 200 },
      { name: 'leader', label: 'Người phụ trách', type: 'text', required: true, max: 120 },
      { name: 'participants', label: 'Đối tượng/quy mô', type: 'text', max: 200 },
      { name: 'objectives', label: 'Mục tiêu', type: 'textarea', full: true },
      { name: 'safety', label: 'Phương án an toàn', type: 'textarea', required: true, full: true },
      { name: 'backupPlan', label: 'Phương án dự phòng', type: 'textarea', full: true },
      { name: 'result', label: 'Kết quả sau hoạt động', type: 'textarea', full: true },
      {
        name: 'status',
        label: 'Trạng thái',
        type: 'select',
        required: true,
        options: opts(['PLANNED', 'Dự kiến'], ['ACTIVE', 'Đang thực hiện'], ['FINISHED', 'Đã kết thúc']),
      },
    ],
    columns: [
      { key: 'name', label: 'Tên hoạt động' },
      { key: 'category', label: 'Nhóm' },
      { key: 'date', label: 'Thời gian', render: 'date' },
      { key: 'location', label: 'Địa điểm' },
      { key: 'status', label: 'Trạng thái', render: 'status' },
    ],
  },

  organization: {
    key: 'organization',
    title: 'Tổ chức Liên đội',
    description: 'Ban Chỉ huy, đội nghi lễ, phát thanh măng non và đội nhóm.',
    endpoint: '/organization',
    labelField: 'name',
    fields: [
      { name: 'name', label: 'Họ và tên', type: 'text', required: true, max: 120 },
      { name: 'internalCode', label: 'Mã nội bộ', type: 'text', max: 40 },
      { name: 'className', label: 'Lớp', type: 'text', required: true, max: 50 },
      {
        name: 'unit',
        label: 'Đội/ban',
        type: 'select',
        required: true,
        configKey: 'team_group',
        options: opts(
          ['Ban Chỉ huy Liên đội', 'Ban Chỉ huy Liên đội'],
          ['Ban Chỉ huy Chi đội', 'Ban Chỉ huy Chi đội'],
          ['Đội nghi lễ', 'Đội nghi lễ'],
          ['Phát thanh măng non', 'Phát thanh măng non'],
          ['Đội tự quản', 'Đội tự quản'],
          ['Câu lạc bộ', 'Câu lạc bộ'],
        ),
      },
      { name: 'position', label: 'Chức vụ', type: 'text', required: true, max: 80, configKey: 'team_position' },
      { name: 'term', label: 'Nhiệm kỳ', type: 'text', required: true, max: 60 },
      { name: 'training', label: 'Kết quả bồi dưỡng', type: 'textarea', full: true },
    ],
    columns: [
      { key: 'name', label: 'Họ và tên' },
      { key: 'className', label: 'Lớp' },
      { key: 'unit', label: 'Đội/ban' },
      { key: 'position', label: 'Chức vụ' },
      { key: 'term', label: 'Nhiệm kỳ' },
    ],
  },

  programs: {
    key: 'programs',
    title: 'Rèn luyện – phong trào',
    description: 'Theo dõi chương trình, chuyên hiệu, công trình và việc tốt.',
    endpoint: '/programs',
    labelField: 'name',
    fields: [
      {
        name: 'name',
        label: 'Tên chương trình/chuyên hiệu',
        type: 'text',
        required: true,
        max: 200,
        configKey: 'program_type',
      },
      { name: 'scope', label: 'Đối tượng/lớp', type: 'text', required: true, max: 150 },
      { name: 'result', label: 'Kết quả công nhận', type: 'text', max: 200 },
      { name: 'recognizedDate', label: 'Ngày công nhận', type: 'date' },
      { name: 'activity', label: 'Hoạt động tham gia', type: 'text', max: 200 },
      { name: 'evidence', label: 'Minh chứng/ghi chú', type: 'textarea', full: true },
      {
        name: 'status',
        label: 'Trạng thái',
        type: 'select',
        required: true,
        options: opts(['DRAFT', 'Đang theo dõi'], ['APPROVED', 'Đã công nhận']),
      },
    ],
    columns: [
      { key: 'name', label: 'Chương trình/chuyên hiệu' },
      { key: 'scope', label: 'Đối tượng' },
      { key: 'result', label: 'Kết quả' },
      { key: 'recognizedDate', label: 'Ngày công nhận', render: 'date' },
      { key: 'status', label: 'Trạng thái', render: 'status' },
    ],
  },

  commendations: {
    key: 'commendations',
    title: 'Khen thưởng',
    description: 'Hồ sơ khen thưởng tập thể và cá nhân.',
    endpoint: '/commendations',
    customEntity: 'commendations',
    labelField: 'recipient',
    fields: [
      { name: 'awardType', label: 'Loại khen thưởng', type: 'text', required: true, max: 100, configKey: 'award_type' },
      { name: 'level', label: 'Cấp khen thưởng', type: 'text', required: true, max: 80, configKey: 'award_level' },
      { name: 'recipient', label: 'Đối tượng', type: 'text', required: true, max: 200 },
      { name: 'achievement', label: 'Thành tích', type: 'textarea', required: true, full: true },
      { name: 'date', label: 'Thời gian', type: 'date' },
      { name: 'related', label: 'Hoạt động/kỳ thi đua liên quan', type: 'text', max: 200 },
      {
        name: 'approvalStatus',
        label: 'Trạng thái xét duyệt',
        type: 'select',
        required: true,
        options: opts(['DRAFT', 'Dự thảo'], ['REVIEW', 'Chờ duyệt'], ['APPROVED', 'Đã duyệt']),
      },
      { name: 'decision', label: 'Quyết định', type: 'text', max: 120 },
      { name: 'notes', label: 'Ghi chú', type: 'textarea', full: true },
    ],
    columns: [
      { key: 'recipient', label: 'Đối tượng' },
      { key: 'awardType', label: 'Loại khen thưởng' },
      { key: 'level', label: 'Cấp' },
      { key: 'date', label: 'Thời gian', render: 'date' },
      { key: 'approvalStatus', label: 'Trạng thái', render: 'status' },
    ],
  },

  equipment: {
    key: 'equipment',
    title: 'Thiết bị Đội',
    description: 'Kiểm kê, mượn–trả và chuẩn bị thiết bị cho sự kiện.',
    endpoint: '/equipment',
    customEntity: 'equipment',
    labelField: 'name',
    fields: [
      { name: 'name', label: 'Tên thiết bị/vật tư', type: 'text', required: true, max: 200 },
      { name: 'code', label: 'Mã', type: 'text', required: true, max: 50 },
      { name: 'groupName', label: 'Nhóm', type: 'text', max: 80, configKey: 'equipment_group' },
      { name: 'quantity', label: 'Số lượng', type: 'number', required: true },
      { name: 'unit', label: 'Đơn vị tính', type: 'text', required: true, max: 30, configKey: 'unit' },
      {
        name: 'condition',
        label: 'Tình trạng',
        type: 'select',
        required: true,
        configKey: 'equipment_condition',
        options: opts(['Tốt', 'Tốt'], ['Cần sửa', 'Cần sửa'], ['Hỏng', 'Hỏng'], ['Đang mượn', 'Đang mượn']),
      },
      { name: 'location', label: 'Nơi lưu', type: 'text', max: 150 },
      { name: 'inventoryDate', label: 'Ngày kiểm kê', type: 'date' },
      { name: 'activity', label: 'Hoạt động đang sử dụng', type: 'text', max: 200 },
      { name: 'notes', label: 'Ghi chú hư hỏng/bổ sung', type: 'textarea', full: true },
    ],
    columns: [
      { key: 'code', label: 'Mã' },
      { key: 'name', label: 'Thiết bị/vật tư' },
      { key: 'quantity', label: 'Số lượng' },
      { key: 'condition', label: 'Tình trạng' },
      { key: 'location', label: 'Nơi lưu' },
    ],
  },
};
