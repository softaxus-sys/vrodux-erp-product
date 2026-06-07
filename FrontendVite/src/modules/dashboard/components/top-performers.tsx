import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrency, getInitials } from "@/lib/utils";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface Performer {
  name: string;
  role: string;
  revenue: number;
  deals: number;
}

export function TopPerformers({ performers }: { performers: Performer[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-warning" />
          <CardTitle className="text-base">Top Performers</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {performers.map((person, i) => (
          <div key={person.name} className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-8 w-8">
                <AvatarFallback className={cn(
                  "text-[10px] font-bold",
                  i === 0 ? "bg-warning/20 text-warning" :
                  i === 1 ? "bg-muted text-muted-foreground" :
                  "bg-muted text-muted-foreground"
                )}>
                  {getInitials(person.name)}
                </AvatarFallback>
              </Avatar>
              {i < 3 && (
                <span className={cn(
                  "absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full flex items-center justify-center text-[8px] font-bold",
                  i === 0 ? "bg-warning text-white" :
                  i === 1 ? "bg-muted-foreground/60 text-white" :
                  "bg-primary/60 text-white"
                )}>
                  {i + 1}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{person.name}</p>
              <p className="text-[10px] text-muted-foreground">{person.deals} deals</p>
            </div>
            <span className="text-xs font-bold text-success">
              {formatCurrency(person.revenue, "AED")}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

