'use client';

import { CameraIcon, Database, Download, HistoryIcon, Upload } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { useScope } from '@/hooks/useScope';
import { useToast } from '@/hooks/useToast';
import { fmtDateTime, formatBytes } from '@/lib/format';
import { api } from '@/services/api';
import type { BackupRecord, Snapshot } from '@/types';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHead,
  Checkbox,
  ErrorState,
  LinkButton,
  LoadingState,
  Notice,
  PageHead,
  Split,
  TableEmptyRow,
  TableWrap,
} from '@/components/ui';
import { Modal } from '@/components/ui/Modal';

interface Overview {
  snapshots: Snapshot[];
  backupRecords: BackupRecord[];
  lastBackupAt: string | null;
  attachmentCount: number;
  attachmentBytes: number;
  storage: { kind: string; label: string };
}

/** Ba phạm vi sao lưu ngoài, giữ nguyên bảng mô tả của bản gốc. */
const BACKUP_SCOPES = [
  {
    scope: 'QUICK' as const,
    label: 'Nhanh',
    content: 'Cấu hình, metadata và dữ liệu nghiệp vụ',
    fit: 'Sao lưu thường xuyên',
  },
  {
    scope: 'FULL' as const,
    label: 'Đầy đủ',
    content: 'Toàn bộ dữ liệu, manifest và SHA-256',
    fit: 'Đổi máy, lưu trữ định kỳ',
  },
  {
    scope: 'YEAR_PACKAGE' as const,
    label: 'Gói năm học',
    content: 'Dữ liệu năm đang chọn và báo cáo chốt',
    fit: 'Đóng năm/bàn giao',
  },
];

