import { anonymousPost, apiClient, API_BASE_URL } from "@/lib/api-client";
import { getDeviceLabel, getOrCreateDeviceId } from "@/lib/device-id";
import type { AuthTokenDto, SessionDto } from "@/types/auth";

const BASE = "/api/auth";

export const authApi = {
  login: async (email: string, password: string): Promise<AuthTokenDto> =>
    anonymousPost(`${BASE}/login`, { email, password, ...(await getDeviceLabel()) }),

  /** Step 2 of a 2FA login -- submit the authenticator (or backup) code with the MFA token. */
  verifyTwoFactor: async (mfaToken: string, code: string): Promise<AuthTokenDto> =>
    anonymousPost(`${BASE}/verify-2fa`, { mfaToken, code, ...(await getDeviceLabel()) }),

  refresh: async (token: string): Promise<AuthTokenDto> =>
    anonymousPost(`${BASE}/refresh`, { token, ...(await getDeviceLabel()) }),

  /** Revoke the refresh token (logout from this device). Best-effort -- local logout always wins. */
  revoke: async (refreshToken: string, accessToken: string): Promise<void> => {
    try {
      await fetch(`${API_BASE_URL}${BASE}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ token: refreshToken }),
      });
    } catch {
      // Server-side revoke failing must never block the local logout the user asked for.
    }
  },

  /** "My devices" -- every active session for the signed-in user, newest first. Passes this
   *  device's own id so the backend can mark which row is "this device"; omitted (not failed)
   *  if secure storage is unavailable, same as login/refresh. */
  getSessions: async (): Promise<SessionDto[]> => {
    const deviceId = await getOrCreateDeviceId();
    const qs = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : "";
    return apiClient.get(`${BASE}/sessions${qs}`);
  },

  /** Revoke one other session by id -- e.g. signing a lost/old device out remotely. */
  revokeSession: (sessionId: string): Promise<void> => apiClient.post(`${BASE}/sessions/${sessionId}/revoke`),
};
