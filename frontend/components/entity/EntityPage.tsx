'use client';

import { Download, FilterX, Inbox, PanelRightOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useApiList, useDebounced } from '@/hooks/useApiQuery';
import { useScope } from '@/hooks/useScope';
import { useToast } from '@/hooks/useToast';
import { cx, fmtDate } from '@/lib/format';
import { statusLabel } from '@/lib/labels';
import { api } from '@/services/api';
import type { BaseRecord } from '@/types';
import {
  Button,
  ErrorState,
  LoadingState,
  Notice,
  PageHead,
  Pagination,
  ProgressBar,
  SearchInput,
  Select,
  StatusBadge,
  TableEmptyRow,
  TableSkeleton,
  TableWrap,
  Toolbar,
} from '@/components/ui';
import { Menu, MenuItem, MenuSeparator } from '@/components/ui/Menu';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { EntityForm } from './EntityForm';
import type { EntityConfig } from './entity.config';

type Row = BaseRecord & Record<string, unknown>;

/**
 * Ngăn chi tiết mở từ một dòng — dùng cho các bảng con treo dưới bản ghi
 * (chỉ tiêu của kế hoạch, sổ mượn–trả của thiết bị, buổi bồi dưỡng của
 * thành viên). Trang nào không khai báo thì bảng vẫn y như cũ.
 */
export interface RowDetail {
  /** Nhãn nút mở ngăn, ví dụ 'Chỉ tiêu'. */
  label: string;
  title: (row: Row) => string;
  render: (row: Row) => ReactNode;
}

const PAGE_SIZE = 50;

/**
 * Trang danh sách dùng chung cho 6 thực thể — tương ứng renderEntity() của bản gốc.
 * Khác biệt: tìm kiếm, lọc và phân trang chạy ở server thay vì duyệt mảng ở client.
 */