export default function BackupPage() {
  const scope = useScope();
  const { user } = useAuth();
  const { toast, toastError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [viewSnapshot, setViewSnapshot] = useState<Snapshot | null>(null);
  const [restoreSnapshot, setRestoreSnapshot] = useState<Snapshot | null>(null);
  const [restoreFile, setRestoreFile] = useState<{ name: string; payload: unknown } | null>(null);
  const [verifyResult, setVerifyResult] = useState<{
    valid: boolean;
    issues: string[];
    total: number;
  } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const { data, loading, error, refetch } = useApiQuery<Overview>('/backup/overview');

  const isAdmin = user?.role === 'ADMIN';

  const exportBackup = useCallback(
    async (backupScope: 'QUICK' | 'FULL' | 'YEAR_PACKAGE') => {
      setBusy(true);
      try {
        await api.download(
          '/backup/export',
          { scope: backupScope, ...(backupScope === 'YEAR_PACKAGE' ? { yearId: scope.yearId } : {}) },
          'tpt-backup.json',
        );
        toast('Đã tạo và tải bản sao lưu');
        void refetch();
      } catch (err) {
        toastError(err);
      } finally {
        setBusy(false);
      }
    },
    [scope.yearId, toast, toastError, refetch],
  );

  const createSnapshot = useCallback(async () => {
    setBusy(true);
    try {
      await api.post('/backup/snapshots', { yearId: scope.yearId });
      toast('Đã tạo điểm khôi phục nội bộ');
      void refetch();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }, [scope.yearId, toast, toastError, refetch]);

  /** Kiểm tra tệp trước khi ghi — bản gốc cũng verify trước restore. */
  const handleFile = useCallback(
    async (file: File) => {
      setBusy(true);
      setVerifyResult(null);
      try {
        const payload = JSON.parse(await file.text()) as Record<string, unknown>;
        const result = await api.post<{ valid: boolean; issues: string[]; total: number }>(
          '/backup/verify',
          payload,
        );
        setRestoreFile({ name: file.name, payload });
        setVerifyResult(result);
        setConfirmed(false);
      } catch (err) {
        toastError(err);
      } finally {
        setBusy(false);
      }
    },
    [toastError],
  );

  const doRestoreFile = useCallback(async () => {
    if (!restoreFile || !confirmed) return;
    setBusy(true);
    try {
      const result = await api.post<{ restored: number }>('/backup/restore', {
        ...(restoreFile.payload as Record<string, unknown>),
        confirmed: true,
      });
      toast(`Đã phục hồi ${result.restored} bản ghi`);
      setRestoreFile(null);
      setVerifyResult(null);
      void refetch();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }, [restoreFile, confirmed, toast, toastError, refetch]);

  const doRestoreSnapshot = useCallback(async () => {
    if (!restoreSnapshot || !confirmed) return;
    setBusy(true);
    try {
      const result = await api.post<{ restored: number }>(
        `/backup/snapshots/${restoreSnapshot.id}/restore`,
        { confirmed: true },
      );
      toast(`Đã khôi phục ${result.restored} bản ghi`);
      setRestoreSnapshot(null);
      setConfirmed(false);
      void refetch();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }, [restoreSnapshot, confirmed, toast, toastError, refetch]);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data) return null;

  return (
    <>
      <PageHead
        title="Sao lưu – đồng bộ"
        description="Dữ liệu lưu tập trung trên PostgreSQL; xuất/nhập tệp để sao lưu ngoài."
        actions={
          <>
            <Button
              icon={<Upload size={15} aria-hidden />}
              disabled={!isAdmin}
              title={isAdmin ? undefined : 'Chỉ quản trị viên được phục hồi dữ liệu'}
              onClick={() => fileInputRef.current?.click()}
            >
              Phục hồi từ tệp
            </Button>
            <Button
              variant="primary"
              icon={<Download size={15} aria-hidden />}
              loading={busy}
              onClick={() => void exportBackup('FULL')}
            >
              Tạo bản sao lưu
            </Button>
          </>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept=".json,application/json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />

      <Notice className="mb-3">
        <strong className="block">Kiến trúc mới: PostgreSQL là nguồn dữ liệu duy nhất.</strong>
        Không còn phụ thuộc IndexedDB của trình duyệt, nên dữ liệu không mất khi xóa dữ liệu duyệt
        web và dùng chung được trên mọi thiết bị.
      </Notice>

      <div className="grid grid-cols-3 gap-3 tablet:grid-cols-1">
        <Card>
          <CardHead title="Sao lưu gần nhất" />
          <CardBody>
            <strong className="text-[15px]">
              {data.lastBackupAt ? fmtDateTime(data.lastBackupAt) : 'Chưa có'}
            </strong>
            <p className="mt-1 text-[12.5px] text-muted">
              {data.attachmentCount} tệp đính kèm • {formatBytes(data.attachmentBytes)}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Phục hồi an toàn" />
          <CardBody>
            <p className="m-0 text-[12.5px]">
              Kiểm tra định dạng, số bản ghi và checksum trước khi ghi. Luôn tự tạo điểm khôi phục
              bảo vệ trước khi ghi đè.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Nơi lưu dữ liệu" />
          <CardBody>
            <Badge tone="blue">
              <Database size={11} className="mr-1" aria-hidden />
              {data.storage.label}
            </Badge>
            <p className="mt-2 text-[12px] text-muted">
              Tệp đính kèm lưu trên đĩa máy chủ, metadata lưu trong PostgreSQL.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-3">
        <CardHead title="Ba phạm vi sao lưu ngoài" />
        <CardBody className="pt-2">
          <TableWrap className="max-h-none">
            <thead>
              <tr>
                <th>Chế độ</th>
                <th>Nội dung</th>
                <th>Phù hợp</th>
                <th className="w-[110px]" />
              </tr>
            </thead>
            <tbody>
              {BACKUP_SCOPES.map((item) => (
                <tr key={item.scope}>
                  <td>
                    <strong>{item.label}</strong>
                  </td>
                  <td className="wrap">{item.content}</td>
                  <td>{item.fit}</td>
                  <td>
                    <LinkButton onClick={() => void exportBackup(item.scope)}>Xuất</LinkButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </CardBody>
      </Card>

      <Card className="mt-3">
        <CardHead
          title="Điểm khôi phục nội bộ"
          meta={`${data.snapshots.length} điểm`}
          actions={
            <Button
              size="sm"
              variant="primary"
              icon={<CameraIcon size={14} aria-hidden />}
              loading={busy}
              onClick={() => void createSnapshot()}
            >
              Tạo điểm ngay
            </Button>
          }
        />
        <CardBody className="pt-2">
          <Notice className="mb-2.5">
            Chính sách giữ: 7 ngày • 4 tuần • 12 tháng. Điểm bảo vệ (trước khóa/mở khóa bảng thi đua,
            sau chốt báo cáo, trước đóng năm) không tự xóa.
          </Notice>
          <TableWrap className="max-h-[360px]">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Tên</th>
                <th>Loại</th>
                <th>Bản ghi</th>
                <th>Checksum</th>
                <th className="w-[150px]">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.snapshots.length === 0 ? (
                <TableEmptyRow colSpan={6}>Chưa có điểm khôi phục.</TableEmptyRow>
              ) : (
                data.snapshots.map((snapshot) => (
                  <tr key={snapshot.id}>
                    <td className="whitespace-nowrap">{fmtDateTime(snapshot.createdAt)}</td>
                    <td className="wrap">{snapshot.name}</td>
                    <td>
                      {snapshot.tier}
                      {snapshot.protected ? (
                        <Badge tone="green" className="ml-1">
                          bảo vệ
                        </Badge>
                      ) : null}
                    </td>
                    <td>{snapshot.recordCount.toLocaleString('vi-VN')}</td>
                    <td>
                      <code className="text-[11px]">{(snapshot.checksum ?? '').slice(0, 12)}…</code>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <LinkButton onClick={() => setViewSnapshot(snapshot)}>Xem</LinkButton>
                        <LinkButton
                          disabled={!isAdmin}
                          onClick={() => {
                            setRestoreSnapshot(snapshot);
                            setConfirmed(false);
                          }}
                        >
                          Khôi phục
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
          title="Nhật ký sao lưu"
          meta={`${data.backupRecords.length} bản`}
          actions={<HistoryIcon size={15} className="text-muted" aria-hidden />}
        />
        <CardBody className="pt-2">
          <TableWrap className="max-h-[280px]">
            <thead>
              <tr>
                <th>Hoàn tất</th>
                <th>Tên</th>
                <th>Phạm vi</th>
                <th>Dung lượng</th>
                <th>Bản ghi</th>
                <th>Checksum</th>
              </tr>
            </thead>
            <tbody>
              {data.backupRecords.length === 0 ? (
                <TableEmptyRow colSpan={6}>Chưa ghi nhận bản sao lưu nào.</TableEmptyRow>
              ) : (
                data.backupRecords.map((record) => (
                  <tr key={record.id}>
                    <td className="whitespace-nowrap">{fmtDateTime(record.completedAt)}</td>
                    <td className="wrap">{record.name}</td>
                    <td>{record.scope}</td>
                    <td>{formatBytes(record.size)}</td>
                    <td>{record.recordCount.toLocaleString('vi-VN')}</td>
                    <td>
                      <code className="text-[11px]">{(record.checksum ?? '').slice(0, 12)}…</code>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>
        </CardBody>
      </Card>

      <Modal
        open={viewSnapshot !== null}
        title="Chi tiết điểm khôi phục"
        onClose={() => setViewSnapshot(null)}
        wide
        footer={<Button variant="primary" onClick={() => setViewSnapshot(null)}>Đóng</Button>}
      >
        {viewSnapshot ? (
          <>
            <Notice className="mb-3">
              Điểm này không chứa tệp đính kèm để tránh nhân đôi dung lượng.
            </Notice>
            <Split label="Tên">{viewSnapshot.name}</Split>
            <Split label="Tổng bản ghi">{viewSnapshot.recordCount.toLocaleString('vi-VN')}</Split>
            <Split label="SHA-256">
              <code className="break-all text-[11px]">{viewSnapshot.checksum}</code>
            </Split>
            <TableWrap className="mt-3 max-h-[320px]">
              <thead>
                <tr>
                  <th>Phân hệ</th>
                  <th className="text-right">Bản ghi</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(viewSnapshot.counts ?? {})
                  .filter(([, count]) => count > 0)
                  .map(([model, count]) => (
                    <tr key={model}>
                      <td>{model}</td>
                      <td className="text-right">{count.toLocaleString('vi-VN')}</td>
                    </tr>
                  ))}
              </tbody>
            </TableWrap>
          </>
        ) : null}
      </Modal>

      <Modal
        open={restoreSnapshot !== null}
        title="Khôi phục từ điểm khôi phục"
        onClose={() => setRestoreSnapshot(null)}
        footer={
          <>
            <Button onClick={() => setRestoreSnapshot(null)} disabled={busy}>
              Hủy
            </Button>
            <Button
              variant="danger"
              loading={busy}
              disabled={!confirmed}
              onClick={() => void doRestoreSnapshot()}
            >
              Khôi phục
            </Button>
          </>
        }
      >
        <Notice tone="danger" className="mb-3">
          Thao tác ghi đè dữ liệu hiện tại bằng nội dung của điểm khôi phục. Hệ thống sẽ tự tạo một
          điểm bảo vệ hiện trạng trước khi ghi.
        </Notice>
        <p className="mb-3 text-[13px]">
          <strong>{restoreSnapshot?.name}</strong> — {restoreSnapshot?.recordCount.toLocaleString('vi-VN')}{' '}
          bản ghi, tạo lúc {fmtDateTime(restoreSnapshot?.createdAt)}.
        </p>
        <Checkbox
          label="Tôi hiểu dữ liệu hiện tại sẽ bị ghi đè."
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
      </Modal>

      <Modal
        open={restoreFile !== null}
        title="Phục hồi từ tệp sao lưu"
        onClose={() => {
          setRestoreFile(null);
          setVerifyResult(null);
        }}
        footer={
          <>
            <Button
              onClick={() => {
                setRestoreFile(null);
                setVerifyResult(null);
              }}
              disabled={busy}
            >
              Hủy
            </Button>
            <Button
              variant="danger"
              loading={busy}
              disabled={!confirmed || !verifyResult?.valid}
              onClick={() => void doRestoreFile()}
            >
              Phục hồi
            </Button>
          </>
        }
      >
        <p className="mb-2 text-[13px]">
          Tệp: <strong>{restoreFile?.name}</strong>
        </p>

        {verifyResult ? (
          verifyResult.valid ? (
            <Notice tone="info" className="mb-3">
              Tệp hợp lệ. Sẽ ghi <strong>{verifyResult.total.toLocaleString('vi-VN')}</strong> bản ghi.
            </Notice>
          ) : (
            <Notice tone="danger" className="mb-3">
              <strong className="block">Tệp không hợp lệ:</strong>
              <ul className="mt-1 list-disc pl-5">
                {verifyResult.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </Notice>
          )
        ) : (
          <LoadingState label="Đang kiểm tra tệp…" />
        )}

        <Checkbox
          label="Tôi hiểu dữ liệu hiện tại sẽ bị ghi đè."
          checked={confirmed}
          disabled={!verifyResult?.valid}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
      </Modal>
    </>
  );
}
