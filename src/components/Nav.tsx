"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { NavItem } from "@/lib/nav";

export function DesktopNav({ items, isActive }: { items: NavItem[]; isActive: (href: string) => boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // A short close delay: without it, the gap between the trigger and the panel
  // closes the menu as the pointer crosses it.
  const scheduleClose = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(null), 140);
  };
  const cancelClose = () => {
    if (timer.current) clearTimeout(timer.current);
  };

  return (
    <nav className="hidden items-center gap-7 lg:flex">
      {items.map((item) => (
        <div
          key={item.href}
          className="relative"
          onMouseEnter={() => { cancelClose(); setOpen(item.href); }}
          onMouseLeave={scheduleClose}
        >
          <Link
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            aria-expanded={item.children ? open === item.href : undefined}
            className={`relative flex items-center gap-1 py-7 text-sm transition-colors ${
              isActive(item.href) ? "text-brand-500" : "text-ink-700 hover:text-brand-500"
            }`}
          >
            {item.label}
            {item.children && (
              <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden className="mt-0.5">
                <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            )}
            {isActive(item.href) && (
              <span className="absolute bottom-5 start-0 h-0.5 w-full bg-brand-500" />
            )}
          </Link>

          {item.children && open === item.href && (
            <div
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
              className="absolute top-full start-0 z-50 min-w-[13rem] border-t-2 border-brand-500 bg-white py-2 shadow-lg"
            >
              {item.children.map((child) => (
                <Link
                  key={child.href}
                  href={child.href}
                  className="block px-5 py-2.5 text-sm text-ink-700 transition-colors hover:bg-ink-50 hover:text-brand-500"
                >
                  {child.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}
