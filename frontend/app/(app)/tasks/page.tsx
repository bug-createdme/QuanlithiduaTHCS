'use client';

import {
  Copy,
  Download,
  FilterX,
  LayoutGrid,
  Library,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useApiList, useDebounced } from '@/hooks/useApiQuery';
import { useScope } from '@/hooks/useScope';
import { useToast } from '@/hooks/useToast';
import { cx, fmtDate, todayISO } from '@/lib/format';
import { TASK_PRIORITY_LABEL, TASK_STATUS_LABEL, toOptions } from '@/lib/labels';
import { api } from '@/services/api';
import type { Task, TaskPriority, TaskStatus, TaskTemplate } from '@/types';
import {
  Badge,
  Button,
  Checkbox,
  ErrorState,
  LoadingState,
  Notice,
  PageHead,
  Pagination,
  ProgressBar,
  SearchInput,
  Segmented,
  Select,
  StatusBadge,
  TableEmptyRow,
  TableSkeleton,
  TableWrap,
  Toolbar,
} from '@/components/ui';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/Menu';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { TaskForm } from './TaskForm';

const PAGE_SIZE = 50;

/** Bốn cột Kanban, đúng danh sách của renderTaskArea() bản gốc. */
const KANBAN_COLUMNS: Array<{ status: TaskStatus; label: string; accent: string }> = [
  { status: 'TODO', label: 'Chưa làm', accent: 'bg-neutral-400' },
  { status: 'DOING', label: 'Đang làm', accent: 'bg-brand-500' },
  { status: 'WAITING', label: 'Chờ phối hợp', accent: 'bg-warning-500' },
  { status: 'DONE', label: 'Hoàn thành', accent: 'bg-success-500' },
];

const QUICK_FILTER_LABEL: Record<string, string> = {
  today: 'việc đến hạn hôm nay',
  soon: 'việc sắp đến hạn trong 3 ngày',
  overdue: 'việc quá hạn',
};

