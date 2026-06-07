"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  BarChart3, PieChart, TrendingUp, FileText, Download, Filter,
  DollarSign, Package, Users, ShoppingCart, Building2, HardHat,
  ArrowUpRight, Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ReportCard {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  badge?: string;
}

const REPORT_CARDS: ReportCard[] = [
  // Finance
  { id: "r1", title: "Profit & Loss Statement", description: "Income, expenses, and net profit by period", category: "Finance", icon: TrendingUp, color: "text-success", bg: "bg-success/10", badge: "Popular" },
  { id: "r2", title: "Balance Sheet", description: "Assets, liabilities, and equity snapshot", category: "Finance", icon: BarChart3, color: "text-primary", bg: "bg-primary/10" },
  { id: "r3", title: "Cash Flow Statement", description: "Operating, investing, and financing cash flows", category: "Finance", icon: DollarSign, color: "text-warning", bg: "bg-warning/10" },
  { id: "r4", title: "Accounts Receivable Ageing", description: "Outstanding receivables by age bucket", category: "Finance", icon: FileText, color: "text-destructive", bg: "bg-destructive/10" },
  { id: "r5", title: "Tax & VAT Summary", description: "Input/output VAT and net payable by period", category: "Finance", icon: PieChart, color: "text-primary", bg: "bg-primary/10" },
  { id: "r6", title: "Budget vs Actual", description: "Variance analysis across all departments", category: "Finance", icon: BarChart3, color: "text-warning", bg: "bg-warning/10" },
  // Sales
  { id: "r7", title: "Sales Revenue Report", description: "Revenue breakdown by product, customer, region", category: "Sales", icon: TrendingUp, color: "text-success", bg: "bg-success/10", badge: "Popular" },
  { id: "r8", title: "Quotation Conversion Rate", description: "Quote-to-order conversion funnel analysis", category: "Sales", icon: BarChart3, color: "text-primary", bg: "bg-primary/10" },
  { id: "r9", title: "Customer Sales Analysis", description: "Top customers by revenue and order frequency", category: "Sales", icon: Users, color: "text-success", bg: "bg-success/10" },
  // Purchase
  { id: "r10", title: "Purchase Order Report", description: "POs by vendor, status, and delivery performance", category: "Purchase", icon: ShoppingCart, color: "text-primary", bg: "bg-primary/10" },
  { id: "r11", title: "Vendor Performance", description: "On-time delivery, quality, and cost metrics", category: "Purchase", icon: Users, color: "text-warning", bg: "bg-warning/10" },
  // Inventory
  { id: "r12", title: "Stock Valuation Report", description: "Current inventory value by category and location", category: "Inventory", icon: Package, color: "text-primary", bg: "bg-primary/10", badge: "Popular" },
  { id: "r13", title: "Reorder Report", description: "Items at or below reorder point", category: "Inventory", icon: FileText, color: "text-destructive", bg: "bg-destructive/10" },
  { id: "r14", title: "Stock Movement History", description: "Inward, outward, and transfer movements", category: "Inventory", icon: BarChart3, color: "text-success", bg: "bg-success/10" },
  // HR
  { id: "r15", title: "Headcount & Payroll", description: "Employee count and payroll cost by department", category: "HR", icon: Users, color: "text-primary", bg: "bg-primary/10" },
  { id: "r16", title: "Leave Utilisation", description: "Leave taken vs entitlement by employee/team", category: "HR", icon: Calendar, color: "text-warning", bg: "bg-warning/10" },
  // Real Estate
  { id: "r17", title: "Occupancy Report", description: "Unit occupancy rates across all properties", category: "Real Estate", icon: Building2, color: "text-success", bg: "bg-success/10" },
  { id: "r18", title: "Rental Income Report", description: "Rental income by property, unit, and period", category: "Real Estate", icon: DollarSign, color: "text-primary", bg: "bg-primary/10", badge: "Popular" },
  // Construction
  { id: "r19", title: "Project Cost Report", description: "Budget vs actual cost by project and phase", category: "Construction", icon: HardHat, color: "text-warning", bg: "bg-warning/10" },
  { id: "r20", title: "BOQ Progress Report", description: "Bill of quantities completion and variation summary", category: "Construction", icon: FileText, color: "text-primary", bg: "bg-primary/10" },
];

const CATEGORIES = ["All", "Finance", "Sales", "Purchase", "Inventory", "HR", "Real Estate", "Construction"];

export function ReportsView() {
  const [activeCategory, setActiveCategory] = React.useState("All");
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    let list = REPORT_CARDS;
    if (activeCategory !== "All") list = list.filter(r => r.category === activeCategory);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(r => r.title.toLowerCase().includes(s) || r.description.toLowerCase().includes(s) || r.category.toLowerCase().includes(s));
    }
    return list;
  }, [activeCategory, search]);

  const grouped = React.useMemo(() => {
    if (activeCategory !== "All") return { [activeCategory]: filtered };
    return filtered.reduce<Record<string, ReportCard[]>>((acc, r) => {
      if (!acc[r.category]) acc[r.category] = [];
      acc[r.category].push(r);
      return acc;
    }, {});
  }, [filtered, activeCategory]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Comprehensive reporting across all ERP modules</p>
        </div>
        <Button variant="outline" className="gap-2 h-9"><Filter className="h-4 w-4" />Custom Report</Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Reports", value: REPORT_CARDS.length, icon: FileText, color: "text-primary", bg: "bg-primary/10" },
          { label: "Categories", value: CATEGORIES.length - 1, icon: BarChart3, color: "text-success", bg: "bg-success/10" },
          { label: "Scheduled", value: 0, icon: Calendar, color: "text-warning", bg: "bg-warning/10" },
          { label: "Exported", value: 0, icon: Download, color: "text-slate-600", bg: "bg-slate-100 dark:bg-slate-800/50" },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", s.bg)}><Icon className={cn("h-5 w-5", s.color)} /></div>
              <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="font-bold text-lg leading-tight">{s.value}</p></div>
            </motion.div>
          );
        })}
      </div>

      {/* Search + Category Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <BarChart3 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            placeholder="Search reports…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 h-9 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setActiveCategory(c)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                activeCategory === c ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Report Cards Grouped by Category */}
      {Object.entries(grouped).map(([category, reports], gi) => (
        <motion.div key={category} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: gi * 0.05 }}>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">{category}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {reports.map((report, i) => {
              const Icon = report.icon;
              return (
                <motion.div key={report.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
                  className="group bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", report.bg)}>
                      <Icon className={cn("h-4.5 w-4.5", report.color)} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      {report.badge && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-primary/10 text-primary rounded">{report.badge}</span>
                      )}
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <p className="text-sm font-semibold mb-1">{report.title}</p>
                  <p className="text-xs text-muted-foreground">{report.description}</p>
                  <div className="mt-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                      <BarChart3 className="h-3 w-3" />Run Report
                    </button>
                    <button className="flex items-center gap-1 text-xs text-muted-foreground hover:underline">
                      <Download className="h-3 w-3" />Export
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      ))}

      {filtered.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-sm text-muted-foreground">
          No reports found for your search.
        </div>
      )}
    </div>
  );
}
