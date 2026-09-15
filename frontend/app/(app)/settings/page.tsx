'use client';

import {
  Building2,
  Download,
  KeyRound,
  Palette,
  Save,
  ShieldCheck,
  Sliders,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { useScope } from '@/hooks/useScope';
import { useToast } from '@/hooks/useToast';
import { cx } from '@/lib/format';
import { SETTINGS_CONFIG_KEYS, SETTINGS_CUSTOM_ENTITY, SETTINGS_TABS, type SettingsTabId } from '@/lib/navigation';
import { USER_ROLE_LABEL } from '@/lib/labels';
import { api } from '@/services/api';
import type { School } from '@/types';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHead,
  Field,
  LoadingState,
  Notice,
  PageHead,
  Select,
  Split,
  Switch,
  TextInput,
} from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/Modal';
import { AcademicPanel } from './panels/AcademicPanel';
import { ClassPanel } from './panels/ClassPanel';
import { HomeroomTeacherPanel } from './panels/HomeroomTeacherPanel';
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
      <CardHead
        title="Thông tin trường"
        icon={<Building2 size={16} aria-hidden />}
        description="Những thông tin này xuất hiện trên mọi báo cáo và mẫu in."
      />
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
        <Button
          variant="primary"
          className="mt-4"
          icon={<Save size={15} aria-hidden />}
          loading={busy}
          onClick={() => void save()}
        >
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
      <CardHead
        title="Giao diện và khổ in"
        icon={<Palette size={16} aria-hidden />}
        description="Áp dụng cho toàn bộ tài khoản trên thiết bị này."
      />
      <CardBody>
        <div className="form-grid">
          <Field
            label="Khổ in báo cáo"
            hint="A4 ngang hợp với bảng nhiều cột như bảng thi đua."
          >
            <Select value={paper} onChange={(e) => setPaper(e.target.value)}>
              <option value="landscape">A4 ngang</option>
              <option value="portrait">A4 dọc</option>
            </Select>
          </Field>

          <div className="flex flex-col justify-center">
            <Switch
              checked={compact}
              onCheckedChange={setCompact}
              label="Chế độ hiển thị gọn"
            />
            <p className="mt-1.5 text-xs text-neutral-500">
              Giảm khoảng cách giữa các dòng để xem được nhiều bản ghi hơn trên một màn hình.
            </p>
          </div>
        </div>
        <Button
          variant="primary"
          className="mt-4"
          icon={<Save size={15} aria-hidden />}
          loading={busy}
          onClick={() => void save()}
        >
          Lưu giao diện
        </Button>
      </CardBody>
    </Card>
  );
}

