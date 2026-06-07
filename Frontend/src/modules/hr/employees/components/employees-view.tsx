"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Users, UserCheck, UserX, Plus, Search, Download, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { useEmployees } from "@/hooks/hr/use-employees";
import { useDepartments } from "@/hooks/hr/use-departments";
import { AddEmployeeForm } from "./add-employee-form";
import type { EmployeeDto } from "@/lib/hr/employees.api";

const STATUS_STYLES: Record<string, string> = {
  active:     "bg-success/10 text-success",
  inactive:   "bg-muted text-muted-foreground",
  terminated: "bg-destructive/10 text-destructive",
};

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  "full-time":  "Full-Time",
  "part-time":  "Part-Time",
  "contract":   "Contract",
  "internship": "Internship",
  "probation":  "Probation",
};

function EmployeeDetailDrawer({ employee, onClose }: { employee: EmployeeDto; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <motion.div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        onClick={onClose}
      />
      <motion.div
        className="ml-auto h-full w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col relative"
        initial={{ x: "100%" }} animate={{ x: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <p className="font-bold">Employee Profile</p>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                {getInitials(employee.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base">{employee.fullName}</p>
              <p className="text-sm text-muted-foreground">{employee.jobTitle ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{employee.departmentName ?? "No Department"}</p>
            </div>
            <span className={cn("shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold capitalize",
              STATUS_STYLES[employee.status] ?? "bg-muted text-muted-foreground")}>
              {employee.status}
            </span>
          </div>
          {[
            { label: "Employee #",      value: employee.employeeNumber },
            { label: "Email",           value: employee.email },
            { label: "Phone",           value: employee.phone ?? "—" },
            { label: "Employment Type", value: EMPLOYMENT_TYPE_LABELS[employee.employmentType] ?? employee.employmentType },
            { label: "Basic Salary",    value: formatCurrency(employee.basicSalary, "AED") },
            { label: "Joining Date",    value: formatDate(employee.joiningDate, "medium") },
            ...(employee.terminationDate ? [{ label: "Termination Date", value: formatDate(employee.terminationDate, "medium") }] : []),
          ].map(row => (
            <div key={row.label} className="flex justify-between items-center py-2.5 border-b border-border/40 last:border-0">
              <span className="text-xs text-muted-foreground">{row.label}</span>
              <span className="text-sm font-medium text-right">{row.value}</span>
            </div>
          ))}
          {employee.notes && (
            <div className="rounded-lg bg-muted/40 p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Notes</p>
              <p className="text-sm">{employee.notes}</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export function EmployeesView() {
  const [search, setSearch]       = React.useState("");
  const [statusFilter, setStatus] = React.useState<string>("all");
  const [deptFilter, setDept]     = React.useState<string>("all");
  const [page, setPage]           = React.useState(1);
  const [selected, setSelected]   = React.useState<EmployeeDto | null>(null);
  const [showAdd, setShowAdd]     = React.useState(false);

  const { data: departments = [] } = useDepartments({ isActive: true });

  const { data, isLoading } = useEmployees({
    page,
    pageSize:     20,
    search:       search || undefined,
    status:       statusFilter !== "all" ? statusFilter : undefined,
    departmentId: deptFilter  !== "all" ? deptFilter   : undefined,
  });

  const employees  = data?.items      ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const activeCount = employees.filter(e => e.status === "active").length;
  const otherCount  = employees.filter(e => e.status !== "active").length;

  const STAT_CARDS = [
    { label: "Showing",       value: employees.length, icon: Users,     color: "text-primary", bg: "bg-primary/10" },
    { label: "Active",        value: activeCount,      icon: UserCheck, color: "text-success", bg: "bg-success/10" },
    { label: "Inactive/Term", value: otherCount,       icon: UserX,     color: "text-warning", bg: "bg-warning/10" },
    { label: "Total",         value: totalCount,       icon: Users,     color: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Employees</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Manage your workforce.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-2"><Download className="h-4 w-4" /> Export</Button>
          <Button size="sm" className="gap-2" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" /> Add Employee
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STAT_CARDS.map((card, i) => (
          <motion.div key={card.label}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", card.bg)}>
              <card.icon className={cn("h-4 w-4", card.color)} />
            </div>
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className={cn("text-lg font-bold", card.color)}>{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search employees…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-9" />
        </div>
        <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground">
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="terminated">Terminated</option>
        </select>
        <select value={deptFilter} onChange={e => { setDept(e.target.value); setPage(1); }}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground">
          <option value="all">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Employee</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">Department</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Type</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Salary</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Joined</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">Loading…</td></tr>
            ) : employees.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">No employees found.</td></tr>
            ) : employees.map(emp => (
              <tr key={emp.id} onClick={() => setSelected(emp)}
                className="border-b border-border/30 last:border-0 hover:bg-muted/20 cursor-pointer transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {getInitials(emp.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{emp.fullName}</p>
                      <p className="text-xs text-muted-foreground">{emp.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">{emp.departmentName ?? "—"}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell capitalize">
                  {EMPLOYMENT_TYPE_LABELS[emp.employmentType] ?? emp.employmentType}
                </td>
                <td className="px-4 py-3 text-sm text-right font-medium hidden sm:table-cell">
                  {formatCurrency(emp.basicSalary, "AED")}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">
                  {formatDate(emp.joiningDate, "medium")}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold capitalize",
                    STATUS_STYLES[emp.status] ?? "bg-muted text-muted-foreground")}>
                    {emp.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10">
            <p className="text-xs text-muted-foreground">Page {page} of {totalPages} · {totalCount} total</p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {selected && <EmployeeDetailDrawer employee={selected} onClose={() => setSelected(null)} />}
      <AddEmployeeForm open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
