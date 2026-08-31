/**
 * Lightweight fetch wrapper that:
 *  - Injects the JWT Bearer token from the Zustand auth store
 *  - Unwraps the backend's { success, data, message, errorCode } envelope
 *  - Handles 401 → token refresh → single retry
 *  - Throws ApiError on HTTP / business errors
 */

import { useAuthStore } from "@/store/auth.store";
import { getApiBaseUrl } from "@/lib/desktop";

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
    /**
     * Per-field validation messages, keyed by the FIELD name the request sent, lower-cased.
     * Present when the server returned a validation failure (ASP.NET ProblemDetails `errors`, or
     * FluentValidation's `failures`). A form can bind these to inputs instead of showing one
     * anonymous toast that does not say which box is wrong.
     */
    public readonly fieldErrors: Record<string, string[]> = {}
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** The message for one field, if the server complained about it. Case-insensitive: the server
   *  answers in PascalCase ("Name"), the form thinks in camelCase ("name"). */
  fieldError(field: string): string | undefined {
    return this.fieldErrors[field.toLowerCase()]?.[0];
  }

  get hasFieldErrors(): boolean {
    return Object.keys(this.fieldErrors).length > 0;
  }
}

/**
 * Pulls per-field messages out of the two validation shapes this backend produces:
 *   - ASP.NET model binding → `{ errors: { Name: ["The Name field is required."] } }`
 *   - FluentValidation via ValidationBehavior → `{ failures: [{ propertyName, errorMessage }] }`
 *
 * Keys are lower-cased so a caller does not have to know which casing came back.
 */
