import { getApiBaseUrl } from "@/lib/desktop";

/**
 * Licence activation for an on-premises installation.
 *
 * Deliberately plain `fetch`, not rawApiClient: this runs when the installation is BLOCKED — an
 * expired licence 403s everything — and often with nobody signed in. rawApiClient attaches a token
 * and bounces to /login on 401, which would throw the person out of the one page that can fix the
 * problem. Same reasoning as the public quotation page.
 */

// Resolved per call, not once at module load: on the desktop client the server address is read
// from the app's own settings and may not be cached yet when this module is first imported.
const base = () => `${getApiBaseUrl()}/api/license`;

export interface LicenseStatus {
  isOnPremises: boolean;
  licensed: boolean;
  expiresAt: string | null;
  daysLeft: number | null;
  expired: boolean;
  /** This computer's code — sent to Softaxis to get a key bound to this machine. */
  machineCode?: string | null;
}

export interface LicenseActivation {
  activated: boolean;
  /** The pasted key was already the installed one. Not an error — say so rather than "done". */
  alreadyInUse: boolean;
  tenantName: string;
  plan: string;
  maxUsers: number;
  modules: string[];
  expiresAt: string;
  daysLeft: number;
}

/** Pulls the server's own message out of whichever shape it used, so the user sees the real reason. */
async function readError(res: Response): Promise<string> {
  try {
    const b = await res.json();
    return (
      b?.detail ?? b?.description ?? b?.message ?? b?.error ?? b?.title ?? `HTTP ${res.status}`
    );
  } catch {
    return `HTTP ${res.status}`;
  }
}

// The Identity API wraps every answer as { success, data, … }. Read `data`; fall back to the body
// itself so a bare response still works.
async function unwrap<T>(res: Response): Promise<T> {
  const body = await res.json();
  return (body && typeof body === "object" && "data" in body ? body.data : body) as T;
}

export const licenseApi = {
  status: async (): Promise<LicenseStatus> => {
    const res = await fetch(`${base()}/status`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(await readError(res));
    return unwrap(res);
  },

  activate: async (licenseKey: string): Promise<LicenseActivation> => {
    const res = await fetch(`${base()}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ licenseKey }),
    });
    if (!res.ok) throw new Error(await readError(res));
    return unwrap(res);
  },
};
