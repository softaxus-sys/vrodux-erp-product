"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/lib/dictionary";
import type { PropertyType } from "@/lib/types";

const TYPE_LABELS: Record<PropertyType, { en: string; ar: string }> = {
  apartment: { en: "Apartment", ar: "شقة" },
  villa: { en: "Villa", ar: "فيلا" },
  townhouse: { en: "Townhouse", ar: "تاون هاوس" },
  penthouse: { en: "Penthouse", ar: "بنتهاوس" },
  plot: { en: "Plot", ar: "أرض" },
  office: { en: "Office", ar: "مكتب" },
};

const PRICE_STEPS = [500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000, 20_000_000];

/**
 * Filter state lives in the URL, not component state. That makes a filtered search
 * shareable and linkable — which matters when an adviser wants to send a client
 * "here is everything in Dubai Hills over 10M" in a WhatsApp message.
 */
export function SearchFilters({
  locale,
  dict,
  communities,
  types,
  compact = false,
}: {
  locale: Locale;
  dict: Dictionary;
  communities: { value: string; label: { en: string; ar: string } }[];
  types: PropertyType[];
  compact?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const current = useMemo(
    () => ({
      purpose: params.get("purpose") ?? "any",
      community: params.get("community") ?? "any",
      type: params.get("type") ?? "any",
      bedrooms: params.get("bedrooms") ?? "any",
      priceMin: params.get("priceMin") ?? "",
      priceMax: params.get("priceMax") ?? "",
    }),
    [params],
  );

  const hasFilters = Object.entries(current).some(
    ([, v]) => v !== "any" && v !== "",
  );

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "any") next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.push(`/${locale}/properties${qs ? `?${qs}` : ""}`, { scroll: !compact });
  }

  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-AE" : "en-AE", {
    notation: locale === "ar" ? "standard" : "compact",
    maximumFractionDigits: 1,
  });

  return (
    <div
      className={
        compact
          ? "rounded-2xl bg-white/95 p-4 shadow-[0_20px_50px_-24px_rgba(15,14,13,.5)] backdrop-blur sm:p-5"
          : "rounded-2xl border border-ink-200 bg-white p-5"
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div>
          <label htmlFor="f-purpose" className="field-label">{dict.search.purpose}</label>
          <select
            id="f-purpose"
            className="field"
            value={current.purpose}
            onChange={(e) => update("purpose", e.target.value)}
          >
            <option value="any">{dict.search.any}</option>
            <option value="buy">{dict.search.buy}</option>
            <option value="rent">{dict.search.rent}</option>
          </select>
        </div>

        <div>
          <label htmlFor="f-community" className="field-label">{dict.search.community}</label>
          <select
            id="f-community"
            className="field"
            value={current.community}
            onChange={(e) => update("community", e.target.value)}
          >
            <option value="any">{dict.search.any}</option>
            {communities.map((c) => (
              <option key={c.value} value={c.value}>{c.label[locale]}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="f-type" className="field-label">{dict.search.type}</label>
          <select
            id="f-type"
            className="field"
            value={current.type}
            onChange={(e) => update("type", e.target.value)}
          >
            <option value="any">{dict.search.any}</option>
            {types.map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t][locale]}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="f-beds" className="field-label">{dict.search.bedrooms}</label>
          <select
            id="f-beds"
            className="field"
            value={current.bedrooms}
            onChange={(e) => update("bedrooms", e.target.value)}
          >
            <option value="any">{dict.search.any}</option>
            <option value="0">{dict.search.studio}</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={String(n)}>
                {new Intl.NumberFormat(locale === "ar" ? "ar-AE" : "en-AE").format(n)}+
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="f-min" className="field-label">{dict.search.priceMin}</label>
          <select
            id="f-min"
            className="field"
            value={current.priceMin}
            onChange={(e) => update("priceMin", e.target.value)}
          >
            <option value="">{dict.search.any}</option>
            {PRICE_STEPS.map((p) => (
              <option key={p} value={String(p)}>{nf.format(p)}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="f-max" className="field-label">{dict.search.priceMax}</label>
          <select
            id="f-max"
            className="field"
            value={current.priceMax}
            onChange={(e) => update("priceMax", e.target.value)}
          >
            <option value="">{dict.search.any}</option>
            {PRICE_STEPS.map((p) => (
              <option key={p} value={String(p)}>{nf.format(p)}</option>
            ))}
          </select>
        </div>
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={() => router.push(`/${locale}/properties`)}
          className="mt-4 text-xs text-ink-500 underline underline-offset-4 hover:text-ink-900"
        >
          {dict.search.reset}
        </button>
      )}
    </div>
  );
}
