"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Calendar, User, Building2, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DealPriorityBadge } from "./deal-status-badge";
import { formatCurrency, getInitials, cn } from "@/lib/utils";
import type { DealDto } from "@/lib/crm/deals.api";

interface Props {
  deal: DealDto;
  index: number;
  onClick: () => void;
}

const probabilityColor = (p: number) =>
  p >= 70 ? "bg-success" : p >= 40 ? "bg-warning" : "bg-destructive";

export function DealCard({ deal, index, onClick }: Props) {
  const daysUntilClose = Math.ceil(
    (new Date(deal.expectedCloseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const isOverdue = daysUntilClose < 0 && deal.stage !== "won" && deal.stage !== "lost";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={onClick}
      className={cn(
        "bg-background border border-border rounded-xl p-4 cursor-pointer",
        "hover:border-primary/40 hover:shadow-md transition-all duration-200",
        "group"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {deal.title}
          </p>
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="truncate">{deal.company}</span>
          </div>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 mt-0.5" />
      </div>

      {/* Value */}
      <div className="mb-3">
        <p className="text-base font-bold text-foreground">
          {formatCurrency(deal.value, deal.currency)}
        </p>
      </div>

      {/* Probability bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
          <span>Probability</span>
          <span className="font-medium">{deal.probability}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", probabilityColor(deal.probability))}
            style={{ width: `${deal.probability}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <DealPriorityBadge priority={deal.priority} />
        <div className="flex items-center gap-2">
          <div className={cn("flex items-center gap-1 text-[10px]", isOverdue ? "text-destructive" : "text-muted-foreground")}>
            <Calendar className="h-3 w-3" />
            <span>
              {isOverdue
                ? `${Math.abs(daysUntilClose)}d overdue`
                : daysUntilClose === 0
                ? "Due today"
                : `${daysUntilClose}d left`}
            </span>
          </div>
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[8px] font-bold bg-primary/10 text-primary">
              {getInitials(deal.assignedTo)}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </motion.div>
  );
}
