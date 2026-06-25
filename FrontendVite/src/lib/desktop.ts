/**
 * Desktop (Electron) bridge — provides the API URL configured in the desktop
 * app's settings. Falls back to VITE_API_URL / localhost for web builds.
 */

interface VroduxDesktop {
  getApiUrl: () => Promise<string>;
  setApiUrl: (url: string) => Promise<boolean>;
  getAppVersion: () => Promise<string>;
  isDesktop: boolean;
  onShowServerPrompt: (cb: (currentUrl: string) => void) => void;
}

declare global {
  interface Window {
    vroduxDesktop?: VroduxDesktop;
  }
}

export const isDesktop = !!window.vroduxDesktop?.isDesktop;

let cachedApiUrl: string | null = null;

const FALLBACK =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:5000";

export async function getDesktopApiUrl(): Promise<string> {
  if (!isDesktop) return FALLBACK;
  if (cachedApiUrl) return cachedApiUrl;
  cachedApiUrl = await window.vroduxDesktop!.getApiUrl();
  return cachedApiUrl;
}

export function getApiBaseUrl(): string {
  return cachedApiUrl ?? FALLBACK;
}

export async function initDesktopApiUrl(): Promise<void> {
  if (!isDesktop) return;
  cachedApiUrl = await window.vroduxDesktop!.getApiUrl();
}

export function clearApiUrlCache(): void {
  cachedApiUrl = null;
}
