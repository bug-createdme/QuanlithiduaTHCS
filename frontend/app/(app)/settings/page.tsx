'use client';

import { Download, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { useScope } from '@/hooks/useScope';
import { useToast } from '@/hooks/useToast';
import { cx } from '@/lib/format';
import { SETTINGS_CONFIG_KEYS, SETTINGS_CUSTOM_ENTITY, SETTINGS_TABS, type SettingsTabId } from '@/lib/navigation';
import { USER_ROLE_LABEL } from '@/lib/labels';
import { api } from '@/services/api';
import type { School } from '@/types';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHead,
  Checkbox,
  Field,
  LoadingState,
  Notice,
  PageHead,
  Select,
  Split,
  TextInput,
} from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/Modal';
import { AcademicPanel } from './panels/AcademicPanel';
import { ClassPanel } from './panels/ClassPanel';
import { ConfigCategoryPanel } from './panels/ConfigCategoryPanel';
import { CustomFieldPanel } from './panels/CustomFieldPanel';

type AppSettings = Record<string, unknown>;

/** Tab 1 — Thông tin trường. */
function SchoolPanel() {
  const { toast, toastError } = useToast();
  const { data, loading, refetch } = useApiQuery<School>('/academic/school');
  const [form, setForm] = useState({
    name: '',
    code: '',
    address: '',
    reporter: '',
    reporterTitle: 'Tổng phụ trách Đội',
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setForm({
      name: data.name,
      code: data.code ?? '',
      address: data.address ?? '',
      reporter: data.reporter ?? '',
      reporterTitle: data.reporterTitle,
    });
  }, [data]);

  const save = async () => {
    setBusy(true);
    try {
      await api.patch('/academic/school', form);
      toast('Đã lưu thông tin trường');
      void refetch();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <Card>
      <CardHead title="Thông tin trường" />
      <CardBody>
        {data?.isSample ? (
          <Notice tone="warn" className="mb-3">
            Trường đang dùng tên mẫu. Hãy nhập tên trường thật — thông tin này xuất hiện trên mọi báo cáo.
          </Notice>
        ) : null}
        <div className="form-grid">
          <Field label="Tên trường" required full>
            <TextInput
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={200}
            />
          </Field>
          <Field label="Mã trường">
            <TextInput value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </Field>
          <Field label="Địa chỉ">
            <TextInput
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
          <Field label="Người lập báo cáo">
            <TextInput
              value={form.reporter}
              onChange={(e) => setForm({ ...form, reporter: e.target.value })}
            />
          </Field>
          <Field label="Chức danh">
            <TextInput
              value={form.reporterTitle}
              onChange={(e) => setForm({ ...form, reporterTitle: e.target.value })}
            />
          </Field>
        </div>
        <Button variant="primary" className="mt-3" loading={busy} onClick={() => void save()}>
          Lưu thông tin
        </Button>
      </CardBody>
    </Card>
  );
}

/** Tab 12 — Giao diện và khổ in. */
function AppearancePanel({
  settings,
  onSaved,
}: {
  settings: AppSettings;
  onSaved: () => void;
}) {
  const { toast, toastError } = useToast();
  const [paper, setPaper] = useState(String(settings.paper_orientation ?? 'landscape'));
  const [compact, setCompact] = useState(settings.compact_mode !== false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api.put('/settings', { paper_orientation: paper, compact_mode: compact });
      document.body.dataset.paper = paper;
      toast('Đã lưu giao diện và khổ in');
      onSaved();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHead title="Giao diện và in" />
      <CardBody>
        <div className="form-grid">
          <Field label="Khổ in báo cáo">
            <Select value={paper} onChange={(e) => setPaper(e.target.value)}>
              <option value="landscape">A4 ngang</option>
              <option value="portrait">A4 dọc</option>
            </Select>
          </Field>
          <Checkbox
            label="Chế độ hiển thị gọn"
            checked={compact}
            onChange={(e) => setCompact(e.target.checked)}
          />
        </div>
        <Button variant="primary" className="mt-3" loading={busy} onClick={() => void save()}>
          Lưu giao diện
        </Button>
      </CardBody>
    </Card>
  );
}

/** Tab 13 — Dữ liệu, giới hạn tệp và ngưỡng cảnh báo. */
function DataPanel({ settings, onSaved }: { settings: AppSettings; onSaved: () => void }) {
  const { toast, toastError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [maxFileMb, setMaxFileMb] = useState(String(settings.max_file_mb ?? 25));
  const [low, setLow] = useState(String(settings.storage_warning_low ?? 70));
  const [high, setHigh] = useState(String(settings.storage_warning_high ?? 85));
  const [critical, setCritical] = useState(String(settings.storage_warning_critical ?? 95));
  const [busy, setBusy] = useState(false);
  const [sampleOpen, setSampleOpen] = useState(false);

  const sampleQuery = useApiQuery<{ total: number; present: boolean; classes: number; tasks: number }>(
    '/settings/sample/status',
  );

  const save = async () => {
    if (!(Number(low) < Number(high) && Number(high) < Number(critical))) {
      toast('Ba ngưỡng phải tăng dần: sớm < cao < nguy cấp.', 'bad');
      return;
    }
    setBusy(true);
    try {
      await api.put('/settings', {
        max_file_mb: Number(maxFileMb),
        storage_warning_low: Number(low),
        storage_warning_high: Number(high),
        storage_warning_critical: Number(critical),
      });
      toast('Đã lưu giới hạn tệp và ngưỡng dung lượng');
      onSaved();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const deleteSample = async () => {
    setBusy(true);
    try {
      const result = await api.delete<Record<string, number>>('/settings/sample');
      toast(
        `Đã xóa dữ liệu mẫu: ${result.classes} lớp, ${result.tasks} công việc, ${result.criteria} tiêu chí.`,
      );
      setSampleOpen(false);
      void sampleQuery.refetch();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const exportConfig = () => void api.download('/config/export', undefined, 'cau-hinh.json');

  const importConfig = async (file: File) => {
    setBusy(true);
    try {
      const payload = JSON.parse(await file.text()) as Record<string, unknown>;
      const result = await api.post<{ imported: number }>('/config/import', payload);
      toast(`Đã nhập ${result.imported} mục cấu hình`);
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3 tablet:grid-cols-1">
        <Card>
          <CardHead title="Cấu hình danh mục" />
          <CardBody>
            <p className="m-0 mb-2 text-[12.5px] text-muted">
              Xuất/nhập toàn bộ danh mục và trường tùy chỉnh để dùng lại ở trường khác.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button icon={<Download size={15} aria-hidden />} onClick={exportConfig}>
                Xuất cấu hình
              </Button>
              <Button
                icon={<Upload size={15} aria-hidden />}
                loading={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                Nhập cấu hình
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept=".json,application/json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importConfig(file);
                  e.target.value = '';
                }}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Dữ liệu mẫu" />
          <CardBody>
            {sampleQuery.data?.present ? (
              <>
                <p className="m-0 mb-2 text-[12.5px]">
                  Hệ thống đang có <strong>{sampleQuery.data.total}</strong> bản ghi mẫu (lớp, tiêu
                  chí, công việc) từ lúc khởi tạo.
                </p>
                <Button
                  variant="danger"
                  icon={<Trash2 size={15} aria-hidden />}
                  onClick={() => setSampleOpen(true)}
                >
                  Xóa dữ liệu mẫu
                </Button>
              </>
            ) : (
              <p className="m-0 text-[12.5px] text-muted">Không còn dữ liệu mẫu trong hệ thống.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-3">
        <CardHead title="Giới hạn tệp và cảnh báo dung lượng" />
        <CardBody>
          <div className="form-grid">
            <Field label="Dung lượng tối đa mỗi tệp (MB)">
              <TextInput
                type="number"
                min={1}
                max={250}
                value={maxFileMb}
                onChange={(e) => setMaxFileMb(e.target.value)}
              />
            </Field>
            <Field label="Cảnh báo sớm (%)">
              <TextInput type="number" min={50} max={90} value={low} onChange={(e) => setLow(e.target.value)} />
            </Field>
            <Field label="Cảnh báo cao (%)">
              <TextInput type="number" min={60} max={95} value={high} onChange={(e) => setHigh(e.target.value)} />
            </Field>
            <Field label="Cảnh báo nguy cấp (%)">
              <TextInput
                type="number"
                min={70}
                max={99}
                value={critical}
                onChange={(e) => setCritical(e.target.value)}
              />
            </Field>
          </div>
          <Button variant="primary" className="mt-3" loading={busy} onClick={() => void save()}>
            Lưu giới hạn
          </Button>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={sampleOpen}
        title="Xóa dữ liệu mẫu"
        loading={busy}
        confirmLabel="Xóa dữ liệu mẫu"
        description={
          <Notice tone="warn">
            Xóa mềm các lớp, bộ tiêu chí và công việc được tạo lúc khởi tạo hệ thống. Nếu lớp mẫu đã
            có điểm thi đua, hệ thống sẽ từ chối để bảo toàn dữ liệu.
          </Notice>
        }
        onCancel={() => setSampleOpen(false)}
        onConfirm={() => void deleteSample()}
      />
    </>
  );
}

/** Tab 14 — Khóa phiên và tài khoản. */
function SecurityPanel() {
  const { user, logout, refreshUser } = useAuth();
  const { toast, toastError } = useToast();
  const [minutes, setMinutes] = useState(String(user?.autoLockMinutes ?? 10));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api.patch('/auth/auto-lock', { autoLockMinutes: Number(minutes) });
      await refreshUser();
      toast(`Đã đặt tự khóa sau ${minutes} phút.`);
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3 tablet:grid-cols-1">
      <Card>
        <CardHead title="Khóa phiên làm việc" />
        <CardBody>
          <Field label="Tự khóa khi không hoạt động">
            <Select value={minutes} onChange={(e) => setMinutes(e.target.value)}>
              {[5, 10, 15, 30].map((value) => (
                <option key={value} value={value}>
                  {value} phút
                </option>
              ))}
            </Select>
          </Field>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" loading={busy} onClick={() => void save()}>
              Lưu thời gian
            </Button>
            <Button onClick={() => void logout()}>Đăng xuất</Button>
          </div>
          <Notice className="mt-3">
            Khác với bản cũ, mật khẩu nay được băm bcrypt và kiểm tra ở máy chủ. Mã nguồn giao diện
            công khai không còn chứa mật khẩu.
          </Notice>
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Tài khoản đang đăng nhập" />
        <CardBody>
          <Split label="Họ và tên">{user?.fullName}</Split>
          <Split label="Tên đăng nhập">
            <code className="text-[12px]">{user?.username}</code>
          </Split>
          <Split label="Vai trò">
            <Badge tone="blue">{user ? USER_ROLE_LABEL[user.role] : '—'}</Badge>
          </Split>
          <Split label="Đăng nhập gần nhất">
            {user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('vi-VN') : 'Lần đầu'}
          </Split>
          <Button className="mt-3" onClick={() => (window.location.href = '/doi-mat-khau')}>
            Đổi mật khẩu
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  const scope = useScope();
  const [tab, setTab] = useState<SettingsTabId>('school');
  const settingsQuery = useApiQuery<AppSettings>('/settings');

  const renderPanel = useCallback(() => {
    if (tab === 'school') return <SchoolPanel />;
    if (tab === 'context') {
      return (
        <>
          <AcademicPanel />
          <ConfigCategoryPanel categoryKeys={SETTINGS_CONFIG_KEYS.context ?? []} />
          <CustomFieldPanel entity="plans" />
        </>
      );
    }
    if (tab === 'classes') return <ClassPanel />;
    if (tab === 'competition') {
      return (
        <Card>
          <CardHead title="Bộ tiêu chí thi đua" />
          <CardBody>
            <p className="m-0 mb-2 text-[12.5px]">
              Quản lý nhiều bộ theo năm học, học kỳ, cơ sở, hiệu lực và phiên bản. Bộ đã có điểm chỉ
              được tạo phiên bản mới.
            </p>
            <Button variant="primary" onClick={() => (window.location.href = '/scores')}>
              Mở trình quản lý bộ tiêu chí
            </Button>
          </CardBody>
        </Card>
      );
    }
    if (tab === 'appearance') {
      return (
        <AppearancePanel
          settings={settingsQuery.data ?? {}}
          onSaved={() => void settingsQuery.refetch()}
        />
      );
    }
    if (tab === 'data') {
      return (
        <DataPanel settings={settingsQuery.data ?? {}} onSaved={() => void settingsQuery.refetch()} />
      );
    }
    if (tab === 'security') return <SecurityPanel />;

    // Các tab còn lại là danh mục cấu hình + trường tùy chỉnh tương ứng.
    const keys = SETTINGS_CONFIG_KEYS[tab] ?? [];
    const entity = SETTINGS_CUSTOM_ENTITY[tab];
    return (
      <>
        {keys.length > 0 ? <ConfigCategoryPanel categoryKeys={keys} /> : null}
        {entity ? <CustomFieldPanel entity={entity} /> : null}
      </>
    );
  }, [tab, settingsQuery]);

  if (!scope.ready || settingsQuery.loading) return <LoadingState />;

  return (
    <>
      <PageHead
        title="Trung tâm cấu hình"
        description="Điều chỉnh ứng dụng theo quy trình của từng trường mà không sửa mã nguồn."
      />

      <div className="grid grid-cols-[260px_1fr] gap-3 tablet:grid-cols-1">
        <nav
          aria-label="Nhóm cấu hình"
          className="sticky top-0 h-fit space-y-0.5 rounded-card border border-line bg-card p-2 tablet:static tablet:flex tablet:gap-1 tablet:overflow-x-auto tablet:space-y-0"
        >
          {SETTINGS_TABS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cx(
                'block w-full rounded-control px-2.5 py-2 text-left text-[12.5px] transition-colors tablet:w-auto tablet:min-w-[180px] tablet:shrink-0',
                tab === item.id ? 'bg-blue text-white font-semibold' : 'hover:bg-blue-soft',
              )}
            >
              {index + 1}. {item.label}
            </button>
          ))}
        </nav>

        <section className="min-w-0">{renderPanel()}</section>
      </div>
    </>
  );
}
