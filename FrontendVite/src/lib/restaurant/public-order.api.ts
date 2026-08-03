import { rawApiClient } from "@/lib/api-client";
import type { PublicMenu, PublicOrderLine, PublicOrderPlaced } from "./restaurant.api";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/restaurant`;

/**
 * Anonymous, guest-facing endpoints for QR-table ordering and self-ordering kiosks — no auth token
 * required (rawApiClient only attaches one if the browser happens to have one from a staff login on
 * the same device, which the backend ignores since these routes are [AllowAnonymous]).
 */
export const publicOrderApi = {
  getMenu: (qrCode: string): Promise<PublicMenu> => rawApiClient.get(`${BASE}/public-menu/${qrCode}`),
  placeOrder: (p: {
    qrCode: string; channel?: "qr_table" | "kiosk"; notes?: string | null;
    guestDeviceToken: string; items: PublicOrderLine[];
  }): Promise<PublicOrderPlaced> => rawApiClient.post(`${BASE}/public-orders`, p),
};

/** Stable per-browser id for correlating a guest's repeat orders — created once, persisted in localStorage. */
export function getGuestDeviceToken(): string {
  const key = "restaurant_guest_device_token";
  let token = localStorage.getItem(key);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(key, token);
  }
  return token;
}
