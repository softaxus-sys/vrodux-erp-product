"use client";

import * as React from "react";
import { Search, Mail, Phone, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmployeeStatusBadge } from "./employee-status-badge";
import { getInitials, cn } from "@/lib/utils";
import type { EmployeeDto as Employee } from "@/lib/hr/employees.api";

const DEPARTMENTS = ["All Departments","Technology","Finance","Human Resources","Sales & Marketing","Operations","Real Estate","Construction","Legal","Administration"];

interface Props { employees: Employee[]; onView: (e: Employee) => void; }

export function EmployeeGrid({ employees, onView }: Props) {
  const [search, setSearch] = React.useState("");
  const [deptFilter, setDeptFilter] = React.useState("All Departments");

  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !search || e.fullName.toLowerCase().includes(q) || e.designation.toLowerCase().includes(q);
    const matchDept = deptFilter === "All Departments" || e.department === deptFilter;
    return matchSearch && matchDept;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
          {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((emp, i) => (
          <motion.div key={emp.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04 }}>
            <Card className="card-hover cursor-pointer" onClick={() => onView(emp)}>
              <CardContent className="p-5">
                <div className="flex flex-col items-center text-center mb-4">
                  <Avatar className="h-16 w-16 mb-3">
                    <AvatarImage src={emp.avatar} />
                    <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
                      {getInitials(emp.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="font-semibold text-sm leading-tight">{emp.fullName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{emp.designation}</p>
                  <div className="mt-2"><EmployeeStatusBadge status={emp.status} /></div>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground border-t border-border/50 pt-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{emp.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3 shrink-0" />
                    <span>{emp.mobile}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span>{emp.branch} · {emp.department}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center">Showing {filtered.length} of {employees.length} employees</p>
    </div>
  );
}
