'use client';

import { Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { api } from '@/services/api';
import type { CustomFieldDefinition, CustomFieldType } from '@/types';
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
  Select,
  TableEmptyRow,
  TableWrap,
  TextArea,
  TextInput,
} from '@/components/ui';
import { Modal } from '@/components/ui/Modal';

const FIELD_TYPE_LABEL: Record<CustomFieldType, string> = {
  SHORT_TEXT: 'Văn bản ngắn',
  LONG_TEXT: 'Văn bản dài',
  NUMBER: 'Số',
  DATE: 'Ngày',
  SINGLE_CHOICE: 'Lựa chọn một',
  MULTI_CHOICE: 'Lựa chọn nhiều',
  BOOLEAN: 'Có/không',
  LINK: 'Liên kết',
  FILE: 'Tệp đính kèm',
};

const ENTITY_LABEL: Record<string, string> = {
  plans: 'kế hoạch',
  tasks: 'công việc',
  activities: 'hoạt động',
  documents: 'hồ sơ',
  commendations: 'khen thưởng',
  equipment: 'thiết bị',
};

interface FormState {
  name: string;
  fieldType: CustomFieldType;
  options: string;
  description: string;
  required: boolean;
  sortOrder: string;
  active: boolean;
}

const emptyForm = (): FormState => ({
  name: '',
  fieldType: 'SHORT_TEXT',
  options: '',
  description: '',
  required: false,
  sortOrder: '99',
  active: true,
});

/** Quản lý trường tùy chỉnh cho một thực thể — tương ứng renderCustomFieldManager(). */
export function CustomFieldPanel({ entity }: { entity: string }) {
  const { toast, toastError } = useToast();
  const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDefinitions(
        await api.get<CustomFieldDefinition[]>(`/settings/custom-fields/${entity}`, {
          includeInactive: 'true',
        }),
      );
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [entity, toastError]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    const payload = {
      entityType: entity,
      name: form.name.trim(),
      fieldType: form.fieldType,
      options: form.options || null,
      description: form.description || null,
      required: form.required,
      sortOrder: Number(form.sortOrder || 99),
      active: form.active,
    };
    try {
      if (editingId) await api.patch(`/settings/custom-fields/${editingId}`, payload);
      else await api.post('/settings/custom-fields', payload);
      toast('Đã lưu trường tùy chỉnh');
      setOpen(false);
      await load();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (definition: CustomFieldDefinition) => {
    try {
      await api.patch(`/settings/custom-fields/${definition.id}`, { active: !definition.active });
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <>
      <Card className="mt-3">
        <CardHead
          title={`Trường thông tin tùy chỉnh – ${ENTITY_LABEL[entity] ?? entity}`}
          meta={`${definitions.length} trường`}
          actions={
            <Button
              size="sm"
              variant="primary"
              icon={<Plus size={14} aria-hidden />}
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm());
                setOpen(true);
              }}
            >
              Thêm trường
            </Button>
          }
        />
        <CardBody className="pt-2">
          <Notice className="mb-2.5">
            Chỉ dùng các kiểu dữ liệu an toàn; không cho phép nhập hoặc thực thi mã.
          </Notice>
          <TableWrap className="max-h-[300px]">
            <thead>
              <tr>
                <th className="w-[60px]">Thứ tự</th>
                <th>Tên trường</th>
                <th>Kiểu</th>
                <th>Bắt buộc</th>
                <th>Trạng thái</th>
                <th className="w-[130px]" />
              </tr>
            </thead>
            <tbody>
              {definitions.length === 0 ? (
                <TableEmptyRow colSpan={6}>Chưa có trường tùy chỉnh.</TableEmptyRow>
              ) : (
                definitions.map((definition, index) => (
                  <tr key={definition.id}>
                    <td>{index + 1}</td>
                    <td className="wrap">{definition.name}</td>
                    <td>{FIELD_TYPE_LABEL[definition.fieldType]}</td>
                    <td>{definition.required ? 'Có' : 'Không'}</td>
                    <td>
                      {definition.active ? (
                        <Badge tone="green">Đang dùng</Badge>
                      ) : (
                        <Badge>Ngừng</Badge>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <LinkButton
                          onClick={() => {
                            setEditingId(definition.id);
                            setForm({
                              name: definition.name,
                              fieldType: definition.fieldType,
                              options: definition.options ?? '',
                              description: definition.description ?? '',
                              required: definition.required,
                              sortOrder: String(definition.sortOrder),
                              active: definition.active,
                            });
                            setOpen(true);
                          }}
                        >
                          Sửa
                        </LinkButton>
                        <LinkButton onClick={() => void toggle(definition)}>
                          {definition.active ? 'Ngừng' : 'Bật'}
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

      <Modal
        open={open}
        title={editingId ? 'Sửa trường tùy chỉnh' : 'Thêm trường tùy chỉnh'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Hủy</Button>
            <Button variant="primary" loading={busy} onClick={() => void save()}>
              Lưu
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Tên trường" required full>
            <TextInput
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={150}
            />
          </Field>
          <Field label="Kiểu trường">
            <Select
              value={form.fieldType}
              onChange={(e) => setForm({ ...form, fieldType: e.target.value as CustomFieldType })}
            >
              {(Object.keys(FIELD_TYPE_LABEL) as CustomFieldType[]).map((type) => (
                <option key={type} value={type}>
                  {FIELD_TYPE_LABEL[type]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Thứ tự">
            <TextInput
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
            />
          </Field>
          <Field
            label="Các lựa chọn, ngăn bằng dấu |"
            full
            hint="Bắt buộc với kiểu Lựa chọn một / Lựa chọn nhiều."
          >
            <TextInput
              value={form.options}
              onChange={(e) => setForm({ ...form, options: e.target.value })}
              placeholder="Mức 1|Mức 2|Mức 3"
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
              checked={form.required}
              onChange={(e) => setForm({ ...form, required: e.target.checked })}
            />
            Bắt buộc
          </label>
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
