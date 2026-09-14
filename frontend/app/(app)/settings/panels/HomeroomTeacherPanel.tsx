'use client';

import { Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useScope } from '@/hooks/useScope';
import { useToast } from '@/hooks/useToast';
import { api } from '@/services/api';
import type { HomeroomTeacher, SchoolClass } from '@/types';
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
import { ConfirmDialog, Modal } from '@/components/ui/Modal';

/**
 * Danh bạ giáo viên chủ nhiệm theo năm học (bảng `homeroom_teachers`).
 *
 * Ô "Giáo viên chủ nhiệm" trong biểu mẫu lớp vẫn là văn bản tự do như bản gốc.
 * Danh bạ này là lớp chuẩn hóa đặt bên cạnh: khai báo giáo viên một lần kèm số
 * điện thoại và email, rồi gán cho lớp. Khi gán, hệ thống ghi luôn tên xuống ô
 * văn bản của lớp nên báo cáo cũ vẫn hiện đúng tên.
 */

const EMPTY = { fullName: '', phone: '', email: '', note: '' };

export function HomeroomTeacherPanel() {
  const scope = useScope();
  const { toast, toastError } = useToast();

  const teachersQuery = useApiQuery<HomeroomTeacher[]>(
    scope.yearId ? '/academic/homeroom-teachers' : null,
    { schoolYearId: scope.yearId },
  );
  const classesQuery = useApiQuery<SchoolClass[]>(scope.yearId ? '/academic/classes' : null, {
    schoolYearId: scope.yearId,
    includeInactive: 'true',
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HomeroomTeacher | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<HomeroomTeacher | null>(null);

  const reload = useCallback(() => {
    void teachersQuery.refetch();
    void classesQuery.refetch();
  }, [teachersQuery, classesQuery]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setForm(EMPTY);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((teacher: HomeroomTeacher) => {
    setEditing(teacher);
    setForm({
      fullName: teacher.fullName,
      phone: teacher.phone ?? '',
      email: teacher.email ?? '',
      note: teacher.note ?? '',
    });
    setFormOpen(true);
  }, []);

  const save = useCallback(async () => {
    setBusy(true);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        phone: form.phone,
        email: form.email,
        note: form.note,
      };
      if (editing) await api.patch(`/academic/homeroom-teachers/${editing.id}`, payload);
      else await api.post('/academic/homeroom-teachers', { ...payload, schoolYearId: scope.yearId });
      toast(editing ? 'Đã cập nhật giáo viên' : 'Đã thêm giáo viên vào danh bạ');
      setFormOpen(false);
      reload();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }, [editing, form, scope.yearId, toast, toastError, reload]);

  const remove = useCallback(async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/academic/homeroom-teachers/${deleting.id}`);
      toast('Đã xóa khỏi danh bạ');
      setDeleting(null);
      reload();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }, [deleting, toast, toastError, reload]);

  const assign = useCallback(
    async (classId: string, homeroomTeacherId: string) => {
      try {
        await api.post('/academic/homeroom-teachers/assign', {
          classId,
          homeroomTeacherId: homeroomTeacherId || null,
        });
        toast(homeroomTeacherId ? 'Đã gán giáo viên chủ nhiệm' : 'Đã gỡ giáo viên chủ nhiệm');
        reload();
      } catch (err) {
        toastError(err);
      }
    },
    [toast, toastError, reload],
  );

  if (teachersQuery.loading && !teachersQuery.data) return <LoadingState />;

  const teachers = teachersQuery.data ?? [];
  const classes = classesQuery.data ?? [];

  return (
    <>
      <Card>
        <CardHead
          title="Danh bạ giáo viên chủ nhiệm"
          meta={`${teachers.length} giáo viên`}
          actions={
            <Button
              size="sm"
              variant="primary"
              icon={<Plus size={14} aria-hidden />}
              onClick={openCreate}
            >
              Thêm giáo viên
            </Button>
          }
        />
        <CardBody>
          <Notice className="mb-3">
            Khai báo giáo viên một lần rồi gán cho lớp ở bảng bên dưới. Ô “Giáo viên chủ nhiệm” khi
            sửa từng lớp vẫn dùng được như cũ; gán từ đây sẽ ghi đè ô đó cho khớp.
          </Notice>

          <TableWrap>
            <thead>
              <tr>
                <th>Họ và tên</th>
                <th className="w-[130px]">Điện thoại</th>
                <th className="w-[200px]">Email</th>
                <th className="w-[170px]">Đang chủ nhiệm</th>
                <th className="w-[110px]">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {teachers.length === 0 ? (
                <TableEmptyRow colSpan={5}>
                  Chưa có giáo viên nào trong danh bạ. Hãy chọn “Thêm giáo viên”.
                </TableEmptyRow>
              ) : (
                teachers.map((teacher) => (
                  <tr key={teacher.id}>
                    <td className="wrap">
                      {teacher.fullName}
                      {teacher.note ? (
                        <div className="mt-0.5 text-[12px] text-muted">{teacher.note}</div>
                      ) : null}
                    </td>
                    <td>{teacher.phone ?? '—'}</td>
                    <td className="wrap">{teacher.email ?? '—'}</td>
                    <td>
                      {teacher.classes?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {teacher.classes.map((cls) => (
                            <Badge key={cls.id} tone="blue">
                              {cls.className}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted">Chưa gán lớp</span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-2.5">
                        <LinkButton onClick={() => openEdit(teacher)}>Sửa</LinkButton>
                        <LinkButton tone="red" onClick={() => setDeleting(teacher)}>
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
        <CardHead title="Gán giáo viên cho lớp" meta={`${classes.length} lớp`} />
        <CardBody>
          {teachers.length === 0 ? (
            <Notice tone="warn">
              Hãy thêm giáo viên vào danh bạ trước, sau đó mới gán được cho lớp.
            </Notice>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <th className="w-[130px]">Lớp</th>
                  <th className="w-[90px]">Khối</th>
                  <th>Giáo viên chủ nhiệm</th>
                </tr>
              </thead>
              <tbody>
                {classes.length === 0 ? (
                  <TableEmptyRow colSpan={3}>Chưa có lớp nào trong năm học.</TableEmptyRow>
                ) : (
                  classes.map((cls) => (
                    <tr key={cls.id}>
                      <td>{cls.className}</td>
                      <td>Khối {cls.grade}</td>
                      <td>
                        <Select
                          value={cls.homeroomTeacherId ?? ''}
                          onChange={(e) => void assign(cls.id, e.target.value)}
                          aria-label={`Giáo viên chủ nhiệm lớp ${cls.className}`}
                        >
                          <option value="">— Chưa gán —</option>
                          {teachers.map((teacher) => (
                            <option key={teacher.id} value={teacher.id}>
                              {teacher.fullName}
                            </option>
                          ))}
                        </Select>
                        {!cls.homeroomTeacherId && cls.teacher ? (
                          <div className="mt-1 text-[12px] text-muted">
                            Đang ghi bằng văn bản: {cls.teacher}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </TableWrap>
          )}
        </CardBody>
      </Card>

      <Modal
        open={formOpen}
        title={editing ? 'Sửa giáo viên' : 'Thêm giáo viên'}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <Button onClick={() => setFormOpen(false)} disabled={busy}>
              Hủy
            </Button>
            <Button variant="primary" loading={busy} onClick={() => void save()}>
              Lưu
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Họ và tên" required full>
            <TextInput
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              maxLength={120}
              required
            />
          </Field>
          <Field label="Điện thoại">
            <TextInput
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              maxLength={30}
            />
          </Field>
          <Field label="Email">
            <TextInput
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              maxLength={160}
            />
          </Field>
          <Field label="Ghi chú" full>
            <TextArea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Xóa khỏi danh bạ"
        loading={busy}
        confirmLabel="Xóa"
        description={
          <>
            <Notice tone="danger" className="mb-2">
              Chỉ xóa được giáo viên chưa gán lớp nào. Bản ghi vẫn còn trong nhật ký.
            </Notice>
            <p className="m-0">
              <strong>{deleting?.fullName}</strong>
            </p>
          </>
        }
        onCancel={() => setDeleting(null)}
        onConfirm={() => void remove()}
      />
    </>
  );
}
