'use client';

import { useCallback, useEffect, useState } from 'react';
import { useScope } from '@/hooks/useScope';
import { useToast } from '@/hooks/useToast';
import { toDateInput, todayISO } from '@/lib/format';
import { REPEAT_RULE_LABEL, TASK_PRIORITY_LABEL, TASK_STATUS_LABEL, toOptions } from '@/lib/labels';
import { ApiError, api } from '@/services/api';
import type { ConfigItem, CustomFieldDefinition, Task } from '@/types';
import { Button, Field, LoadingState, Select, TextArea, TextInput } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { CustomFieldInputs, collectCustomValues } from '@/components/entity/CustomFieldInputs';

interface TaskFormState {
  title: string;
  groupName: string;
  campusId: string;
  startDate: string;
  dueDate: string;
  priority: string;
  status: string;
  progress: string;
  coordination: string;
  repeatRule: string;
  repeatUntil: string;
  checklist: string;
  obstacle: string;
  notes: string;
}

const emptyState = (campusId: string): TaskFormState => ({
  title: '',
  groupName: '',
  campusId: campusId === 'all' ? '' : campusId,
  startDate: todayISO(),
  dueDate: todayISO(),
  priority: 'NORMAL',
  status: 'TODO',
  progress: '0',
  coordination: '',
  repeatRule: 'NONE',
  repeatUntil: '',
  checklist: '',
  obstacle: '',
  notes: '',
});

/** Ghép checklist con thành textarea; mục bắt buộc có tiền tố "!" như bản gốc. */
function checklistToText(items: Task['checkItems']): string {
  if (!items?.length) return '';
  return items
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => `${item.required ? '! ' : ''}${item.label}`)
    .join('\n');
}

