import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DealCard } from "./deal-card";
import { formatCurrency, cn } from "@/lib/utils";
import { PIPELINE_STAGES, type DealDto as Deal } from "@/lib/crm/crm.api";
import { useMoveDealStage } from "@/hooks/crm/use-crm";
import { useCurrency } from "@/hooks/use-currency";
import { useLazyList } from "@/hooks/use-lazy-list";

const COLUMN_PAGE = 15;

const LOSS_REASONS = ["Price too high", "Lost to competitor", "No budget", "No decision / timing", "Bad fit", "Went silent", "Other"];

const STAGE_PROBABILITY: Record<string, number> = {
  lead: 10, qualified: 30, proposal: 60, negotiation: 80, won: 100, lost: 0,
};

interface Props {
  deals: Deal[];
  onDealClick: (deal: Deal) => void;
}

export function PipelineBoard({ deals, onDealClick }: Props) {
  const moveStage = useMoveDealStage();
  const [draggedId, setDraggedId] = React.useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = React.useState<string | null>(null);
  const [stageDeals, setStageDeals] = React.useState<Deal[]>(deals);
  const [pendingLost, setPendingLost] = React.useState<{ id: string; title: string } | null>(null);
  const [lossReason, setLossReason] = React.useState("");

  React.useEffect(() => { setStageDeals(deals); }, [deals]);

  // Top-value deals first within each column.
  const byStage = (stage: string) =>
    stageDeals.filter(d => d.stage === stage).sort((a, b) => b.value - a.value);

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
    const id = draggedId;
    const current = stageDeals.find(d => d.id === id);
    setDraggedId(null);
    setDragOverStage(null);
    if (!current || current.stage === stage) return;
    // Dropping into Lost — capture a loss reason before persisting.
    if (stage === "lost") {
      setLossReason("");
      setPendingLost({ id, title: current.title });
      return;
    }
    const probability = STAGE_PROBABILITY[stage] ?? current.probability;
    // optimistic update, then persist
    setStageDeals(prev => prev.map(d => d.id === id ? { ...d, stage: stage as Deal["stage"], probability } : d));
    moveStage.mutate({ id, stage, probability });
  };

  const confirmLost = () => {
    if (!pendingLost) return;
    const { id } = pendingLost;
    setStageDeals(prev => prev.map(d => d.id === id ? { ...d, stage: "lost" as Deal["stage"], probability: 0 } : d));
    moveStage.mutate({ id, stage: "lost", probability: 0, lossReason: lossReason.trim() || undefined });
    setPendingLost(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverStage(null);
  };

  return (
    <>
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[600px]">
      {PIPELINE_STAGES.map(stage => (
        <BoardColumn
          key={stage.key}
          stage={stage}
          cards={byStage(stage.key)}
          isOver={dragOverStage === stage.key}
          draggedId={draggedId}
          onDragOver={e => handleDragOver(e, stage.key)}
          onDrop={e => handleDrop(e, stage.key)}
          onDragLeave={() => setDragOverStage(null)}
          onCardDragStart={handleDragStart}
          onCardDragEnd={handleDragEnd}
          onDealClick={onDealClick}
        />
      ))}
    </div>

    {/* Loss reason capture */}
    <AnimatePresence>
      {pendingLost && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setPendingLost(null)}
          />
          <motion.div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-card border border-border rounded-2xl z-50 shadow-2xl"
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="text-base font-bold">Mark deal as lost</h3>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{pendingLost.title}</p>
              </div>
              <button onClick={() => setPendingLost(null)} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Why was it lost?</p>
              <div className="flex flex-wrap gap-1.5">
                {LOSS_REASONS.map(r => (
                  <button
                    key={r}
                    onClick={() => setLossReason(r)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                      lossReason === r ? "border-destructive bg-destructive/10 text-destructive" : "border-border text-muted-foreground hover:border-destructive/40"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <textarea
                value={lossReason}
                onChange={e => setLossReason(e.target.value)}
                placeholder="Add detail (optional)…"
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/30 resize-none"
              />
            </div>
            <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPendingLost(null)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmLost}>Mark as lost</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  );
}

type Stage = (typeof PIPELINE_STAGES)[number];

function BoardColumn({
  stage, cards, isOver, draggedId, onDragOver, onDrop, onDragLeave,
  onCardDragStart, onCardDragEnd, onDealClick,
}: {
  stage: Stage;
  cards: Deal[];
  isOver: boolean;
  draggedId: string | null;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onCardDragStart: (e: React.DragEvent, id: string) => void;
  onCardDragEnd: () => void;
  onDealClick: (d: Deal) => void;
}) {
  const currency = useCurrency();
  const { visible, hasMore, loadMore, shown, total } = useLazyList(cards, COLUMN_PAGE);
  const colValue = cards.reduce((s, d) => s + d.value, 0);

  return (
    <div
      className="flex flex-col flex-shrink-0 w-72"
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
    >
      {/* Column header */}
      <div className={cn(
        "flex items-center justify-between px-3 py-2.5 rounded-xl mb-3 border transition-colors",
        isOver ? "border-primary/40 bg-primary/5" : `${stage.bg} border-transparent`
      )}>
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-bold uppercase tracking-wide", stage.color)}>{stage.label}</span>
          <span className={cn("inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold", stage.color, stage.bg)}>
            {total}
          </span>
        </div>
        <span className="text-[11px] font-semibold text-muted-foreground">
          {colValue > 0 ? formatCurrency(colValue, currency) : "—"}
        </span>
      </div>

      {/* Cards */}
      <div className={cn(
        "flex flex-col gap-3 flex-1 rounded-xl p-2 transition-colors min-h-[100px]",
        isOver && "bg-primary/3 ring-1 ring-primary/20"
      )}>
        {visible.map((deal, i) => (
          <div
            key={deal.id}
            draggable
            onDragStart={e => onCardDragStart(e, deal.id)}
            onDragEnd={onCardDragEnd}
            className={cn("transition-opacity", draggedId === deal.id && "opacity-40")}
          >
            <DealCard deal={deal} index={i} onClick={() => onDealClick(deal)} />
          </div>
        ))}

        {hasMore && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground" onClick={loadMore}>
            Show {total - shown} more
          </Button>
        )}

        {total === 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className={cn(
              "flex-1 flex items-center justify-center rounded-lg border-2 border-dashed text-xs text-muted-foreground/50 h-24",
              isOver ? "border-primary/40 text-primary" : "border-border"
            )}
          >
            {isOver ? "Drop here" : "No deals"}
          </motion.div>
        )}
      </div>
    </div>
  );
}

