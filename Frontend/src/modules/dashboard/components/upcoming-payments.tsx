"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Clock } from "lucide-react";

interface Payment {
  id: string;
  vendor: string;
  amount: number;
  dueDate: string;
  status: "pending" | "overdue";
}

export function UpcomingPayments({ payments }: { payments: Payment[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Upcoming Payments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {payments.map((payment) => (
          <div key={payment.id} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Clock className="h-3.5 w-3.5 text-warning shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{payment.vendor}</p>
                <p className="text-[10px] text-muted-foreground">
                  Due {formatDate(payment.dueDate, "short")}
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-warning shrink-0">
              {formatCurrency(payment.amount, "AED")}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
