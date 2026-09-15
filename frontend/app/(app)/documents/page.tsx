'use client';

import {
  Download,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  FolderPlus,
  File as FileIcon,
  HardDrive,
  LayoutGrid,
  List,
  Pin,
  PinOff,
  RotateCcw,
  Trash2,
  Upload,
  UploadCloud,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useApiQuery, useDebounced } from '@/hooks/useApiQuery';
import { useScope } from '@/hooks/useScope';
import { useToast } from '@/hooks/useToast';
import { cx, fmtDateTime, formatBytes } from '@/lib/format';
import { api } from '@/services/api';
import type { DocumentFolder, DocumentRecord } from '@/types';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHead,
  SearchInput,
  Segmented,
  Select,
  TableEmptyRow,
  TableSkeleton,
  TableWrap,
  TextInput,
  Toolbar,
} from '@/components/ui';
import { Menu, MenuItem, MenuSeparator } from '@/components/ui/Menu';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';

/** Chọn biểu tượng theo phần mở rộng, tương ứng fileIcon() của bản gốc. */
function iconFor(extension: string | null | undefined) {
  const ext = (extension ?? '').toLowerCase();
  if (ext === '.pdf') return FileText;
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) return FileImage;
  if (['.xls', '.xlsx', '.csv'].includes(ext)) return FileSpreadsheet;
  if (ext === '.zip') return FileArchive;
  if (['.doc', '.docx', '.txt', '.ppt', '.pptx'].includes(ext)) return FileText;
  return FileIcon;
}

/** Màu nền biểu tượng theo nhóm tệp — giúp quét nhanh loại tài liệu. */
function toneFor(extension: string | null | undefined): string {
  const ext = (extension ?? '').toLowerCase();
  if (ext === '.pdf') return 'bg-danger-50 text-danger-600';
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) return 'bg-brand-50 text-brand-600';
  if (['.xls', '.xlsx', '.csv'].includes(ext)) return 'bg-success-50 text-success-600';
  if (ext === '.zip') return 'bg-warning-50 text-warning-600';
  return 'bg-neutral-100 text-neutral-500';
}

