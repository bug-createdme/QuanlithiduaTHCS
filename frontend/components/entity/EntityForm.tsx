'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useScope } from '@/hooks/useScope';
import { useToast } from '@/hooks/useToast';
import { toDateInput } from '@/lib/format';
import { ApiError, api } from '@/services/api';
import type { ConfigItem, CustomFieldDefinition } from '@/types';
import { Button, Field, LoadingState, Select, TextArea, TextInput } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { CustomFieldInputs, collectCustomValues } from './CustomFieldInputs';
import type { EntityConfig, EntityField } from './entity.config';

type FormValues = Record<string, string>;

/**
 * Form thêm/sửa dùng chung — tương ứng entityForm() của bản gốc,
 * gồm cả cơ chế ghi đè lựa chọn bằng danh mục cấu hình động (dynamicMap).
 */
export function EntityForm({
  config,
  open,
  recordId,
  onClose,
  onSaved,
}: {
  config: EntityConfig;
  open: boolean;
  recordId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const scope = useScope();
  const { toast, toastError } = useToast();

  const [values, setValues] = useState<FormValues>({});
  const [customValues, setCustomValues] = useState<Record<string, unknown>>({});
  const [customDefs, setCustomDefs] = useState<CustomFieldDefinition[]>([]);
  const [configItems, setConfigItems] = useState<Record<string, ConfigItem[]>>({});
  const [revision, setRevision] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issues, setIssues] = useState<Record<string, string>>({});

  const configKeys = useMemo(
    () => Array.from(new Set(config.fields.map((f) => f.configKey).filter(Boolean) as string[])),
    [config.fields],
  );

  // Nạp danh mục động và trường tùy chỉnh một lần mỗi khi mở form.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      const [items, defs] = await Promise.all([
        Promise.all(
          configKeys.map(async (key) => [key, await api.get<ConfigItem[]>(`/config/items/${key}`)] as const),
        ),
        config.customEntity
          ? api.get<CustomFieldDefinition[]>(`/settings/custom-fields/${config.customEntity}`)
          : Promise.resolve([]),
      ]);
      if (cancelled) return;
      setConfigItems(Object.fromEntries(items));
      setCustomDefs(defs);
    })().catch(() => {
      /* danh mục không tải được thì dùng lựa chọn tĩnh mặc định */
    });

    return () => {
      cancelled = true;
    };
  }, [open, configKeys, config.customEntity]);

  // Nạp bản ghi khi sửa; đặt giá trị mặc định khi thêm mới.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const defaults: FormValues = { campusId: scope.campusId === 'all' ? '' : scope.campusId };
    for (const field of config.fields) {
      if (field.type === 'select' && field.required && field.options?.length) {
        defaults[field.name] = field.options[0]!.value;
      } else if (field.type === 'number') {
        defaults[field.name] = '0';
      } else {
        defaults[field.name] = '';
      }
    }

    if (!recordId) {
      setValues(defaults);
      setCustomValues({});
      setRevision(null);
      setIssues({});
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const row = await api.get<Record<string, unknown>>(`${config.endpoint}/${recordId}`);
        if (cancelled) return;
        const next: FormValues = { campusId: (row.campusId as string) ?? '' };
        for (const field of config.fields) {
          const raw = row[field.name];
          next[field.name] =
            field.type === 'date'
              ? toDateInput(raw as string)
              : raw === null || raw === undefined
                ? ''
                : String(raw);
        }
        setValues(next);
        setCustomValues((row.customValues as Record<string, unknown>) ?? {});
        setRevision(Number(row.revision ?? 0));
        setIssues({});
      } catch (err) {
        toastError(err);
        onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, recordId, config, scope.campusId, toastError, onClose]);

  const setValue = useCallback((name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
  }, []);

  /** Lựa chọn động từ danh mục cấu hình sẽ ghi đè danh sách tĩnh, đúng bản gốc. */
  const optionsFor = (field: EntityField): Array<{ value: string; label: string }> => {
    const dynamic = field.configKey ? configItems[field.configKey] : undefined;
    if (dynamic?.length) return dynamic.map((item) => ({ value: item.label, label: item.label }));
    return field.options ?? [];
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setIssues({});

    const payload: Record<string, unknown> = {
      schoolYearId: scope.yearId,
      semesterId: scope.semesterId === 'all' ? null : scope.semesterId,
      campusId: values.campusId || null,
      customValues: collectCustomValues(customDefs, customValues),
      ...(revision !== null ? { revision } : {}),
    };

    for (const field of config.fields) {
      const raw = values[field.name] ?? '';
      if (field.type === 'number') payload[field.name] = raw === '' ? 0 : Number(raw);
      else payload[field.name] = raw === '' ? null : raw;
    }

    try {
      if (recordId) await api.patch(`${config.endpoint}/${recordId}`, payload);
      else await api.post(config.endpoint, payload);
      toast('Đã lưu bản ghi');
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.issues?.length) {
          setIssues(Object.fromEntries(err.issues.map((i) => [i.field, i.message])));
        }
        if (err.code === 'REVISION_CONFLICT') {
          toast('Bản ghi đã thay đổi ở nơi khác. Hãy đóng form và mở lại để xem bản mới nhất.', 'bad');
        } else {
          toastError(err);
        }
      } else {
        toastError(err);
      }
    } finally {
      setSaving(false);
    }
  };

  const title = `${recordId ? 'Cập nhật' : 'Thêm'} ${config.title.toLowerCase()}`;

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      wide
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button variant="primary" form="entityForm" type="submit" loading={saving}>
            Lưu
          </Button>
        </>
      }
    >
      {loading ? (
        <LoadingState />
      ) : (
        <form id="entityForm" onSubmit={handleSubmit}>
          <div className="form-grid">
            {config.fields.map((field) => {
              const error = issues[field.name];
              const value = values[field.name] ?? '';
              const options = optionsFor(field);

              return (
                <Field
                  key={field.name}
                  label={field.label}
                  required={field.required}
                  error={error}
                  full={field.full || field.type === 'textarea'}
                >
                  {field.type === 'textarea' ? (
                    <TextArea
                      name={field.name}
                      value={value}
                      required={field.required}
                      onChange={(e) => setValue(field.name, e.target.value)}
                    />
                  ) : field.type === 'select' || options.length > 0 ? (
                    <Select
                      name={field.name}
                      value={value}
                      required={field.required}
                      onChange={(e) => setValue(field.name, e.target.value)}
                    >
                      <option value="">— Chọn —</option>
                      {options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <TextInput
                      name={field.name}
                      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                      value={value}
                      required={field.required}
                      maxLength={field.max}
                      step={field.type === 'number' ? 'any' : undefined}
                      onChange={(e) => setValue(field.name, e.target.value)}
                    />
                  )}
                </Field>
              );
            })}

            <CustomFieldInputs
              definitions={customDefs}
              values={customValues}
              onChange={setCustomValues}
            />

            <Field label="Cơ sở áp dụng">
              <Select
                value={values.campusId ?? ''}
                onChange={(e) => setValue('campusId', e.target.value)}
              >
                <option value="">Toàn trường</option>
                {scope.campuses.map((campus) => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </form>
      )}
    </Modal>
  );
}
