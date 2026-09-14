'use client';

import { ArrowDown, ArrowUp, Copy, Plus, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/hooks/useToast';
import { normalizeText } from '@/lib/format';
import { api } from '@/services/api';
import type { ConfigCategory, ConfigItem } from '@/types';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHead,
  Field,
  LinkButton,
  LoadingState,
  Notice,
  TableEmptyRow,
  TableWrap,
  TextArea,
  TextInput,
  Toolbar,
} from '@/components/ui';
import { Modal } from '@/components/ui/Modal';

interface ItemFormState {
  label: string;
  code: string;
  color: string;
  icon: string;
  sortOrder: string;
  description: string;
  active: boolean;
}

const emptyItem = (): ItemFormState => ({
  label: '',
  code: '',
  color: '#0b6bcb',
  icon: '•',
  sortOrder: '99',
  description: '',
  active: true,
});

/** Sinh mã gợi ý từ nhãn tiếng Việt: "Chưa làm" → "CHUA_LAM". */
function suggestCode(label: string): string {
  return (
    normalizeText(label)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'ITEM'
  );
}

/**
 * Quản lý một nhóm danh mục động — tương ứng renderConfigCategory() của bản gốc.
 * Nguyên tắc giữ nguyên: ngừng sử dụng ≠ xóa, dữ liệu lịch sử vẫn giữ tên cũ.
 */
