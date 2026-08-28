'use client';

import { Download, LayoutGrid, List, Library, Plus, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useApiList, useDebounced } from '@/hooks/useApiQuery';
import { useScope } from '@/hooks/useScope';
import { useToast } from '@/hooks/useToast';
import { cx, fmtDate, todayISO } from '@/lib/format';
import { TASK_PRIORITY_LABEL, TASK_STATUS_LABEL, toOptions } from '@/lib/labels';
import { api } from '@/services/api';
import type { Task, TaskStatus, TaskTemplate } from '@/types';
import {
  Badge,
  Button,
  Checkbox,
  ErrorState,
  LinkButton,
  LoadingState,
  Notice,
  PageHead,
  Pagination,
  ProgressBar,
  Select,
  StatusBadge,
  TableEmptyRow,
  TableWrap,
  TextInput,
  Toolbar,
} from '@/components/ui';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { TaskForm } from './TaskForm';

const PAGE_SIZE = 50;

/** Bốn cột Kanban, đúng danh sách của renderTaskArea() bản gốc. */
const KANBAN_COLUMNS: Array<{ status: TaskStatus; label: string }> = [
  { status: 'TODO', label: 'Chưa làm' },
  { status: 'DOING', label: 'Đang làm' },
  { status: 'WAITING', label: 'Chờ phối hợp' },
  { status: 'DONE', label: 'Hoàn thành' },
];

