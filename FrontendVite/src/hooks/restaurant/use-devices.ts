import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { devicesApi } from "@/lib/restaurant/devices.api";
import { useCurrentBranch } from "@/hooks/restaurant/use-current-branch";

const QK = "restaurant-devices";
const FINGERPRINT_KEY = "restaurant_device_fingerprint";
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function getOrCreateFingerprint(): string {
  let fp = localStorage.getItem(FINGERPRINT_KEY);
  if (!fp) {
    fp = crypto.randomUUID();
    localStorage.setItem(FINGERPRINT_KEY, fp);
  }
  return fp;
}

export const useDeviceRegistrations = (branchId?: string | null) =>
  useQuery({ queryKey: [QK, branchId ?? "all"], queryFn: () => devicesApi.getAll(branchId) });

export function useUpdateDeviceRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...p }: { id: string; deviceName: string; branchId: string | null; isActive: boolean }) =>
      devicesApi.update(id, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QK] }); toast.success("Device updated."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveDeviceRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => devicesApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QK] }); toast.success("Device removed."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Self-registers this browser as a POS device (observability only — never gates access) and sends a
 * periodic heartbeat while the Restaurant POS view is open. Silently no-ops on failure — a device
 * that can't reach the registration endpoint should never block the actual POS flow. */
export function useDeviceRegistration() {
  const { branchId } = useCurrentBranch();
  const registeredRef = React.useRef(false);

  React.useEffect(() => {
    const fingerprint = getOrCreateFingerprint();
    const deviceName = `${navigator.platform || "Device"} — ${new Date().toLocaleDateString()}`;

    devicesApi.register({ branchId, deviceFingerprint: fingerprint, deviceName })
      .then(() => { registeredRef.current = true; })
      .catch(() => { /* best-effort — never block the POS UI */ });

    const interval = setInterval(() => {
      if (registeredRef.current) devicesApi.heartbeat(fingerprint).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);
}