export function ConfigCategoryPanel({ categoryKeys }: { categoryKeys: string[] }) {
  const { toast, toastError } = useToast();
  const confirm = useConfirm();
  const [categories, setCategories] = useState<ConfigCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState<Record<string, string>>({});

  const [formOpen, setFormOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ItemFormState>(emptyItem);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCategories(
        await api.get<ConfigCategory[]>('/config/categories', {
          keys: categoryKeys.join(','),
          includeInactive: 'true',
        }),
      );
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [categoryKeys, toastError]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveItem = async () => {
    setBusy(true);
    const payload = {
      label: form.label.trim(),
      code: form.code.trim() || suggestCode(form.label),
      color: form.color,
      icon: form.icon || '•',
      sortOrder: Number(form.sortOrder || 99),
      description: form.description || null,
      active: form.active,
    };
    try {
      if (editingId) await api.patch(`/config/items/${editingId}`, payload);
      else await api.post(`/config/categories/${activeKey}/items`, payload);
      toast('Đã lưu mục cấu hình');
      setFormOpen(false);
      await load();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (item: ConfigItem) => {
    try {
      await api.patch(`/config/items/${item.id}`, { active: !item.active });
      toast(
        item.active ? 'Đã ngừng sử dụng; dữ liệu cũ vẫn được giữ' : 'Đã bật sử dụng',
      );
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const clone = async (item: ConfigItem) => {
    try {
      await api.post(`/config/items/${item.id}/clone`);
      toast('Đã nhân bản mục');
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const move = async (item: ConfigItem, direction: 'up' | 'down') => {
    try {
      await api.post(`/config/items/${item.id}/move`, { direction });
      toast(`Đã di chuyển "${item.label}" ${direction === 'up' ? 'lên trên' : 'xuống dưới'}.`);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const restoreDefaults = async (category: ConfigCategory) => {
    const ok = await confirm({
      title: 'Khôi phục danh mục mẫu',
      description: `Bạn có chắc muốn khôi phục các mục mẫu cho danh mục "${category.name}"? Các mục mặc định bị thiếu sẽ được tạo lại.`,
      confirmLabel: 'Khôi phục',
      tone: 'warn',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const result = await api.post<{ restored: number }>(
        `/config/categories/${category.key}/restore-defaults`,
      );
      toast(`Đã khôi phục ${result.restored} mục mẫu`);
      await load();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <>
      <Notice className="mb-3">
        Danh mục ngừng sử dụng không xuất hiện khi tạo mới nhưng vẫn giữ nguyên tên trong dữ liệu
        lịch sử.
      </Notice>

      {categories.map((category) => {
        const query = normalizeText(search[category.key] ?? '');
        const items = category.items.filter(
          (item) => !query || normalizeText(item.label).includes(query),
        );
        const activeCount = category.items.filter((item) => item.active).length;

        return (
          <Card key={category.id} className="mb-3">
            <CardHead
              title={category.name}
              meta={`${activeCount}/${category.items.length} đang dùng`}
            />
            <CardBody className="pt-2">
              <Toolbar className="mb-2">
                <TextInput
                  value={search[category.key] ?? ''}
                  onChange={(e) =>
                    setSearch((current) => ({ ...current, [category.key]: e.target.value }))
                  }
                  placeholder="Tìm trong danh mục…"
                  className="min-w-[160px] flex-1"
                  aria-label={`Tìm trong ${category.name}`}
                />
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Plus size={14} aria-hidden />}
                  onClick={() => {
                    setActiveKey(category.key);
                    setEditingId(null);
                    setForm(emptyItem());
                    setFormOpen(true);
                  }}
                >
                  Thêm
                </Button>
                <Button
                  size="sm"
                  icon={<RotateCcw size={14} aria-hidden />}
                  loading={busy}
                  onClick={() => void restoreDefaults(category)}
                >
                  Khôi phục mẫu
                </Button>
              </Toolbar>

              <TableWrap className="max-h-[300px]">
                <thead>
                  <tr>
                    <th className="w-[60px]">Thứ tự</th>
                    <th className="w-[60px]">Màu</th>
                    <th>Tên hiển thị</th>
                    <th>Mã</th>
                    <th>Trạng thái</th>
                    <th className="w-[210px]">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <TableEmptyRow colSpan={6}>Không có mục phù hợp.</TableEmptyRow>
                  ) : (
                    items.map((item, index) => (
                      <tr key={item.id}>
                        <td>{index + 1}</td>
                        <td>
                          <span
                            className="inline-block h-4 w-4 rounded"
                            style={{ background: item.color }}
                            aria-hidden
                          />
                        </td>
                        <td className="wrap">{item.label}</td>
                        <td>
                          <code className="text-[11px]">{item.code}</code>
                        </td>
                        <td>
                          {item.active ? (
                            <Badge tone="green">Đang dùng</Badge>
                          ) : (
                            <Badge>Ngừng dùng</Badge>
                          )}
                        </td>
                        <td>
                          <div className="flex flex-wrap items-center gap-2">
                            <LinkButton
                              aria-label="Lên"
                              onClick={() => void move(item, 'up')}
                            >
                              <ArrowUp size={13} aria-hidden />
                            </LinkButton>
                            <LinkButton
                              aria-label="Xuống"
                              onClick={() => void move(item, 'down')}
                            >
                              <ArrowDown size={13} aria-hidden />
                            </LinkButton>
                            <LinkButton
                              onClick={() => {
                                setActiveKey(category.key);
                                setEditingId(item.id);
                                setForm({
                                  label: item.label,
                                  code: item.code,
                                  color: item.color,
                                  icon: item.icon,
                                  sortOrder: String(item.sortOrder),
                                  description: item.description ?? '',
                                  active: item.active,
                                });
                                setFormOpen(true);
                              }}
                            >
                              Sửa
                            </LinkButton>
                            <LinkButton onClick={() => void clone(item)}>
                              <Copy size={13} aria-hidden />
                            </LinkButton>
                            <LinkButton onClick={() => void toggle(item)}>
                              {item.active ? 'Ngừng' : 'Bật'}
                            </LinkButton>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </TableWrap>
            </CardBody>
          </Card>
        );
      })}

      <Modal
        open={formOpen}
        title={editingId ? 'Sửa mục cấu hình' : 'Thêm mục cấu hình'}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Hủy</Button>
            <Button variant="primary" loading={busy} onClick={() => void saveItem()}>
              Lưu
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Tên hiển thị" required full>
            <TextInput
              value={form.label}
              onChange={(e) => {
                const label = e.target.value;
                setForm((current) => ({
                  ...current,
                  label,
                  // Chỉ tự sinh mã khi thêm mới và người dùng chưa tự nhập.
                  code: !editingId && !current.code ? '' : current.code,
                }));
              }}
              onBlur={() =>
                setForm((current) => ({
                  ...current,
                  code: current.code || suggestCode(current.label),
                }))
              }
              maxLength={150}
            />
          </Field>
          <Field label="Mã duy nhất" required hint="Chỉ chữ không dấu, số, gạch ngang, gạch dưới.">
            <TextInput
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              maxLength={60}
            />
          </Field>
          <Field label="Màu nhận diện">
            <input
              type="color"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              className="h-[34px] w-full rounded-control border border-line bg-white px-1"
            />
          </Field>
          <Field label="Biểu tượng ký tự">
            <TextInput
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              maxLength={4}
            />
          </Field>
          <Field label="Thứ tự">
            <TextInput
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
            />
          </Field>
          <Field label="Mô tả" full>
            <TextArea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              className="h-[15px] w-[15px] accent-[#0b6bcb]"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Đang sử dụng
          </label>
        </div>
      </Modal>
    </>
  );
}