/** Mức ưu tiên hiển thị bằng chấm màu + chữ, không chỉ dựa vào màu sắc. */
const PRIORITY_DOT: Record<TaskPriority, string> = {
  LOW: 'bg-neutral-300',
  NORMAL: 'bg-brand-400',
  HIGH: 'bg-warning-500',
  URGENT: 'bg-danger-500',
};

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
  const hasFilter =
    debouncedSearch.trim() !== '' || status !== 'all' || priority !== 'all' || filter !== null;

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

  const exportCsv = useCallback(async () => {
    try {
      await api.download('/tasks/export', params, 'cong-viec.csv');
      toast('Đã xuất danh sách công việc ra CSV');
    } catch (err) {
      toastError(err);
    }
  }, [params, toast, toastError]);

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

  const openEdit = useCallback((id: string) => {
    setEditingId(id);
    setFormOpen(true);
  }, []);

  const resetFilters = useCallback(() => {
    setSearch('');
    setStatus('all');
    setPriority('all');
    setFilter(null);
  }, []);

  const today = todayISO();

  if (!scope.ready) return <LoadingState />;

  const showSkeleton = loading && data.length === 0 && !error;

  return (
    <>
      <PageHead
        title="Công việc và checklist"
        description="Theo dõi đầu việc, hạn hoàn thành, phụ thuộc và tiến độ thực hiện."
        actions={
          <>
            {/*
              Bản cũ xếp 4 nút ngang hàng ở đầu trang; ba trong số đó là thao
              tác hiếm dùng. Nay chỉ giữ hành động chính nổi bật, phần còn lại
              gom vào một menu để mắt không phải chọn giữa bốn nút ngang nhau.
            */}
            <Menu
              align="end"
              label="Thao tác khác với danh sách công việc"
              trigger={
                <span className="btn">
                  <MoreHorizontal size={15} aria-hidden />
                  Thao tác khác
                </span>
              }
            >
              {(close) => (
                <>
                  <MenuLabel>Tạo hàng loạt</MenuLabel>
                  <MenuItem
                    icon={<RefreshCw size={15} aria-hidden />}
                    onClick={() => {
                      close();
                      void generateRecurring();
                    }}
                  >
                    Sinh việc lặp đến hạn
                  </MenuItem>
                  <MenuItem
                    icon={<Library size={15} aria-hidden />}
                    onClick={() => {
                      close();
                      void openTemplates();
                    }}
                  >
                    Thư viện công việc mẫu
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem
                    icon={<Download size={15} aria-hidden />}
                    onClick={() => {
                      close();
                      void exportCsv();
                    }}
                  >
                    Xuất CSV theo bộ lọc
                  </MenuItem>
                </>
              )}
            </Menu>

            <Button
              variant="primary"
              icon={<Plus size={15} aria-hidden />}
              onClick={() => {
                setEditingId(null);
                setFormOpen(true);
              }}
            >
              Thêm công việc
            </Button>
          </>
        }
      />

      <Toolbar>
        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="Tìm theo tên công việc…"
          className="min-w-[200px] flex-1"
          aria-label="Tìm công việc"
        />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-auto"
          aria-label="Lọc theo trạng thái"
        >
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
          aria-label="Lọc theo mức ưu tiên"
        >
          <option value="all">Mọi mức ưu tiên</option>
          {toOptions(TASK_PRIORITY_LABEL).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        {hasFilter ? (
          <Button
            size="sm"
            variant="ghost"
            icon={<FilterX size={14} aria-hidden />}
            onClick={resetFilters}
          >
            Bỏ lọc
          </Button>
        ) : null}

        <Segmented
          className="ml-auto"
          ariaLabel="Kiểu hiển thị danh sách công việc"
          value={view}
          onChange={setView}
          items={[
            { id: 'list', label: 'Danh sách', icon: <List size={14} aria-hidden /> },
            { id: 'kanban', label: 'Kanban', icon: <LayoutGrid size={14} aria-hidden /> },
          ]}
        />
      </Toolbar>

      {filter ? (
        <Notice className="mb-3">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              Đang lọc theo <strong>{QUICK_FILTER_LABEL[filter] ?? filter}</strong>.
            </span>
            <button
              type="button"
              onClick={() => setFilter(null)}
              className="font-semibold underline underline-offset-2 hover:no-underline"
            >
              Bỏ bộ lọc
            </button>
          </span>
        </Notice>
      ) : null}

      {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

      {showSkeleton ? <TableSkeleton cols={7} /> : null}

      {/* ── Dạng bảng ────────────────────────────────────────────────── */}
      {!error && !showSkeleton && view === 'list' ? (
        <>
          <TableWrap>
            <thead>
              <tr>
                <th className="min-w-[240px]">Công việc</th>
                <th>Nhóm</th>
                <th>Cơ sở</th>
                <th>Hạn</th>
                <th>Ưu tiên</th>
                <th>Trạng thái</th>
                <th className="min-w-[130px]">Tiến độ</th>
                <th className="w-[112px] text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <TableEmptyRow
                  colSpan={8}
                  action={
                    hasFilter ? (
                      <Button size="sm" icon={<FilterX size={14} aria-hidden />} onClick={resetFilters}>
                        Bỏ bộ lọc
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="primary"
                        icon={<Plus size={14} aria-hidden />}
                        onClick={() => {
                          setEditingId(null);
                          setFormOpen(true);
                        }}
                      >
                        Thêm công việc
                      </Button>
                    )
                  }
                >
                  {hasFilter
                    ? 'Không có công việc nào khớp bộ lọc hiện tại.'
                    : 'Chưa có công việc nào trong phạm vi đang chọn.'}
                </TableEmptyRow>
              ) : (
                data.map((task) => {
                  const overdue = task.status !== 'DONE' && task.dueDate.slice(0, 10) < today;
                  const requiredLeft =
                    task.checkItems?.filter((item) => item.required && !item.done).length ?? 0;
                  return (
                    <tr key={task.id}>
                      <td className="wrap">
                        <strong className="text-ink">{task.title}</strong>
                        {task.obstacle ? (
                          <span className="mt-0.5 block text-xs text-neutral-500">
                            Trở ngại: {task.obstacle}
                          </span>
                        ) : null}
                        {requiredLeft > 0 ? (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-[1px] text-2xs font-semibold text-warning-700">
                            Còn {requiredLeft} mục checklist bắt buộc
                          </span>
                        ) : null}
                      </td>
                      <td>{task.groupName || <span className="text-neutral-400">—</span>}</td>
                      <td>{scope.campusName(task.campusId)}</td>
                      <td className="whitespace-nowrap">
                        {overdue ? (
                          <Badge tone="red" dot className="mr-1">
                            Quá hạn
                          </Badge>
                        ) : null}
                        <span className="tabular-nums">{fmtDate(task.dueDate)}</span>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <span
                            aria-hidden
                            className={cx('h-2 w-2 shrink-0 rounded-full', PRIORITY_DOT[task.priority])}
                          />
                          {TASK_PRIORITY_LABEL[task.priority]}
                        </span>
                      </td>
                      <td>
                        <StatusBadge value={task.status} />
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <ProgressBar
                            value={task.progress}
                            className="w-[72px]"
                            label={`Tiến độ ${task.progress}%`}
                          />
                          <span className="tabular-nums text-xs text-neutral-500">
                            {task.progress}%
                          </span>
                        </div>
                      </td>
                      <td className="actions text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<Pencil size={14} aria-hidden />}
                            aria-label={`Sửa công việc ${task.title}`}
                            onClick={() => openEdit(task.id)}
                          >
                            Sửa
                          </Button>
                          <Menu label="Thao tác khác">
                            {(close) => (
                              <>
                                <MenuItem
                                  icon={<Copy size={15} aria-hidden />}
                                  onClick={() => {
                                    close();
                                    void cloneTask(task.id);
                                  }}
                                >
                                  Nhân bản
                                </MenuItem>
                                <MenuSeparator />
                                <MenuItem
                                  danger
                                  icon={<Trash2 size={15} aria-hidden />}
                                  onClick={() => {
                                    close();
                                    setDeleting(task);
                                  }}
                                >
                                  Xóa công việc
                                </MenuItem>
                              </>
                            )}
                          </Menu>
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

      {/* ── Dạng Kanban ──────────────────────────────────────────────── */}
      {!error && !showSkeleton && view === 'kanban' ? (
        <div className="grid grid-cols-4 gap-3 lap:grid-flow-col lap:auto-cols-[minmax(260px,1fr)] lap:grid-cols-none lap:overflow-x-auto lap:pb-2">
          {KANBAN_COLUMNS.map((column) => {
            const items = data.filter((task) => task.status === column.status);
            const shown = items.slice(0, 50);
            return (
              <section
                key={column.status}
                className="flex min-w-0 flex-col rounded-lg border border-line bg-neutral-50 p-2"
              >
                <header className="mb-2 flex items-center gap-2 px-1.5 py-1">
                  <span aria-hidden className={cx('h-2 w-2 rounded-full', column.accent)} />
                  <h3 className="m-0 text-sm font-bold text-neutral-700">{column.label}</h3>
                  <span className="ml-auto rounded-full bg-white px-2 py-[1px] text-2xs font-bold tabular-nums text-neutral-500 shadow-xs">
                    {items.length}
                  </span>
                </header>

                <div className="space-y-2">
                  {shown.map((task) => {
                    const overdue = task.status !== 'DONE' && task.dueDate.slice(0, 10) < today;
                    return (
                      <article
                        key={task.id}
                        className="rounded-md border border-line bg-white p-2.5 shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-sm"
                      >
                        <button
                          type="button"
                          onClick={() => openEdit(task.id)}
                          className="block w-full text-left"
                        >
                          <strong className="block text-sm font-semibold leading-snug text-ink">
                            {task.title}
                          </strong>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-2xs text-neutral-500">
                            <span
                              aria-hidden
                              className={cx('h-1.5 w-1.5 rounded-full', PRIORITY_DOT[task.priority])}
                            />
                            {TASK_PRIORITY_LABEL[task.priority]}
                            <span aria-hidden>·</span>
                            {scope.campusName(task.campusId)}
                          </span>
                        </button>

                        <div className="mt-2 flex items-center gap-2">
                          <ProgressBar
                            value={task.progress}
                            className="flex-1"
                            label={`Tiến độ ${task.progress}%`}
                          />
                          <span className="shrink-0 tabular-nums text-2xs text-neutral-500">
                            {task.progress}%
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-2">
                          {overdue ? (
                            <Badge tone="red" dot>
                              Quá hạn
                            </Badge>
                          ) : (
                            <span className="text-2xs tabular-nums text-neutral-500">
                              Hạn {fmtDate(task.dueDate)}
                            </span>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<Pencil size={13} aria-hidden />}
                            aria-label={`Mở chi tiết ${task.title}`}
                            onClick={() => openEdit(task.id)}
                          >
                            Chi tiết
                          </Button>
                        </div>
                      </article>
                    );
                  })}

                  {items.length > 50 ? (
                    <p className="px-1 text-2xs text-neutral-500">
                      Đang hiển thị 50 mục đầu. Dùng bộ lọc để thu hẹp.
                    </p>
                  ) : null}
                  {items.length === 0 ? (
                    <p className="rounded-md border border-dashed border-neutral-300 px-1 py-6 text-center text-xs text-neutral-400">
                      Không có việc
                    </p>
                  ) : null}
                </div>
              </section>
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
        description="Chọn các đầu việc thường gặp để tạo nhanh, sau đó sửa lại cho phù hợp."
        icon={<Library size={18} aria-hidden />}
        onClose={() => setTemplatesOpen(false)}
        size="lg"
        footer={
          <>
            <span className="mr-auto text-xs text-neutral-500">
              Đã chọn <strong className="tabular-nums text-ink">{selectedTemplates.size}</strong> mẫu
            </span>
            <Button onClick={() => setTemplatesOpen(false)}>Đóng</Button>
            <Button
              variant="primary"
              loading={applyingTemplates}
              onClick={() => void applyTemplates()}
            >
              Thêm mục đã chọn
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-1 tablet:grid-cols-1">
          {templates.map((template) => (
            <Checkbox
              key={template.id}
              label={template.title}
              className="px-2 hover:bg-neutral-50"
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
        title="Xác nhận xóa công việc"
        loading={deletingBusy}
        confirmLabel="Xóa công việc"
        description={
          <>
            <p className="m-0">
              Xóa công việc <strong className="text-ink">{deleting?.title}</strong>?
            </p>
            <Notice tone="warn" className="mt-2.5">
              Bản ghi được xóa mềm và vẫn còn trong nhật ký.
            </Notice>
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
