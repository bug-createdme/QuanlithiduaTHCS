'use client';

import { Suspense } from 'react';
import { EntityPage } from '@/components/entity/EntityPage';
import { ENTITY_CONFIGS } from '@/components/entity/entity.config';
import { LoadingState } from '@/components/ui';

/** Trang dùng chung bộ CRUD chuẩn; cấu hình nằm ở entity.config.ts. */
export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <EntityPage config={ENTITY_CONFIGS.organization!} />
    </Suspense>
  );
}
