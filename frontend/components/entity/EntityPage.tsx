'use client';

import { Download, Plus } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useApiList, useDebounced } from '@/hooks/useApiQuery';
import { useScope } from '@/hooks/useScope';
import { useToast } from '@/hooks/useToast';
import { fmtDate } from '@/lib/format';
import { statusLabel } from '@/lib/labels';
import { api } from '@/services/api';
import type { BaseRecord } from '@/types';
import {
  Button,
  ErrorState,
  LinkButton,
  LoadingState,
  Notice,
  PageHead,
  Pagination,
  Select,
  StatusBadge,
  TableEmptyRow,
  TableWrap,
  TextInput,
  Toolbar,
} from '@/components/ui';
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

  const renderCell = (row: Row, column: EntityConfig['columns'][number]) => {
    const value = row[column.key];
    if (column.render === 'status') return <StatusBadge value={value as string} />;
    if (column.render === 'date') return fmtDate(value as string);
    if (column.render === 'percent') return `${Number(value ?? 0)}%`;
    if (value === null || value === undefined || value === '') return '—';
    return String(value);
  };

  if (!scope.ready) return <LoadingState />;

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
            <Button
              variant="primary"
              icon={<Plus size={15} aria-hidden />}
              onClick={() => {
                setEditingId(null);
                setFormOpen(true);
              }}
            >
              Thêm mới
            </Button>
          </>
        }
      />

      <Toolbar>
        <TextInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Tìm trong ${config.title.toLowerCase()}…`}
          className="min-w-[180px] flex-1"
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
        <span className="ml-auto text-[12px] text-muted">{meta?.total ?? 0} bản ghi</span>
      </Toolbar>

      {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

      {loading && data.length === 0 && !error ? (
        <LoadingState />
      ) : !error ? (
        <>
          <TableWrap>
            <thead>
              <tr>
                {config.columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
                <th className={rowDetail ? 'w-[210px]' : 'w-[130px]'}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <TableEmptyRow colSpan={config.columns.length + 1}>
                  Chưa có bản ghi. Hãy chọn “Thêm mới”.
                </TableEmptyRow>
              ) : (
                data.map((row) => (
                  <tr key={row.id}>
                    {config.columns.map((column) => (
                      <td key={column.key} className={column.key === 'name' ? 'wrap' : undefined}>
                        {renderCell(row, column)}
                      </td>
                    ))}
                    <td>
                      <div className="flex flex-wrap gap-2.5">
                        <LinkButton
                          onClick={() => {
                            setEditingId(row.id);
                            setFormOpen(true);
                          }}
                        >
                          Sửa
                        </LinkButton>
                        {rowDetail ? (
                          <LinkButton onClick={() => setDetailRow(row)}>{rowDetail.label}</LinkButton>
                        ) : null}
                        <LinkButton tone="red" onClick={() => setDeleting(row)}>
                          Xóa
                        </LinkButton>
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
        confirmLabel="Xóa"
        description={
          <>
            <Notice tone="danger" className="mb-2">
              Bản ghi sẽ được xóa mềm và vẫn còn trong nhật ký. Không thể hoàn tác trực tiếp trên màn
              hình này.
            </Notice>
            <p className="m-0">
              <strong>
                {String(deleting?.[config.labelField] ?? statusLabel(null)) || 'Bản ghi đã chọn'}
              </strong>
            </p>
          </>
        }
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />

      {rowDetail && detailRow ? (
        <Modal
          open
          wide
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
