import { getApiBaseUrl } from "@/lib/desktop";

export function apiUrl(path: string): string {
  return `${getApiBaseUrl()}${path}`;
}
