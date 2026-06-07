"use client";

import * as React from "react";
import { Search, Filter, Eye, MoreHorizontal, Copy, Send, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InvoiceSummaryDtoStatusBadge } from "./invoice-status-badge";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { InvoiceSummaryDtoSummaryDto } from "@/lib/finance/invoices.api";
type InvoiceSummaryDtoStatus = string;
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Sent", value: "sent" },
  { label: "Paid", value: "paid" },
  { label: "Overdue", value: "overdue" },
  { label: "Partial", value: "partial" },
  { label: "Cancelled", value: "cancelled" },
];

type SortField = "number" | "customerName" | "issueDate" | "dueDate" | "total" | "status";
type SortDir = "asc" | "desc";

interface InvoiceSummaryDtoTableProps {
  invoices: InvoiceSummaryDto[];
  onView: (invoice: InvoiceSummaryDto) => void;
}

export function InvoiceSummaryDtoTable({ invoices, onView }: InvoiceSummaryDtoTableProps) {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sortField, setSortField] = React.useState<SortField>("issueDate");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  const filtered = React.useMemo(() => {
    return invoices
      .filter((inv) => {
        const matchSearch =
          !search ||
          inv.number.toLowerCase().includes(search.toLowerCase()) ||
          inv.customerName.toLowerCase().includes(search.toLowerCase()) ||
          inv.reference?.toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === "all" || inv.status === statusFilter;
        return matchSearch && matchStatus;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === "number") cmp = a.number.localeCompare(b.number);
        else if (sortField === "customerName") cmp = a.customerName.localeCompare(b.customerName);
        else if (sortField === "issueDate") cmp = a.issueDate.localeCompare(b.issueDate);
        else if (sortField === "dueDate") cmp = a.dueDate.localeCompare(b.dueDate);
        else if (sortField === "total") cmp = a.total - b.total;
        else if (sortField === "status") cmp = a.status.localeCompare(b.status);
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [invoices, search, statusFilter, sortField, sortDir]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp className="h-3 w-3 opacity-20" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 text-primary" />
      : <ChevronDown className="h-3 w-3 text-primary" />;
  };

  const th = (label: string, field: SortField) => (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer select-none whitespace-nowrap"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label} <SortIcon field={field} />
      </div>
    </th>
  );

  return (
    <Card>
      <CardHeader className="pb-0">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search invoices, customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          {/* Status filters */}
          <div className="flex items-center gap-1 flex-wrap">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                  statusFilter === f.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
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
                {th("InvoiceSummaryDto #", "number")}
                {th("Customer", "customerName")}
                {th("Issue Date", "issueDate")}
                {th("Due Date", "dueDate")}
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Branch</th>
                {th("Amount", "total")}
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Balance Due</th>
                {th("Status", "status")}
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-muted-foreground text-sm">
                    No invoices found.
                  </td>
                </tr>
              ) : (
                filtered.map((inv, i) => (
                  <motion.tr
                    key={inv.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="erp-table-row cursor-pointer group"
                    onClick={() => onView(inv)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-primary">{inv.number}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-sm">{inv.customerName}</p>
                        {inv.reference && (
                          <p className="text-xs text-muted-foreground">{inv.reference}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(inv.issueDate, "medium")}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn(
                        "text-sm",
                        inv.status === "overdue" ? "text-destructive font-semibold" : "text-muted-foreground"
                      )}>
                        {formatDate(inv.dueDate, "medium")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{inv.branch}</td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">
                      {formatCurrency(inv.total, "AED")}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn(
                        "font-medium text-sm",
                        inv.balanceDue > 0 ? "text-warning" : "text-muted-foreground"
                      )}>
                        {inv.balanceDue > 0 ? formatCurrency(inv.balanceDue, "AED") : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <InvoiceSummaryDtoStatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onView(inv)}>
                            <Eye className="mr-2 h-4 w-4" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Copy className="mr-2 h-4 w-4" /> Duplicate
                          </DropdownMenuItem>
                          {inv.status === "draft" && (
                            <DropdownMenuItem>
                              <Send className="mr-2 h-4 w-4" /> Send to Customer
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
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

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
          <span>Showing {filtered.length} of {invoices.length} invoices</span>
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