function TasksPageInner() {
  const scope = useScope();
  const { toast, toastError } = useToast();
  const searchParams = useSearchParams();

  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const [filter, setFilter] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [applyingTemplates, setApplyingTemplates] = useState(false);

  const debouncedSearch = useDebounced(search, 160);

  // Bộ lọc nhanh và lệnh mở form đến từ các thẻ KPI của trang Tổng quan.
  useEffect(() => {
    const quickFilter = searchParams.get('filter');
    if (quickFilter) setFilter(quickFilter);
    if (searchParams.get('new') === '1') {
      setEditingId(null);
      setFormOpen(true);
    }
    const editId = searchParams.get('edit');
    if (editId) {
      setEditingId(editId);
      setFormOpen(true);
    }
  }, [searchParams]);

  const params = useMemo(
    () => ({
      ...scope.query,
      ...(debouncedSearch.trim() ? { q: debouncedSearch.trim() } : {}),
      ...(status !== 'all' ? { status } : {}),
      ...(priority !== 'all' ? { priority } : {}),
      ...(filter ? { filter } : {}),
      ...(view === 'kanban' ? { all: 'true' } : { page, pageSize: PAGE_SIZE }),
    }),
    [scope.query, debouncedSearch, status, priority, filter, view, page],
  );

  const { data, meta, loading, error, refetch } = useApiList<Task>(
    scope.ready && scope.yearId ? '/tasks' : null,
    params,
  );

  useEffect(() => setPage(1), [debouncedSearch, status, priority, filter, scope.yearId]);

  const openTemplates = useCallback(async () => {
    try {
      setTemplates(await api.get<TaskTemplate[]>('/tasks/templates'));
      setSelectedTemplates(new Set());
      setTemplatesOpen(true);
    } catch (err) {
      toastError(err);
    }
  }, [toastError]);

  const applyTemplates = useCallback(async () => {
    if (selectedTemplates.size === 0) {
      toast('Hãy chọn ít nhất một mẫu.', 'bad');
      return;
    }
    setApplyingTemplates(true);
    try {
      await api.post('/tasks/templates/apply', {
        schoolYearId: scope.yearId,
        semesterId: scope.semesterId === 'all' ? null : scope.semesterId,
        campusId: scope.campusId === 'all' ? null : scope.campusId,
        templateIds: [...selectedTemplates],
      });
      toast(`Đã thêm ${selectedTemplates.size} công việc`);
      setTemplatesOpen(false);
      void refetch();
    } catch (err) {
      toastError(err);
    } finally {
      setApplyingTemplates(false);
    }
  }, [selectedTemplates, scope, toast, toastError, refetch]);

  const cloneTask = useCallback(
    async (id: string) => {
      try {
        await api.post(`/tasks/${id}/clone`);
        toast('Đã nhân bản công việc');
        void refetch();
      } catch (err) {
        toastError(err);
      }
    },
    [toast, toastError, refetch],
  );

  const generateRecurring = useCallback(async () => {
    try {
      const result = await api.post<{ created: number }>('/tasks/generate-recurring', {
        schoolYearId: scope.yearId,
      });
      toast(
        result.created > 0
          ? `Đã sinh ${result.created} công việc lặp đến hạn`
          : 'Không có công việc lặp nào đến hạn.',
      );
      void refetch();
    } catch (err) {
      toastError(err);
    }
  }, [scope.yearId, toast, toastError, refetch]);

  const handleDelete = useCallback(async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await api.delete(`/tasks/${deleting.id}`);
      toast('Đã xóa công việc');
      setDeleting(null);
      void refetch();
    } catch (err) {
      toastError(err);
    } finally {
      setDeletingBusy(false);
    }
  }, [deleting, toast, toastError, refetch]);

  const today = todayISO();

  if (!scope.ready) return <LoadingState />;

  return (
    <>
      <PageHead
        title="Công việc và checklist"
        description="Theo dõi đầu việc, hạn, phụ thuộc và tiến độ thực hiện."
        actions={
          <>
            <Button icon={<RefreshCw size={15} aria-hidden />} onClick={() => void generateRecurring()}>
              Sinh việc lặp
            </Button>
            <Button icon={<Library size={15} aria-hidden />} onClick={() => void openTemplates()}>
              Thư viện mẫu
            </Button>
            <Button
              icon={<Download size={15} aria-hidden />}
              onClick={() => void api.download('/tasks/export', params, 'cong-viec.csv')}
            >
              Xuất CSV
            </Button>
            <Button
              variant="primary"
              icon={<Plus size={15} aria-hidden />}
              onClick={() => {
                setEditingId(null);
                setFormOpen(true);
              }}
            >
              Công việc
            </Button>
          </>
        }
      />

      {filter ? (
        <Notice className="mb-2.5">
          Đang lọc theo{' '}
          <strong>
            {filter === 'today' ? 'việc hôm nay' : filter === 'soon' ? 'sắp đến hạn 3 ngày' : 'việc quá hạn'}
          </strong>
          .{' '}
          <LinkButton onClick={() => setFilter(null)}>Bỏ bộ lọc</LinkButton>
        </Notice>
      ) : null}

      <Toolbar>
        <TextInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm công việc…"
          className="min-w-[180px] flex-1"
          aria-label="Tìm công việc"
        />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto" aria-label="Lọc trạng thái">
          <option value="all">Mọi trạng thái</option>
          {toOptions(TASK_STATUS_LABEL).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="w-auto"
          aria-label="Lọc mức ưu tiên"
        >
          <option value="all">Mọi mức ưu tiên</option>
          {toOptions(TASK_PRIORITY_LABEL).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <div className="ml-auto flex gap-1">
          <Button
            size="sm"
            icon={<List size={14} aria-hidden />}
            className={cx(view === 'list' && 'border-blue bg-blue-soft text-blue')}
            onClick={() => setView('list')}
          >
            Danh sách
          </Button>
          <Button
            size="sm"
            icon={<LayoutGrid size={14} aria-hidden />}
            className={cx(view === 'kanban' && 'border-blue bg-blue-soft text-blue')}
            onClick={() => setView('kanban')}
          >
            Kanban
          </Button>
        </div>
      </Toolbar>

      {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

      {loading && data.length === 0 && !error ? <LoadingState /> : null}

      {!error && !(loading && data.length === 0) && view === 'list' ? (
        <>
          <TableWrap>
            <thead>
              <tr>
                <th>Công việc</th>
                <th>Nhóm</th>
                <th>Cơ sở</th>
                <th>Hạn</th>
                <th>Ưu tiên</th>
                <th>Trạng thái</th>
                <th>Tiến độ</th>
                <th className="w-[170px]">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <TableEmptyRow colSpan={8}>Không có công việc phù hợp bộ lọc.</TableEmptyRow>
              ) : (
                data.map((task) => {
                  const overdue = task.status !== 'DONE' && task.dueDate.slice(0, 10) < today;
                  const requiredLeft =
                    task.checkItems?.filter((item) => item.required && !item.done).length ?? 0;
                  return (
                    <tr key={task.id}>
                      <td className="wrap">
                        <strong>{task.title}</strong>
                        {task.obstacle ? (
                          <span className="mt-0.5 block text-[11.5px] text-muted">
                            Trở ngại: {task.obstacle}
                          </span>
                        ) : null}
                        {requiredLeft > 0 ? (
                          <span className="mt-0.5 block text-[11.5px] text-[#8a6100]">
                            Còn {requiredLeft} mục checklist bắt buộc
                          </span>
                        ) : null}
                      </td>
                      <td>{task.groupName || '—'}</td>
                      <td>{scope.campusName(task.campusId)}</td>
                      <td className="whitespace-nowrap">
                        {overdue ? <Badge tone="red">Quá hạn</Badge> : null} {fmtDate(task.dueDate)}
                      </td>
                      <td>{TASK_PRIORITY_LABEL[task.priority]}</td>
                      <td>
                        <StatusBadge value={task.status} />
                      </td>
                      <td className="min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <ProgressBar value={task.progress} className="w-[70px]" />
                          <small>{task.progress}%</small>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2.5">
                          <LinkButton
                            onClick={() => {
                              setEditingId(task.id);
                              setFormOpen(true);
                            }}
                          >
                            Sửa
                          </LinkButton>
                          <LinkButton onClick={() => void cloneTask(task.id)}>Nhân bản</LinkButton>
                          <LinkButton tone="red" onClick={() => setDeleting(task)}>
                            Xóa
                          </LinkButton>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </TableWrap>

          {meta ? (
            <Pagination
              page={meta.page}
              pageCount={meta.pageCount}
              total={meta.total}
              pageSize={meta.pageSize}
              onChange={setPage}
            />
          ) : null}
        </>
      ) : null}

      {!error && !(loading && data.length === 0) && view === 'kanban' ? (
        <div className="grid grid-cols-4 gap-2.5 overflow-x-auto tablet:grid-flow-col tablet:auto-cols-[260px] tablet:grid-cols-none">
          {KANBAN_COLUMNS.map((column) => {
            const items = data.filter((task) => task.status === column.status);
            const shown = items.slice(0, 50);
            return (
              <div key={column.status} className="rounded-card border border-line bg-card p-2">
                <h3 className="m-0 mb-2 px-1 text-[12.5px] font-bold text-muted">
                  {column.label} • {items.length}
                </h3>
                <div className="space-y-2">
                  {shown.map((task) => (
                    <article
                      key={task.id}
                      className="rounded-control border border-line bg-white px-2.5 py-2"
                    >
                      <strong className="block text-[12.5px] leading-snug">{task.title}</strong>
                      <small className="mt-0.5 block text-[11px] text-muted">
                        Hạn {fmtDate(task.dueDate)} • {scope.campusName(task.campusId)}
                      </small>
                      <ProgressBar value={task.progress} className="mt-2" />
                      <LinkButton
                        className="mt-2"
                        onClick={() => {
                          setEditingId(task.id);
                          setFormOpen(true);
                        }}
                      >
                        Mở chi tiết
                      </LinkButton>
                    </article>
                  ))}
                  {items.length > 50 ? (
                    <small className="block px-1 text-[11px] text-muted">
                      Đang hiển thị 50 mục đầu. Dùng bộ lọc để thu hẹp.
                    </small>
                  ) : null}
                  {items.length === 0 ? (
                    <p className="px-1 py-3 text-center text-[12px] text-muted">Trống</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <TaskForm
        open={formOpen}
        taskId={editingId}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          void refetch();
        }}
      />

      <Modal
        open={templatesOpen}
        title="Thư viện công việc mẫu"
        onClose={() => setTemplatesOpen(false)}
        wide
        footer={
          <>
            <Button onClick={() => setTemplatesOpen(false)}>Đóng</Button>
            <Button variant="primary" loading={applyingTemplates} onClick={() => void applyTemplates()}>
              Thêm mục đã chọn
            </Button>
          </>
        }
      >
        <Notice className="mb-3">
          Các mẫu chỉ để tham khảo; thầy cô có thể chọn, sau đó sửa lại trước khi dùng.
        </Notice>
        <div className="grid grid-cols-2 gap-2 tablet:grid-cols-1">
          {templates.map((template) => (
            <Checkbox
              key={template.id}
              label={template.title}
              checked={selectedTemplates.has(template.id)}
              onChange={(e) =>
                setSelectedTemplates((current) => {
                  const next = new Set(current);
                  if (e.target.checked) next.add(template.id);
                  else next.delete(template.id);
                  return next;
                })
              }
            />
          ))}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Xác nhận xóa"
        loading={deletingBusy}
        confirmLabel="Xóa"
        description={
          <>
            <Notice tone="danger" className="mb-2">
              Bản ghi sẽ được xóa mềm và vẫn còn trong nhật ký.
            </Notice>
            <p className="m-0">
              <strong>{deleting?.title}</strong>
            </p>
          </>
        }
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TasksPageInner />
    </Suspense>
  );
}
