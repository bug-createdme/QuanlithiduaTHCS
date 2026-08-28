import { describe, expect, it } from 'vitest';
import {
  NAV_ITEMS,
  SETTINGS_CONFIG_KEYS,
  SETTINGS_CUSTOM_ENTITY,
  SETTINGS_TABS,
} from '@/lib/navigation';
import { ENTITY_CONFIGS } from '@/components/entity/entity.config';

describe('Điều hướng chính', () => {
  it('có đúng 16 mục như website gốc', () => {
    expect(NAV_ITEMS).toHaveLength(16);
  });

  it('giữ nguyên thứ tự và nhãn của bản gốc', () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual([
      'Tổng quan',
      'Hôm nay',
      'Kế hoạch',
      'Công việc và checklist',
      'Lịch hoạt động',
      'Thi đua lớp',
      'Hoạt động Đội',
      'Tổ chức Liên đội',
      'Rèn luyện – phong trào',
      'Khen thưởng',
      'Hồ sơ – minh chứng',
      'Thiết bị Đội',
      'Báo cáo',
      'Trợ lý tổng hợp',
      'Sao lưu – đồng bộ',
      'Thiết lập',
    ]);
  });

  it('mọi đường dẫn là duy nhất và bắt đầu bằng /', () => {
    const hrefs = NAV_ITEMS.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.every((h) => h.startsWith('/'))).toBe(true);
  });

  it('mỗi mục đều có biểu tượng và nhãn ngắn cho điện thoại', () => {
    for (const item of NAV_ITEMS) {
      expect(item.icon).toBeTruthy();
      expect(item.short.length).toBeGreaterThan(0);
      // Nhãn ngắn phải thực sự ngắn để vừa ô 112px của thanh điều hướng đáy.
      expect(item.short.length).toBeLessThanOrEqual(12);
    }
  });
});

describe('Trung tâm cấu hình', () => {
  it('có đúng 14 nhóm thiết lập như bản gốc', () => {
    expect(SETTINGS_TABS).toHaveLength(14);
  });

  it('mã nhóm là duy nhất', () => {
    const ids = SETTINGS_TABS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('mọi khóa danh mục đều thuộc một nhóm thiết lập có thật', () => {
    const tabIds = new Set(SETTINGS_TABS.map((t) => t.id));
    for (const key of Object.keys(SETTINGS_CONFIG_KEYS)) {
      expect(tabIds.has(key as (typeof SETTINGS_TABS)[number]['id'])).toBe(true);
    }
  });

  it('gồm đủ 21 danh mục cấu hình động của bản gốc', () => {
    const all = Object.values(SETTINGS_CONFIG_KEYS).flat();
    expect(new Set(all).size).toBe(21);
  });

  it('thực thể gắn trường tùy chỉnh đều nằm trong danh sách backend cho phép', () => {
    const allowed = new Set([
      'plans',
      'tasks',
      'activities',
      'documents',
      'commendations',
      'equipment',
    ]);
    for (const entity of Object.values(SETTINGS_CUSTOM_ENTITY)) {
      expect(allowed.has(entity)).toBe(true);
    }
  });
});

describe('Cấu hình sáu trang CRUD', () => {
  const keys = Object.keys(ENTITY_CONFIGS);

  it('có đủ sáu thực thể', () => {
    expect(keys).toHaveLength(6);
  });

  it('mỗi thực thể đều có tiêu đề, mô tả và điểm cuối API', () => {
    for (const key of keys) {
      const config = ENTITY_CONFIGS[key]!;
      expect(config.title).toBeTruthy();
      expect(config.description).toBeTruthy();
      expect(config.endpoint.startsWith('/')).toBe(true);
    }
  });

  it('khóa cấu hình khớp với đường dẫn điểm cuối', () => {
    for (const key of keys) {
      expect(ENTITY_CONFIGS[key]!.endpoint).toBe(`/${key}`);
    }
  });

  it('mọi cột hiển thị đều tồn tại trong danh sách trường của form', () => {
    for (const key of keys) {
      const config = ENTITY_CONFIGS[key]!;
      const fieldNames = new Set(config.fields.map((f) => f.name));
      for (const column of config.columns) {
        expect(
          fieldNames.has(column.key),
          `Cột "${column.key}" của ${config.title} không có trường tương ứng`,
        ).toBe(true);
      }
    }
  });

  it('trường dùng làm nhãn khi xóa phải tồn tại', () => {
    for (const key of keys) {
      const config = ENTITY_CONFIGS[key]!;
      expect(config.fields.some((f) => f.name === config.labelField)).toBe(true);
    }
  });

  it('trường bắt buộc kiểu select đều có sẵn lựa chọn mặc định', () => {
    for (const key of keys) {
      for (const field of ENTITY_CONFIGS[key]!.fields) {
        if (field.type === 'select' && field.required) {
          expect(
            (field.options?.length ?? 0) > 0,
            `Trường "${field.name}" của ${key} thiếu lựa chọn mặc định`,
          ).toBe(true);
        }
      }
    }
  });

  it('tên trường không trùng nhau trong cùng một thực thể', () => {
    for (const key of keys) {
      const names = ENTITY_CONFIGS[key]!.fields.map((f) => f.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });
});
