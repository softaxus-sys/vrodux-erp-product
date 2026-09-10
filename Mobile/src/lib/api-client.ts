/**
 * Fetch wrapper for the Vrodux ApiGateway. Mirrors FrontendVite's
 * src/lib/api-client.ts (same backend envelope, same 401 -> refresh -> retry
 * behavior, same field-error extraction) so the two clients never drift on
 * how they talk to the same API.
 */
import { useAuthStore } from "@/store/auth.store";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:5000";

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
    message: string,
    /** Per-field validation messages, keyed by field name lower-cased. */
    public readonly fieldErrors: Record<string, string[]> = {}
  ) {
    super(message);
    this.name = "ApiError";
  }

  fieldError(field: string): string | undefined {
    return this.fieldErrors[field.toLowerCase()]?.[0];
  }

  get hasFieldErrors(): boolean {
    return Object.keys(this.fieldErrors).length > 0;
  }
}

/**
 * Pulls per-field messages out of the two validation shapes this backend
 * produces: ASP.NET model binding (`{ errors: { Name: [...] } }`) and
 * FluentValidation via ValidationBehavior (`{ failures: [{ propertyName,
 * errorMessage }] }`).
 */
function extractFieldErrors(body: Record<string, unknown> | null): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!body) return out;

  const add = (field: string, message: string) => {
    const key = field.toLowerCase();
    (out[key] ??= []).push(message);
  };

  const errors = body.errors as Record<string, unknown> | undefined;
  if (errors && typeof errors === "object" && !Array.isArray(errors)) {
    for (const [field, messages] of Object.entries(errors)) {
      if (Array.isArray(messages)) messages.forEach((m) => typeof m === "string" && add(field, m));
      else if (typeof messages === "string") add(field, messages);
    }
  }

  const failures = body.failures as unknown;
  if (Array.isArray(failures)) {
    for (const f of failures) {
      const item = f as Record<string, unknown>;
      const field = (item?.propertyName ?? item?.PropertyName) as string | undefined;
      const message = (item?.errorMessage ?? item?.ErrorMessage) as string | undefined;
      if (field && message) add(field, message);
    }
  }

  return out;
}

// ── Token refresh (mutex: rotating refresh tokens, dedupe concurrent 401s) ────

let activeRefresh: Promise<string | null> | null = null;

async function performRefresh(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: refreshToken }),
    });
    if (!res.ok) return null;
    const body: BackendResponse<{ accessToken: string; refreshToken: string }> = await res.json();
    if (!body.success || !body.data) return null;

    useAuthStore.getState().setAccessToken(body.data.accessToken);
    useAuthStore.getState().setRefreshToken(body.data.refreshToken);
    return body.data.accessToken;
  } catch {
    return null;
  }
}

function doRefresh(refreshToken: string): Promise<string | null> {
  if (activeRefresh) return activeRefresh;
  activeRefresh = performRefresh(refreshToken).finally(() => {
    activeRefresh = null;
  });
  return activeRefresh;
}

// ── Core request function ──────────────────────────────────────────────────────

async function request<T>(url: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const { accessToken, refreshToken, logout } = useAuthStore.getState();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401 && !isRetry && refreshToken) {
    const newToken = await doRefresh(refreshToken);
    if (newToken) return request<T>(url, options, true);
    logout();
    throw new ApiError(401, "unauthorized", "Session expired. Please log in again.");
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = await res.json();
  } catch {
    // No JSON body (204 No Content, or a non-API error page) -- fine.
  }

  if (!res.ok) {
    const fieldErrors = extractFieldErrors(body);
    const message =
      (body?.message as string | undefined) ??
      fieldErrors[Object.keys(fieldErrors)[0]]?.[0] ??
      (body?.title as string | undefined) ??
      `HTTP ${res.status}`;
    throw new ApiError(res.status, (body?.errorCode as string | undefined) ?? null, message, fieldErrors);
  }

  // Gateway envelope: { success, data, message, errorCode, traceId }
  if (body && typeof body === "object" && "success" in body) {
    const envelope = body as unknown as BackendResponse<T>;
    if (!envelope.success) {
      throw new ApiError(res.status, envelope.errorCode, envelope.message ?? "Request failed.");
    }
    return envelope.data as T;
  }

  // Some routes (e.g. plain REST-style business-service endpoints) return the
  // payload directly with no envelope -- pass it through as-is.
  return body as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(`${API_BASE_URL}${path}`),
  post: <T>(path: string, data?: unknown) =>
    request<T>(`${API_BASE_URL}${path}`, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(`${API_BASE_URL}${path}`, { method: "PUT", body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(`${API_BASE_URL}${path}`, { method: "PATCH", body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(`${API_BASE_URL}${path}`, { method: "DELETE" }),
};

/** For pre-login calls (login, register, forgot-password) -- no Authorization header, no refresh. */
export async function anonymousPost<T>(path: string, data: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body: BackendResponse<T> | Record<string, unknown> = await res.json();

  if (!res.ok) {
    const b = body as Record<string, unknown>;
    const fieldErrors = extractFieldErrors(b);
    const message =
      (b?.message as string | undefined) ??
      fieldErrors[Object.keys(fieldErrors)[0]]?.[0] ??
      (b?.title as string | undefined) ??
      `HTTP ${res.status}`;
    throw new ApiError(res.status, (b?.errorCode as string | undefined) ?? null, message, fieldErrors);
  }

  if (body && typeof body === "object" && "success" in body) {
    const envelope = body as BackendResponse<T>;
    if (!envelope.success) throw new ApiError(res.status, envelope.errorCode, envelope.message ?? "Request failed.");
    return envelope.data as T;
  }
  return body as T;
}
