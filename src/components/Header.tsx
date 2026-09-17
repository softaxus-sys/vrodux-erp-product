"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/lib/dictionary";

export function Header({ locale, dict }: { locale: Locale; dict: Dictionary }) {
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

  const links = [
    { href: `/${locale}`, label: dict.nav.home },
    { href: `/${locale}/properties`, label: dict.nav.properties },
    { href: `/${locale}/about`, label: dict.nav.about },
    { href: `/${locale}/contact`, label: dict.nav.contact },
  ];

  const isActive = (href: string) =>
    href === `/${locale}` ? pathname === href : pathname?.startsWith(href);

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled ? "border-b border-ink-200/70 bg-ink-50/90 backdrop-blur" : "bg-transparent"
      }`}
    >
      <div className="container-content flex h-20 items-center justify-between gap-6">
        <Link href={`/${locale}`} className="group flex flex-col leading-none">
          <span className="font-display text-xl tracking-tight text-ink-900 sm:text-2xl">
            {dict.brand.name}
          </span>
          <span className="mt-1 text-[0.6rem] uppercase tracking-widest text-ink-400">
            {dict.brand.tagline}
          </span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={`relative text-sm transition-colors ${
                isActive(l.href) ? "text-ink-900" : "text-ink-500 hover:text-ink-900"
              }`}
            >
              {l.label}
              {isActive(l.href) && (
                <span className="absolute -bottom-1.5 start-0 h-px w-full bg-sand-500" />
              )}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <LanguageSwitcher locale={locale} />
          <Link href={`/${locale}/contact`} className="btn-accent hidden text-xs sm:inline-flex">
            {dict.nav.enquire}
          </Link>
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
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="border-b border-ink-100 py-4 font-display text-2xl text-ink-900 last:border-0"
              >
                {l.label}
              </Link>
            ))}
            <Link href={`/${locale}/contact`} className="btn-accent mt-5 w-full">
              {dict.nav.enquire}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
