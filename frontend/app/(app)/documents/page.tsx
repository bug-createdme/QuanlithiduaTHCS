'use client';

import {
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderPlus,
  File as FileIcon,
  LayoutGrid,
  List,
  Trash2,
  Upload,
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
  Button,
  ErrorState,
  Field,
  LinkButton,
  LoadingState,
  Notice,
  PageHead,
  Select,
  TableEmptyRow,
  TableWrap,
  TextInput,
  Toolbar,
} from '@/components/ui';
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

  return (
    <>
      <PageHead
        title="Hồ sơ – minh chứng"
        description="Kho tài liệu: lưu tệp thật, thư mục, phiên bản, tìm kiếm và thùng rác."
        actions={
          <>
            <Button icon={<FolderPlus size={15} aria-hidden />} onClick={() => setFolderOpen(true)}>
              Thư mục
            </Button>
            <Button
              variant="primary"
              icon={<Upload size={15} aria-hidden />}
              loading={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              Tải tệp
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
        <TextInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm tên, số hiệu, thẻ…"
          className="min-w-[180px] flex-1"
          aria-label="Tìm tài liệu"
        />
        <Select
          value={fileType}
          onChange={(e) => setFileType(e.target.value)}
          className="w-auto"
          aria-label="Lọc loại tệp"
        >
          <option value="all">Tất cả loại tệp</option>
          <option value="pdf">PDF</option>
          <option value="image">Hình ảnh</option>
          <option value="office">Word/Excel/PowerPoint</option>
        </Select>
        <Button
          size="sm"
          icon={view === 'grid' ? <List size={14} aria-hidden /> : <LayoutGrid size={14} aria-hidden />}
          onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
        >
          {view === 'grid' ? 'Danh sách' : 'Dạng lưới'}
        </Button>
        <span className="ml-auto text-[12px] text-muted">{docsQuery.data?.count ?? 0} tài liệu</span>
      </Toolbar>

      <div className="grid grid-cols-[220px_1fr] gap-3 tablet:grid-cols-1">
        <aside className="rounded-card border border-line bg-card p-2">
          <strong className="block px-1 pb-1.5 text-[12px] text-muted">Thư mục</strong>
          <button
            type="button"
            onClick={() => setFolderId('root')}
            className={cx(
              'block w-full truncate rounded-control px-2 py-1.5 text-left text-[13px]',
              folderId === 'root' ? 'bg-blue-soft font-semibold text-blue' : 'hover:bg-canvas',
            )}
          >
            Tất cả tài liệu
          </button>
          {(foldersQuery.data ?? []).map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => setFolderId(folder.id)}
              className={cx(
                'block w-full truncate rounded-control px-2 py-1.5 text-left text-[13px]',
                folderId === folder.id ? 'bg-blue-soft font-semibold text-blue' : 'hover:bg-canvas',
              )}
            >
              ▸ {folder.name}
              {folder._count ? (
                <span className="ml-1 text-[11px] text-muted">({folder._count.documents})</span>
              ) : null}
            </button>
          ))}
          <hr className="my-1.5 border-0 border-t border-line" />
          <button
            type="button"
            onClick={() => setFolderId('trash')}
            className={cx(
              'flex w-full items-center gap-1.5 rounded-control px-2 py-1.5 text-left text-[13px]',
              trash ? 'bg-red-soft font-semibold text-red' : 'hover:bg-canvas',
            )}
          >
            <Trash2 size={14} aria-hidden />
            Thùng rác
          </button>

          <hr className="my-1.5 border-0 border-t border-line" />
          <div className="px-1">
            <small className="block text-[11px] text-muted">Dung lượng tệp đã dùng</small>
            <strong className="text-[13px]">{formatBytes(docsQuery.data?.totalSize ?? 0)}</strong>
            <p className="mt-1 text-[11px] text-muted">
              Tệp lưu trên máy chủ, không phụ thuộc trình duyệt.
            </p>
          </div>
        </aside>

        <section>
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
                'mb-2.5 grid place-items-center rounded-card border-2 border-dashed px-4 py-6 text-center text-[13px] transition-colors',
                dragging ? 'border-blue bg-blue-soft text-blue' : 'border-line bg-card text-muted',
              )}
            >
              Kéo thả nhiều tệp vào đây hoặc dán ảnh từ clipboard
            </div>
          ) : null}

          {docsQuery.error ? (
            <ErrorState error={docsQuery.error} onRetry={() => void docsQuery.refetch()} />
          ) : docsQuery.loading && documents.length === 0 ? (
            <LoadingState />
          ) : documents.length === 0 ? (
            <Notice>Chưa có tài liệu phù hợp.</Notice>
          ) : view === 'grid' ? (
            // Mobile-first: 1 → 2 (≥521px) → 3 (≥851px) → 4 cột (≥1181px).
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {documents.map((doc) => {
                const attachment = doc.attachments?.[0];
                const Icon = iconFor(attachment?.extension);
                return (
                  <article
                    key={doc.id}
                    className="flex flex-col rounded-card border border-line bg-card p-2.5 shadow-card"
                  >
                    <Icon size={26} className="mb-1.5 text-blue" aria-hidden />
                    <strong className="line-clamp-2 text-[12.5px] leading-snug" title={doc.name}>
                      {doc.pinned ? '★ ' : ''}
                      {doc.name}
                    </strong>
                    <small className="mt-0.5 text-[11px] text-muted">
                      {(attachment?.extension ?? doc.type).toUpperCase()} •{' '}
                      {formatBytes(attachment?.size ?? 0)}
                    </small>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {trash ? (
                        <>
                          <LinkButton onClick={() => void restore(doc.id)}>Khôi phục</LinkButton>
                          <LinkButton tone="red" onClick={() => setPurging(doc)}>
                            Xóa vĩnh viễn
                          </LinkButton>
                        </>
                      ) : (
                        <>
                          {attachment ? (
                            <LinkButton
                              onClick={() => void downloadAttachment(attachment.id, attachment.fileName)}
                            >
                              Tải về
                            </LinkButton>
                          ) : null}
                          <LinkButton onClick={() => void togglePin(doc)}>
                            {doc.pinned ? 'Bỏ ghim' : 'Ghim'}
                          </LinkButton>
                          <LinkButton tone="red" onClick={() => setDeleting(doc)}>
                            Xóa
                          </LinkButton>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <th>Tên tài liệu</th>
                  <th>Loại</th>
                  <th>Dung lượng</th>
                  <th>Cập nhật</th>
                  <th className="w-[190px]">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {documents.length === 0 ? (
                  <TableEmptyRow colSpan={5}>Chưa có tài liệu phù hợp.</TableEmptyRow>
                ) : (
                  documents.map((doc) => {
                    const attachment = doc.attachments?.[0];
                    return (
                      <tr key={doc.id}>
                        <td className="wrap">
                          <strong>
                            {doc.pinned ? '★ ' : ''}
                            {doc.name}
                          </strong>
                          {doc.tags ? (
                            <span className="mt-0.5 block text-[11px] text-muted">{doc.tags}</span>
                          ) : null}
                        </td>
                        <td>{attachment?.extension ?? doc.type}</td>
                        <td>{formatBytes(attachment?.size ?? 0)}</td>
                        <td className="whitespace-nowrap">{fmtDateTime(doc.updatedAt)}</td>
                        <td>
                          <div className="flex flex-wrap gap-2">
                            {trash ? (
                              <>
                                <LinkButton onClick={() => void restore(doc.id)}>Khôi phục</LinkButton>
                                <LinkButton tone="red" onClick={() => setPurging(doc)}>
                                  Xóa vĩnh viễn
                                </LinkButton>
                              </>
                            ) : (
                              <>
                                {attachment ? (
                                  <LinkButton
                                    onClick={() => void downloadAttachment(attachment.id, attachment.fileName)}
                                  >
                                    Tải về
                                  </LinkButton>
                                ) : null}
                                <LinkButton onClick={() => void togglePin(doc)}>
                                  {doc.pinned ? 'Bỏ ghim' : 'Ghim'}
                                </LinkButton>
                                <LinkButton tone="red" onClick={() => setDeleting(doc)}>
                                  Xóa
                                </LinkButton>
                              </>
                            )}
                          </div>
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
        onClose={() => setFolderOpen(false)}
        footer={
          <>
            <Button onClick={() => setFolderOpen(false)}>Hủy</Button>
            <Button variant="primary" loading={busy} onClick={() => void createFolder()}>
              Tạo
            </Button>
          </>
        }
      >
        <Field label="Tên thư mục" required>
          <TextInput value={folderName} onChange={(e) => setFolderName(e.target.value)} maxLength={150} />
        </Field>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Chuyển vào thùng rác"
        loading={busy}
        confirmLabel="Xóa"
        description={
          <>
            <Notice tone="warn" className="mb-2">
              Tài liệu chuyển vào thùng rác, có thể khôi phục sau.
            </Notice>
            <p className="m-0">
              <strong>{deleting?.name}</strong>
            </p>
          </>
        }
        onCancel={() => setDeleting(null)}
        onConfirm={() => void softDelete()}
      />

      <ConfirmDialog
        open={purging !== null}
        title="Xóa vĩnh viễn"
        loading={busy}
        confirmLabel="Xóa vĩnh viễn"
        description={
          <>
            <Notice tone="danger" className="mb-2">
              Tệp trên máy chủ sẽ bị xóa thật và <strong>không thể khôi phục</strong>.
            </Notice>
            <p className="m-0">
              <strong>{purging?.name}</strong>
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
