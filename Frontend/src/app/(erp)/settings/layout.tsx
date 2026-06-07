"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SlidersHorizontal, ShieldCheck, GitBranch, Plug, ScrollText,
} from "lucide-react";

const SETTINGS_NAV = [
  {
    label: "General",
    href: "/settings/general",
    icon: SlidersHorizontal,
    description: "Company profile & regional",
  },
  {
    label: "Users & Roles",
    href: "/settings/users",
    icon: ShieldCheck,
    description: "Team access & permissions",
  },
  {
    label: "Branches",
    href: "/settings/branches",
    icon: GitBranch,
    description: "Office locations & staff",
  },
  {
    label: "Integrations",
    href: "/settings/integrations",
    icon: Plug,
    description: "Third-party connections",
  },
  {
    label: "Audit Logs",
    href: "/settings/audit",
    icon: ScrollText,
    description: "System activity trail",
  },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex gap-6 min-h-full">
      {/* Left Settings Nav */}
      <aside className="w-56 flex-shrink-0">
        <div className="sticky top-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
            System Settings
          </p>
          <nav className="space-y-0.5">
            {SETTINGS_NAV.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                  <div className="min-w-0">
                    <p className={`text-sm font-medium leading-none ${isActive ? "text-primary" : ""}`}>
                      {item.label}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{item.description}</p>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Divider + version info */}
          <div className="mt-6 pt-4 border-t border-border px-1">
            <p className="text-xs text-muted-foreground">Softaxis ERP</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">v2.4.1 · Enterprise</p>
          </div>
        </div>
      </aside>

      {/* Right Content */}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
