'use client';

import { Suspense } from 'react';
import { EntityPage } from '@/components/entity/EntityPage';
import { ENTITY_CONFIGS } from '@/components/entity/entity.config';
import { EquipmentLedgerPanel } from '@/components/records/EquipmentLedgerPanel';
import { LoadingState } from '@/components/ui';

/** Trang dùng chung bộ CRUD chuẩn; cấu hình nằm ở entity.config.ts. */
export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <EntityPage
        config={ENTITY_CONFIGS.equipment!}
        rowDetail={{
          label: 'Mượn–trả',
          title: (row) => `Sổ mượn–trả — ${String(row.name ?? '')}`,
          render: (row) => (
            <EquipmentLedgerPanel
              equipmentId={row.id}
              equipmentName={String(row.name ?? '')}
              totalQuantity={Number(row.quantity ?? 0)}
            />
          ),
        }}
      />
    </Suspense>
  );
}
