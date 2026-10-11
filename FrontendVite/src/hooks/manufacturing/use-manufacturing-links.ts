import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import i18n from "@/i18n";
import { useAuthStore } from "@/store/auth.store";
import { getTenantCurrency } from "@/hooks/use-currency";
import { approvalsApi } from "@/lib/purchase/approvals.api";
import { financeApi, type AccountDto, type JournalLineRequest } from "@/lib/finance/finance.api";
import { manufacturingApi, type ProductionOrderDto } from "@/lib/manufacturing/manufacturing.api";

/**
 * Manufacturing's optional links to other modules. Customers buy modules separately, so every
 * link here is gated on the other module being present AND the user holding its permission —
 * and each one goes through that module's own API. Manufacturing never writes another module's data.
 */

const msg = (key: string, opts?: Record<string, unknown>) => i18n.t(`links.${key}`, { ns: "manufacturing", ...opts });

/** True when the tenant has the module and this user may perform the action in it. */
export function useModuleLink(module: "purchase" | "finance" | "manufacturing", permission: string) {
  const hasModule = useAuthStore(s => s.hasModuleAccess)(module);
  const allowed   = useAuthStore(s => s.hasRawPermission)(permission);
  return hasModule && allowed;
}

// ── Shortage → purchase requisition ─────────────────────────────────────────

export interface ShortageLine { name: string; sku?: string | null; unit: string; quantity: number; unitCost: number; }

export function useRequestPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lines, reference, requiredBy, orderId }: {
      lines: ShortageLine[]; reference: string; requiredBy?: string | null;
      /** The production order the request is for — its number is stored on the order. */
      orderId?: string;
    }) => {
      const requester = useAuthStore.getState().user?.name ?? "Manufacturing";
      const created = await approvalsApi.create({
        title: msg("requisitionTitle", { reference }),
        requestedBy: requester,
        department: "Manufacturing",
        requiredBy: requiredBy || new Date(Date.now() + 7 * 864e5).toISOString().split("T")[0],
        priority: "high",
        category: "raw_materials",
        vendorSuggestion: null,
        justification: msg("requisitionJustification", { reference }),
        currency: getTenantCurrency(),
        items: lines.map(l => ({
          description: `${l.name}${l.sku ? ` (${l.sku})` : ""} — ${l.unit}`,
          quantity: l.quantity,
          estimatedUnitPrice: l.unitCost,
        })),
      });
      // The request exists either way; failing to note its number on the order is not worth an error.
      if (orderId) await manufacturingApi.linkRequisition(orderId, created.requestNumber).catch(() => undefined);
      return created;
    },
    onSuccess: created => {
      qc.invalidateQueries({ queryKey: ["purchase-approvals"] });
      qc.invalidateQueries({ queryKey: ["manufacturing"] });
      toast.success(msg("requisitionCreated", { number: created.requestNumber }));
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Completed order → Finance journal entry ─────────────────────────────────

export interface PostingAccounts { finishedGoodsId: string; materialsId: string; absorbedId: string; scrapId: string; }

const HINTS = {
  finishedGoods: ["finished goods", "inventory", "stock"],
  materials:     ["raw material", "materials", "inventory", "stock"],
  absorbed:      ["production cost", "manufacturing overhead", "factory overhead", "direct labour", "direct labor", "wages payable", "accrued"],
  scrap:         ["scrap", "wastage", "waste", "spoilage", "write-off", "write off", "cost of goods"],
};

function guess(accounts: AccountDto[], hints: string[]) {
  for (const hint of hints) {
    const hit = accounts.find(a => a.name.toLowerCase().includes(hint));
    if (hit) return hit.id;
  }
  return "";
}

const storageKey = () => `mfg-posting-accounts:${useAuthStore.getState().tenant?.id ?? "default"}`;

/** The accounts used last time on this device, else a guess by name. Always shown to the user before posting. */
export function defaultPostingAccounts(accounts: AccountDto[]): PostingAccounts {
  let saved: Partial<PostingAccounts> = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey()) ?? "{}"); } catch { /* fall back to guesses */ }
  const known = (id?: string) => (id && accounts.some(a => a.id === id) ? id : "");
  return {
    finishedGoodsId: known(saved.finishedGoodsId) || guess(accounts, HINTS.finishedGoods),
    materialsId:     known(saved.materialsId)     || guess(accounts, HINTS.materials),
    absorbedId:      known(saved.absorbedId)      || guess(accounts, HINTS.absorbed),
    scrapId:         known(saved.scrapId)         || guess(accounts, HINTS.scrap),
  };
}

