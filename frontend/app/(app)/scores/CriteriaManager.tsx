'use client';

import { Copy, Download, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useConfirm } from '@/hooks/useConfirm';
import { useScope } from '@/hooks/useScope';
import { useToast } from '@/hooks/useToast';
import { toDateInput } from '@/lib/format';
import {
  CRITERIA_FORMULA_LABEL,
  CRITERIA_SET_STATUS_LABEL,
  CRITERION_DATA_TYPE_LABEL,
  toOptions,
} from '@/lib/labels';
import { api } from '@/services/api';
import type { CriteriaSet, Criterion } from '@/types';
import {
  Badge,
  Button,
  Field,
  LinkButton,
  LoadingState,
  Notice,
  Select,
  TableEmptyRow,
  TableWrap,
  TextArea,
  TextInput,
  Toolbar,
} from '@/components/ui';
import { Modal } from '@/components/ui/Modal';

interface SetFormState {
  name: string;
  version: string;
  semesterId: string;
  campusId: string;
  formula: string;
  baseScore: string;
  effectiveFrom: string;
  effectiveTo: string;
  status: string;
  basis: string;
}

interface CriterionFormState {
  code: string;
  groupName: string;
  name: string;
  description: string;
  dataType: string;
  points: string;
  minValue: string;
  maxValue: string;
  decimals: string;
  weight: string;
  sortOrder: string;
  color: string;
  evidenceRequired: boolean;
  active: boolean;
}

const emptyCriterion = (): CriterionFormState => ({
  code: '',
  groupName: '',
  name: '',
  description: '',
  dataType: 'SCORE',
  points: '0',
  minValue: '-20',
  maxValue: '20',
  decimals: '1',
  weight: '1',
  sortOrder: '99',
  color: '#0b6bcb',
  evidenceRequired: false,
  active: true,
});

/**
 * Trình quản lý bộ tiêu chí — tương ứng showCriteriaConfig() của bản gốc.
 * Bộ đã phát sinh điểm bị khóa cấu trúc; muốn đổi phải nhân bản phiên bản mới.
 */
