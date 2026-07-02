import * as React from "react";
import { UserPlus, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmployeeStats } from "./employee-stats";
import { EmployeeTable } from "./employee-table";
import { EmployeeGrid } from "./employee-grid";
import { EmployeeDrawer } from "./employee-drawer";
import type { EmployeeDto as Employee } from "@/lib/hr/hr.api";
import { useEmployees, useHrSummary } from "@/hooks/hr/use-hr";
import { cn } from "@/lib/utils";
import { toCsv, downloadFile } from "@/lib/csv";
import { exportPdf } from "@/lib/pdf";
import { ExportMenu } from "@/components/ui/export-menu";
import { AddEmployeeForm } from "./add-employee-form";
import { Can } from "@/components/auth/can";

type ViewMode = "table" | "grid";

export function EmployeesView() {
  const { data: employees = [] } = useEmployees();
  const { data: hrSummary } = useHrSummary();

  const [viewMode, setViewMode] = React.useState<ViewMode>("table");
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Employee | null>(null);
  const [showAddForm, setShowAddForm] = React.useState(false);

  const handleView = (emp: Employee) => {
    setSelected(emp);
    setDrawerOpen(true);
  };

  const COLS = ["Employee ID","Full Name","Email","Phone","Department","Designation","Contract Type","Status","Join Date","Basic Salary","Currency"] as const;

  const exportCsv = () => {
    const csv = toCsv(employees.map(e => ({
      "Employee ID":   e.employeeId,
      "Full Name":     e.fullName,
      "Email":         e.email,
      "Phone":         e.phone,
      "Department":    e.department,
      "Designation":   e.designation,
      "Contract Type": e.contractType,
      "Status":        e.status,
      "Join Date":     e.joinDate ?? "",
      "Basic Salary":  e.basicSalary,
      "Currency":      e.currency,
    })), ["Employee ID","Full Name","Email","Phone","Department","Designation","Contract Type","Status","Join Date","Basic Salary","Currency"]);
    downloadFile(`employees_${new Date().toISOString().split("T")[0]}.csv`, csv);
  };

  const exportPdfReport = () => {
    exportPdf({
      title: "Employee Directory",
      subtitle: `${employees.length} employees · ${new Date().toLocaleDateString("en-AE", { month: "long", year: "numeric" })}`,
      columns: [...COLS],
      rows: employees.map(e => [e.employeeId, e.fullName, e.email, e.phone, e.department, e.designation, e.contractType, e.status, e.joinDate ?? "—", e.basicSalary, e.currency]),
      landscape: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Employees</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Manage employee profiles, contracts, and records.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* View toggle */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "p-2 transition-colors",
                viewMode === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-2 transition-colors",
                viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} className="gap-2" />
          <Can permission="hr.employees.create">
            <Button size="sm" className="gap-2" onClick={() => setShowAddForm(true)}>
              <UserPlus className="h-4 w-4" /> Add Employee
            </Button>
          </Can>
        </div>
      </div>

      {/* Stats */}
      {hrSummary && <EmployeeStats summary={hrSummary} />}

      {/* Table or Grid */}
      {viewMode === "table" ? (
        <EmployeeTable employees={employees} onView={handleView} />
      ) : (
        <EmployeeGrid employees={employees} onView={handleView} />
      )}

      {/* Profile Drawer */}
      <EmployeeDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        employee={selected}
      />
      <AddEmployeeForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}

