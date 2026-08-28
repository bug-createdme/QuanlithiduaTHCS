'use client';

import { Building2, CalendarPlus, Lock, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useScope } from '@/hooks/useScope';
import { useToast } from '@/hooks/useToast';
import { fmtDate } from '@/lib/format';
import { api } from '@/services/api';
import type { Campus, SchoolYear } from '@/types';
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
  TableEmptyRow,
  TableWrap,
  TextInput,
} from '@/components/ui';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';

/** Quản lý cơ sở + vòng đời năm học — tương ứng renderAcademicYearPanel() bản gốc. */
export function AcademicPanel() {
  const scope = useScope();
  const { toast, toastError } = useToast();

  const campusesQuery = useApiQuery<Campus[]>('/academic/campuses');
  const yearsQuery = useApiQuery<SchoolYear[]>('/academic/years');

  const [busy, setBusy] = useState(false);
  const [campusOpen, setCampusOpen] = useState(false);
  const [campusId, setCampusId] = useState<string | null>(null);
  const [campusForm, setCampusForm] = useState({ name: '', code: '' });
  const [deletingCampus, setDeletingCampus] = useState<Campus | null>(null);

  const [yearOpen, setYearOpen] = useState(false);
  const [yearForm, setYearForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    copyClasses: true,
    copyCriteria: true,
    copyTemplates: true,
  });

  const [closingYear, setClosingYear] = useState<SchoolYear | null>(null);
  const [closeWarnings, setCloseWarnings] = useState<string[]>([]);
  const [closeReason, setCloseReason] = useState('');

  const reload = useCallback(async () => {
    await Promise.all([campusesQuery.refetch(), yearsQuery.refetch(), scope.reload()]);
  }, [campusesQuery, yearsQuery, scope]);

  const saveCampus = async () => {
    setBusy(true);
    try {
      const payload = { name: campusForm.name.trim(), code: campusForm.code.trim().toUpperCase() };
      if (campusId) await api.patch(`/academic/campuses/${campusId}`, payload);
      else await api.post('/academic/campuses', payload);
      toast(campusId ? 'Đã cập nhật cơ sở' : 'Đã thêm cơ sở');
      setCampusOpen(false);
      await reload();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const deleteCampus = async () => {
    if (!deletingCampus) return;
    setBusy(true);
    try {
      await api.delete(`/academic/campuses/${deletingCampus.id}`);
      toast('Đã xóa cơ sở chưa sử dụng');
      setDeletingCampus(null);
      await reload();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const openNewYear = () => {
    const current = scope.currentYear;
    const startYear = Number(/\d{4}/.exec(current?.name ?? '')?.[0] ?? new Date().getFullYear()) + 1;
    setYearForm({
      name: `${startYear}–${startYear + 1}`,
      startDate: `${startYear}-08-15`,
      endDate: `${startYear + 1}-05-31`,
      isCurrent: false,
      copyClasses: true,
      copyCriteria: true,
      copyTemplates: true,
    });
    setYearOpen(true);
  };

  const createYear = async () => {
    setBusy(true);
    try {
      await api.post('/academic/years', {
        ...yearForm,
        copyFromYearId: scope.yearId || undefined,
      });
      toast('Đã tạo năm học và 40 tuần');
      setYearOpen(false);
      await reload();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const setCurrent = async (year: SchoolYear) => {
    try {
      await api.post(`/academic/years/${year.id}/set-current`);
      toast(`Đã đặt ${year.name} làm năm học hiện hành`);
      await reload();
    } catch (err) {
      toastError(err);
    }
  };

  const startClose = async (year: SchoolYear) => {
    try {
      const check = await api.get<{ warnings: string[] }>(`/academic/years/${year.id}/close-check`);
      setCloseWarnings(check.warnings);
      setClosingYear(year);
      setCloseReason('');
    } catch (err) {
      toastError(err);
    }
  };

  const confirmClose = async () => {
    if (!closingYear) return;
    setBusy(true);
    try {
      await api.post(`/academic/years/${closingYear.id}/close`, {
        reason: closeReason.trim() || undefined,
      });
      toast(`Đã đóng năm học ${closingYear.name}`);
      setClosingYear(null);
      await reload();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  if (campusesQuery.loading || yearsQuery.loading) return <LoadingState />;

  return (
    <>
      <Card>
        <CardHead
          title="Quản lý cơ sở"
          meta={`${campusesQuery.data?.length ?? 0} cơ sở`}
          actions={
            <Button
              size="sm"
              variant="primary"
              icon={<Plus size={14} aria-hidden />}
              onClick={() => {
                setCampusId(null);
                setCampusForm({ name: '', code: '' });
                setCampusOpen(true);
              }}
            >
              Thêm cơ sở
            </Button>
          }
        />
        <CardBody className="pt-2">
          <Notice className="mb-2.5">
            Đổi tên hoặc mã cơ sở bất cứ lúc nào mà không mất liên kết dữ liệu. Chỉ xóa được cơ sở
            chưa có lớp hoặc dữ liệu nghiệp vụ.
          </Notice>
          <TableWrap className="max-h-[280px]">
            <thead>
              <tr>
                <th className="w-[50px]">TT</th>
                <th>Tên cơ sở</th>
                <th>Mã</th>
                <th>Số lớp</th>
                <th className="w-[120px]">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {(campusesQuery.data ?? []).length === 0 ? (
                <TableEmptyRow colSpan={5}>Chưa có cơ sở. Hãy chọn “Thêm cơ sở”.</TableEmptyRow>
              ) : (
                campusesQuery.data!.map((campus, index) => (
                  <tr key={campus.id}>
                    <td>{index + 1}</td>
                    <td className="wrap">
                      <strong>{campus.name}</strong>
                    </td>
                    <td>
                      <code className="text-[11px]">{campus.code}</code>
                    </td>
                    <td>{campus._count?.classes ?? 0}</td>
                    <td>
                      <div className="flex gap-2">
                        <LinkButton
                          onClick={() => {
                            setCampusId(campus.id);
                            setCampusForm({ name: campus.name, code: campus.code });
                            setCampusOpen(true);
                          }}
                        >
                          Sửa
                        </LinkButton>
                        <LinkButton tone="red" onClick={() => setDeletingCampus(campus)}>
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

      <Card className="mt-3">
        <CardHead
          title="Vòng đời năm học"
          meta={`${yearsQuery.data?.length ?? 0} năm`}
          actions={
            <Button
              size="sm"
              variant="primary"
              icon={<CalendarPlus size={14} aria-hidden />}
              onClick={openNewYear}
            >
              Tạo năm học mới
            </Button>
          }
        />
        <CardBody className="pt-2">
          <Notice className="mb-2.5">
            Năm đã đóng chuyển sang chỉ đọc. Mọi thao tác tạo và đóng năm đều được ghi nhật ký.
          </Notice>
          <TableWrap className="max-h-[320px]">
            <thead>
              <tr>
                <th>Năm học</th>
                <th>Thời gian</th>
                <th>Học kỳ/tuần/lớp</th>
                <th>Trạng thái</th>
                <th className="w-[190px]">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {(yearsQuery.data ?? []).length === 0 ? (
                <TableEmptyRow colSpan={5}>Chưa có năm học nào.</TableEmptyRow>
              ) : (
                yearsQuery.data!.map((year) => (
                  <tr key={year.id}>
                    <td>
                      <strong>{year.name}</strong>
                      {year.isCurrent ? (
                        <Badge tone="blue" className="ml-1.5">
                          hiện hành
                        </Badge>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap">
                      {fmtDate(year.startDate)} – {fmtDate(year.endDate)}
                    </td>
                    <td>
                      {year._count
                        ? `${year._count.semesters}/${year._count.weeks}/${year._count.classes}`
                        : '—'}
                    </td>
                    <td>
                      {year.status === 'ARCHIVED' || year.readOnly ? (
                        <Badge tone="yellow">Đã đóng • chỉ đọc</Badge>
                      ) : (
                        <Badge tone="green">Đang mở</Badge>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {!year.isCurrent ? (
                          <LinkButton onClick={() => void setCurrent(year)}>Đặt hiện hành</LinkButton>
                        ) : null}
                        {year.status !== 'ARCHIVED' ? (
                          <LinkButton tone="red" onClick={() => void startClose(year)}>
                            Đóng năm
                          </LinkButton>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>
        </CardBody>
      </Card>

      <div className="mt-3 grid grid-cols-2 gap-3 tablet:grid-cols-1">
        <Card>
          <CardHead title="Quy tắc tạo năm" />
          <CardBody>
            <ul className="m-0 list-disc space-y-1 pl-5 text-[12.5px]">
              <li>Tạo mới học kỳ và 40 tuần theo ngày bắt đầu.</li>
              <li>Chỉ sao chép lớp và bộ tiêu chí khi được chọn.</li>
              <li>Không sao chép điểm, xếp hạng, hoạt động, công việc đã phát sinh hay báo cáo cũ.</li>
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHead title="Quy tắc đóng năm" />
          <CardBody>
            <ul className="m-0 list-disc space-y-1 pl-5 text-[12.5px]">
              <li>Kiểm tra bảng điểm chưa khóa, việc chưa xong và báo cáo nháp.</li>
              <li>Tạo điểm khôi phục bảo vệ trước khi đóng.</li>
              <li>Sau khi đóng, bản ghi năm cũ chuyển sang chỉ đọc.</li>
            </ul>
          </CardBody>
        </Card>
      </div>

      <Modal
        open={campusOpen}
        title={campusId ? 'Sửa cơ sở' : 'Thêm cơ sở'}
        onClose={() => setCampusOpen(false)}
        footer={
          <>
            <Button onClick={() => setCampusOpen(false)}>Hủy</Button>
            <Button variant="primary" loading={busy} onClick={() => void saveCampus()}>
              Lưu
            </Button>
          </>
        }
      >
        <Field label="Tên cơ sở" required>
          <TextInput
            value={campusForm.name}
            onChange={(e) => setCampusForm({ ...campusForm, name: e.target.value })}
            placeholder="Ví dụ: Cơ sở 1"
            maxLength={120}
          />
        </Field>
        <div className="mt-3">
          <Field
            label="Mã cơ sở"
            required
            hint="Chỉ dùng chữ không dấu, số, gạch ngang hoặc gạch dưới. Mã phải duy nhất."
          >
            <TextInput
              value={campusForm.code}
              onChange={(e) => setCampusForm({ ...campusForm, code: e.target.value.toUpperCase() })}
              placeholder="Ví dụ: CS1"
              maxLength={30}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={yearOpen}
        title="Tạo năm học mới"
        onClose={() => setYearOpen(false)}
        wide
        footer={
          <>
            <Button onClick={() => setYearOpen(false)}>Hủy</Button>
            <Button variant="primary" loading={busy} onClick={() => void createYear()}>
              Tạo năm học
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Tên năm học" required full>
            <TextInput
              value={yearForm.name}
              onChange={(e) => setYearForm({ ...yearForm, name: e.target.value })}
            />
          </Field>
          <Field label="Ngày bắt đầu" required>
            <TextInput
              type="date"
              value={yearForm.startDate}
              onChange={(e) => setYearForm({ ...yearForm, startDate: e.target.value })}
            />
          </Field>
          <Field label="Ngày kết thúc" required>
            <TextInput
              type="date"
              value={yearForm.endDate}
              onChange={(e) => setYearForm({ ...yearForm, endDate: e.target.value })}
            />
          </Field>
        </div>

        <fieldset className="mt-3 rounded-control border border-line p-3">
          <legend className="px-1 text-[12px] font-semibold text-muted">
            Sao chép có chọn lọc từ {scope.currentYear?.name ?? 'năm hiện tại'}
          </legend>
          <div className="space-y-2">
            <Checkbox
              label="Danh sách lớp và giáo viên (tạo ID mới)"
              checked={yearForm.copyClasses}
              onChange={(e) => setYearForm({ ...yearForm, copyClasses: e.target.checked })}
            />
            <Checkbox
              label="Bộ tiêu chí và tiêu chí (chuyển về dự thảo)"
              checked={yearForm.copyCriteria}
              onChange={(e) => setYearForm({ ...yearForm, copyCriteria: e.target.checked })}
            />
            <Checkbox
              label="Mẫu công việc dùng chung"
              checked={yearForm.copyTemplates}
              onChange={(e) => setYearForm({ ...yearForm, copyTemplates: e.target.checked })}
            />
            <Checkbox
              label="Đặt làm năm học hiện hành"
              checked={yearForm.isCurrent}
              onChange={(e) => setYearForm({ ...yearForm, isCurrent: e.target.checked })}
            />
          </div>
        </fieldset>

        <Notice tone="warn" className="mt-3">
          Không sao chép điểm thi đua, xếp hạng, công việc phát sinh, hoạt động, hồ sơ giao dịch hoặc
          báo cáo năm cũ.
        </Notice>
      </Modal>

      <Modal
        open={closingYear !== null}
        title={`Đóng năm học ${closingYear?.name ?? ''}`}
        onClose={() => setClosingYear(null)}
        footer={
          <>
            <Button onClick={() => setClosingYear(null)} disabled={busy}>
              Hủy
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void confirmClose()}>
              <Lock size={14} aria-hidden />
              Đóng năm
            </Button>
          </>
        }
      >
        {closeWarnings.length > 0 ? (
          <Notice tone="warn" className="mb-3">
            <strong className="block">Còn tồn đọng trước khi đóng năm:</strong>
            <ul className="mt-1 list-disc pl-5">
              {closeWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
            Vẫn có thể đóng, nhưng nên xử lý trước để số liệu trọn vẹn.
          </Notice>
        ) : (
          <Notice className="mb-3">
            Không phát hiện tồn đọng. Hệ thống sẽ tạo điểm khôi phục bảo vệ trước khi đóng.
          </Notice>
        )}
        <Field label="Lý do/ghi chú (tùy chọn)">
          <TextInput
            value={closeReason}
            onChange={(e) => setCloseReason(e.target.value)}
            maxLength={500}
          />
        </Field>
      </Modal>

      <ConfirmDialog
        open={deletingCampus !== null}
        title="Xóa cơ sở"
        loading={busy}
        confirmLabel="Xóa cơ sở"
        description={
          <>
            <Notice tone="warn" className="mb-2">
              Chỉ xóa được cơ sở chưa phát sinh dữ liệu. Nếu đã có lớp hoặc bản ghi nghiệp vụ, hệ
              thống sẽ từ chối để bảo toàn dữ liệu lịch sử.
            </Notice>
            <p className="m-0 flex items-center gap-1.5">
              <Building2 size={15} aria-hidden />
              <strong>
                {deletingCampus?.name} ({deletingCampus?.code})
              </strong>
            </p>
          </>
        }
        onCancel={() => setDeletingCampus(null)}
        onConfirm={() => void deleteCampus()}
      />
    </>
  );
}
