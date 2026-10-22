# Manufacturing

**Headline:** From bill of materials to finished goods — with real cost.
**Tagline:** BOMs, routing, production orders, stock issue/receipt and yield.

## Features
- **Bills of Materials** — finished product, batch size, components with scrap %, status draft/active/archived; component details read from Inventory.
- **Routing & work centres** — labour and overhead rates per hour; operations (setup once per order, run per batch).
- **Production orders** — planned → released → in progress → completed (cancel before issue); components scaled from the BOM at creation so editing a BOM never changes a live order.
- **Stock** — issue materials (with a shortage check), complete with optional backflush; scrapped units are not received; finished goods are received into Inventory at actual unit cost.
- **Costing** — materials issued + labour and overhead from actual operation time; unit cost per good unit.
- **Planning** — material requirements across open orders vs stock; **yield report** (output, scrap, yield %, average unit cost).
- **Optional links** — raise a purchase requisition from shortages (needs Purchase); "Plan production" from a sales order (needs Sales); post production cost to Finance as a draft journal entry you review.
- Default Manufacturing Manager and Staff roles; available automatically for tenants with the Manufacturing industry.

## Needs
Inventory (the only hard dependency).

## Do not claim yet
- Returning issued materials; updating Inventory product cost on receipt; capacity scheduling; a manufacturing dashboard; per-warehouse stock checks.
- Costing covers materials, labour and overhead from work-centre rates only.
