/**
 * usePaymentMethods — returns the ordered list of enabled payment methods
 * for the current tenant's country.
 *
 * Data flow:
 *   1. Fetches live config from backend GET /api/payment-methods
 *   2. Maps backend DTOs → PaymentMethodDef (adds icon/color from local registry)
 *   3. Falls back to country seed defaults if backend returns nothing or while loading
 *
 * usePaymentMethodsManager — extended hook for the settings page.
 * Provides save / reset / delete-custom.
 */

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import {
  paymentMethodsApi,
  type PaymentMethodDto,
  type PaymentMethodSaveItem,
} from "@/lib/pos/payment-methods.api";
import {
  PAYMENT_METHOD_REGISTRY,
  getMethodsForCountry,
  getSeedIds,
  buildCustomDef,
  type PaymentMethodDef,
} from "@/lib/pos/payment-methods.config";

// ─── Country resolution ───────────────────────────────────────────────────────

const CURRENCY_TO_COUNTRY: Record<string, string> = {
  AED: "ae", PKR: "pk", SAR: "sa", OMR: "om",
  INR: "in", GBP: "gb", USD: "us", QAR: "qa",
  KWD: "kw", BHD: "bh",
};

function resolveCountry(
  country?: string | null,
  currency?: string | null,
): string {
  const c = (country ?? "").toLowerCase().trim();
  if (c === "ae" || c.includes("uae") || c.includes("emirates")) return "ae";
  if (c === "pk" || c.includes("pakistan"))                        return "pk";
  if (c === "sa" || c.includes("saudi"))                           return "sa";
  if (c === "in" || c.includes("india"))                           return "in";
  if (c === "gb" || c.includes("kingdom"))                         return "gb";
  if (c === "us" || c.includes("united states"))                   return "us";
  if (c.length === 2 && /^[a-z]{2}$/.test(c))                     return c;
  return CURRENCY_TO_COUNTRY[(currency ?? "").toUpperCase()] ?? "pk";
}

// ─── Country filter for DTOs ──────────────────────────────────────────────────

/** Does the backend `countries` field cover `code`? ("*" = universal) */
function dtoMatchesCountry(dto: PaymentMethodDto, code: string): boolean {
  const raw = dto.countries ?? "*";
  if (!raw || raw === "*") return true;
  return raw.split(",").map(s => s.trim().toLowerCase()).includes(code.toLowerCase());
}

// ─── DTO → PaymentMethodDef mapping ──────────────────────────────────────────

function dtoToDef(dto: PaymentMethodDto): PaymentMethodDef {
  // Look up frontend registry by code (case-insensitive)
  const reg = PAYMENT_METHOD_REGISTRY.find(
    m => m.id.toLowerCase() === dto.code.toLowerCase(),
  );
  if (reg) return reg;

  // Custom (not in registry) — build a generic def
  return buildCustomDef({ id: dto.code, label: dto.label });
}

// ─── Query key ────────────────────────────────────────────────────────────────

export const pmKeys = {
  all: ["payment-methods"] as const,
};

// ─── usePaymentMethods ────────────────────────────────────────────────────────

/**
 * Lightweight hook for POS views.
 * Returns the ordered enabled-method list; never empty (falls back to seeds).
 * Shows seed data immediately via placeholderData — no loading flicker.
 */
export function usePaymentMethods(): PaymentMethodDef[] {
  const { tenant } = useAuthStore();
  const countryCode = resolveCountry(tenant?.country, tenant?.currency);

  const seedMethods = React.useMemo(
    () => getSeedIds(countryCode)
      .map(id => PAYMENT_METHOD_REGISTRY.find(m => m.id === id))
      .filter((m): m is PaymentMethodDef => m != null),
    [countryCode],
  );

  const { data } = useQuery({
    queryKey: pmKeys.all,
    queryFn:  () => paymentMethodsApi.getAll(),
    staleTime: 5 * 60 * 1000,
    placeholderData: [],   // no loading flicker
  });

  return React.useMemo(() => {
    // Enabled AND (custom OR matches tenant country)
    const enabled = (data ?? []).filter(
      d => d.isEnabled && (!d.isSystem || dtoMatchesCountry(d, countryCode)),
    );
    if (enabled.length === 0) return seedMethods;
    return enabled
      .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
      .map(dtoToDef);
  }, [data, countryCode, seedMethods]);
}

// ─── usePaymentMethodsManager ─────────────────────────────────────────────────

/**
 * Extended hook for the Payment Methods settings page.
 */
export function usePaymentMethodsManager() {
  const { tenant } = useAuthStore();
  const countryCode   = resolveCountry(tenant?.country, tenant?.currency);
  const queryClient   = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: pmKeys.all,
    queryFn:  () => paymentMethodsApi.getAll(),
    staleTime: 5 * 60 * 1000,
  });

  const seedIds       = React.useMemo(() => getSeedIds(countryCode), [countryCode]);
  const allForCountry = React.useMemo(() => getMethodsForCountry(countryCode), [countryCode]);

  const saveMutation = useMutation({
    mutationFn: (items: PaymentMethodSaveItem[]) => paymentMethodsApi.save(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pmKeys.all });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => paymentMethodsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pmKeys.all });
    },
  });

  return {
    isLoading,
    isSaving:       saveMutation.isPending,
    countryCode,
    allForCountry,
    seedIds,
    /** Raw backend DTOs — use for settings UI */
    methods:        data,
    save:           (items: PaymentMethodSaveItem[]) => saveMutation.mutateAsync(items),
    deleteCustom:   (id: string) => deleteMutation.mutateAsync(id),
    /** Reset to seeds: enable only seed IDs, disable everything else */
    reset: () => {
      const items: PaymentMethodSaveItem[] = data.map((d, i) => ({
        code:      d.code,
        label:     d.label,
        isEnabled: seedIds.includes(d.code),
        sortOrder: seedIds.indexOf(d.code) >= 0 ? seedIds.indexOf(d.code) : 100 + i,
        isCustom:  !d.isSystem,
      }));
      return saveMutation.mutateAsync(items);
    },
  };
}