export function EntityPage({ config, rowDetail }: { config: EntityConfig; rowDetail?: RowDetail }) {
  const scope = useScope();
  const { toast, toastError } = useToast();
  const searchParams = useSearchParams();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [campusFilter, setCampusFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [detailRow, setDetailRow] = useState<Row | null>(null);

  const debouncedSearch = useDebounced(search, 200);
  const hasFilter = debouncedSearch.trim() !== '' || campusFilter !== 'all';

  const params = useMemo(
    () => ({
      ...scope.query,
      ...(campusFilter !== 'all' ? { campusId: campusFilter } : {}),
      ...(debouncedSearch.trim() ? { q: debouncedSearch.trim() } : {}),
      page,
      pageSize: PAGE_SIZE,
    }),
    [scope.query, campusFilter, debouncedSearch, page],
  );

  const { data, meta, loading, error, refetch } = useApiList<Row>(
    scope.ready && scope.yearId ? config.endpoint : null,
    params,
  );

  // Mở form ngay khi vào trang từ "Thêm nhanh" (?new=1).
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditingId(null);
      setFormOpen(true);
    }
  }, [searchParams]);

  // Đổi bộ lọc thì quay về trang đầu để tránh trang trống.
  useEffect(() => setPage(1), [debouncedSearch, campusFilter, scope.yearId]);

  const handleDelete = useCallback(async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await api.delete(`${config.endpoint}/${deleting.id}`);
      toast('Đã xóa bản ghi');
      setDeleting(null);
      void refetch();
    } catch (err) {
      toastError(err);
    } finally {
      setDeletingBusy(false);
    }
  }, [deleting, config.endpoint, toast, toastError, refetch]);

  const exportCsv = useCallback(async () => {
    try {
      await api.download(`${config.endpoint}/export`, params, `${config.key}.csv`);
      toast('Đã xuất tệp CSV');
    } catch (err) {
      toastError(err);
    }
  }, [config.endpoint, config.key, params, toast, toastError]);

  const openCreate = useCallback(() => {
    setEditingId(null);
    setFormOpen(true);
  }, []);

  const resetFilters = useCallback(() => {
    setSearch('');
    setCampusFilter('all');
  }, []);

  const renderCell = (row: Row, column: EntityConfig['columns'][number]) => {
    const value = row[column.key];
    if (column.render === 'status') return <StatusBadge value={value as string} />;
    if (column.render === 'date') return fmtDate(value as string);
    if (column.render === 'percent') {
      const percent = Number(value ?? 0);
      return (
        <span className="flex items-center gap-2">
          <ProgressBar value={percent} className="w-[64px]" label={`Tiến độ ${percent}%`} />
          <span className="tabular-nums text-xs text-neutral-500">{percent}%</span>
        </span>
      );
    }
    if (value === null || value === undefined || value === '') {
      return <span className="text-neutral-400">—</span>;
    }
    return String(value);
  };

  if (!scope.ready) return <LoadingState />;

  const columnCount = config.columns.length + 1;

  return (
    <>
      <PageHead
        title={config.title}
        description={config.description}
        actions={
          <>
            <Button icon={<Download size={15} aria-hidden />} onClick={() => void exportCsv()}>
              Xuất CSV
            </Button>
            <Button variant="primary" icon={<Plus size={15} aria-hidden />} onClick={openCreate}>
              Thêm mới
            </Button>
          </>
        }
      />

      <Toolbar>
        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder={`Tìm trong ${config.title.toLowerCase()}…`}
          className="min-w-[200px] flex-1"
          aria-label={`Tìm trong ${config.title}`}
        />
        <Select
          value={campusFilter}
          onChange={(e) => setCampusFilter(e.target.value)}
          className="w-auto"
          aria-label="Lọc theo cơ sở"
        >
          <option value="all">Tất cả cơ sở</option>
          {scope.campuses.map((campus) => (
            <option key={campus.id} value={campus.id}>
              {campus.name}
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

        <span className="ml-auto whitespace-nowrap text-xs text-neutral-500">
          <strong className="tabular-nums text-ink">{meta?.total ?? 0}</strong> bản ghi
        </span>
      </Toolbar>

      {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

      {loading && data.length === 0 && !error ? (
        <TableSkeleton cols={columnCount} />
      ) : !error ? (
        <>
          <TableWrap>
            <thead>
              <tr>
                {config.columns.map((column) => (
                  <th key={column.key} className={column.key === 'name' ? 'min-w-[220px]' : undefined}>
                    {column.label}
                  </th>
                ))}
                <th className="w-[112px] text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <TableEmptyRow
                  colSpan={columnCount}
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
                        onClick={openCreate}
                      >
                        Thêm mới
                      </Button>
                    )
                  }
                >
                  {hasFilter
                    ? 'Không có bản ghi nào khớp bộ lọc hiện tại.'
                    : `Chưa có ${config.title.toLowerCase()} nào trong phạm vi đang chọn.`}
                </TableEmptyRow>
              ) : (
                data.map((row) => (
                  <tr key={row.id}>
                    {config.columns.map((column) => (
                      <td
                        key={column.key}
                        className={cx(
                          column.key === 'name' && 'wrap',
                          column.key === config.labelField && 'font-semibold text-ink',
                        )}
                      >
                        {renderCell(row, column)}
                      </td>
                    ))}
                    <td className="actions text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Pencil size={14} aria-hidden />}
                          aria-label={`Sửa ${String(row[config.labelField] ?? 'bản ghi')}`}
                          onClick={() => {
                            setEditingId(row.id);
                            setFormOpen(true);
                          }}
                        >
                          Sửa
                        </Button>
                        <Menu label="Thao tác khác">
                          {(close) => (
                            <>
                              {rowDetail ? (
                                <>
                                  <MenuItem
                                    icon={<PanelRightOpen size={15} aria-hidden />}
                                    onClick={() => {
                                      close();
                                      setDetailRow(row);
                                    }}
                                  >
                                    {rowDetail.label}
                                  </MenuItem>
                                  <MenuSeparator />
                                </>
                              ) : null}
                              <MenuItem
                                danger
                                icon={<Trash2 size={15} aria-hidden />}
                                onClick={() => {
                                  close();
                                  setDeleting(row);
                                }}
                              >
                                Xóa bản ghi
                              </MenuItem>
                            </>
                          )}
                        </Menu>
                      </div>
                    </td>
                  </tr>
                ))
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

      <EntityForm
        config={config}
        open={formOpen}
        recordId={editingId}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          void refetch();
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Xác nhận xóa"
        loading={deletingBusy}
        confirmLabel="Xóa bản ghi"
        description={
          <>
            <p className="m-0">
              Xóa{' '}
              <strong className="text-ink">
                {String(deleting?.[config.labelField] ?? statusLabel(null)) || 'bản ghi đã chọn'}
              </strong>{' '}
              khỏi danh sách?
            </p>
            <Notice tone="warn" className="mt-2.5">
              Bản ghi được xóa mềm và vẫn còn trong nhật ký, nhưng không thể hoàn tác trực tiếp
              trên màn hình này.
            </Notice>
          </>
        }
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />

      {rowDetail && detailRow ? (
        <Modal
          open
          size="lg"
          icon={<Inbox size={18} aria-hidden />}
          title={rowDetail.title(detailRow)}
          onClose={() => setDetailRow(null)}
          footer={<Button onClick={() => setDetailRow(null)}>Đóng</Button>}
        >
          {rowDetail.render(detailRow)}
        </Modal>
      ) : null}
    </>
  );
}
