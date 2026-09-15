'use client';

import {
  Download,
  FileCheck2,
  FileText,
  History,
  MoreHorizontal,
  Package,
  Printer,
  Save,
} from 'lucide-react';
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
  CardSkeleton,
  Checkbox,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Notice,
  PageHead,
  Select,
  TextInput,
} from '@/components/ui';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/Menu';
import { Modal } from '@/components/ui/Modal';

const PREVIEW_TYPES: ReportType[] = ['WEEK', 'SCORES', 'TASKS', 'ACTIVITIES', 'EQUIPMENT'];

/** Kết xuất nội dung báo cáo từ dữ liệu có cấu trúc do backend trả về. */
function ReportView({ payload }: { payload: ReportPayload }) {
  return (
    <article className="mx-auto max-w-[860px] text-base leading-relaxed">
      <header className="text-center">
        <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-neutral-500">
          {payload.schoolName}
        </p>
        <h2 className="mx-auto mt-2 max-w-[36ch] text-2xl font-bold leading-snug text-ink text-balance">
          {payload.title}
        </h2>
        <p className="m-0 mt-1.5 text-sm text-neutral-500">{payload.scopeLabel}</p>
      </header>

      <div className="mt-4 flex flex-wrap justify-between gap-2 border-y border-line py-2 text-xs text-neutral-500">
        <span>Tạo lúc: {fmtDateTime(payload.generatedAt)}</span>
        <span>Phạm vi dữ liệu: {payload.scopeLabel}</span>
      </div>

      {payload.sections.map((section, index) => (
        <section key={index} className="mb-5">
          {section.heading ? (
            <h3 className="mb-2 mt-5 border-l-[3px] border-brand-600 pl-2.5 text-lg font-bold text-ink">
              {section.heading}
            </h3>
          ) : null}
          {section.paragraph ? <p className="m-0">{section.paragraph}</p> : null}
          {section.notice ? (
            <Notice tone={section.notice.tone === 'warn' ? 'warn' : 'info'}>{section.notice.text}</Notice>
          ) : null}
          {section.table ? (
            <div className="mt-2 overflow-x-auto rounded-md border border-line">
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
        </section>
      ))}

      <div className="mt-12 grid grid-cols-2 gap-4 text-center">
        {payload.signatures.map((label) => (
          <div key={label}>
            <strong className="text-ink">{label}</strong>
            <span aria-hidden className="mx-auto mt-14 block h-px w-2/3 bg-neutral-200" />
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

  const exportCsv = useCallback(async () => {
    try {
      await api.download('/reports/export/csv', { ...scope.query, type }, 'bao-cao.csv');
      toast('Đã xuất báo cáo ra CSV');
    } catch (err) {
      toastError(err);
    }
  }, [scope.query, type, toast, toastError]);

  const changePaper = (value: 'landscape' | 'portrait') => {
    setPaper(value);
    document.body.dataset.paper = value;
  };

  if (!scope.ready) return <LoadingState />;

  return (
    <>
      <PageHead
        eyebrow={REPORT_TYPE_LABEL[type]}
        title="Báo cáo"
        description="Tổng hợp số liệu đã xác nhận trong phạm vi đang chọn và truy ngược về bản ghi gốc."
        actions={
          <>
            {/* Ba thao tác ít dùng gộp vào menu để hai hành động chính nổi bật. */}
            <Menu
              align="end"
              label="Thao tác khác với báo cáo"
              trigger={
                <span className="btn">
                  <MoreHorizontal size={15} aria-hidden />
                  Thao tác khác
                </span>
              }
            >
              {(close) => (
                <>
                  <MenuLabel>Kết xuất</MenuLabel>
                  <MenuItem
                    icon={<Printer size={15} aria-hidden />}
                    onClick={() => {
                      close();
                      window.print();
                    }}
                  >
                    In hoặc lưu PDF
                  </MenuItem>
                  <MenuItem
                    icon={<Download size={15} aria-hidden />}
                    onClick={() => {
                      close();
                      void exportCsv();
                    }}
                  >
                    Xuất CSV
                  </MenuItem>
                  <MenuSeparator />
                  <MenuLabel>Cả năm học</MenuLabel>
                  <MenuItem
                    icon={<Package size={15} aria-hidden />}
                    onClick={() => {
                      close();
                      void createPackage();
                    }}
                  >
                    Tạo gói báo cáo chốt
                  </MenuItem>
                </>
              )}
            </Menu>

            <Button
              icon={<Save size={15} aria-hidden />}
              loading={busy}
              onClick={() => void saveReport('DRAFT')}
            >
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

      <div className="no-print mb-3 grid gap-3 rounded-lg border border-line bg-card p-3.5 shadow-xs md:grid-cols-2 xl:grid-cols-4">
        <Field label="Loại báo cáo">
          <Select value={type} onChange={(e) => setType(e.target.value as ReportType)}>
            {PREVIEW_TYPES.map((value) => (
              <option key={value} value={value}>
                {REPORT_TYPE_LABEL[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Khổ in">
          <Select
            value={paper}
            onChange={(e) => changePaper(e.target.value as 'landscape' | 'portrait')}
          >
            <option value="landscape">A4 ngang</option>
            <option value="portrait">A4 dọc</option>
          </Select>
        </Field>

        <Field label="Nơi nhận" hint="Tùy chọn — in lên bản báo cáo đã chốt.">
          <TextInput
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Ví dụ: Phòng GD&ĐT Lệ Thủy"
          />
        </Field>

        <Field label="Trạng thái gửi">
          <Select value={submission} onChange={(e) => setSubmission(e.target.value)}>
            {toOptions(SUBMISSION_STATUS_LABEL).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Notice tone="warn" title="Nháp và bản chốt khác nhau" className="no-print mb-3">
        Bản <strong>nháp</strong> luôn tạo lại được từ số liệu hiện tại. Bản{' '}
        <strong>đã chốt</strong> lưu nội dung tĩnh kèm phiên bản, bộ lọc, checksum và trạng thái
        gửi — muốn sửa phải tạo phiên bản mới. Số liệu nguồn không sửa được tại trang này.
      </Notice>

      <Card>
        <CardBody className="p-6 md:p-8">
          {previewQuery.error ? (
            <ErrorState error={previewQuery.error} onRetry={() => void previewQuery.refetch()} />
          ) : previewQuery.loading && !previewQuery.data ? (
            <CardSkeleton lines={8} />
          ) : previewQuery.data ? (
            <ReportView payload={previewQuery.data} />
          ) : null}
        </CardBody>
      </Card>

      <Card className="no-print mt-4">
        <CardHead
          title="Phiên bản báo cáo đã lưu"
          icon={<History size={16} aria-hidden />}
          meta={`${savedQuery.data?.length ?? 0} phiên bản`}
        />
        <CardBody className="p-0">
          {(savedQuery.data ?? []).length === 0 ? (
            <EmptyState
              className="border-0 bg-transparent py-10"
              icon={<FileText size={22} aria-hidden />}
              title="Chưa lưu phiên bản nào"
              hint="Dùng “Lưu nháp” hoặc “Chốt báo cáo” để tạo phiên bản đầu tiên."
            />
          ) : (
            <ul className="m-0 list-none divide-y divide-neutral-100 p-0">
              {savedQuery.data!.map((report) => (
                <li
                  key={report.id}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-neutral-50"
                >
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-neutral-100 text-neutral-500"
                    aria-hidden
                  >
                    <FileText size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-base font-semibold text-ink">
                      {report.name}
                    </strong>
                    <span className="mt-0.5 block truncate text-xs text-neutral-500">
                      {fmtDateTime(report.generatedAt)} · {REPORT_TYPE_LABEL[report.type]} · phiên
                      bản {report.version} · {SUBMISSION_STATUS_LABEL[report.submissionStatus]}
                    </span>
                  </div>
                  <Badge tone={report.status === 'FINALIZED' ? 'green' : 'yellow'} dot>
                    {report.status === 'FINALIZED' ? 'Đã chốt' : 'Bản nháp'}
                  </Badge>
                  <Button size="sm" className="shrink-0" onClick={() => setOpenReport(report)}>
                    Mở lại
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Modal
        open={finalizeOpen}
        title="Chốt báo cáo"
        description="Phiên bản đã chốt lưu nội dung bất biến để đối chiếu về sau."
        icon={<FileCheck2 size={18} aria-hidden />}
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
        description="Bản lưu không tự cập nhật theo số liệu nguồn hiện tại."
        icon={<FileText size={18} aria-hidden />}
        onClose={() => setOpenReport(null)}
        size="lg"
        footer={<Button variant="primary" onClick={() => setOpenReport(null)}>Đóng</Button>}
      >
        {openReport ? (
          <>
            <Notice className="mb-3">
              Bản lưu lúc {fmtDateTime(openReport.generatedAt)} • v{openReport.version} •{' '}
              {openReport.status === 'FINALIZED' ? 'đã chốt, bất biến' : 'bản nháp'}. Nội dung không
              tự cập nhật theo nguồn hiện tại.
            </Notice>
            <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
              <span className="text-muted">Nơi nhận/trạng thái gửi</span>
              <strong>
                {openReport.recipient || 'Chưa ghi'} •{' '}
                {SUBMISSION_STATUS_LABEL[openReport.submissionStatus]}
              </strong>
            </div>
            <div className="mb-3 flex flex-wrap justify-between gap-2 text-sm">
              <span className="text-muted">Checksum nguồn</span>
              <code className="break-all text-2xs">
                {openReport.sourceChecksum ?? 'Chưa có ở phiên bản cũ'}
              </code>
            </div>
            {openReport.contentText ? (
              (() => {
                try {
                  return <ReportView payload={JSON.parse(openReport.contentText) as ReportPayload} />;
                } catch {
                  return (
                    <pre className="whitespace-pre-wrap text-xs">{openReport.contentText}</pre>
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
