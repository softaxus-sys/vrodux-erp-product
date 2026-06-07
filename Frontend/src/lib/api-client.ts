/**
 * Lightweight fetch wrapper that:
 *  - Injects the JWT Bearer token from the Zustand auth store
 *  - Unwraps the backend's { success, data, message, errorCode } envelope
 *  - Handles 401 → token refresh → single retry
 *  - Throws ApiError on HTTP / business errors
 */

import { useAuthStore } from "@/store/auth.store";

// ── Backend envelope types ────────────────────────────────────────────────────

export interface BackendResponse<T> {
  success: boolean;
  data: T | null;
  message: string | null;
  errorCode: string | null;
  traceId: string;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ── Error type ────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string | null,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const IDENTITY_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

// ── Token refresh (called inline, not via auth.api to avoid circular import) ──

async function doRefresh(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${IDENTITY_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: refreshToken }),
    });
    if (!res.ok) return null;
    const body: BackendResponse<{ accessToken: string; refreshToken: string }> =
      await res.json();
    if (!body.success || !body.data) return null;

    // Persist both tokens back into the store
    const store = useAuthStore.getState();
    store.setToken(body.data.accessToken);
    store.setRefreshToken(body.data.refreshToken);
    return body.data.accessToken;
  } catch {
    return null;
  }
}

// ── Core fetch function ───────────────────────────────────────────────────────

async function request<T>(
  url: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const { token, refreshToken, logout } = useAuthStore.getState();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });

  // 401 → try refresh once
  if (res.status === 401 && !isRetry && refreshToken) {
    const newToken = await doRefresh(refreshToken);
    if (newToken) {
      return request<T>(url, options, true);
    }
    logout();
    throw new ApiError(401, "unauthorized", "Session expired. Please log in again.");
  }

  const body: BackendResponse<T> = await res.json().catch(() => ({
    success: false,
    data: null,
    message: res.statusText,
    errorCode: null,
    traceId: "",
  }));

  if (!res.ok || !body.success) {
    throw new ApiError(
      res.status,
      body.errorCode ?? null,
      body.message ?? `HTTP ${res.status}`
    );
  }

  return body.data as T;
}

// ── Public helpers ────────────────────────────────────────────────────────────

export const apiClient = {
  get: <T>(url: string) => request<T>(url),

  post: <T>(url: string, data?: unknown) =>
    request<T>(url, {
      method: "POST",
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }),

  put: <T>(url: string, data?: unknown) =>
    request<T>(url, {
      method: "PUT",
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};

// ── Raw client — for services that return plain JSON (no BackendResponse envelope) ──
// Used by HR, Finance, Sales, Purchase controllers.

async function rawRequest<T>(
  url: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const { token, refreshToken, logout } = useAuthStore.getState();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401 && !isRetry && refreshToken) {
    const newToken = await doRefresh(refreshToken);
    if (newToken) return rawRequest<T>(url, options, true);
    logout();
    throw new ApiError(401, "unauthorized", "Session expired. Please log in again.");
  }

  if (!res.ok) {
    let errorMsg = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody?.error) errorMsg = errBody.error;
      else if (errBody?.title) errorMsg = errBody.title;
    } catch { /* ignore */ }
    throw new ApiError(res.status, null, errorMsg);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const rawApiClient = {
  get:    <T>(url: string)                    => rawRequest<T>(url),
  post:   <T>(url: string, data?: unknown)    => rawRequest<T>(url, { method: "POST",   body: data !== undefined ? JSON.stringify(data) : undefined }),
  put:    <T>(url: string, data?: unknown)    => rawRequest<T>(url, { method: "PUT",    body: data !== undefined ? JSON.stringify(data) : undefined }),
  patch:  <T>(url: string, data?: unknown)    => rawRequest<T>(url, { method: "PATCH",  body: data !== undefined ? JSON.stringify(data) : undefined }),
  delete: <T>(url: string)                    => rawRequest<T>(url, { method: "DELETE" }),
};
