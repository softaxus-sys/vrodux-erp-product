import * as React from "react";
import { UserPlus, Download, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmployeeStats } from "./employee-stats";
import { EmployeeTable } from "./employee-table";
import { EmployeeGrid } from "./employee-grid";
import { EmployeeDrawer } from "./employee-drawer";
import type { EmployeeDto as Employee } from "@/lib/hr/hr.api";
import { useEmployees, useHrSummary } from "@/hooks/hr/use-hr";
import { cn } from "@/lib/utils";
import { AddEmployeeForm } from "./add-employee-form";

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
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setShowAddForm(true)}>
            <UserPlus className="h-4 w-4" /> Add Employee
          </Button>
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

