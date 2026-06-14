import * as React from "react";
import { Link } from "react-router-dom";
import { Briefcase } from "lucide-react";

export function CareersLayout({
  tenantSlug,
  companyName,
  children,
}: {
  tenantSlug: string;
  companyName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <Link to={`/careers/${tenantSlug}`} className="flex items-center gap-2 font-bold text-lg">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Briefcase className="h-4 w-4 text-white" />
            </span>
            {companyName ?? "Careers"}
          </Link>
          <span className="text-xs text-slate-400">Powered by VroduxERP</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
      <footer className="border-t border-slate-800 mt-16">
        <div className="mx-auto max-w-5xl px-6 py-6 text-xs text-slate-500">
          © {new Date().getFullYear()} {companyName ?? "Company"}. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
