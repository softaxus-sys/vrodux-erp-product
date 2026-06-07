import type { AuthTokenDto, UserDto } from "./types";
import { ApiError, apiClient, type BackendResponse } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/auth`;

// ── Raw fetch helpers (no auth store dependency — used before login) ──────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json: BackendResponse<T> = await res.json().catch(() => ({
    success: false,
    data: null,
    message: res.statusText,
    errorCode: null,
    traceId: "",
  }));

  if (!res.ok || !json.success) {
    throw new ApiError(res.status, json.errorCode, json.message ?? `HTTP ${res.status}`);
  }

  return json.data as T;
}

// ── Exported API functions ────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string): Promise<AuthTokenDto> =>
    post("/login", { email, password }),

  refresh: (token: string): Promise<AuthTokenDto> =>
    post("/refresh", { token }),

  register: (
    firstName: string,
    lastName: string,
    email: string,
    username: string,
    password: string
  ): Promise<UserDto> =>
    post("/register", { firstName, lastName, email, username, password }),

  /** Revoke refresh token (logout from device). Needs auth — use apiClient. */
  revoke: async (token: string, accessToken: string): Promise<void> => {
    await fetch(`${BASE}/revoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ token }),
    });
  },

  /** Get current user's own profile (requires auth). */
  getMe: (): Promise<UserDto> =>
    apiClient.get(`${BASE}/me`),

  /** Update current user's own profile (requires auth). */
  updateMe: (data: {
    firstName: string;
    lastName: string;
    phoneNumber?: string | null;
    avatarUrl?: string | null;
  }): Promise<UserDto> =>
    apiClient.put(`${BASE}/me`, data),

  /** Change current user's own password (requires auth). */
  changePassword: (currentPassword: string, newPassword: string): Promise<void> =>
    apiClient.post(`${BASE}/me/change-password`, { currentPassword, newPassword }),
};