export function TaskForm({
  open,
  taskId,
  onClose,
  onSaved,
}: {
  open: boolean;
  taskId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const scope = useScope();
  const { toast, toastError } = useToast();

  const [values, setValues] = useState<TaskFormState>(() => emptyState(scope.campusId));
  const [customDefs, setCustomDefs] = useState<CustomFieldDefinition[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, unknown>>({});
  const [groups, setGroups] = useState<ConfigItem[]>([]);
  const [revision, setRevision] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issues, setIssues] = useState<Record<string, string>>({});

  const set = useCallback(<K extends keyof TaskFormState>(key: K, value: TaskFormState[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      const [groupItems, defs] = await Promise.all([
        api.get<ConfigItem[]>('/config/items/task_group'),
        api.get<CustomFieldDefinition[]>('/settings/custom-fields/tasks'),
      ]);
      if (cancelled) return;
      setGroups(groupItems);
      setCustomDefs(defs);
    })().catch(() => {
      /* thiếu danh mục thì vẫn nhập tay được */
    });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!taskId) {
      setValues(emptyState(scope.campusId));
      setCustomValues({});
      setRevision(null);
      setIssues({});
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const task = await api.get<Task>(`/tasks/${taskId}`);
        if (cancelled) return;
        setValues({
          title: task.title,
          groupName: task.groupName ?? '',
          campusId: task.campusId ?? '',
          startDate: toDateInput(task.startDate),
          dueDate: toDateInput(task.dueDate),
          priority: task.priority,
          status: task.status,
          progress: String(task.progress),
          coordination: task.coordination ?? '',
          repeatRule: task.repeatRule,
          repeatUntil: toDateInput(task.repeatUntil),
          checklist: checklistToText(task.checkItems),
          obstacle: task.obstacle ?? '',
          notes: task.notes ?? '',
        });
        setCustomValues(task.customValues ?? {});
        setRevision(task.revision);
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
  }, [open, taskId, scope.campusId, toastError, onClose]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Kiểm tra tại chỗ trước khi gửi, dùng đúng câu chữ của bản gốc.
    if (values.startDate && values.dueDate < values.startDate) {
      toast('Hạn hoàn thành phải từ ngày bắt đầu trở đi.', 'bad');
      return;
    }

    setSaving(true);
    setIssues({});
    const payload = {
      schoolYearId: scope.yearId,
      semesterId: scope.semesterId === 'all' ? null : scope.semesterId,
      campusId: values.campusId || null,
      title: values.title.trim(),
      groupName: values.groupName || null,
      startDate: values.startDate || null,
      dueDate: values.dueDate,
      priority: values.priority,
      status: values.status,
      progress: Number(values.progress || 0),
      coordination: values.coordination || null,
      repeatRule: values.repeatRule,
      repeatUntil: values.repeatUntil || null,
      checklist: values.checklist || null,
      obstacle: values.obstacle || null,
      notes: values.notes || null,
      customValues: collectCustomValues(customDefs, customValues),
      ...(revision !== null ? { revision } : {}),
    };

    try {
      if (taskId) await api.patch(`/tasks/${taskId}`, payload);
      else await api.post('/tasks', payload);
      toast('Đã lưu công việc');
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.issues?.length) {
        setIssues(Object.fromEntries(err.issues.map((i) => [i.field, i.message])));
      }
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={taskId ? 'Cập nhật công việc' : 'Thêm công việc'}
      onClose={onClose}
      wide
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button variant="primary" type="submit" form="taskForm" loading={saving}>
            Lưu công việc
          </Button>
        </>
      }
    >
      {loading ? (
        <LoadingState />
      ) : (
        <form id="taskForm" onSubmit={handleSubmit}>
          <div className="form-grid">
            <Field label="Tiêu đề" required full error={issues.title}>
              <TextInput
                value={values.title}
                onChange={(e) => set('title', e.target.value)}
                maxLength={200}
                required
              />
            </Field>

            <Field label="Nhóm nghiệp vụ">
              <Select value={values.groupName} onChange={(e) => set('groupName', e.target.value)}>
                <option value="">— Chọn —</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.label}>
                    {group.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Cơ sở">
              <Select value={values.campusId} onChange={(e) => set('campusId', e.target.value)}>
                <option value="">Toàn trường</option>
                {scope.campuses.map((campus) => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Ngày bắt đầu">
              <TextInput
                type="date"
                value={values.startDate}
                onChange={(e) => set('startDate', e.target.value)}
              />
            </Field>

            <Field label="Hạn hoàn thành" required error={issues.dueDate}>
              <TextInput
                type="date"
                value={values.dueDate}
                onChange={(e) => set('dueDate', e.target.value)}
                required
              />
            </Field>

            <Field label="Ưu tiên">
              <Select value={values.priority} onChange={(e) => set('priority', e.target.value)}>
                {toOptions(TASK_PRIORITY_LABEL).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Trạng thái">
              <Select value={values.status} onChange={(e) => set('status', e.target.value)}>
                {toOptions(TASK_STATUS_LABEL).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Tiến độ (%)">
              <TextInput
                type="number"
                min={0}
                max={100}
                value={values.progress}
                onChange={(e) => set('progress', e.target.value)}
              />
            </Field>

            <Field label="Người/bộ phận phối hợp">
              <TextInput
                value={values.coordination}
                onChange={(e) => set('coordination', e.target.value)}
                maxLength={200}
              />
            </Field>

            <Field label="Chu kỳ lặp">
              <Select value={values.repeatRule} onChange={(e) => set('repeatRule', e.target.value)}>
                {toOptions(REPEAT_RULE_LABEL).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Kết thúc lặp (tùy chọn)">
              <TextInput
                type="date"
                value={values.repeatUntil}
                disabled={values.repeatRule === 'NONE'}
                onChange={(e) => set('repeatUntil', e.target.value)}
              />
            </Field>

            <Field
              label="Checklist con"
              full
              hint="Mỗi dòng một mục; thêm ! ở đầu nếu bắt buộc. Mục đã hoàn thành giữ nguyên trạng thái khi sửa."
            >
              <TextArea
                value={values.checklist}
                onChange={(e) => set('checklist', e.target.value)}
                rows={4}
              />
            </Field>

            <Field label="Trở ngại" full>
              <TextArea value={values.obstacle} onChange={(e) => set('obstacle', e.target.value)} />
            </Field>

            <Field label="Ghi chú/kết quả" full>
              <TextArea value={values.notes} onChange={(e) => set('notes', e.target.value)} />
            </Field>

            <CustomFieldInputs
              definitions={customDefs}
              values={customValues}
              onChange={setCustomValues}
            />
          </div>
        </form>
      )}
    </Modal>
  );
}