/**
 * Finished goods are debited with the cost of the good output and scrap with the rejects' share;
 * raw materials are credited with what was consumed, and labour + overhead with what the routing
 * absorbed. Lines on the same account are netted, so a tenant with a single "Inventory" account
 * posts only the conversion cost.
 */
export function buildProductionJournal(order: ProductionOrderDto, accounts: AccountDto[], picked: PostingAccounts) {
  const conversion = order.labourCost + order.overheadCost;
  const scrap = order.scrapCost ?? 0;
  const net = new Map<string, number>();   // accountId → debit (+) / credit (−)
  const add = (id: string, amount: number) => { if (id && amount) net.set(id, (net.get(id) ?? 0) + amount); };

  add(picked.finishedGoodsId, order.totalCost - scrap);
  add(picked.scrapId, scrap);
  add(picked.materialsId, -order.materialCost);
  add(picked.absorbedId, -conversion);

  const lines: JournalLineRequest[] = [...net.entries()]
    .filter(([, amount]) => Math.abs(amount) >= 0.005)
    .map(([accountId, amount]) => ({
      accountId,
      accountName: accounts.find(a => a.id === accountId)?.name ?? "",
      debitAmount: amount > 0 ? Math.round(amount * 100) / 100 : 0,
      creditAmount: amount < 0 ? Math.round(-amount * 100) / 100 : 0,
      description: `${order.orderNumber} — ${order.productName}`,
    }));

  const debit  = lines.reduce((s, l) => s + l.debitAmount, 0);
  const credit = lines.reduce((s, l) => s + l.creditAmount, 0);
  if (lines.length < 2 || Math.abs(debit - credit) >= 0.01) return null;

  return {
    date: (order.completedAt ?? new Date().toISOString()).split("T")[0],
    description: `Production ${order.orderNumber} — ${order.producedQuantity} ${order.unit} ${order.productName}`,
    reference: order.orderNumber,
    notes: `Cost of production order ${order.orderNumber}.`,
    lines,
  };
}

/** Posts one journal entry per order. Orders that net to nothing with these accounts are skipped. */
export function usePostOrdersToFinance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orders, accounts, picked }: { orders: ProductionOrderDto[]; accounts: AccountDto[]; picked: PostingAccounts }) => {
      const numbers: string[] = [];
      let skipped = 0;
      try {
        for (const order of orders) {
          const payload = buildProductionJournal(order, accounts, picked);
          if (!payload) { skipped++; continue; }

          const created = await financeApi.createJournalEntry(payload) as
            { id?: string; entryNumber?: string; journalNumber?: string } | null;
          if (!created?.id) throw new Error(msg("postFailed"));

          const number = created.entryNumber ?? created.journalNumber ?? null;
          // Remember the link so the order cannot be posted twice.
          await manufacturingApi.linkJournal(order.id, { journalEntryId: created.id, journalEntryNumber: number });
          numbers.push(number ?? order.orderNumber);
        }
      } catch (e) {
        // Say how far it got: the entries already created are real and stay linked.
        if (numbers.length > 0) throw new Error(msg("postPartial", { n: numbers.length, error: (e as Error).message }));
        throw e;
      }
      if (numbers.length === 0) throw new Error(msg("nothingToPost"));
      try { localStorage.setItem(storageKey(), JSON.stringify(picked)); } catch { /* convenience only */ }
      return { numbers, skipped };
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["manufacturing"] });
      qc.invalidateQueries({ queryKey: ["finance"] });
    },
    onSuccess: ({ numbers }) => toast.success(
      numbers.length === 1 ? msg("posted", { number: numbers[0] }) : msg("postedMany", { n: numbers.length })),
    onError: (e: Error) => toast.error(e.message),
  });
}
