"use client";

import * as React from "react";
import { motion } from "framer-motion";

const features = [
  { icon: "💰", label: "Finance & Accounting", desc: "GL, invoicing, VAT" },
  { icon: "📦", label: "Inventory & WMS",       desc: "Multi-warehouse, transfers" },
  { icon: "👥", label: "HR & Payroll",           desc: "Attendance, leaves, WPS" },
  { icon: "🏗️", label: "Construction & BOQ",    desc: "Projects, contractors" },
  { icon: "🏨", label: "Hospitality",            desc: "Rooms, bookings, PMS" },
  { icon: "🏢", label: "Real Estate",            desc: "Properties, leases, CRM" },
];

const stats = [
  { value: "50+",   label: "ERP Modules" },
  { value: "14+",   label: "Industries" },
  { value: "99.9%", label: "Uptime SLA" },
  { value: "UAE",   label: "VAT Ready" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Left branding panel ───────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col">
        {/* Deep navy base */}
        <div className="absolute inset-0 bg-[#0a0f1e]" />

        {/* Mesh gradient blobs */}
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-blue-600/20 blur-[100px]" />
        <div className="absolute top-1/2 -right-24 w-[350px] h-[350px] rounded-full bg-indigo-500/20 blur-[80px]" />
        <div className="absolute -bottom-24 left-1/3 w-[400px] h-[400px] rounded-full bg-violet-600/15 blur-[90px]" />

        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(circle, #6b8cff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-12 text-white">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-lg leading-none">Softaxis ERP</p>
              <p className="text-white/40 text-xs mt-0.5">Enterprise Platform</p>
            </div>
          </motion.div>

          {/* Hero text */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-16"
          >
            <h2 className="text-4xl font-bold leading-[1.15] tracking-tight">
              The ERP that works
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
                the way you think.
              </span>
            </h2>
            <p className="mt-4 text-white/50 text-base leading-relaxed max-w-sm">
              Purpose-built for MENA. Multi-company, multi-currency, bilingual
              — ready for your enterprise from day one.
            </p>
          </motion.div>

          {/* Feature pills */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.28 }}
            className="mt-10 grid grid-cols-2 gap-3"
          >
            {features.map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.35 + i * 0.06 }}
                className="flex items-center gap-3 bg-white/5 hover:bg-white/8 border border-white/8 rounded-xl px-4 py-3 transition-colors duration-200"
              >
                <span className="text-xl leading-none">{f.icon}</span>
                <div>
                  <p className="text-sm font-medium text-white/90 leading-none">{f.label}</p>
                  <p className="text-xs text-white/40 mt-1">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.65 }}
            className="mt-10 grid grid-cols-4 gap-3"
          >
            {stats.map((s) => (
              <div
                key={s.label}
                className="bg-white/5 border border-white/8 rounded-xl p-4 text-center"
              >
                <p className="text-xl font-bold text-blue-400">{s.value}</p>
                <p className="text-xs text-white/40 mt-1">{s.label}</p>
              </div>
            ))}
          </motion.div>

          {/* Footer */}
          <div className="mt-auto text-white/25 text-xs">
            © 2026 Softaxis Technologies. All rights reserved.
          </div>
        </div>
      </div>

      {/* ── Right auth content ────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background relative">
        {/* Subtle radial glow behind form */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_40%,_hsl(221_83%_53%/0.06)_0%,_transparent_70%)] pointer-events-none" />
        <div className="relative w-full max-w-[420px]">{children}</div>
      </div>
    </div>
  );
}
