import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accountApi, twoFactorApi } from "@/lib/settings.api";
import { useAuthStore } from "@/store/auth.store";
import type { ChangeMyPasswordRequest, UpdateMeRequest } from "@/types/settings";

const QK = "account" as const;

export function useMe() {
  return useQuery({ queryKey: [QK, "me"], queryFn: accountApi.getMe });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const updateUser = useAuthStore((s) => s.updateUser);
  return useMutation({
    mutationFn: (body: UpdateMeRequest) => accountApi.updateMe(body),
    onSuccess: (user) => {
      updateUser(user);
      qc.invalidateQueries({ queryKey: [QK, "me"] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: ChangeMyPasswordRequest) => accountApi.changePassword(body),
  });
}

export function useTwoFactorStatus() {
  return useQuery({ queryKey: [QK, "2fa-status"], queryFn: twoFactorApi.getStatus });
}

export function useSetupTwoFactor() {
  return useMutation({ mutationFn: twoFactorApi.setup });
}

export function useEnableTwoFactor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => twoFactorApi.enable(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, "2fa-status"] }),
  });
}

export function useDisableTwoFactor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => twoFactorApi.disable(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, "2fa-status"] }),
  });
}
