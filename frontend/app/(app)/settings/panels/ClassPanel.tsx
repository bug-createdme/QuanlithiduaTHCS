'use client';

import { FileUp, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useConfirm } from '@/hooks/useConfirm';
import { useScope } from '@/hooks/useScope';
import { useToast } from '@/hooks/useToast';
import { api } from '@/services/api';
import type { SchoolClass } from '@/types';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHead,
  Checkbox,
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
import { ConfirmDialog, Modal } from '@/components/ui/Modal';

interface ImportRow {
  code?: string;
  className: string;
  grade: number;
  campusCode: string;
  teacher?: string;
}

/** Tách một dòng CSV/TSV, tôn trọng dấu nháy kép bao quanh giá trị. */
function parseDelimited(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      out.push(current);
      current = '';
    } else current += char;
  }
  out.push(current);
  return out.map((value) => value.trim());
}

export function ClassPanel() {
  const scope = useScope();
  const { toast, toastError } = useToast();
  const confirm = useConfirm();

  const { data, loading, refetch } = useApiQuery<SchoolClass[]>(
    scope.yearId ? '/academic/classes' : null,
    { schoolYearId: scope.yearId, includeInactive: 'true' },
  );

  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingClass, setDeletingClass] = useState<SchoolClass | null>(null);
  const [form, setForm] = useState({
    className: '',
    grade: '6',
    campusId: '',
    teacher: '',
    active: true,
  });

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [preview, setPreview] = useState<ImportRow[] | null>(null);
  const [importErrors, setImportErrors] = useState<Array<{ row: number; message: string }>>([]);

  const save = async () => {
    setBusy(true);
    try {
      const payload = {
        schoolYearId: scope.yearId,
        campusId: form.campusId || scope.campuses[0]?.id,
        className: form.className.trim(),
        grade: Number(form.grade),
        teacher: form.teacher || null,
        active: form.active,
      };
      if (editingId) await api.patch(`/academic/classes/${editingId}`, payload);
      else await api.post('/academic/classes', payload);
      toast('Đã lưu lớp');
      setFormOpen(false);
      void refetch();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const deleteClass = async () => {
    if (!deletingClass) return;
    setBusy(true);
    try {
      await api.delete(`/academic/classes/${deletingClass.id}`);
      toast(`Đã xóa lớp ${deletingClass.className}`);
      setDeletingClass(null);
      void refetch();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  /** Phân tích dữ liệu dán từ Excel: mã lớp, tên lớp, khối, mã cơ sở, GVCN. */
  const buildPreview = useCallback(() => {
    const text = importText.trim();
    if (!text) {
      toast('Hãy dán dữ liệu.', 'bad');
      return;
    }
    const delimiter = text.includes('\t') ? '\t' : ',';
    const rows = text
      .split(/\r?\n/)
      .map((line) => parseDelimited(line, delimiter))
      .filter((cells) => cells.length >= 4);

    if (rows[0] && /mã|ma_lop|code/i.test(rows[0][0] ?? '')) rows.shift();

    setPreview(
      rows.map((cells) => ({
        code: cells[0] || undefined,
        className: cells[1] ?? '',
        grade: Number(cells[2]),
        campusCode: cells[3] ?? '',
        teacher: cells[4] || undefined,
      })),
    );
    setImportErrors([]);
    toast(`Đã phân tích ${rows.length} lớp học từ dữ liệu dán. Sẵn sàng nhập.`, 'info');
  }, [importText, toast]);

  const commitImport = async (dryRun: boolean) => {
    if (!preview?.length) return;
    if (!dryRun) {
      const ok = await confirm({
        title: 'Nhập danh sách lớp',
        description: `Bạn có chắc muốn nhập ${preview.length} lớp học vào năm học hiện tại không?`,
        confirmLabel: 'Nhập lớp',
        tone: 'primary',
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const result = await api.post<{
        imported: number;
        errors: Array<{ row: number; message: string }>;
        valid?: number;
      }>('/academic/classes/import', {
        schoolYearId: scope.yearId,
        rows: preview,
        dryRun,
      });
      setImportErrors(result.errors);
      if (result.errors.length > 0) {
        toast(`Có ${result.errors.length} dòng lỗi. Chưa ghi dữ liệu.`, 'bad');
      } else if (dryRun) {
        toast(`${preview.length} dòng hợp lệ, sẵn sàng nhập.`);
      } else {
        toast(`Đã nhập ${result.imported} lớp`);
        setImportOpen(false);
        setImportText('');
        setPreview(null);
        void refetch();
      }
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <>
      <Card>
        <CardHead
          title="Danh sách lớp"
          meta={`${data?.length ?? 0} lớp`}
          actions={
            <div className="flex gap-2">
              <Button
                size="sm"
                icon={<FileUp size={14} aria-hidden />}
                onClick={() => setImportOpen(true)}
              >
                Nhập CSV/dán Excel
              </Button>
              <Button
                size="sm"
                variant="primary"
                icon={<Plus size={14} aria-hidden />}
                onClick={() => {
                  setEditingId(null);
                  setForm({
                    className: '',
                    grade: '6',
                    campusId: scope.campuses[0]?.id ?? '',
                    teacher: '',
                    active: true,
                  });
                  setFormOpen(true);
                }}
              >
                Lớp
              </Button>
            </div>
          }
        />
        <CardBody className="pt-2">
          <TableWrap className="max-h-[430px]">
            <thead>
              <tr>
                <th>Lớp</th>
                <th>Khối</th>
                <th>Cơ sở</th>
                <th>Giáo viên chủ nhiệm</th>
                <th>Trạng thái</th>
                <th className="w-[120px]">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).length === 0 ? (
                <TableEmptyRow colSpan={6}>Chưa có lớp nào trong năm học này.</TableEmptyRow>
              ) : (
                data!.map((cls) => (
                  <tr key={cls.id}>
                    <td>
                      <strong>{cls.className}</strong>
                    </td>
                    <td>{cls.grade}</td>
                    <td>{cls.campus?.name ?? scope.campusName(cls.campusId)}</td>
                    <td>{cls.teacher || '—'}</td>
                    <td>
                      {cls.active ? (
                        <Badge tone="green">Đang dùng</Badge>
                      ) : (
                        <Badge>Ngừng dùng</Badge>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <LinkButton
                          onClick={() => {
                            setEditingId(cls.id);
                            setForm({
                              className: cls.className,
                              grade: String(cls.grade),
                              campusId: cls.campusId,
                              teacher: cls.teacher ?? '',
                              active: cls.active,
                            });
                            setFormOpen(true);
                          }}
                        >
                          Sửa
                        </LinkButton>
                        <LinkButton tone="red" onClick={() => setDeletingClass(cls)}>
                          Xóa
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
        open={formOpen}
        title={editingId ? 'Sửa lớp' : 'Thêm lớp'}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Hủy</Button>
            <Button variant="primary" loading={busy} onClick={() => void save()}>
              Lưu lớp
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Tên lớp/chi đội" required>
            <TextInput
              value={form.className}
              onChange={(e) => setForm({ ...form, className: e.target.value })}
              maxLength={50}
            />
          </Field>
          <Field label="Khối" required>
            <Select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((grade) => (
                <option key={grade} value={grade}>
                  Khối {grade}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cơ sở" required>
            <Select
              value={form.campusId}
              onChange={(e) => setForm({ ...form, campusId: e.target.value })}
            >
              {scope.campuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Giáo viên chủ nhiệm">
            <TextInput
              value={form.teacher}
              onChange={(e) => setForm({ ...form, teacher: e.target.value })}
              maxLength={120}
            />
          </Field>
          <Checkbox
            label="Đang hoạt động"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
        </div>
      </Modal>

      <Modal
        open={importOpen}
        title="Nhập danh sách lớp"
        description="Dán dữ liệu từ bảng tính, xem trước rồi mới ghi vào hệ thống."
        onClose={() => setImportOpen(false)}
        size="lg"
        footer={
          <>
            <Button onClick={() => setImportOpen(false)}>Hủy</Button>
            <Button onClick={buildPreview}>Xem trước</Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={!preview?.length}
              onClick={() => void commitImport(false)}
            >
              Nhập dữ liệu
            </Button>
          </>
        }
      >
        <Notice className="mb-3">
          Dán dữ liệu từ Excel theo 5 cột: mã lớp, tên lớp, khối, mã cơ sở, giáo viên chủ nhiệm. Dòng
          tiêu đề có thể có hoặc không. Hệ thống chỉ ghi khi toàn bộ dòng đều hợp lệ.
        </Notice>

        <Field label="Dữ liệu CSV hoặc bảng dán">
          <TextArea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={8}
            placeholder={'6A1\t6/1\t6\tCS1\tNguyễn Văn A'}
          />
        </Field>

        {importErrors.length > 0 ? (
          <Notice tone="danger" className="mt-3">
            <strong className="block">Không thể nhập, có {importErrors.length} dòng lỗi:</strong>
            <ul className="mt-1 max-h-[160px] list-disc overflow-auto pl-5">
              {importErrors.map((error, index) => (
                <li key={index}>
                  Dòng {error.row}: {error.message}
                </li>
              ))}
            </ul>
          </Notice>
        ) : null}

        {preview?.length ? (
          <div className="mt-3">
            <p className="mb-1.5 text-sm text-muted">
              Xem trước {preview.length} dòng — kiểm tra trước khi ghi.
            </p>
            <TableWrap className="max-h-[240px]">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tên lớp</th>
                  <th>Khối</th>
                  <th>Mã cơ sở</th>
                  <th>GVCN</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, index) => (
                  <tr key={index}>
                    <td>{row.code ?? '—'}</td>
                    <td>{row.className}</td>
                    <td>{Number.isFinite(row.grade) ? row.grade : '⚠'}</td>
                    <td>{row.campusCode}</td>
                    <td>{row.teacher ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <Toolbar className="mt-2">
              <Button size="sm" loading={busy} onClick={() => void commitImport(true)}>
                Kiểm tra hợp lệ
              </Button>
            </Toolbar>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={deletingClass !== null}
        title="Xóa lớp học"
        loading={busy}
        confirmLabel="Xóa lớp"
        description={
          <>
            <Notice tone="warn" className="mb-2">
              Chỉ xóa được lớp chưa có dữ liệu điểm thi đua hoặc phân công. Nếu lớp đã có dữ liệu,
              hệ thống sẽ từ chối để bảo toàn lịch sử.
            </Notice>
            <p className="m-0">
              Bạn có chắc chắn muốn xóa lớp <strong>{deletingClass?.className}</strong>?
            </p>
          </>
        }
        onCancel={() => setDeletingClass(null)}
        onConfirm={() => void deleteClass()}
      />
    </>
  );
}
