/**
 * ExportMenu — drop-in replacement for the plain "Export" button.
 * Renders a dropdown with "Export CSV" and "Export PDF" options.
 *
 * Usage:
 *   <ExportMenu onCsv={exportCsv} onPdf={exportPdf} />
 */

import * as React from "react";
import { Download, FileText, FileSpreadsheet, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface ExportMenuProps {
  onCsv: () => void;
  onPdf: () => void;
  size?: "sm" | "default";
  className?: string;
  disabled?: boolean;
}

export function ExportMenu({ onCsv, onPdf, size = "sm", className, disabled }: ExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size}
          className={className ?? "h-9 gap-1.5 text-sm"}
          disabled={disabled}
        >
          <Download className="h-3.5 w-3.5" />
          Export
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={onCsv} className="gap-2.5 cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 text-success" />
          <div>
            <p className="text-sm font-medium">Export CSV</p>
            <p className="text-[10px] text-muted-foreground">Spreadsheet (.csv)</p>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onPdf} className="gap-2.5 cursor-pointer">
          <FileText className="h-4 w-4 text-destructive" />
          <div>
            <p className="text-sm font-medium">Export PDF</p>
            <p className="text-[10px] text-muted-foreground">Branded report (.pdf)</p>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
