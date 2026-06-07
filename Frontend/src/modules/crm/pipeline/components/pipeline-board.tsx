"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DealDtoCard } from "./deal-card";
import { formatCurrency, cn } from "@/lib/utils";
import { PIPELINE_STAGES, type DealDtoDto } from "@/lib/crm/deals.api";

interface Props {
  deals: DealDto[];
  onDealDtoClick: (deal: DealDto) => void;
}

export function PipelineBoard({ deals, onDealDtoClick }: Props) {
  const [draggedId, setDraggedId] = React.useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = React.useState<string | null>(null);
  const [stageDealDtos, setStageDealDtos] = React.useState<DealDto[]>(deals);

  React.useEffect(() => { setStageDealDtos(deals); }, [deals]);

  const byStage = (stage: string) => stageDealDtos.filter(d => d.stage === stage);

  const stageValue = (stage: string) =>
    byStage(stage).reduce((s, d) => s + d.value, 0);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStage(stage);
  };

  const handleDrop = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    if (!draggedId) return;
    setStageDealDtos(prev =>
      prev.map(d => d.id === draggedId ? { ...d, stage: stage as DealDto["stage"] } : d)
    );
    setDraggedId(null);
    setDragOverStage(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverStage(null);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[600px]">
      {PIPELINE_STAGES.map(stage => {
        const cards = byStage(stage.key);
        const isOver = dragOverStage === stage.key;

        return (
          <div
            key={stage.key}
            className="flex flex-col flex-shrink-0 w-72"
            onDragOver={e => handleDragOver(e, stage.key)}
            onDrop={e => handleDrop(e, stage.key)}
            onDragLeave={() => setDragOverStage(null)}
          >
            {/* Column header */}
            <div className={cn(
              "flex items-center justify-between px-3 py-2.5 rounded-xl mb-3 border transition-colors",
              isOver ? "border-primary/40 bg-primary/5" : `${stage.bg} border-transparent`
            )}>
              <div className="flex items-center gap-2">
                <span className={cn("text-xs font-bold uppercase tracking-wide", stage.color)}>
                  {stage.label}
                </span>
                <span className={cn(
                  "inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold",
                  stage.color, stage.bg
                )}>
                  {cards.length}
                </span>
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground">
                {stageValue(stage.key) > 0 ? formatCurrency(stageValue(stage.key), "AED") : "—"}
              </span>
            </div>

            {/* Cards */}
            <div className={cn(
              "flex flex-col gap-3 flex-1 rounded-xl p-2 transition-colors min-h-[100px]",
              isOver && "bg-primary/3 ring-1 ring-primary/20"
            )}>
              {cards.map((deal, i) => (
                <div
                  key={deal.id}
                  draggable
                  onDragStart={e => handleDragStart(e, deal.id)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "transition-opacity",
                    draggedId === deal.id && "opacity-40"
                  )}
                >
                  <DealDtoCard deal={deal} index={i} onClick={() => onDealDtoClick(deal)} />
                </div>
              ))}

              {cards.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={cn(
                    "flex-1 flex items-center justify-center rounded-lg border-2 border-dashed",
                    "text-xs text-muted-foreground/50 h-24",
                    isOver ? "border-primary/40 text-primary" : "border-border"
                  )}
                >
                  {isOver ? "Drop here" : "No deals"}
                </motion.div>
              )}
            </div>

            {/* Add deal button */}
            {stage.key !== "won" && stage.key !== "lost" && (
              <Button variant="ghost" size="sm" className="mt-2 h-8 text-xs text-muted-foreground justify-start gap-1.5 hover:text-foreground">
                <Plus className="h-3.5 w-3.5" />
                Add deal
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
