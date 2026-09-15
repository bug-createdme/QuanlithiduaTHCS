import {
  Award,
  Bot,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FileBarChart,
  Flag,
  FolderOpen,
  LayoutDashboard,
  Clock,
  Package,
  RefreshCw,
  Settings,
  Star,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Nhãn rút gọn cho thanh điều hướng đáy trên điện thoại. */
  short: string;
}

/**
 * 16 mục điều hướng, đúng thứ tự và câu chữ của mảng NAV trong website gốc.
 * Biểu tượng Unicode của bản gốc được thay bằng Lucide React theo yêu cầu,
 * ánh xạ 1-1 để giữ nguyên ý nghĩa thị giác.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Tổng quan', short: 'Tổng quan', icon: LayoutDashboard },
  { href: '/today', label: 'Hôm nay', short: 'Hôm nay', icon: Clock },
  { href: '/plans', label: 'Kế hoạch', short: 'Kế hoạch', icon: ClipboardList },
  { href: '/tasks', label: 'Công việc và checklist', short: 'Công việc', icon: CheckSquare },
  { href: '/calendar', label: 'Lịch hoạt động', short: 'Lịch', icon: CalendarDays },
  { href: '/scores', label: 'Thi đua lớp', short: 'Thi đua', icon: Star },
  { href: '/activities', label: 'Hoạt động Đội', short: 'Hoạt động', icon: Flag },
  { href: '/organization', label: 'Tổ chức Liên đội', short: 'Tổ chức', icon: Users },
  { href: '/programs', label: 'Rèn luyện – phong trào', short: 'Rèn luyện', icon: Award },
  { href: '/commendations', label: 'Khen thưởng', short: 'Khen thưởng', icon: Trophy },
  { href: '/documents', label: 'Hồ sơ – minh chứng', short: 'Hồ sơ', icon: FolderOpen },
  { href: '/equipment', label: 'Thiết bị Đội', short: 'Thiết bị', icon: Package },
  { href: '/reports', label: 'Báo cáo', short: 'Báo cáo', icon: FileBarChart },
  { href: '/assistant', label: 'Trợ lý tổng hợp', short: 'Trợ lý', icon: Bot },
  { href: '/backup', label: 'Sao lưu – đồng bộ', short: 'Sao lưu', icon: RefreshCw },
  { href: '/settings', label: 'Thiết lập', short: 'Thiết lập', icon: Settings },
];

/**
 * Thanh bên gom 16 mục trên thành 6 nhóm nghiệp vụ.
 *
 * Một danh sách phẳng 16 dòng buộc người dùng đọc hết mới tìm ra chức năng;
 * chia nhóm theo đúng cách công việc của Tổng phụ trách được tổ chức thì mắt
 * chỉ phải quét trong một nhóm 2–3 mục. Thứ tự và nội dung NAV_ITEMS không đổi,
 * đây chỉ là cách trình bày lại.
 */
export interface NavGroup {
  id: string;
  label: string;
  /** Nhãn cực ngắn cho thanh bên thu gọn (64px). */
  short: string;
  items: NavItem[];
}

const byHref = (href: string): NavItem => {
  const item = NAV_ITEMS.find((entry) => entry.href === href);
  if (!item) throw new Error(`Thiếu mục điều hướng cho ${href}`);
  return item;
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'operate',
    label: 'Điều hành hằng ngày',
    short: 'Điều hành',
    items: [byHref('/dashboard'), byHref('/today'), byHref('/calendar')],
  },
  {
    id: 'plan',
    label: 'Kế hoạch và công việc',
    short: 'Kế hoạch',
    items: [byHref('/plans'), byHref('/tasks')],
  },
  {
    id: 'competition',
    label: 'Thi đua và rèn luyện',
    short: 'Thi đua',
    items: [byHref('/scores'), byHref('/programs'), byHref('/commendations')],
  },
  {
    id: 'team',
    label: 'Hoạt động và tổ chức Đội',
    short: 'Đội',
    items: [byHref('/activities'), byHref('/organization'), byHref('/equipment')],
  },
  {
    id: 'archive',
    label: 'Hồ sơ và báo cáo',
    short: 'Hồ sơ',
    items: [byHref('/documents'), byHref('/reports'), byHref('/assistant')],
  },
  {
    id: 'system',
    label: 'Hệ thống',
    short: 'Hệ thống',
    items: [byHref('/backup'), byHref('/settings')],
  },
];

/** Mục điều hướng đang hoạt động ứng với đường dẫn hiện tại. */
export function activeNavItem(pathname: string): NavItem | null {
  return (
    NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ?? null
  );
}

/** Nhóm chứa mục đang hoạt động — dùng cho breadcrumb ở thanh trên cùng. */
export function activeNavGroup(pathname: string): NavGroup | null {
  const item = activeNavItem(pathname);
  if (!item) return null;
  return NAV_GROUPS.find((group) => group.items.includes(item)) ?? null;
}

/** 14 nhóm thiết lập, đúng thứ tự SETTINGS_TABS của bản gốc. */
export const SETTINGS_TABS = [
  { id: 'school', label: 'Thông tin trường' },
  { id: 'context', label: 'Cơ sở – năm học – học kỳ – tuần' },
  { id: 'classes', label: 'Lớp và giáo viên chủ nhiệm' },
  { id: 'competition', label: 'Cấu hình thi đua' },
  { id: 'activities', label: 'Danh mục hoạt động' },
  { id: 'tasks', label: 'Công việc và checklist' },
  { id: 'documents', label: 'Hồ sơ – tài liệu' },
  { id: 'team', label: 'Tổ chức Đội – phong trào' },
  { id: 'awards', label: 'Khen thưởng' },
  { id: 'equipment', label: 'Thiết bị' },
  { id: 'reports', label: 'Báo cáo và mẫu in' },
  { id: 'appearance', label: 'Giao diện' },
  { id: 'data', label: 'Dữ liệu – sao lưu' },
  { id: 'security', label: 'Khóa phiên và tài khoản' },
] as const;

export type SettingsTabId = (typeof SETTINGS_TABS)[number]['id'];

/** Danh mục cấu hình hiển thị ở mỗi tab — giữ đúng SETTINGS_CONFIG_KEYS gốc. */
export const SETTINGS_CONFIG_KEYS: Partial<Record<SettingsTabId, string[]>> = {
  context: ['plan_type', 'plan_level', 'plan_status'],
  activities: ['activity_type', 'calendar_type'],
  tasks: ['task_group', 'task_status', 'priority'],
  documents: ['document_type', 'document_status'],
  team: ['team_group', 'team_position', 'program_type', 'specialty'],
  awards: ['award_type', 'award_level'],
  equipment: ['equipment_group', 'equipment_condition', 'unit'],
  reports: ['report_type', 'report_template'],
};

/** Thực thể tương ứng để quản lý trường tùy chỉnh ở mỗi tab. */
export const SETTINGS_CUSTOM_ENTITY: Partial<Record<SettingsTabId, string>> = {
  context: 'plans',
  activities: 'activities',
  tasks: 'tasks',
  documents: 'documents',
  awards: 'commendations',
  equipment: 'equipment',
};
