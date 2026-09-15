'use client';

import { Link2, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/hooks/useToast';
import { fmtDate } from '@/lib/format';
import { TASK_STATUS_LABEL } from '@/lib/labels';
import { api } from '@/services/api';
import type { DependencyType, TaskBrief, TaskDependencyView } from '@/types';
import {
  Badge,
  Button,
  LinkButton,
  LoadingState,
  Notice,
  Select,
  TableEmptyRow,
  TableWrap,
} from '@/components/ui';

/**
 * Phụ thuộc giữa các công việc (bảng `task_dependencies`).
 *
 * Hiển thị hai chiều: việc này đang chờ việc nào, và việc nào đang chờ nó.
 * Máy chủ tự chặn vòng lặp nên ở đây chỉ cần hiện lại thông báo cho người dùng.
 */

const TYPE_LABEL: Record<DependencyType, string> = {
  FINISH_TO_START: 'Xong trước – mới bắt đầu',
  START_TO_START: 'Bắt đầu cùng lúc',
};

function TaskLine({ task }: { task: TaskBrief }) {
  return (
    <>
      <span className="wrap">{task.title}</span>
      <div className="mt-0.5 text-xs text-muted">
        {TASK_STATUS_LABEL[task.status] ?? task.status} • hạn {fmtDate(task.dueDate)}
      </div>
    </>
  );
}

export function TaskDependencies({ taskId }: { taskId: string }) {
  const { toast, toastError } = useToast();
  const confirm = useConfirm();
  const { data, loading, error, refetch } = useApiQuery<TaskDependencyView>('/task-dependencies', {
    taskId,
  });
  const candidatesQuery = useApiQuery<TaskBrief[]>('/task-dependencies/candidates', { taskId });

  const [picked, setPicked] = useState('');
  const [type, setType] = useState<DependencyType>('FINISH_TO_START');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    void refetch();
    void candidatesQuery.refetch();
  }, [refetch, candidatesQuery]);

  const add = useCallback(async () => {
    if (!picked) return;
    setBusy(true);
    try {
      await api.post('/task-dependencies', { taskId, dependsOnId: picked, type });
      toast('Đã thêm việc phải chờ');
      setPicked('');
      reload();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }, [picked, type, taskId, toast, toastError, reload]);

  const remove = useCallback(
    async (dep: TaskDependencyView['dependsOn'][number]) => {
      const ok = await confirm({
        title: 'Bỏ liên kết phụ thuộc',
        description: `Bạn có chắc muốn bỏ liên kết phụ thuộc với công việc "${dep.dependsOn.title}" không?`,
        confirmLabel: 'Bỏ liên kết',
        tone: 'danger',
      });
      if (!ok) return;
      setBusy(true);
      try {
        await api.delete(`/task-dependencies/${dep.id}`);
        toast('Đã bỏ liên kết phụ thuộc');
        reload();
      } catch (err) {
        toastError(err);
      } finally {
        setBusy(false);
      }
    },
    [confirm, toast, toastError, reload],
  );

  if (loading && !data) return <LoadingState />;
  if (error) return <Notice tone="warn">Không tải được danh sách phụ thuộc.</Notice>;

  const view = data ?? { dependsOn: [], blocking: [], blockedBy: 0 };
  const candidates = candidatesQuery.data ?? [];

  return (
    <div className="full">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="field-label mb-0 flex items-center gap-1.5">
          <Link2 size={14} aria-hidden />
          Việc phải chờ xong trước
        </span>
        {view.blockedBy > 0 ? (
          <Badge tone="yellow">Đang chờ {view.blockedBy} việc chưa xong</Badge>
        ) : view.dependsOn.length > 0 ? (
          <Badge tone="green">Các việc phải chờ đã xong</Badge>
        ) : null}
      </div>

      <TableWrap>
        <thead>
          <tr>
            <th>Công việc phải chờ</th>
            <th className="w-[190px]">Kiểu liên kết</th>
            <th className="w-[80px]">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {view.dependsOn.length === 0 ? (
            <TableEmptyRow colSpan={3}>Công việc này không chờ việc nào khác.</TableEmptyRow>
          ) : (
            view.dependsOn.map((dep) => (
              <tr key={dep.id}>
                <td>
                  <TaskLine task={dep.dependsOn} />
                </td>
                <td>{TYPE_LABEL[dep.type]}</td>
                <td>
                  <LinkButton tone="red" disabled={busy} onClick={() => void remove(dep)}>
                    Bỏ
                  </LinkButton>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableWrap>

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <Select
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
          className="min-w-[220px] flex-1"
          aria-label="Chọn công việc phải chờ"
        >
          <option value="">— Chọn công việc phải chờ —</option>
          {candidates.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
        </Select>
        <Select
          value={type}
          onChange={(e) => setType(e.target.value as DependencyType)}
          className="w-auto"
          aria-label="Kiểu liên kết"
        >
          {(Object.keys(TYPE_LABEL) as DependencyType[]).map((key) => (
            <option key={key} value={key}>
              {TYPE_LABEL[key]}
            </option>
          ))}
        </Select>
        <Button
          size="sm"
          icon={<Plus size={14} aria-hidden />}
          disabled={!picked || busy}
          onClick={() => void add()}
        >
          Thêm
        </Button>
      </div>

      {view.blocking.length > 0 ? (
        <div className="mt-3">
          <span className="field-label">Việc khác đang chờ công việc này</span>
          <ul className="m-0 list-none space-y-1 p-0">
            {view.blocking.map((dep) => (
              <li key={dep.id} className="text-base">
                <TaskLine task={dep.task} />
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-muted">
            Hoãn hoặc xóa công việc này sẽ ảnh hưởng tới {view.blocking.length} việc ở trên.
          </p>
        </div>
      ) : null}
    </div>
  );
}