function extractFieldErrors(body: Record<string, unknown> | null): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!body) return out;

  const add = (field: string, message: string) => {
    // A key of "" is ASP.NET's bucket for model-level (non-field) errors — keep it, so a caller
    // can surface it as a form-level message rather than losing it.
    const key = field.toLowerCase();
    (out[key] ??= []).push(message);
  };

  const errors = body.errors as Record<string, unknown> | undefined;
  if (errors && typeof errors === "object" && !Array.isArray(errors)) {
    for (const [field, messages] of Object.entries(errors)) {
      if (Array.isArray(messages)) messages.forEach(m => typeof m === "string" && add(field, m));
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

// ── Constants ─────────────────────────────────────────────────────────────────

const IDENTITY_URL = getApiBaseUrl();

// ── Token refresh (called inline, not via auth.api to avoid circular import) ──
//
// Mutex: backend uses rotating refresh tokens (old token is revoked on every
// refresh). If two concurrent 401 responses both call doRefresh() they'd send
// the same (now-revoked) token a second time and the second call would fail,
// triggering an unwanted logout. The mutex deduplicates: all callers that
// arrive while a refresh is already in-flight share the same Promise and wait
// for its result instead of starting a new request.

let activeRefresh: Promise<string | null> | null = null;

async function performRefresh(refreshToken: string): Promise<string | null> {
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

function doRefresh(refreshToken: string): Promise<string | null> {
  // Already refreshing — return the same promise so only ONE request is sent
  if (activeRefresh) return activeRefresh;

  activeRefresh = performRefresh(refreshToken).finally(() => {
    activeRefresh = null;
  });

  return activeRefresh;
}

// ── Subscription error codes returned by SubscriptionEnforcementMiddleware ────

const SUBSCRIPTION_CODES = new Set([
  "SUBSCRIPTION_EXPIRED",
  "LICENSE_EXPIRED",
  "LICENSE_NOT_ISSUED",
  "ACCOUNT_SUSPENDED",
  "TRIAL_EXPIRED",
  // "Buy Now" signup that hasn't paid yet — gated to billing, same as the others.
  "PAYMENT_REQUIRED",
]);

/**
 * Pages whose whole purpose is to RESOLVE a subscription block. Never navigate away from
 * these on a subscription error.
 *
 * The ERP shell fires non-exempt calls on every authenticated page load (ErpLayout ->
 * useTenantBootstrap -> GET /api/app-settings/regional), and the enforcement middleware only
 * exempts /api/auth, /api/license, /api/billing and /api/tenant-settings. Without this guard a
 * blocked tenant bounces billing -> /subscription-expired -> billing forever and can never pay.
 */
const BILLING_RECOVERY_PATHS = [
  "/subscription-expired",
  "/settings/billing",
  "/billing/checkout",
];

function handleSubscriptionError(errorCode: string | null, message: string | null): void {
  if (!errorCode || !SUBSCRIPTION_CODES.has(errorCode)) return;
  // Persist for the error page to read
  sessionStorage.setItem(
    "sub_error",
    JSON.stringify({ code: errorCode, message: message ?? "Subscription error." })
  );

  const path = window.location.pathname;
  if (BILLING_RECOVERY_PATHS.some(p => path === p || path.startsWith(p + "/") || path.startsWith(p + "?"))) {
    // Already somewhere the user can fix this — let the individual call fail quietly.
    return;
  }

  window.location.replace("/subscription-expired");
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
    // Subscription errors get their own full-page experience
    handleSubscriptionError(body.errorCode ?? null, body.message ?? null);

    // The Identity service can fail model binding before its envelope is ever built, so the body
    // is plain ProblemDetails in that case — read field errors here too, or those forms lose them.
    const fieldErrors = extractFieldErrors(body as unknown as Record<string, unknown>);

    throw new ApiError(
      res.status,
      body.errorCode ?? null,
      body.message ?? Object.values(fieldErrors)[0]?.[0] ?? `HTTP ${res.status}`,
      fieldErrors
    );
  }

  return body.data as T;
}

// ── Raw fetch (no envelope) — for Sales & Purchase services ──────────────────

async function rawRequest<T>(
  url: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const { token, refreshToken, logout } = useAuthStore.getState();

  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    // Never set Content-Type for FormData: the browser has to generate it itself so it can append
    // the multipart boundary. Forcing application/json here makes the server reject the upload.
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
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

  if (res.status === 204) return undefined as T;

  // `parsed: false` distinguishes "the body was literally null" from "the body could not be
  // parsed". They were indistinguishable before, so a 200 whose body was cut short — a slow, large
  // response through a proxy — resolved as null, sailed past every `data = []` default (those only
  // fire for undefined) and crashed the caller on the first property access.
  const { body, parsed } = await res
    .json()
    .then(b => ({ body: b, parsed: true }))
    .catch(() => ({ body: null, parsed: false }));

  if (!res.ok) {
    // ExceptionHandlingMiddleware uses `detail`; FinanceControllerBase uses `description`; fallback `message`
    const b = body as Record<string, unknown> | null;
    const fieldErrors = extractFieldErrors(b);

    // A validation failure carries no `detail`, so this used to fall through to a bare
    // "HTTP 400" — the response said exactly which field was wrong and the user was told nothing.
    // Lead with the field messages; `title` ("One or more validation errors occurred.") is a
    // last resort because it names no field either.
    const firstFieldMessage = Object.values(fieldErrors)[0]?.[0];

    const msg =
      (b?.detail      as string | undefined) ??
      (b?.description as string | undefined) ??
      (b?.message     as string | undefined) ??
      (b?.error       as string | undefined) ??
      firstFieldMessage ??
      (b?.title       as string | undefined) ??
      `HTTP ${res.status}`;
    const code = (b?.code as string | undefined) ?? null;
    throw new ApiError(res.status, code, msg, fieldErrors);
  }

  if (!parsed) {
    throw new ApiError(res.status, "Response.Unreadable",
      "The server's response could not be read — it may have been cut short. Please try again.");
  }

  return body as T;
}

/** Client for services that return raw JSON (no BackendResponse envelope). */
export const rawApiClient = {
  get:    <T>(url: string)                  => rawRequest<T>(url),
  post:   <T>(url: string, data?: unknown)  => rawRequest<T>(url, { method: "POST",   body: data !== undefined ? JSON.stringify(data) : undefined }),
  put:    <T>(url: string, data?: unknown)  => rawRequest<T>(url, { method: "PUT",    body: data !== undefined ? JSON.stringify(data) : undefined }),
  patch:  <T>(url: string, data?: unknown)  => rawRequest<T>(url, { method: "PATCH",  body: data !== undefined ? JSON.stringify(data) : undefined }),
  delete: <T>(url: string)                  => rawRequest<T>(url, { method: "DELETE" }),
  /** Multipart upload. Pass a FormData; the browser sets the Content-Type + boundary itself. */
  postForm: <T>(url: string, form: FormData) => rawRequest<T>(url, { method: "POST", body: form }),
  /**
   * Downloads a file with the auth header attached. A plain <a href> can't be used for protected
   * endpoints because the browser would send no bearer token.
   */
  getBlob: async (url: string): Promise<{ blob: Blob; fileName: string | null }> => {
    const { token } = useAuthStore.getState();
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new ApiError(res.status, null, `Download failed (HTTP ${res.status}).`);

    // Prefer the server's filename from Content-Disposition; callers fall back to their own.
    const disposition = res.headers.get("content-disposition") ?? "";
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    const fileName = match ? decodeURIComponent(match[1]) : null;

    return { blob: await res.blob(), fileName };
  },
};

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
  patch: <T>(url: string, data?: unknown) =>
    request<T>(url, { method: "PATCH", body: data !== undefined ? JSON.stringify(data) : undefined }),
};

