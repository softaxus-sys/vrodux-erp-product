"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, localeMeta, type Locale } from "@/i18n/config";

/**
 * Swaps the locale segment while keeping the visitor on the same page. Anything else
 * (sending them to the homepage) loses their place on a property they were reading.
 */
export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname() || `/${locale}`;

  return (
    <div className="flex items-center gap-1 text-xs">
      {locales.map((l, i) => {
        const segments = pathname.split("/");
        segments[1] = l;
        const href = segments.join("/") || `/${l}`;
        const active = l === locale;

        return (
          <span key={l} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden className="text-ink-300">/</span>}
            <Link
              href={href}
              hrefLang={localeMeta[l].htmlLang}
              aria-current={active ? "true" : undefined}
              className={
                active
                  ? "font-medium text-ink-900"
                  : "text-ink-400 transition-colors hover:text-ink-900"
              }
            >
              {localeMeta[l].label}
            </Link>
          </span>
        );
      })}
    </div>
  );
}
