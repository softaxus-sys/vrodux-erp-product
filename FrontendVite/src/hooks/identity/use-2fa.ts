import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { twoFactorApi } from "@/lib/identity/auth.api";

const KEY = ["2fa", "status"] as const;

export function useTwoFactorStatus(enabled = true) {
  return useQuery({
    queryKey: KEY,
    queryFn:  twoFactorApi.status,
    enabled,
    staleTime: 30_000,
  });
}

/** Begin enrollment — returns { secret, otpAuthUri, qrCodeDataUri }. */
export function useSetupTwoFactor() {
  return useMutation({
    mutationFn: twoFactorApi.setup,
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Confirm enrollment with a code — returns { backupCodes }. */
export function useEnableTwoFactor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => twoFactorApi.enable(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Two-factor authentication enabled.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDisableTwoFactor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => twoFactorApi.disable(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Two-factor authentication disabled.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
