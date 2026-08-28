'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/services/api';

interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: unknown;
  /** Nạp lại dữ liệu, ví dụ sau khi lưu hoặc xóa. */
  refetch: () => Promise<void>;
  setData: (value: T | null) => void;
}

type QueryParams = Record<string, string | number | boolean | null | undefined>;

/**
 * Hook lấy dữ liệu tối giản: theo dõi loading/error, tự hủy request cũ
 * và cung cấp refetch. Không dùng thư viện ngoài để giữ bundle gọn.
 */
export function useApiQuery<T>(
  path: string | null,
  params?: QueryParams,
  options: { enabled?: boolean } = {},
): QueryState<T> {
  const enabled = options.enabled !== false && path !== null;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<unknown>(null);

  const controllerRef = useRef<AbortController | null>(null);
  // So sánh tham số bằng chuỗi hoá để tránh vòng lặp khi object được tạo mới mỗi lần render.
  const paramsKey = JSON.stringify(params ?? {});

  const run = useCallback(async () => {
    if (!enabled || !path) {
      setLoading(false);
      return;
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const result = await api.get<T>(path, JSON.parse(paramsKey) as QueryParams, controller.signal);
      if (!controller.signal.aborted) setData(result);
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') setError(err);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [enabled, path, paramsKey]);

  useEffect(() => {
    void run();
    return () => controllerRef.current?.abort();
  }, [run]);

  return { data, loading, error, refetch: run, setData };
}

/** Biến thể trả kèm `meta` phân trang. */
export function useApiList<T>(
  path: string | null,
  params?: QueryParams,
  options: { enabled?: boolean } = {},
) {
  const enabled = options.enabled !== false && path !== null;
  const [data, setData] = useState<T[]>([]);
  const [meta, setMeta] = useState<{ total: number; page: number; pageSize: number; pageCount: number } | null>(
    null,
  );
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<unknown>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const paramsKey = JSON.stringify(params ?? {});

  const run = useCallback(async () => {
    if (!enabled || !path) {
      setLoading(false);
      return;
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const result = await api.getWithMeta<T[]>(
        path,
        JSON.parse(paramsKey) as QueryParams,
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setData(result.data);
        setMeta(result.meta ?? null);
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') setError(err);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [enabled, path, paramsKey]);

  useEffect(() => {
    void run();
    return () => controllerRef.current?.abort();
  }, [run]);

  return { data, meta, loading, error, refetch: run };
}

/** Chống dội cho ô tìm kiếm; mặc định 200 ms như bản gốc. */
export function useDebounced<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
