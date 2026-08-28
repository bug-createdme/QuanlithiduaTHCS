/**
 * Dữ liệu mặc định trích nguyên văn từ website gốc (index.html).
 * Giữ đúng thứ tự và cách viết tiếng Việt của bản gốc để UI khớp 100%.
 */

/** CONFIG_DEFINITIONS — 21 danh mục cấu hình động, dòng 10741 của bản gốc. */
export const CONFIG_DEFINITIONS: Array<[key: string, name: string, items: string[]]> = [
  ['plan_type', 'Loại kế hoạch', ['Năm học', 'Học kỳ', 'Tháng', 'Tuần', 'Chuyên đề']],
  ['plan_level', 'Cấp kế hoạch', ['Toàn trường', 'Liên đội', 'Chi đội', 'Cơ sở']],
  ['plan_status', 'Trạng thái kế hoạch', ['Dự thảo', 'Đang thực hiện', 'Đã kết thúc']],
  [
    'activity_type',
    'Loại hoạt động',
    [
      'Giáo dục truyền thống – đạo đức',
      'Học tập – sáng tạo',
      'Kỹ năng sống – an toàn',
      'Văn nghệ – thể thao',
      'Môi trường',
      'Tình nguyện – nhân đạo',
      'Rèn luyện đội viên',
      'Xây dựng tổ chức Đội',
      'Hoạt động theo chủ điểm',
      'Hoạt động phối hợp',
    ],
  ],
  ['task_group', 'Nhóm công việc', ['Tuần', 'Tháng', 'Học kỳ', 'Năm học', 'Đột xuất']],
  [
    'task_status',
    'Trạng thái công việc',
    ['Chưa làm', 'Đang làm', 'Chờ phối hợp', 'Chờ duyệt', 'Hoàn thành', 'Tạm dừng'],
  ],
  ['priority', 'Mức ưu tiên', ['Thấp', 'Bình thường', 'Cao', 'Khẩn']],
  ['calendar_type', 'Loại sự kiện lịch', ['Hoạt động Đội', 'Họp', 'Tập huấn', 'Hạn hồ sơ', 'Thi đua']],
  [
    'document_type',
    'Loại hồ sơ',
    ['Kế hoạch', 'Hoạt động', 'Thi đua', 'Tổ chức Đội', 'Rèn luyện', 'Khen thưởng', 'Báo cáo', 'Thiết bị'],
  ],
  ['document_status', 'Trạng thái hồ sơ', ['Bản nháp', 'Đã xác nhận', 'Lưu trữ']],
  [
    'team_group',
    'Nhóm tổ chức/đội/ban',
    [
      'Ban Chỉ huy Liên đội',
      'Ban Chỉ huy Chi đội',
      'Đội nghi lễ',
      'Phát thanh măng non',
      'Đội tự quản',
      'Câu lạc bộ',
    ],
  ],
  [
    'team_position',
    'Chức vụ',
    ['Liên đội trưởng', 'Liên đội phó', 'Chi đội trưởng', 'Chi đội phó', 'Ủy viên'],
  ],
  [
    'program_type',
    'Loại chương trình rèn luyện',
    ['Rèn luyện đội viên', 'Chuyên hiệu', 'Công trình măng non', 'Việc tốt'],
  ],
  [
    'specialty',
    'Chuyên hiệu',
    ['An toàn giao thông', 'Chăm học', 'Nghệ sĩ nhỏ tuổi', 'Nhà sinh học nhỏ tuổi'],
  ],
  ['award_type', 'Loại khen thưởng', ['Giấy khen', 'Tuyên dương', 'Chứng nhận', 'Phần thưởng']],
  ['award_level', 'Cấp khen thưởng', ['Chi đội', 'Liên đội', 'Nhà trường', 'Cấp trên']],
  ['equipment_group', 'Nhóm thiết bị', ['Nghi lễ', 'Âm thanh', 'Trang trí', 'Thể thao', 'Văn phòng']],
  ['equipment_condition', 'Tình trạng thiết bị', ['Tốt', 'Cần sửa', 'Hỏng', 'Đang mượn']],
  ['unit', 'Đơn vị tính', ['Cái', 'Bộ', 'Chiếc', 'Hộp', 'Cuộn']],
  [
    'report_type',
    'Loại báo cáo',
    ['Công tác tuần', 'Thi đua tuần', 'Công việc', 'Hoạt động', 'Thiết bị', 'Hồ sơ'],
  ],
  ['report_template', 'Mẫu báo cáo', ['Mẫu ngắn', 'Mẫu đầy đủ', 'Bảng tổng hợp']],
];

/** 16 mẫu công việc từ showTaskTemplates(), dòng 6662 của bản gốc. */
export const TASK_TEMPLATES: string[] = [
  'Chuẩn bị nội dung sinh hoạt dưới cờ',
  'Kiểm tra kế hoạch trực tuần',
  'Rà soát lớp chưa nhập thi đua',
  'Kiểm tra minh chứng',
  'Tổng hợp và duyệt thi đua',
  'Công bố kết quả nội bộ',
  'Chuẩn bị phát thanh măng non',
  'Báo cáo Ban Giám hiệu',
  'Xây dựng kế hoạch tuần kế tiếp',
  'Xây dựng chủ điểm tháng',
  'Kiểm tra hồ sơ Chi đội',
  'Kiểm tra thiết bị, vật tư Đội',
  'Tổ chức Đại hội Chi đội và Liên đội',
  'Bồi dưỡng Ban Chỉ huy',
  'Sơ kết học kỳ',
  'Tổng kết năm học',
];

/**
 * 5 tiêu chí mẫu từ ensureSeed(), dòng 5443 của bản gốc.
 * [code, group, name, points, min, max]
 */
export const SAMPLE_CRITERIA: Array<[string, string, string, number, number, number]> = [
  ['NN01', 'Nề nếp', 'Thực hiện nề nếp chung', -2, -20, 0],
  ['VS01', 'Vệ sinh', 'Vệ sinh, cảnh quan', -2, -20, 0],
  ['HT01', 'Học tập', 'Thực hiện nhiệm vụ học tập tập thể', 2, 0, 20],
  ['HD01', 'Hoạt động', 'Tham gia hoạt động, phong trào', 3, 0, 30],
  ['VT01', 'Việc tốt', 'Việc tốt, sáng kiến tập thể', 2, 0, 20],
];

/** Giá trị mặc định của app_settings, gom từ nhiều nơi trong bản gốc. */
export const DEFAULT_APP_SETTINGS: Array<[string, unknown]> = [
  ['sample_loaded', true],
  ['sample_deleted', false],
  ['onboarded', false],
  ['last_backup_at', null],
  ['auto_lock_minutes', 10],
  ['paper_orientation', 'landscape'],
  ['compact_mode', true],
  ['max_file_mb', 25],
  ['storage_warning_low', 70],
  ['storage_warning_high', 85],
  ['storage_warning_critical', 95],
  ['backup_directory_auto', false],
  ['school_name', 'TRƯỜNG THCS (CHƯA CẤU HÌNH)'],
];

/** Bảng màu nhận diện mặc định cho mục cấu hình — tái hiện defaultConfigColor(). */
export const CONFIG_COLORS = [
  '#0b6bcb',
  '#16845b',
  '#f4b41a',
  '#c93c3c',
  '#7c3aed',
  '#0891b2',
  '#ea580c',
  '#4d7c0f',
];

/** Sinh mã ổn định cho mục cấu hình từ nhãn tiếng Việt: "Chưa làm" → "CHUA_LAM". */
export function slugCode(label: string): string {
  const base = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base || 'ITEM';
}