export function CriteriaManager({
  open,
  onClose,
  onChanged,
  initialSetId,
}: {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
  initialSetId: string | null;
  criteria: Criterion[];
}) {
  const scope = useScope();
  const { toast, toastError } = useToast();
  const confirm = useConfirm();

  const [sets, setSets] = useState<CriteriaSet[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialSetId);
  const [detail, setDetail] = useState<CriteriaSet | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<SetFormState | null>(null);
  const [newSetOpen, setNewSetOpen] = useState(false);
  const [newSet, setNewSet] = useState({ name: '', version: '1.0', formula: 'BASE', baseScore: '100', status: 'DRAFT', basis: '' });

  const [criterionOpen, setCriterionOpen] = useState(false);
  const [criterionId, setCriterionId] = useState<string | null>(null);
  const [criterionForm, setCriterionForm] = useState<CriterionFormState>(emptyCriterion);

  const locked = detail?.locked === true;

  const loadSets = useCallback(async () => {
    if (!scope.yearId) return;
    const list = await api.get<CriteriaSet[]>('/criteria/sets', { schoolYearId: scope.yearId });
    setSets(list);
    setSelectedId((current) => current ?? list[0]?.id ?? null);
  }, [scope.yearId]);

  const loadDetail = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const row = await api.get<CriteriaSet>(`/criteria/sets/${id}`);
      setDetail(row);
      setForm({
        name: row.name,
        version: row.version,
        semesterId: row.semesterId ?? '',
        campusId: row.campusId ?? '',
        formula: row.formula,
        baseScore: String(Number(row.baseScore)),
        effectiveFrom: toDateInput(row.effectiveFrom),
        effectiveTo: toDateInput(row.effectiveTo),
        status: row.status,
        basis: row.basis ?? '',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadSets().catch(toastError);
  }, [open, loadSets, toastError]);

  useEffect(() => {
    if (!open || !selectedId) return;
    void loadDetail(selectedId).catch(toastError);
  }, [open, selectedId, loadDetail, toastError]);

  const saveSet = async () => {
    if (!detail || !form) return;
    setSaving(true);
    try {
      await api.patch(`/criteria/sets/${detail.id}`, {
        name: form.name,
        version: form.version,
        semesterId: form.semesterId || null,
        campusId: form.campusId || null,
        formula: form.formula,
        baseScore: Number(form.baseScore || 0),
        effectiveFrom: form.effectiveFrom || null,
        effectiveTo: form.effectiveTo || null,
        status: form.status,
        basis: form.basis || null,
      });
      toast('Đã lưu bộ tiêu chí');
      await loadSets();
      await loadDetail(detail.id);
      onChanged();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const createSet = async () => {
    if (!newSet.name.trim()) {
      toast('Hãy nhập tên bộ tiêu chí.', 'bad');
      return;
    }
    setSaving(true);
    try {
      const created = await api.post<CriteriaSet>('/criteria/sets', {
        schoolYearId: scope.yearId,
        semesterId: scope.semesterId === 'all' ? null : scope.semesterId,
        campusId: scope.campusId === 'all' ? null : scope.campusId,
        name: newSet.name.trim(),
        version: newSet.version,
        formula: newSet.formula,
        baseScore: Number(newSet.baseScore || 0),
        status: newSet.status,
        basis: newSet.basis || null,
      });
      toast('Đã tạo bộ tiêu chí');
      setNewSetOpen(false);
      setNewSet({ name: '', version: '1.0', formula: 'BASE', baseScore: '100', status: 'DRAFT', basis: '' });
      await loadSets();
      setSelectedId(created.id);
      onChanged();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const cloneSet = async () => {
    if (!detail) return;
    const ok = await confirm({
      title: 'Nhân bản bộ tiêu chí',
      description: `Bạn có chắc muốn nhân bản bộ tiêu chí "${detail.name}" (v${detail.version}) thành một phiên bản mới? Toàn bộ tiêu chí sẽ được sao chép sang bộ mới ở trạng thái dự thảo.`,
      confirmLabel: 'Nhân bản',
      tone: 'primary',
    });
    if (!ok) return;
    setSaving(true);
    try {
      const clone = await api.post<CriteriaSet>(`/criteria/sets/${detail.id}/clone`);
      toast('Đã tạo phiên bản mới; dữ liệu tuần cũ không thay đổi');
      await loadSets();
      setSelectedId(clone.id);
      onChanged();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const saveCriterion = async () => {
    if (!detail) return;
    setSaving(true);
    const payload = {
      code: criterionForm.code.trim(),
      groupName: criterionForm.groupName || null,
      name: criterionForm.name.trim(),
      description: criterionForm.description || null,
      dataType: criterionForm.dataType,
      points: Number(criterionForm.points || 0),
      minValue: criterionForm.minValue === '' ? null : Number(criterionForm.minValue),
      maxValue: criterionForm.maxValue === '' ? null : Number(criterionForm.maxValue),
      decimals: Number(criterionForm.decimals || 0),
      weight: Number(criterionForm.weight || 1),
      sortOrder: Number(criterionForm.sortOrder || 99),
      color: criterionForm.color,
      evidenceRequired: criterionForm.evidenceRequired,
      active: criterionForm.active,
    };
    try {
      if (criterionId) await api.patch(`/criteria/criteria/${criterionId}`, payload);
      else await api.post(`/criteria/sets/${detail.id}/criteria`, payload);
      toast('Đã lưu tiêu chí');
      setCriterionOpen(false);
      await loadDetail(detail.id);
      onChanged();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleCriterion = async (criterion: Criterion) => {
    try {
      await api.patch(`/criteria/criteria/${criterion.id}`, { active: !criterion.active });
      toast(criterion.active ? 'Đã ngừng sử dụng tiêu chí' : 'Đã kích hoạt tiêu chí');
      if (detail) await loadDetail(detail.id);
      onChanged();
    } catch (err) {
      toastError(err);
    }
  };

  const exportJson = async () => {
    if (!detail) return;
    try {
      await api.download(`/criteria/sets/${detail.id}/export`, undefined, 'bo-tieu-chi.json');
      toast('Đã xuất bộ tiêu chí ra tệp JSON');
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <>
      <Modal
        open={open}
        title="Quản lý bộ tiêu chí thi đua"
        onClose={onClose}
        wide
        footer={
          <>
            <Button onClick={onClose}>Đóng</Button>
            {detail ? (
              <Button variant="primary" loading={saving} onClick={() => void saveSet()}>
                Lưu bộ tiêu chí
              </Button>
            ) : null}
          </>
        }
      >
        <Notice tone="warn" className="mb-3">
          Bộ đã phát sinh điểm được khóa cấu trúc. Hãy nhân bản thành phiên bản mới để thay đổi nội
          dung quan trọng.
        </Notice>

        <Toolbar className="mb-3">
          <Select
            value={selectedId ?? ''}
            onChange={(e) => setSelectedId(e.target.value || null)}
            className="min-w-[200px] flex-1"
            aria-label="Chọn bộ tiêu chí"
          >
            <option value="">— Chọn bộ tiêu chí —</option>
            {sets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.name} • v{set.version} • {CRITERIA_SET_STATUS_LABEL[set.status]}
              </option>
            ))}
          </Select>
          <Button size="sm" icon={<Plus size={14} aria-hidden />} onClick={() => setNewSetOpen(true)}>
            Bộ mới
          </Button>
          <Button
            size="sm"
            icon={<Copy size={14} aria-hidden />}
            disabled={!detail}
            onClick={() => void cloneSet()}
          >
            Nhân bản phiên bản
          </Button>
          <Button
            size="sm"
            icon={<Download size={14} aria-hidden />}
            disabled={!detail}
            onClick={() => void exportJson()}
          >
            Xuất JSON
          </Button>
        </Toolbar>

        {loading ? <LoadingState /> : null}

        {!loading && detail && form ? (
          <>
            <div className="form-grid mb-4">
              <Field label="Tên bộ tiêu chí" required full>
                <TextInput
                  value={form.name}
                  readOnly={locked}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Phiên bản">
                <TextInput
                  value={form.version}
                  readOnly={locked}
                  onChange={(e) => setForm({ ...form, version: e.target.value })}
                />
              </Field>
              <Field label="Học kỳ">
                <Select
                  value={form.semesterId}
                  onChange={(e) => setForm({ ...form, semesterId: e.target.value })}
                >
                  <option value="">Mọi học kỳ</option>
                  {scope.semesters.map((semester) => (
                    <option key={semester.id} value={semester.id}>
                      {semester.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Cơ sở">
                <Select
                  value={form.campusId}
                  onChange={(e) => setForm({ ...form, campusId: e.target.value })}
                >
                  <option value="">Toàn trường</option>
                  {scope.campuses.map((campus) => (
                    <option key={campus.id} value={campus.id}>
                      {campus.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Cách tính">
                <Select
                  value={form.formula}
                  disabled={locked}
                  onChange={(e) => setForm({ ...form, formula: e.target.value })}
                >
                  {toOptions(CRITERIA_FORMULA_LABEL).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Điểm chuẩn">
                <TextInput
                  type="number"
                  step="0.01"
                  value={form.baseScore}
                  readOnly={locked}
                  onChange={(e) => setForm({ ...form, baseScore: e.target.value })}
                />
              </Field>
              <Field label="Hiệu lực từ">
                <TextInput
                  type="date"
                  value={form.effectiveFrom}
                  onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                />
              </Field>
              <Field label="Hiệu lực đến">
                <TextInput
                  type="date"
                  value={form.effectiveTo}
                  onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })}
                />
              </Field>
              <Field label="Trạng thái">
                <Select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {toOptions(CRITERIA_SET_STATUS_LABEL).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Căn cứ nội bộ" full>
                <TextArea
                  value={form.basis}
                  onChange={(e) => setForm({ ...form, basis: e.target.value })}
                />
              </Field>
            </div>

            <div className="mb-2 flex items-center justify-between">
              <h3 className="m-0 text-[14px] font-bold">Tiêu chí/thành phần</h3>
              <Button
                size="sm"
                variant="primary"
                icon={<Plus size={14} aria-hidden />}
                disabled={locked}
                onClick={() => {
                  setCriterionId(null);
                  setCriterionForm(emptyCriterion());
                  setCriterionOpen(true);
                }}
              >
                Tiêu chí
              </Button>
            </div>

            <TableWrap className="max-h-[340px]">
              <thead>
                <tr>
                  <th>TT</th>
                  <th>Mã</th>
                  <th>Nhóm</th>
                  <th>Tên</th>
                  <th>Kiểu</th>
                  <th>Cộng/trừ</th>
                  <th>Giới hạn</th>
                  <th>Trọng số</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(detail.criteria ?? []).length === 0 ? (
                  <TableEmptyRow colSpan={10}>Chưa có tiêu chí.</TableEmptyRow>
                ) : (
                  detail.criteria!.map((criterion, index) => (
                    <tr key={criterion.id}>
                      <td>{index + 1}</td>
                      <td>{criterion.code}</td>
                      <td>{criterion.groupName ?? '—'}</td>
                      <td className="wrap">{criterion.name}</td>
                      <td>{CRITERION_DATA_TYPE_LABEL[criterion.dataType]}</td>
                      <td>{Number(criterion.points) >= 0 ? 'Cộng' : 'Trừ'}</td>
                      <td className="whitespace-nowrap">
                        {criterion.minValue ?? '—'} → {criterion.maxValue ?? '—'}
                      </td>
                      <td>{Number(criterion.weight)}</td>
                      <td>
                        {criterion.active ? (
                          <Badge tone="green">Đang dùng</Badge>
                        ) : (
                          <Badge>Ngừng</Badge>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <LinkButton
                            disabled={locked}
                            onClick={() => {
                              setCriterionId(criterion.id);
                              setCriterionForm({
                                code: criterion.code,
                                groupName: criterion.groupName ?? '',
                                name: criterion.name,
                                description: criterion.description ?? '',
                                dataType: criterion.dataType,
                                points: String(Number(criterion.points)),
                                minValue: criterion.minValue ?? '',
                                maxValue: criterion.maxValue ?? '',
                                decimals: String(criterion.decimals),
                                weight: String(Number(criterion.weight)),
                                sortOrder: String(criterion.sortOrder),
                                color: criterion.color,
                                evidenceRequired: criterion.evidenceRequired,
                                active: criterion.active,
                              });
                              setCriterionOpen(true);
                            }}
                          >
                            Sửa
                          </LinkButton>
                          <LinkButton onClick={() => void toggleCriterion(criterion)}>
                            {criterion.active ? 'Ngừng' : 'Bật'}
                          </LinkButton>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </TableWrap>
          </>
        ) : null}

        {!loading && !detail ? (
          <Notice>Chưa có bộ tiêu chí. Hãy tạo bộ mới để bắt đầu.</Notice>
        ) : null}
      </Modal>

      <Modal
        open={newSetOpen}
        title="Tạo bộ tiêu chí"
        onClose={() => setNewSetOpen(false)}
        footer={
          <>
            <Button onClick={() => setNewSetOpen(false)}>Hủy</Button>
            <Button variant="primary" loading={saving} onClick={() => void createSet()}>
              Tạo bộ
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Tên bộ tiêu chí" required full>
            <TextInput value={newSet.name} onChange={(e) => setNewSet({ ...newSet, name: e.target.value })} />
          </Field>
          <Field label="Phiên bản">
            <TextInput
              value={newSet.version}
              onChange={(e) => setNewSet({ ...newSet, version: e.target.value })}
            />
          </Field>
          <Field label="Cách tính">
            <Select value={newSet.formula} onChange={(e) => setNewSet({ ...newSet, formula: e.target.value })}>
              {toOptions(CRITERIA_FORMULA_LABEL).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Điểm chuẩn">
            <TextInput
              type="number"
              value={newSet.baseScore}
              onChange={(e) => setNewSet({ ...newSet, baseScore: e.target.value })}
            />
          </Field>
          <Field label="Trạng thái">
            <Select value={newSet.status} onChange={(e) => setNewSet({ ...newSet, status: e.target.value })}>
              <option value="DRAFT">Dự thảo</option>
              <option value="ACTIVE">Đang áp dụng</option>
            </Select>
          </Field>
          <Field label="Căn cứ nội bộ" full>
            <TextArea value={newSet.basis} onChange={(e) => setNewSet({ ...newSet, basis: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={criterionOpen}
        title={criterionId ? 'Sửa tiêu chí' : 'Thêm tiêu chí'}
        onClose={() => setCriterionOpen(false)}
        wide
        footer={
          <>
            <Button onClick={() => setCriterionOpen(false)}>Hủy</Button>
            <Button variant="primary" loading={saving} onClick={() => void saveCriterion()}>
              Lưu tiêu chí
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Mã" required>
            <TextInput
              value={criterionForm.code}
              onChange={(e) => setCriterionForm({ ...criterionForm, code: e.target.value })}
              maxLength={20}
            />
          </Field>
          <Field label="Nhóm">
            <TextInput
              value={criterionForm.groupName}
              onChange={(e) => setCriterionForm({ ...criterionForm, groupName: e.target.value })}
            />
          </Field>
          <Field label="Tên hiển thị" required full>
            <TextInput
              value={criterionForm.name}
              onChange={(e) => setCriterionForm({ ...criterionForm, name: e.target.value })}
            />
          </Field>
          <Field label="Mô tả cách chấm" full>
            <TextArea
              value={criterionForm.description}
              onChange={(e) => setCriterionForm({ ...criterionForm, description: e.target.value })}
            />
          </Field>
          <Field label="Kiểu dữ liệu">
            <Select
              value={criterionForm.dataType}
              onChange={(e) => setCriterionForm({ ...criterionForm, dataType: e.target.value })}
            >
              {toOptions(CRITERION_DATA_TYPE_LABEL).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Điểm mỗi lần">
            <TextInput
              type="number"
              step="0.01"
              value={criterionForm.points}
              onChange={(e) => setCriterionForm({ ...criterionForm, points: e.target.value })}
            />
          </Field>
          <Field label="Tối thiểu">
            <TextInput
              type="number"
              step="0.01"
              value={criterionForm.minValue}
              onChange={(e) => setCriterionForm({ ...criterionForm, minValue: e.target.value })}
            />
          </Field>
          <Field label="Tối đa">
            <TextInput
              type="number"
              step="0.01"
              value={criterionForm.maxValue}
              onChange={(e) => setCriterionForm({ ...criterionForm, maxValue: e.target.value })}
            />
          </Field>
          <Field label="Số chữ số thập phân">
            <TextInput
              type="number"
              min={0}
              max={3}
              value={criterionForm.decimals}
              onChange={(e) => setCriterionForm({ ...criterionForm, decimals: e.target.value })}
            />
          </Field>
          <Field label="Trọng số">
            <TextInput
              type="number"
              step="0.01"
              min={0}
              value={criterionForm.weight}
              onChange={(e) => setCriterionForm({ ...criterionForm, weight: e.target.value })}
            />
          </Field>
          <Field label="Thứ tự">
            <TextInput
              type="number"
              value={criterionForm.sortOrder}
              onChange={(e) => setCriterionForm({ ...criterionForm, sortOrder: e.target.value })}
            />
          </Field>
          <Field label="Màu">
            <input
              type="color"
              value={criterionForm.color}
              onChange={(e) => setCriterionForm({ ...criterionForm, color: e.target.value })}
              className="h-[34px] w-full rounded-control border border-line bg-white px-1"
            />
          </Field>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              className="h-[15px] w-[15px] accent-[#0b6bcb]"
              checked={criterionForm.evidenceRequired}
              onChange={(e) =>
                setCriterionForm({ ...criterionForm, evidenceRequired: e.target.checked })
              }
            />
            Bắt buộc minh chứng
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              className="h-[15px] w-[15px] accent-[#0b6bcb]"
              checked={criterionForm.active}
              onChange={(e) => setCriterionForm({ ...criterionForm, active: e.target.checked })}
            />
            Đang sử dụng
          </label>
        </div>
      </Modal>
    </>
  );
}
