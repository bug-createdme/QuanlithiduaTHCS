/**
 * Lớp giao tiếp REST duy nhất của ứng dụng.
 * Toàn bộ dữ liệu nghiệp vụ đi qua đây — không có IndexedDB, không localStorage.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

/** Access token chỉ nằm trong bộ nhớ; refresh token nằm ở cookie HttpOnly. */
let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export interface FieldIssue {
  field: string;
  message: string;
}

/** Lỗi API đã được phân loại, mang thông điệp tiếng Việt hiển thị được ngay. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues?: FieldIssue[];
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    issues?: FieldIssue[],
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.issues = issues;
    this.details = details;
  }

  /** Thông điệp gắn kèm một trường cụ thể, dùng để hiện lỗi cạnh input. */
  issueFor(field: string): string | undefined {
    return this.issues?.find((i) => i.field === field)?.message;
  }
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string; issues?: FieldIssue[]; details?: Record<string, unknown> };
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  /** Bỏ qua vòng làm mới token — dùng cho chính điểm cuối refresh. */
  skipRefresh?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(BASE_URL + path, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === null || value === undefined || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

let refreshPromise: Promise<boolean> | null = null;

/** Làm mới access token; nhiều lời gọi song song dùng chung một lượt refresh. */
async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) return false;
        const json = (await response.json()) as { data: { accessToken: string } };
        accessToken = json.data.accessToken;
        return true;
      } catch {
        return false;
      } finally {
        // Cho phép lượt refresh kế tiếp sau khi lượt này kết thúc.
        setTimeout(() => {
          refreshPromise = null;
        }, 0);
      }
    })();
  }
  return refreshPromise;
}

async function toApiError(response: Response): Promise<ApiError> {
  let payload: ErrorEnvelope = {};
  try {
    payload = (await response.json()) as ErrorEnvelope;
  } catch {
    /* phản hồi không phải JSON */
  }
  return new ApiError(
    response.status,
    payload.error?.code ?? 'INTERNAL_ERROR',
    payload.error?.message ?? 'Không thể kết nối máy chủ. Hãy kiểm tra kết nối mạng.',
    payload.error?.issues,
    payload.error?.details,
  );
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, skipRefresh } = options;

  const send = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (body !== undefined && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    return fetch(buildUrl(path, query), {
      method,
      credentials: 'include',
      headers,
      signal,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });
  };

  let response: Response;
  try {
    response = await send();
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'Mất kết nối tới máy chủ. Hãy kiểm tra mạng rồi thử lại.');
  }

  // Token hết hạn: làm mới một lần rồi phát lại đúng yêu cầu đó.
  if (response.status === 401 && !skipRefresh) {
    if (await refreshAccessToken()) {
      response = await send();
    } else {
      accessToken = null;
      onUnauthorized?.();
      throw await toApiError(response);
    }
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;

  const json = (await response.json()) as { data: T };
  return json.data;
}

/** Trả cả `data` và `meta` cho các điểm cuối có phân trang. */
async function requestWithMeta<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; meta?: { total: number; page: number; pageSize: number; pageCount: number } }> {
  const { method = 'GET', query, signal } = options;
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(buildUrl(path, query), {
    method,
    credentials: 'include',
    headers,
    signal,
  });

  if (response.status === 401 && (await refreshAccessToken())) {
    return requestWithMeta<T>(path, options);
  }
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as { data: T; meta?: never };
}

/** Tải tệp về máy — dùng blob để giữ đúng tên tệp từ Content-Disposition. */
async function download(path: string, query?: RequestOptions['query'], fallbackName = 'tai-lieu'): Promise<void> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(buildUrl(path, query), { credentials: 'include', headers });
  if (!response.ok) throw await toApiError(response);

  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const filename = match ? decodeURIComponent(match[1]!) : fallbackName;

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) =>
    request<T>(path, { method: 'GET', query, signal }),
  getWithMeta: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) =>
    requestWithMeta<T>(path, { method: 'GET', query, signal }),
  post: <T>(path: string, body?: unknown, query?: RequestOptions['query']) =>
    request<T>(path, { method: 'POST', body, query }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: 'POST', body: formData }),
  download,
  raw: request,
};
