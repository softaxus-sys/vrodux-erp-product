"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import { DesktopNav } from "@/components/Nav";
import type { NavItem } from "@/lib/nav";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/lib/dictionary";

export function Header({
  locale,
  dict,
  items,
}: {
  locale: Locale;
  dict: Dictionary;
  items: NavItem[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // A route change must close the drawer, or navigating from inside it leaves the
  // menu covering the page the visitor just asked for.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const phone = process.env.NEXT_PUBLIC_PHONE ?? "+971 4 2445777";

  // Compare on pathname only: the section links carry query strings, and
  // including those would leave every section permanently inactive.
  const isActive = (href: string) => {
    const path = href.split("?")[0];
    return path === `/${locale}` ? pathname === path : Boolean(pathname?.startsWith(path));
  };

  return (
    <header
      className={`sticky top-0 z-50 border-b bg-white transition-shadow duration-300 ${
        scrolled ? "border-ink-200 shadow-sm" : "border-ink-100"
      }`}
    >
      <div className="container-content flex h-20 items-center justify-between gap-6">
        <Link href={`/${locale}`} className="group flex items-center">
          <Logo name={dict.brand.name} tagline={dict.brand.tagline} />
        </Link>

        <DesktopNav items={items} isActive={isActive} />


        <div className="flex items-center gap-4">
          <LanguageSwitcher locale={locale} />
          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            className="btn-ghost hidden px-5 py-2.5 text-xs sm:inline-flex"
          >
            {/* dir="ltr" keeps the leading + on the correct side under RTL. */}
            <span dir="ltr">{dict.nav.callUs}: {phone}</span>
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? dict.common.close : dict.common.menu}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-200 lg:hidden"
          >
            <span className="relative block h-3 w-4">
              <span
                className={`absolute inset-x-0 top-0 h-px bg-ink-900 transition-transform ${
                  open ? "translate-y-1.5 rotate-45" : ""
                }`}
              />
              <span
                className={`absolute inset-x-0 top-1.5 h-px bg-ink-900 transition-opacity ${
                  open ? "opacity-0" : ""
                }`}
              />
              <span
                className={`absolute inset-x-0 top-3 h-px bg-ink-900 transition-transform ${
                  open ? "-translate-y-1.5 -rotate-45" : ""
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-ink-200 bg-ink-50 lg:hidden">
          <nav className="container-content flex flex-col py-4">
            {items.map((item) => (
              <div key={item.href} className="border-b border-ink-100 last:border-0">
                <Link
                  href={item.href}
                  className="block py-4 font-display text-xl font-semibold text-ink-800"
                >
                  {item.label}
                </Link>
                {item.children && (
                  <div className="pb-3 ps-4">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="block py-2 text-sm text-ink-600"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <a href={`tel:${phone.replace(/\s/g, "")}`} className="btn-ghost mt-5 w-full">
              <span dir="ltr">{dict.nav.callUs}: {phone}</span>
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
