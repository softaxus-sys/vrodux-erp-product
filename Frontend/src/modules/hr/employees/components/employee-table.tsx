"use client";

import * as React from "react";
import { Search, MoreHorizontal, Eye, Edit, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmployeeStatusBadge } from "./employee-status-badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDate, formatCurrency, getInitials, cn } from "@/lib/utils";
import type { EmployeeDto as Employee } from "@/lib/hr/employees.api";
type EmployeeStatus = string;
const DEPARTMENTS = ["All Departments","Technology","Finance","Human Resources","Sales & Marketing","Operations","Real Estate","Construction","Legal","Administration"];

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "On Leave", value: "on_leave" },
  { label: "Probation", value: "probation" },
  { label: "Terminated", value: "terminated" },
];

type SortField = "fullName" | "department" | "designation" | "joinDate" | "basicSalary";
type SortDir = "asc" | "desc";

interface Props { employees: Employee[]; onView: (e: Employee) => void; }

export function EmployeeTable({ employees, onView }: Props) {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [deptFilter, setDeptFilter] = React.useState("All Departments");
  const [sortField, setSortField] = React.useState<SortField>("fullName");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const filtered = React.useMemo(() => {
    return employees
      .filter(e => {
        const q = search.toLowerCase();
        const matchSearch = !search ||
          e.fullName.toLowerCase().includes(q) ||
          e.employeeId.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          e.designation.toLowerCase().includes(q);
        const matchStatus = statusFilter === "all" || e.status === statusFilter;
        const matchDept = deptFilter === "All Departments" || e.department === deptFilter;
        return matchSearch && matchStatus && matchDept;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === "fullName") cmp = a.fullName.localeCompare(b.fullName);
        else if (sortField === "department") cmp = a.department.localeCompare(b.department);
        else if (sortField === "designation") cmp = a.designation.localeCompare(b.designation);
        else if (sortField === "joinDate") cmp = a.joinDate.localeCompare(b.joinDate);
        else if (sortField === "basicSalary") cmp = a.basicSalary - b.basicSalary;
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [employees, search, statusFilter, deptFilter, sortField, sortDir]);

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField !== field ? <ChevronUp className="h-3 w-3 opacity-20" /> :
      sortDir === "asc" ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" />;

  const th = (label: string, field: SortField) => (
    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer select-none whitespace-nowrap"
      onClick={() => handleSort(field)}>
      <div className="flex items-center gap-1">{label}<SortIcon field={field} /></div>
    </th>
  );

  return (
    <Card>
      <CardHeader className="pb-0">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search name, ID, designation..." value={search}
                onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
            </div>
            {/* Department filter */}
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          {/* Status filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {STATUS_FILTERS.map(f => (
              <button key={f.value} onClick={() => setStatusFilter(f.value)}
                className={cn("px-3 py-1 rounded-full text-xs font-medium transition-colors",
                  statusFilter === f.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-y border-border bg-muted/30">
              <tr>
                {th("Employee", "fullName")}
                {th("Department", "department")}
                {th("Designation", "designation")}
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Branch</th>
                {th("Join Date", "joinDate")}
                {th("Salary", "basicSalary")}
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-16 text-muted-foreground text-sm">No employees found.</td></tr>
              ) : (
                filtered.map((emp, i) => (
                  <motion.tr key={emp.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="erp-table-row cursor-pointer group" onClick={() => onView(emp)}>
                    {/* Employee */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={emp.avatar} />
                          <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">
                            {getInitials(emp.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm leading-tight">{emp.fullName}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{emp.employeeId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{emp.department}</td>
                    <td className="px-4 py-3 text-sm">{emp.designation}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{emp.branch}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{formatDate(emp.joinDate, "medium")}</td>
                    <td className="px-4 py-3 font-semibold text-sm whitespace-nowrap">{formatCurrency(emp.basicSalary, "AED")}</td>
                    <td className="px-4 py-3"><EmployeeStatusBadge status={emp.status} /></td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onView(emp)}><Eye className="mr-2 h-4 w-4" />View Profile</DropdownMenuItem>
                          <DropdownMenuItem><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />Terminate
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
          <span>Showing {filtered.length} of {employees.length} employees</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled>Previous</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs px-3 bg-primary/5 border-primary/20 text-primary">1</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled>Next</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
