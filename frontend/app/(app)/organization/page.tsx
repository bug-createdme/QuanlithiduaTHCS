'use client';

import { Suspense } from 'react';
import { EntityPage } from '@/components/entity/EntityPage';
import { ENTITY_CONFIGS } from '@/components/entity/entity.config';
import { TrainingRecordsPanel } from '@/components/records/TrainingRecordsPanel';
import { LoadingState } from '@/components/ui';

/** Trang dùng chung bộ CRUD chuẩn; cấu hình nằm ở entity.config.ts. */
export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <EntityPage
        config={ENTITY_CONFIGS.organization!}
        rowDetail={{
          label: 'Bồi dưỡng',
          title: (row) => `Sổ bồi dưỡng — ${String(row.name ?? '')}`,
          render: (row) => (
            <TrainingRecordsPanel teamMemberId={row.id} memberName={String(row.name ?? '')} />
          ),
        }}
      />
    </Suspense>
  );
}
