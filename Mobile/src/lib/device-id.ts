/**
 * A stable id for this app install, used to label and individually manage a login session from
 * a "my devices" list on the backend (see CLAUDE.md's per-device refresh tokens work). Persisted
 * outside the zustand auth store's own session blob -- logging out must NOT reset it, or a
 * re-login on the same physical phone would look like a brand-new device every time, and the
 * backend's own-device revoke-on-login dedup (which relies on this id staying stable) would never
 * fire.
 */
import { Platform } from "react-native";
import * as Device from "expo-device";
import { getSecureItem, setSecureItem } from "@/lib/secure-storage";

const DEVICE_ID_KEY = "vrodux.deviceId";

let cached: string | null = null;

function randomUuidV4(): string {
  // No uuid/crypto dependency needed for a purely local, non-cryptographic label -- RFC 4122
  // version 4 shape (random bits, version nibble fixed to 4, variant nibble fixed to 8-b).
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  let out = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += "-";
    else if (i === 14) out += "4";
    else if (i === 19) out += ["8", "9", "a", "b"][Math.floor(Math.random() * 4)];
    else out += hex();
  }
  return out;
}

/** Reads the persisted device id, generating and storing one on first call. Safe to call
 *  repeatedly (login, every token refresh) -- resolves to the same value for the life of the
 *  install. Returns null only if secure storage itself is unavailable (falls back to unlabeled
 *  sessions, same as a client that never sends one at all). */
export async function getOrCreateDeviceId(): Promise<string | null> {
  if (cached) return cached;

  const existing = await getSecureItem(DEVICE_ID_KEY);
  if (existing) {
    cached = existing;
    return cached;
  }

  const fresh = randomUuidV4();
  try {
    await setSecureItem(DEVICE_ID_KEY, fresh);
  } catch {
    return null;
  }
  cached = fresh;
  return cached;
}

export interface DeviceLabel {
  deviceId: string | null;
  deviceName: string | null;
  platform: "ios" | "android" | null;
}

/** Everything login/refresh needs to label + dedupe a session -- one call site for both. */
export async function getDeviceLabel(): Promise<DeviceLabel> {
  return {
    deviceId: await getOrCreateDeviceId(),
    deviceName: Device.deviceName ?? null,
    platform: Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : null,
  };
}
