# One product catalogue — Inventory is the source of truth

> Status: **design agreed 2026-10-27, step 0 built.** Nothing in this file has changed live-tenant data yet.
> Read this first if you pick the work up in a new session.

## Why

Products live in two places today: `pos.products` (created from the POS screens) and
`inventory.products` (created from Inventory). Categories, stock and stock movements are duplicated too.
Four raw-SQL queries UNION the two, and `CrossSchemaProductService` branches on "which schema owns this
product" for every sale, refund and void. E-commerce (variants, galleries, channels, Shopify) needs one
catalogue it can trust, and a stock figure that cannot differ depending on which screen created the item.

## Rules

1. `inventory.products` (+ `product_stock`, `stock_movements`, `product_categories`) is the **only** place
   a product, its categories and its stock are written.
2. **The POS and Restaurant screens do not change.** Their routes (`/api/products`, `/api/categories`),
   request/response shapes and permissions (`pos.products.*`) stay exactly as they are. Their handlers become
   a thin facade that reads and writes Inventory.
3. A tenant that has POS, Restaurant POS, Manufacturing or E-commerce **always has Inventory** (step 0, done).
4. Live tenants move one at a time, with a dry-run report first, and the old rows are kept (flagged), not dropped.

## Step 0 — mandatory Inventory (DONE)

- `Identity.Domain/Entities/ModuleDependencies.cs`: the one rule table (`pos→inventory`, `restaurant→pos`,
  `manufacturing→inventory`, `ecommerce→inventory`) and `Close()`. `Tenant.ResolvedModules` now closes the list
  over it, so the JWT `modules` claim always carries Inventory for these tenants — signup, super-admin
  grant, industry pack, manual grant alike. (Before this only Restaurant and Manufacturing added it; a POS-only
  grant did not.)
- Gateway `LicensedModules.Requires`: `ecommerce→inventory` added (schema install for on-prem).
- Super-admin `module-selector.tsx`: turning a module on adds what it needs; a module another selected module
  needs is locked (lock icon, tooltip "Required by …"); an incomplete saved list is completed on open.
- Signup (`module-data.ts`) already did this: auto-added modules show "Required" and cannot be toggled.
- **Existing tenants:** a POS tenant without Inventory gets it in their next token (re-login). Nothing is
  created or deleted; Inventory simply appears.
- `ecommerce` is in the rule tables but **not yet in any picker** — it is added to the UI when the module has
  pages (no selectable module that does nothing).
- Still true and to be removed later: gateway `Requires["inventory"] = ["pos"]` exists only because Inventory's
  `StockMovementRepository` writes back to `[pos].[products]`. It goes away at step 4.

## Where the code touches `pos.products` today (found by search — the work list)

POS API/Application: `ProductsController`, `CategoriesController`, `CatalogueController` /
`ImportCatalogueCommand`, `VendorsController` + `PurchaseOrdersController` (POS has its own vendors and POs
that adjust POS stock), `PosDashboardController`, `ReportService`, `LowStockReadService`,
`BranchStockReadService`, `POSSeedData`, `GetProducts*`/`CreateProduct`/`UpdateProduct`/`DeleteProduct`/
`AdjustStock` handlers, `POS ProductRepository`.
Sale paths: `CrossSchemaProductService` (already supports both schemas), `CreateSale`, `RefundTransaction`,
`VoidTransaction`, `SyncOfflineDay`.
Inventory side: `ProductReadService` (4 UNION queries), `StockMovementRepository` (writes `[pos].[products]`),
`InventoryReportService`.
Others: Restaurant `GetInventoryDashboardHandler`, Recipe `RecipeStockService`, `BranchSyncCatalog`
(`pos.products` is Cloud-owned), AI `ModuleToolCatalog`, offline POS catalogue (built from `GET /api/products`).

## The plan, in order

1. **Inventory product gets the e-commerce shape (additive only).** Product *templates* with options
   (Size, Colour) whose **variants are ordinary Inventory products** (own SKU, barcode, price, stock — so POS,
   purchase, sales, Finance and every stock path are unchanged); gallery (several images, one primary);
   slug / SEO title / meta / online name & description; a `PublishedOnline` flag; weight and dimensions;
   per-channel price and availability in their own tables. Existing products stay valid as "template with no
   variants".
2. **Catalogue facade for POS.** Same `Barcode` rules, same DTOs, same permissions; the handlers read and write
   Inventory. Behind a per-tenant switch so a tenant can be moved and moved back.
3. **Per-tenant move.** `pos.products` → `inventory.products` **keeping the same Id** (sale lines, offline
   queues and sync references only store ids); categories matched by name per tenant; `pos.branch_stock` →
   one Inventory warehouse per branch + `product_stock`. Dry-run report first: counts, SKU/barcode clashes
   (refuses the tenant until resolved), categories that would merge, products with stock but no branch.
   `pos.stock_movements` stays as read-only history. Old rows flagged `MovedToInventory`, not deleted.
4. **Retire the glue.** Remove the UNION queries, the schema branching in `CrossSchemaProductService`, and
   `Requires["inventory"] = ["pos"]`. Collapse POS-schema vendors/POs onto Purchase (separate decision).
5. **Branch servers / on-prem.** `inventory` products and stock must be added to `BranchSyncCatalog`
   (head-office-owned catalogue flowing down, branch stock flowing up) **before** any branch-server tenant is
   moved. The cloud mirror already covers the inventory schema.
6. Then the channel framework, Shopify, storefront engine, payments, website builder, customer accounts,
   white-label app (see the roadmap in the conversation notes / `ecommerce-roadmap` section below when written).

## Risks to check at each step

- Stock must never differ between screens: reconcile `inventory.products.StockQuantity` against the sum of
  `product_stock` before and after a move.
- Raw-SQL stock changes fire no event; the channel outbox needs a hook in the deduct/restore SQL **and** a
  periodic reconcile.
- Offline tills hold a catalogue snapshot keyed by id — ids must not change.
- Barcode: POS validates through a value object; Inventory stores a string. The facade keeps POS's rules.
- Run the live-DB schema tests (`SourceSchemaTests`, `BuildingBlocks.Tests` with `SYNC_TEST_DB`) after any
  table change.
