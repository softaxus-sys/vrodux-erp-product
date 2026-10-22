# Purchase

**Headline:** Control what you buy, from request to receipt.
**Tagline:** Vendors, purchase orders, approvals, goods receipts and returns.

## Features
- **Vendors** — vendor master with create/edit.
- **Purchase orders** — create, send, track; statuses move to partial / received as goods arrive.
- **Goods Receipt Notes (GRN)** — receive against a PO, with subtotal, tax (display) and total; PO status updates by cumulative quantities. For workspaces with Inventory, received lines linked to an inventory product add stock automatically.
- **Purchase returns** — return goods to a vendor against a PO.
- **Purchase invoices (bills)** — Tax, Non-Tax and Import (foreign currency) bills via Finance's accounts-payable.
- **Approvals** — requisitions with approve / reject (reject asks for a reason). Requisitions can also be raised from Manufacturing material shortages and via the AI assistant.

## Works with
Inventory (stock on receipt), Finance (bills, payables), Manufacturing (shortage → requisition), Import/Export (link a shipment to a PO and copy its lines), notifications (approvers are alerted).

## Access control
Permissions for vendors, orders, approvals. Vendor reads are permission-gated.

## Do not claim yet
- A "New request" button on the approvals screen is not wired in the web UI (requisitions are raised from Manufacturing or via the AI assistant).
- "Create PO" from an approved requisition is not built.
- Goods receipts and purchase returns do not post to the ledger (inventory is not carried in the ledger yet).