function DocumentsPageInner() {
  const scope = useScope();
  const { toast, toastError } = useToast();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [folderId, setFolderId] = useState<string>('root');
  const [search, setSearch] = useState('');
  const [fileType, setFileType] = useState('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [deleting, setDeleting] = useState<DocumentRecord | null>(null);
  const [purging, setPurging] = useState<DocumentRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const debouncedSearch = useDebounced(search, 220);

  const foldersQuery = useApiQuery<DocumentFolder[]>(
    scope.ready && scope.yearId ? '/documents/folders' : null,
    { schoolYearId: scope.yearId },
  );

  const docsQuery = useApiQuery<{ documents: DocumentRecord[]; totalSize: number; count: number }>(
    scope.ready && scope.yearId ? '/documents' : null,
    {
      schoolYearId: scope.yearId,
      folderId,
      ...(debouncedSearch.trim() ? { q: debouncedSearch.trim() } : {}),
      fileType,
    },
  );

  useEffect(() => {
    if (searchParams.get('new') === '1') fileInputRef.current?.click();
  }, [searchParams]);

  const trash = folderId === 'trash';
  const documents = docsQuery.data?.documents ?? [];

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setUploading(true);
      try {
        const formData = new FormData();
        for (const file of files) formData.append('files', file);
        formData.append('schoolYearId', scope.yearId);
        if (scope.campusId !== 'all') formData.append('campusId', scope.campusId);
        if (folderId !== 'root' && folderId !== 'trash') formData.append('folderId', folderId);

        const created = await api.upload<DocumentRecord[]>('/documents/upload', formData);
        toast(`Đã tải lên ${created.length} tệp`);
        void docsQuery.refetch();
      } catch (err) {
        toastError(err);
      } finally {
        setUploading(false);
      }
    },
    [scope.yearId, scope.campusId, folderId, toast, toastError, docsQuery],
  );

  // Dán ảnh từ clipboard khi đang ở trang này — hành vi có ở bản gốc.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.items ?? [])
        .filter((item) => item.kind === 'file')
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);
      if (files.length) void uploadFiles(files);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [uploadFiles]);

  const downloadAttachment = async (attachmentId: string, fileName: string) => {
    try {
      await api.download(`/documents/attachments/${attachmentId}/download`, undefined, fileName);
      toast(`Đang tải tệp: ${fileName}`);
    } catch (err) {
      toastError(err);
    }
  };

  const createFolder = async () => {
    if (!folderName.trim()) {
      toast('Hãy nhập tên thư mục.', 'bad');
      return;
    }
    setBusy(true);
    try {
      await api.post('/documents/folders', {
        schoolYearId: scope.yearId,
        name: folderName.trim(),
        parentId: folderId !== 'root' && folderId !== 'trash' ? folderId : null,
      });
      toast('Đã tạo thư mục');
      setFolderOpen(false);
      setFolderName('');
      void foldersQuery.refetch();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const softDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/documents/${deleting.id}`);
      toast('Đã chuyển vào thùng rác');
      setDeleting(null);
      void docsQuery.refetch();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const restore = async (id: string) => {
    try {
      await api.post(`/documents/${id}/restore`);
      toast('Đã khôi phục tài liệu');
      void docsQuery.refetch();
    } catch (err) {
      toastError(err);
    }
  };

  const purge = async () => {
    if (!purging) return;
    setBusy(true);
    try {
      await api.delete(`/documents/${purging.id}/purge`);
      toast('Đã xóa vĩnh viễn');
      setPurging(null);
      void docsQuery.refetch();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const togglePin = async (doc: DocumentRecord) => {
    try {
      await api.post(`/documents/${doc.id}/pin`, { pinned: !doc.pinned });
      toast(doc.pinned ? 'Đã bỏ ghim tài liệu' : 'Đã ghim tài liệu lên đầu');
      void docsQuery.refetch();
    } catch (err) {
      toastError(err);
    }
  };

  if (!scope.ready) return <LoadingState />;

  /** Menu thao tác dùng chung cho cả dạng lưới và dạng danh sách. */
  const rowActions = (doc: DocumentRecord) => {
    const attachment = doc.attachments?.[0];
    return (
      <Menu label={`Thao tác với ${doc.name}`}>
        {(close) => (
          <>
            {trash ? (
              <>
                <MenuItem
                  icon={<RotateCcw size={15} aria-hidden />}
                  onClick={() => {
                    close();
                    void restore(doc.id);
                  }}
                >
                  Khôi phục
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  danger
                  icon={<Trash2 size={15} aria-hidden />}
                  onClick={() => {
                    close();
                    setPurging(doc);
                  }}
                >
                  Xóa vĩnh viễn
                </MenuItem>
              </>
            ) : (
              <>
                {attachment ? (
                  <MenuItem
                    icon={<Download size={15} aria-hidden />}
                    onClick={() => {
                      close();
                      void downloadAttachment(attachment.id, attachment.fileName);
                    }}
                  >
                    Tải tệp về máy
                  </MenuItem>
                ) : null}
                <MenuItem
                  icon={doc.pinned ? <PinOff size={15} aria-hidden /> : <Pin size={15} aria-hidden />}
                  onClick={() => {
                    close();
                    void togglePin(doc);
                  }}
                >
                  {doc.pinned ? 'Bỏ ghim' : 'Ghim lên đầu'}
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  danger
                  icon={<Trash2 size={15} aria-hidden />}
                  onClick={() => {
                    close();
                    setDeleting(doc);
                  }}
                >
                  Chuyển vào thùng rác
                </MenuItem>
              </>
            )}
          </>
        )}
      </Menu>
    );
  };

  return (
    <>
      <PageHead
        title="Hồ sơ – minh chứng"
        description="Kho tài liệu của Liên đội: lưu tệp thật trên máy chủ, có thư mục, phiên bản, tìm kiếm và thùng rác."
        actions={
          <>
            <Button icon={<FolderPlus size={15} aria-hidden />} onClick={() => setFolderOpen(true)}>
              Thư mục mới
            </Button>
            <Button
              variant="primary"
              icon={<Upload size={15} aria-hidden />}
              loading={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              Tải tệp lên
            </Button>
          </>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.webp,.zip"
        onChange={(e) => {
          void uploadFiles(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />

      <Toolbar>
        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="Tìm theo tên, số hiệu hoặc thẻ…"
          className="min-w-[200px] flex-1"
          aria-label="Tìm tài liệu"
        />
        <Select
          value={fileType}
          onChange={(e) => setFileType(e.target.value)}
          className="w-auto"
          aria-label="Lọc theo loại tệp"
        >
          <option value="all">Tất cả loại tệp</option>
          <option value="pdf">PDF</option>
          <option value="image">Hình ảnh</option>
          <option value="office">Word / Excel / PowerPoint</option>
        </Select>

        <span className="ml-auto whitespace-nowrap text-xs text-neutral-500">
          <strong className="tabular-nums text-ink">{docsQuery.data?.count ?? 0}</strong> tài liệu
        </span>

        <Segmented
          ariaLabel="Kiểu hiển thị tài liệu"
          value={view}
          onChange={setView}
          items={[
            { id: 'grid', label: 'Lưới', icon: <LayoutGrid size={14} aria-hidden /> },
            { id: 'list', label: 'Danh sách', icon: <List size={14} aria-hidden /> },
          ]}
        />
      </Toolbar>

      <div className="grid grid-cols-[240px_1fr] gap-4 tablet:grid-cols-1">
        {/* ── Cây thư mục ─────────────────────────────────────────────── */}
        <aside className="h-fit rounded-lg border border-line bg-card p-2 shadow-xs">
          <p className="px-2 pb-1.5 pt-1 text-2xs font-bold uppercase tracking-[0.06em] text-neutral-400">
            Thư mục
          </p>

          <button
            type="button"
            onClick={() => setFolderId('root')}
            className={cx(
              'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-base transition-colors',
              folderId === 'root'
                ? 'bg-brand-50 font-semibold text-brand-700'
                : 'text-neutral-700 hover:bg-neutral-100',
            )}
          >
            <FolderOpen size={15} className="shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">Tất cả tài liệu</span>
          </button>

          {(foldersQuery.data ?? []).map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => setFolderId(folder.id)}
              className={cx(
                'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-base transition-colors',
                folderId === folder.id
                  ? 'bg-brand-50 font-semibold text-brand-700'
                  : 'text-neutral-700 hover:bg-neutral-100',
              )}
            >
              <FolderOpen size={15} className="shrink-0 opacity-70" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{folder.name}</span>
              {folder._count ? (
                <span className="shrink-0 tabular-nums text-2xs text-neutral-400">
                  {folder._count.documents}
                </span>
              ) : null}
            </button>
          ))}

          <div className="my-1.5 h-px bg-line" />

          <button
            type="button"
            onClick={() => setFolderId('trash')}
            className={cx(
              'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-base transition-colors',
              trash
                ? 'bg-danger-50 font-semibold text-danger-700'
                : 'text-neutral-700 hover:bg-neutral-100',
            )}
          >
            <Trash2 size={15} className="shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">Thùng rác</span>
          </button>

          <div className="mt-2 rounded-md border border-line bg-neutral-25 p-2.5">
            <p className="m-0 flex items-center gap-1.5 text-2xs font-semibold text-neutral-500">
              <HardDrive size={13} aria-hidden />
              Dung lượng tệp đã dùng
            </p>
            <p className="m-0 mt-1 text-lg font-bold tabular-nums text-ink">
              {formatBytes(docsQuery.data?.totalSize ?? 0)}
            </p>
            <p className="m-0 mt-1 text-2xs leading-snug text-neutral-500">
              Tệp lưu trên máy chủ, không phụ thuộc trình duyệt.
            </p>
          </div>
        </aside>

        {/* ── Danh sách tài liệu ──────────────────────────────────────── */}
        <section className="min-w-0">
          {!trash ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void uploadFiles(Array.from(e.dataTransfer.files));
              }}
              className={cx(
                'mb-3 flex items-center justify-center gap-2.5 rounded-lg border-2 border-dashed px-4 py-5 text-center text-base transition-colors',
                dragging
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-neutral-300 bg-neutral-25 text-neutral-500',
              )}
            >
              <UploadCloud size={20} className="shrink-0" aria-hidden />
              <span>
                Kéo thả nhiều tệp vào đây, dán ảnh từ clipboard, hoặc{' '}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
                >
                  chọn tệp từ máy
                </button>
              </span>
            </div>
          ) : null}

          {docsQuery.error ? (
            <ErrorState error={docsQuery.error} onRetry={() => void docsQuery.refetch()} />
          ) : docsQuery.loading && documents.length === 0 ? (
            <TableSkeleton cols={5} rows={5} />
          ) : documents.length === 0 ? (
            <EmptyState
              icon={<FolderOpen size={22} aria-hidden />}
              title={trash ? 'Thùng rác trống' : 'Chưa có tài liệu phù hợp'}
              hint={
                trash
                  ? 'Tài liệu bị xóa mềm sẽ xuất hiện tại đây và có thể khôi phục.'
                  : 'Tải tệp lên hoặc đổi bộ lọc để xem tài liệu khác.'
              }
              action={
                trash ? undefined : (
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<Upload size={14} aria-hidden />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Tải tệp lên
                  </Button>
                )
              }
            />
          ) : view === 'grid' ? (
            // Mobile-first: 1 → 2 (≥521px) → 3 (≥851px) → 4 cột (≥1181px).
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {documents.map((doc) => {
                const attachment = doc.attachments?.[0];
                const Icon = iconFor(attachment?.extension);
                return (
                  <article
                    key={doc.id}
                    className="flex flex-col rounded-lg border border-line bg-card p-3 shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={cx(
                          'grid h-10 w-10 shrink-0 place-items-center rounded-md',
                          toneFor(attachment?.extension),
                        )}
                        aria-hidden
                      >
                        <Icon size={20} />
                      </span>
                      {rowActions(doc)}
                    </div>

                    <strong
                      className="mt-2.5 line-clamp-2 text-sm font-semibold leading-snug text-ink"
                      title={doc.name}
                    >
                      {doc.name}
                    </strong>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge>{(attachment?.extension ?? doc.type).toUpperCase()}</Badge>
                      <span className="text-2xs tabular-nums text-neutral-500">
                        {formatBytes(attachment?.size ?? 0)}
                      </span>
                      {doc.pinned ? (
                        <Badge tone="yellow" icon={<Pin size={10} aria-hidden />}>
                          Ghim
                        </Badge>
                      ) : null}
                    </div>

                    {attachment && !trash ? (
                      <Button
                        size="sm"
                        className="mt-2.5"
                        block
                        icon={<Download size={13} aria-hidden />}
                        onClick={() => void downloadAttachment(attachment.id, attachment.fileName)}
                      >
                        Tải về
                      </Button>
                    ) : null}
                    {trash ? (
                      <Button
                        size="sm"
                        className="mt-2.5"
                        block
                        icon={<RotateCcw size={13} aria-hidden />}
                        onClick={() => void restore(doc.id)}
                      >
                        Khôi phục
                      </Button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <th className="min-w-[240px]">Tên tài liệu</th>
                  <th>Loại</th>
                  <th className="num">Dung lượng</th>
                  <th>Cập nhật</th>
                  <th className="w-[64px] text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {documents.length === 0 ? (
                  <TableEmptyRow colSpan={5}>Chưa có tài liệu phù hợp.</TableEmptyRow>
                ) : (
                  documents.map((doc) => {
                    const attachment = doc.attachments?.[0];
                    const Icon = iconFor(attachment?.extension);
                    return (
                      <tr key={doc.id}>
                        <td className="wrap">
                          <span className="flex items-start gap-2.5">
                            <span
                              className={cx(
                                'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-sm',
                                toneFor(attachment?.extension),
                              )}
                              aria-hidden
                            >
                              <Icon size={14} />
                            </span>
                            <span className="min-w-0">
                              <strong className="text-ink">{doc.name}</strong>
                              {doc.pinned ? (
                                <Badge tone="yellow" className="ml-1.5 align-middle">
                                  Ghim
                                </Badge>
                              ) : null}
                              {doc.tags ? (
                                <span className="mt-0.5 block text-2xs text-neutral-500">
                                  {doc.tags}
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </td>
                        <td>{attachment?.extension ?? doc.type}</td>
                        <td className="num">{formatBytes(attachment?.size ?? 0)}</td>
                        <td className="whitespace-nowrap tabular-nums">
                          {fmtDateTime(doc.updatedAt)}
                        </td>
                        <td className="actions text-right">
                          <div className="flex justify-end">{rowActions(doc)}</div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </TableWrap>
          )}
        </section>
      </div>

      <Modal
        open={folderOpen}
        title="Tạo thư mục"
        description="Thư mục mới nằm trong thư mục đang mở, giúp gom hồ sơ theo chủ đề."
        icon={<FolderPlus size={18} aria-hidden />}
        onClose={() => setFolderOpen(false)}
        footer={
          <>
            <Button onClick={() => setFolderOpen(false)} disabled={busy}>
              Hủy
            </Button>
            <Button variant="primary" loading={busy} onClick={() => void createFolder()}>
              Tạo thư mục
            </Button>
          </>
        }
      >
        <Field label="Tên thư mục" required hint="Ví dụ: Minh chứng thi đua học kỳ I">
          <TextInput
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            maxLength={150}
          />
        </Field>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Chuyển vào thùng rác"
        loading={busy}
        tone="warn"
        confirmLabel="Chuyển vào thùng rác"
        description={
          <>
            <p className="m-0">
              Chuyển <strong className="text-ink">{deleting?.name}</strong> vào thùng rác?
            </p>
            <p className="m-0 mt-2 text-neutral-500">
              Tài liệu vẫn nằm trong thùng rác và có thể khôi phục bất cứ lúc nào.
            </p>
          </>
        }
        onCancel={() => setDeleting(null)}
        onConfirm={() => void softDelete()}
      />

      <ConfirmDialog
        open={purging !== null}
        title="Xóa vĩnh viễn tài liệu"
        loading={busy}
        confirmLabel="Xóa vĩnh viễn"
        description={
          <>
            <p className="m-0">
              Xóa vĩnh viễn <strong className="text-ink">{purging?.name}</strong>?
            </p>
            <p className="m-0 mt-2 font-semibold text-danger-700">
              Tệp trên máy chủ sẽ bị xóa thật và không thể khôi phục.
            </p>
          </>
        }
        onCancel={() => setPurging(null)}
        onConfirm={() => void purge()}
      />
    </>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DocumentsPageInner />
    </Suspense>
  );
}
