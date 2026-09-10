/**
 * Thin wrapper over expo-secure-store (iOS Keychain / Android Keystore).
 *
 * Access + refresh tokens must never sit in AsyncStorage/localStorage-style
 * plain storage on a device -- this app reaches payroll, invoices and HR
 * records. Keys mirror what the web app's zustand persist middleware calls
 * its localStorage keys, purely so the two are easy to reason about side by
 * side -- they are NOT shared storage (different origins, different devices).
 */
import * as SecureStore from "expo-secure-store";

export const SecureStorageKeys = {
  accessToken: "vrodux.accessToken",
  refreshToken: "vrodux.refreshToken",
} as const;

export async function getSecureItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    // A private/locked keystore (fresh install before first unlock, or a
    // simulator quirk) should read as "nothing stored" rather than crash
    // the whole auth bootstrap.
    return null;
  }
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Already gone -- deleting is idempotent from the caller's point of view.
  }
}