/** Tab 13 — Dữ liệu, giới hạn tệp và ngưỡng cảnh báo. */
function DataPanel({ settings, onSaved }: { settings: AppSettings; onSaved: () => void }) {
  const { toast, toastError } = useToast();
  const { user } = useAuth();
  /** Xóa dữ liệu mẫu là thao tác toàn cục, máy chủ chỉ cho ADMIN. */
  const isAdmin = user?.role === 'ADMIN';
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

  const confirm = useConfirm();

  const exportConfig = async () => {
    try {
      await api.download('/config/export', undefined, 'cau-hinh.json');
      toast('Đã xuất và tải tệp cấu hình.');
    } catch (err) {
      toastError(err);
    }
  };

  const importConfig = async (file: File) => {
    const ok = await confirm({
      title: 'Nhập cấu hình',
      description:
        'Nhập tệp cấu hình này sẽ ghi đè và bổ sung các danh mục, trường tùy chỉnh hiện có. Bạn có chắc muốn tiếp tục?',
      confirmLabel: 'Nhập cấu hình',
      tone: 'primary',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const payload = JSON.parse(await file.text()) as Record<string, unknown>;
      const result = await api.post<{ imported: number }>('/config/import', payload);
      toast(`Đã nhập ${result.imported} mục cấu hình`);
      onSaved();
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
            <p className="m-0 mb-2 text-sm text-muted">
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
                <p className="m-0 mb-2 text-sm">
                  Hệ thống đang có <strong>{sampleQuery.data.total}</strong> bản ghi mẫu (lớp, tiêu
                  chí, công việc) từ lúc khởi tạo.
                </p>
                <Button
                  variant="danger"
                  icon={<Trash2 size={15} aria-hidden />}
                  disabled={!isAdmin}
                  title={isAdmin ? undefined : 'Chỉ quản trị viên được xóa dữ liệu mẫu'}
                  onClick={() => setSampleOpen(true)}
                >
                  Xóa dữ liệu mẫu
                </Button>
              </>
            ) : (
              <p className="m-0 text-sm text-muted">Không còn dữ liệu mẫu trong hệ thống.</p>
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
  const router = useRouter();
  const { user, refreshUser } = useAuth();
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
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHead
          title="Khóa phiên làm việc"
          icon={<ShieldCheck size={16} aria-hidden />}
          description="Bảo vệ dữ liệu khi thiết bị bị bỏ quên ở phòng làm việc."
        />
        <CardBody>
          <Field
            label="Tự khóa khi không hoạt động"
            hint="Khóa màn hình nhưng giữ nguyên dữ liệu đang mở; chỉ cần nhập lại mật khẩu."
          >
            <Select value={minutes} onChange={(e) => setMinutes(e.target.value)}>
              {[5, 10, 15, 30].map((value) => (
                <option key={value} value={value}>
                  {value} phút
                </option>
              ))}
            </Select>
          </Field>
          <Button
            variant="primary"
            className="mt-4"
            icon={<Save size={15} aria-hidden />}
            loading={busy}
            onClick={() => void save()}
          >
            Lưu thời gian
          </Button>
          <Notice className="mt-4">
            Mật khẩu được băm bcrypt và kiểm tra ở máy chủ; mã nguồn giao diện công khai không
            chứa mật khẩu.
          </Notice>
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Tài khoản đang đăng nhập" icon={<KeyRound size={16} aria-hidden />} />
        <CardBody>
          <div className="mb-3 flex items-center gap-3 rounded-md border border-line bg-neutral-25 p-3">
            <Avatar name={user?.fullName ?? user?.username} size={40} />
            <div className="min-w-0">
              <p className="m-0 truncate text-lg font-semibold text-ink">{user?.fullName}</p>
              <p className="m-0 truncate text-xs text-neutral-500">@{user?.username}</p>
            </div>
            <Badge tone="blue" className="ml-auto shrink-0">
              {user ? USER_ROLE_LABEL[user.role] : '—'}
            </Badge>
          </div>

          <Split label="Đăng nhập gần nhất">
            {user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('vi-VN') : 'Lần đầu'}
          </Split>
          <Split label="Tự khóa sau">{user?.autoLockMinutes ?? 10} phút không thao tác</Split>

          <Button
            className="mt-4"
            icon={<KeyRound size={15} aria-hidden />}
            onClick={() => router.push('/doi-mat-khau')}
          >
            Đổi mật khẩu
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
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
    if (tab === 'classes')
      return (
        <>
          <ClassPanel />
          <div className="mt-3">
            <HomeroomTeacherPanel />
          </div>
        </>
      );
    if (tab === 'competition') {
      return (
        <Card>
          <CardHead title="Bộ tiêu chí thi đua" icon={<Star size={16} aria-hidden />} />
          <CardBody>
            <p className="m-0 mb-3 max-w-[70ch] text-base leading-relaxed text-neutral-600">
              Quản lý nhiều bộ tiêu chí theo năm học, học kỳ, cơ sở, hiệu lực và phiên bản.
              Bộ tiêu chí đã có điểm chỉ được tạo phiên bản mới để không làm sai lệch số liệu cũ.
            </p>
            <Button variant="primary" onClick={() => router.push('/scores')}>
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
  }, [tab, settingsQuery, router]);

  const activeTabLabel = SETTINGS_TABS.find((item) => item.id === tab)?.label;

  if (!scope.ready || (settingsQuery.loading && !settingsQuery.data)) return <LoadingState />;

  return (
    <>
      <PageHead
        eyebrow={activeTabLabel}
        title="Trung tâm cấu hình"
        description="Điều chỉnh ứng dụng theo quy trình của từng trường mà không cần sửa mã nguồn."
      />

      <div className="grid grid-cols-[268px_1fr] gap-4 tablet:grid-cols-1">
        <nav
          aria-label="Nhóm cấu hình"
          className="sticky top-0 h-fit rounded-lg border border-line bg-card p-2 shadow-xs tablet:static tablet:flex tablet:gap-1 tablet:overflow-x-auto tablet:p-1.5 no-scrollbar"
        >
          <p className="px-2.5 pb-1.5 pt-1 text-2xs font-bold uppercase tracking-[0.06em] text-neutral-400 tablet:hidden">
            <Sliders size={12} className="mr-1 inline" aria-hidden />
            14 nhóm cấu hình
          </p>

          {SETTINGS_TABS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-current={tab === item.id ? 'page' : undefined}
              className={cx(
                'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors tablet:w-auto tablet:min-w-[170px] tablet:shrink-0',
                tab === item.id
                  ? 'bg-brand-50 font-semibold text-brand-700'
                  : 'text-neutral-700 hover:bg-neutral-100',
              )}
            >
              <span
                aria-hidden
                className={cx(
                  'grid h-5 w-5 shrink-0 place-items-center rounded-sm text-2xs font-bold tabular-nums',
                  tab === item.id ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-500',
                )}
              >
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 leading-snug">{item.label}</span>
            </button>
          ))}
        </nav>

        <section className="min-w-0 space-y-4">{renderPanel()}</section>
      </div>
    </>
  );
}
