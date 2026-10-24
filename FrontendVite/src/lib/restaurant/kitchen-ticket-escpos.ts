import { EscPos } from "@/lib/pos/escpos";

export interface KitchenTicketLine {
  name: string;
  quantity: number;
  /** Chosen options (e.g. "Large, Extra cheese") — printed under the item. */
  options?: string[];
  /** Free-text instruction from the waiter. */
  note?: string | null;
}

/**
 * The kitchen's copy of an order, printed at the till. Used when the till cannot reach the server:
 * the kitchen screen on another device never sees an offline order, so paper is the only way the
 * kitchen learns of it. Large type for item and table, no prices — this is for cooks.
 */
export function buildKitchenTicket(p: {
  orderNumber: string;
  table: string;
  waiter: string;
  lines: KitchenTicketLine[];
  offline: boolean;
}): Uint8Array {
  const esc = new EscPos(46);
  esc.init().center().boldOn().println("KITCHEN").boldOff();
  if (p.offline) esc.println("(taken offline)");
  esc.bigOn().boldOn().println(p.table).bigOff().boldOff();
  esc.println(`${p.orderNumber}  ·  ${p.waiter}`);
  esc.println(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  esc.left().rule();
  for (const l of p.lines) {
    esc.setSize(2, 2).boldOn().println(`${l.quantity} x ${l.name}`).setSize(1, 1).boldOff();
    for (const o of l.options ?? []) esc.println(`   + ${o}`);
    if (l.note) esc.boldOn().println(`   ! ${l.note}`).boldOff();
  }
  esc.rule().feed(3).cut();
  return esc.build();
}
