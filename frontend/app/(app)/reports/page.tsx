'use client';

import { Download, FileCheck2, Package, Printer, Save } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useScope } from '@/hooks/useScope';
import { useToast } from '@/hooks/useToast';
import { fmtDateTime } from '@/lib/format';
import { REPORT_TYPE_LABEL, SUBMISSION_STATUS_LABEL, toOptions } from '@/lib/labels';
import { api } from '@/services/api';
import type { GeneratedReport, ReportPayload, ReportType } from '@/types';
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
  Select,
  TextInput,
  Toolbar,
} from '@/components/ui';
import { Modal } from '@/components/ui/Modal';

const PREVIEW_TYPES: ReportType[] = ['WEEK', 'SCORES', 'TASKS', 'ACTIVITIES', 'EQUIPMENT'];

/** Kết xuất nội dung báo cáo từ dữ liệu có cấu trúc do backend trả về. */
function ReportView({ payload }: { payload: ReportPayload }) {
  return (
    <article className="text-[13px] leading-relaxed">
      <div className="text-center">
        <small className="block uppercase">{payload.schoolName}</small>
        <h2 className="my-2 text-[16px] font-bold">{payload.title}</h2>
        <p className="m-0 text-[12.5px]">{payload.scopeLabel}</p>
      </div>

      <div className="mt-3 flex flex-wrap justify-between gap-2 text-[11.5px] text-muted">
        <span>Tạo lúc: {fmtDateTime(payload.generatedAt)}</span>
        <span>Phạm vi dữ liệu: {payload.scopeLabel}</span>
      </div>
      <hr className="my-2 border-0 border-t border-line" />

      {payload.sections.map((section, index) => (
        <div key={index} className="mb-3">
          {section.heading ? (
            <h3 className="mb-1 mt-3 text-[14px] font-bold">{section.heading}</h3>
          ) : null}
          {section.paragraph ? <p className="m-0">{section.paragraph}</p> : null}
          {section.notice ? (
            <Notice tone={section.notice.tone === 'warn' ? 'warn' : 'info'}>{section.notice.text}</Notice>
          ) : null}
          {section.table ? (
            <div className="mt-1.5 overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    {section.table.head.map((cell) => (
                      <th key={cell}>{cell}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.table.rows.length === 0 ? (
                    <tr>
                      <td colSpan={section.table.head.length} className="py-6 text-center text-muted">
                        Không có dữ liệu trong phạm vi đã chọn.
                      </td>
                    </tr>
                  ) : (
                    section.table.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className={cellIndex === 0 ? 'wrap' : undefined}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ))}

      <div className="mt-10 grid grid-cols-2 text-center">
        {payload.signatures.map((label) => (
          <div key={label}>
            <strong>{label}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

export default function ReportsPage() {
  const scope = useScope();
  const { toast, toastError } = useToast();

  const [type, setType] = useState<ReportType>('WEEK');
  const [recipient, setRecipient] = useState('');
  const [submission, setSubmission] = useState('NOT_SUBMITTED');
  const [paper, setPaper] = useState<'landscape' | 'portrait'>('landscape');
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [openReport, setOpenReport] = useState<GeneratedReport | null>(null);

  const previewQuery = useApiQuery<ReportPayload>(
    scope.ready && scope.yearId ? '/reports/preview' : null,
    { ...scope.query, type },
  );

  const savedQuery = useApiQuery<GeneratedReport[]>(
    scope.ready && scope.yearId ? '/reports' : null,
    { yearId: scope.yearId },
  );

  const saveReport = useCallback(
    async (status: 'DRAFT' | 'FINALIZED') => {
      setBusy(true);
      try {
        const report = await api.post<GeneratedReport>('/reports', {
          ...scope.query,
          type,
          status,
          recipient: recipient.trim() || undefined,
          submissionStatus: submission,
          confirmed: status === 'FINALIZED' ? confirmed : false,
        });
        toast(
          status === 'FINALIZED'
            ? `Đã chốt báo cáo v${report.version}; nội dung lưu bất biến.`
            : `Đã lưu bản nháp v${report.version}.`,
        );
        setFinalizeOpen(false);
        setConfirmed(false);
        void savedQuery.refetch();
      } catch (err) {
        toastError(err);
      } finally {
        setBusy(false);
      }
    },
    [scope.query, type, recipient, submission, confirmed, toast, toastError, savedQuery],
  );

  const createPackage = useCallback(async () => {
    setBusy(true);
    try {
      await api.post('/reports/packages', { yearId: scope.yearId });
      toast('Đã tạo gói báo cáo chốt của năm học');
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }, [scope.yearId, toast, toastError]);

  const changePaper = (value: 'landscape' | 'portrait') => {
    setPaper(value);
    document.body.dataset.paper = value;
  };

  if (!scope.ready) return <LoadingState />;

  return (
    <>
      <PageHead
        title="Báo cáo"
        description="Tổng hợp số liệu đã xác nhận và truy ngược về bản ghi gốc."
        actions={
          <>
            <Button icon={<Package size={15} aria-hidden />} loading={busy} onClick={() => void createPackage()}>
              Gói báo cáo chốt
            </Button>
            <Button
              icon={<Download size={15} aria-hidden />}
              onClick={() =>
                void api.download('/reports/export/csv', { ...scope.query, type }, 'bao-cao.csv')
              }
            >
              Xuất CSV
            </Button>
            <Button icon={<Printer size={15} aria-hidden />} onClick={() => window.print()}>
              In/Lưu PDF
            </Button>
            <Button icon={<Save size={15} aria-hidden />} onClick={() => void saveReport('DRAFT')}>
              Lưu nháp
            </Button>
            <Button
              variant="primary"
              icon={<FileCheck2 size={15} aria-hidden />}
              onClick={() => setFinalizeOpen(true)}
            >
              Chốt báo cáo
            </Button>
          </>
        }
      />

      <Toolbar>
        <Select
          value={type}
          onChange={(e) => setType(e.target.value as ReportType)}
          className="w-auto"
          aria-label="Loại báo cáo"
        >
          {PREVIEW_TYPES.map((value) => (
            <option key={value} value={value}>
              {REPORT_TYPE_LABEL[value]}
            </option>
          ))}
        </Select>
        <Select
          value={paper}
          onChange={(e) => changePaper(e.target.value as 'landscape' | 'portrait')}
          className="w-auto"
          aria-label="Khổ in"
        >
          <option value="landscape">A4 ngang</option>
          <option value="portrait">A4 dọc</option>
        </Select>
        <TextInput
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="Nơi nhận (tùy chọn)"
          className="w-[200px]"
          aria-label="Nơi nhận"
        />
        <Select
          value={submission}
          onChange={(e) => setSubmission(e.target.value)}
          className="w-auto"
          aria-label="Trạng thái gửi"
        >
          {toOptions(SUBMISSION_STATUS_LABEL).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <span className="ml-auto text-[12px] text-muted">Số liệu nguồn không sửa tại báo cáo</span>
      </Toolbar>

      <Notice tone="warn" className="no-print mb-2.5">
        <strong>Nháp</strong> có thể tạo lại; <strong>báo cáo chốt</strong> lưu nội dung tĩnh, phiên
        bản, bộ lọc, checksum và trạng thái gửi. Muốn sửa sau chốt phải tạo phiên bản mới.
      </Notice>

      <Card>
        <CardBody>
          {previewQuery.error ? (
            <ErrorState error={previewQuery.error} onRetry={() => void previewQuery.refetch()} />
          ) : previewQuery.loading && !previewQuery.data ? (
            <LoadingState label="Đang tổng hợp số liệu…" />
          ) : previewQuery.data ? (
            <ReportView payload={previewQuery.data} />
          ) : null}
        </CardBody>
      </Card>

      <Card className="no-print mt-3">
        <CardHead
          title="Phiên bản báo cáo đã lưu"
          meta={`${savedQuery.data?.length ?? 0} phiên bản`}
        />
        <CardBody className="pt-2">
          {(savedQuery.data ?? []).length === 0 ? (
            <p className="py-4 text-center text-[13px] text-muted">Chưa lưu phiên bản báo cáo.</p>
          ) : (
            <ul className="m-0 list-none divide-y divide-line p-0">
              {savedQuery.data!.map((report) => (
                <li key={report.id} className="flex items-center gap-2.5 py-2">
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-[13px]">{report.name}</strong>
                    <small className="text-[11.5px] text-muted">
                      {fmtDateTime(report.generatedAt)} • {REPORT_TYPE_LABEL[report.type]} • v
                      {report.version} • {report.status === 'FINALIZED' ? 'đã chốt' : 'bản nháp'} •{' '}
                      {SUBMISSION_STATUS_LABEL[report.submissionStatus]}
                    </small>
                  </div>
                  <Badge tone={report.status === 'FINALIZED' ? 'green' : 'yellow'}>
                    {report.status === 'FINALIZED' ? 'Bất biến' : 'Nháp'}
                  </Badge>
                  <LinkButton onClick={() => setOpenReport(report)}>Mở lại</LinkButton>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Modal
        open={finalizeOpen}
        title="Chốt báo cáo"
        onClose={() => setFinalizeOpen(false)}
        footer={
          <>
            <Button onClick={() => setFinalizeOpen(false)} disabled={busy}>
              Hủy
            </Button>
            <Button variant="primary" loading={busy} onClick={() => void saveReport('FINALIZED')}>
              Chốt phiên bản
            </Button>
          </>
        }
      >
        <Notice tone="warn" className="mb-3">
          <strong>Sau khi chốt, phiên bản này không sửa trực tiếp.</strong> Nếu số liệu thay đổi, hãy
          tạo và chốt phiên bản mới.
        </Notice>
        <Checkbox
          label="Tôi đã đối chiếu nội dung, bộ lọc, nơi nhận và trạng thái gửi."
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
      </Modal>

      <Modal
        open={openReport !== null}
        title={openReport?.name ?? ''}
        onClose={() => setOpenReport(null)}
        wide
        footer={<Button variant="primary" onClick={() => setOpenReport(null)}>Đóng</Button>}
      >
        {openReport ? (
          <>
            <Notice className="mb-3">
              Bản lưu lúc {fmtDateTime(openReport.generatedAt)} • v{openReport.version} •{' '}
              {openReport.status === 'FINALIZED' ? 'đã chốt, bất biến' : 'bản nháp'}. Nội dung không
              tự cập nhật theo nguồn hiện tại.
            </Notice>
            <div className="mb-2 flex flex-wrap justify-between gap-2 text-[12.5px]">
              <span className="text-muted">Nơi nhận/trạng thái gửi</span>
              <strong>
                {openReport.recipient || 'Chưa ghi'} •{' '}
                {SUBMISSION_STATUS_LABEL[openReport.submissionStatus]}
              </strong>
            </div>
            <div className="mb-3 flex flex-wrap justify-between gap-2 text-[12.5px]">
              <span className="text-muted">Checksum nguồn</span>
              <code className="break-all text-[11px]">
                {openReport.sourceChecksum ?? 'Chưa có ở phiên bản cũ'}
              </code>
            </div>
            {openReport.contentText ? (
              (() => {
                try {
                  return <ReportView payload={JSON.parse(openReport.contentText) as ReportPayload} />;
                } catch {
                  return (
                    <pre className="whitespace-pre-wrap text-[12px]">{openReport.contentText}</pre>
                  );
                }
              })()
            ) : null}
          </>
        ) : null}
      </Modal>
    </>
  );
}
