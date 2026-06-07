using Microsoft.EntityFrameworkCore;
using Softaxis.Inventory.Application.Abstractions;
using Softaxis.Inventory.Domain.Constants;
using Softaxis.Inventory.Infrastructure.Persistence;

namespace Softaxis.Inventory.Infrastructure.Services;

public sealed class InventoryReportService(InventoryDbContext db) : IInventoryReportService
{
    public Task<InvReportResult> RunReportAsync(string reportId, InvReportParams p, CancellationToken ct) =>
        reportId switch
        {
            "inv-stock-valuation"         => StockValuationAsync(p, ct),
            "inv-abc-analysis"            => AbcAnalysisAsync(p, ct),
            "inv-reorder-alert"           => ReorderAlertAsync(p, ct),
            "inv-stock-movement"          => StockMovementAsync(p, ct),
            "inv-slow-dead-stock"         => SlowDeadStockAsync(p, ct),
            "inv-warehouse-stock"         => WarehouseStockAsync(p, ct),
            "inv-expiry-tracking"         => ExpiryTrackingAsync(p, ct),
            "inv-shrinkage"               => ShrinkageAsync(p, ct),
            "inv-uae-input-vat"           => UaeInputVatAsync(p, ct),
            "inv-uae-stock-adjustment-vat"=> UaeStockAdjVatAsync(p, ct),
            "inv-uae-consignment"         => UaeConsignmentAsync(p, ct),
            "inv-uae-wac-valuation"       => UaeWacValuationAsync(p, ct),
            "inv-pk-fifo-valuation"       => PkFifoValuationAsync(p, ct),
            "inv-pk-annual-stock-return"  => PkAnnualStockReturnAsync(p, ct),
            "inv-pk-input-tax-credit"     => PkInputTaxCreditAsync(p, ct),
            "inv-pk-write-off"            => PkWriteOffAsync(p, ct),
            "inv-pk-provincial-movement"  => PkProvincialMovementAsync(p, ct),
            _                             => Task.FromResult(new InvReportResult([], [], 0))
        };

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static InvReportResult Build(string[] cols, IReadOnlyList<Dictionary<string, object?>> rows)
        => new(cols, rows, rows.Count);

    private static Dictionary<string, object?> Row(params (string k, object? v)[] fields)
    {
        var d = new Dictionary<string, object?>(fields.Length);
        foreach (var (k, v) in fields) d[k] = v;
        return d;
    }

    // ── 1. Stock Valuation ────────────────────────────────────────────────────

    private async Task<InvReportResult> StockValuationAsync(InvReportParams p, CancellationToken ct)
    {
        var products = await db.Products
            .Include(pr => pr.Category)
            .Where(pr => !pr.IsDeleted && pr.IsActive)
            .Where(pr => p.CategoryId == null || pr.CategoryId == p.CategoryId)
            .AsNoTracking()
            .ToListAsync(ct);

        var movements = await db.StockMovements
            .Where(m => !m.IsDeleted)
            .Where(m => p.WarehouseId == null || m.WarehouseId == p.WarehouseId)
            .AsNoTracking()
            .ToListAsync(ct);

        var warehouses = await db.Warehouses
            .Where(w => !w.IsDeleted)
            .Where(w => p.WarehouseId == null || w.Id == p.WarehouseId)
            .AsNoTracking()
            .ToListAsync(ct);

        var method = p.ValuationMethod?.ToLowerInvariant() ?? "wac";
        var cols   = new[] { "Product", "SKU", "Category", "Warehouse", "Qty on Hand", "Unit Cost", "Total Value", "Valuation Method" };

        var rows = new List<Dictionary<string, object?>>();

        // Group movements by product × warehouse
        var movsByProdWh = movements.GroupBy(m => (m.ProductId, WarehouseId: m.WarehouseId ?? Guid.Empty)).ToList();

        foreach (var prod in products)
        {
            var prodMovsGroups = movsByProdWh.Where(g => g.Key.ProductId == prod.Id).ToList();

            if (!prodMovsGroups.Any())
            {
                // Product with no movements – use current stock on product entity
                var wh = warehouses.FirstOrDefault();
                rows.Add(Row(
                    ("Product",           (object?)prod.Name),
                    ("SKU",               (object?)(prod.SKU ?? "—")),
                    ("Category",          (object?)(prod.Category?.Name ?? "—")),
                    ("Warehouse",         (object?)(wh?.Name ?? "Default")),
                    ("Qty on Hand",       (object?)prod.StockQuantity),
                    ("Unit Cost",         (object?)Math.Round(prod.CostPrice, 2)),
                    ("Total Value",       (object?)Math.Round(prod.StockQuantity * prod.CostPrice, 2)),
                    ("Valuation Method",  (object?)method.ToUpperInvariant())
                ));
                continue;
            }

            foreach (var whGroup in prodMovsGroups)
            {
                var whId   = whGroup.Key.WarehouseId;
                var wh     = warehouses.FirstOrDefault(w => w.Id == whId);
                var movs   = whGroup.OrderBy(m => m.MovedAt).ToList();
                var qty    = movs.Sum(m => m.Quantity);

                decimal unitCost;
                if (method == "fifo")
                {
                    // FIFO: cost from earliest unissued lot
                    unitCost = movs.Where(m => m.Quantity > 0).LastOrDefault()?.UnitCost ?? prod.CostPrice;
                }
                else if (method == "lifo")
                {
                    unitCost = movs.Where(m => m.Quantity > 0).FirstOrDefault()?.UnitCost ?? prod.CostPrice;
                }
                else
                {
                    // WAC
                    var inMovs     = movs.Where(m => m.Quantity > 0).ToList();
                    var totalCost  = inMovs.Sum(m => m.Quantity * m.UnitCost);
                    var totalQty   = inMovs.Sum(m => m.Quantity);
                    unitCost       = totalQty > 0 ? totalCost / totalQty : prod.CostPrice;
                }

                rows.Add(Row(
                    ("Product",           (object?)prod.Name),
                    ("SKU",               (object?)(prod.SKU ?? "—")),
                    ("Category",          (object?)(prod.Category?.Name ?? "—")),
                    ("Warehouse",         (object?)(wh?.Name ?? "Unknown")),
                    ("Qty on Hand",       (object?)Math.Round(qty, 4)),
                    ("Unit Cost",         (object?)Math.Round(unitCost, 2)),
                    ("Total Value",       (object?)Math.Round(qty * unitCost, 2)),
                    ("Valuation Method",  (object?)method.ToUpperInvariant())
                ));
            }
        }

        return Build(cols, rows.OrderBy(r => r["Product"]?.ToString()).ToList());
    }

    // ── 2. ABC Analysis ───────────────────────────────────────────────────────

    private async Task<InvReportResult> AbcAnalysisAsync(InvReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var movements = await db.StockMovements
            .Include(m => m.Product).ThenInclude(pr => pr!.Category)
            .Where(m => !m.IsDeleted && m.MovementType == MovementTypes.Sale)
            .Where(m => m.MovedAt >= from && m.MovedAt < to)
            .Where(m => p.WarehouseId == null || m.WarehouseId == p.WarehouseId)
            .AsNoTracking()
            .ToListAsync(ct);

        var products = await db.Products
            .Include(pr => pr.Category)
            .Where(pr => !pr.IsDeleted && (p.CategoryId == null || pr.CategoryId == p.CategoryId))
            .AsNoTracking()
            .ToListAsync(ct);

        var cols = new[] { "Product", "SKU", "Category", "Annual Usage Value", "Cumulative %", "Class", "Reorder Qty" };

        // Calculate annual usage value per product
        var usageValues = products.Select(pr =>
        {
            var movs  = movements.Where(m => m.ProductId == pr.Id).ToList();
            var qty   = Math.Abs(movs.Sum(m => m.Quantity));
            var val   = movs.Sum(m => Math.Abs(m.Quantity) * m.UnitCost);
            return (pr, qty, val);
        })
        .OrderByDescending(x => x.val)
        .ToList();

        var totalValue  = usageValues.Sum(x => x.val);
        decimal cumSum  = 0;
        var rows = usageValues.Select(x =>
        {
            cumSum += x.val;
            var cumPct = totalValue > 0 ? cumSum / totalValue * 100 : 0m;
            var cls    = cumPct <= 80 ? "A" : cumPct <= 95 ? "B" : "C";
            return Row(
                ("Product",            (object?)x.pr.Name),
                ("SKU",                (object?)(x.pr.SKU ?? "—")),
                ("Category",           (object?)(x.pr.Category?.Name ?? "—")),
                ("Annual Usage Value", (object?)Math.Round(x.val, 2)),
                ("Cumulative %",       (object?)Math.Round(cumPct, 1)),
                ("Class",              (object?)cls),
                ("Reorder Qty",        (object?)x.pr.ReorderLevel)
            );
        }).ToList();

        return Build(cols, rows);
    }

    // ── 3. Reorder Alert ──────────────────────────────────────────────────────

    private async Task<InvReportResult> ReorderAlertAsync(InvReportParams p, CancellationToken ct)
    {
        var products = await db.Products
            .Include(pr => pr.Category)
            .Where(pr => !pr.IsDeleted && pr.IsActive && pr.TrackInventory)
            .Where(pr => pr.StockQuantity <= pr.ReorderLevel)
            .Where(pr => p.CategoryId == null || pr.CategoryId == p.CategoryId)
            .AsNoTracking()
            .ToListAsync(ct);

        var warehouses = await db.Warehouses
            .Where(w => !w.IsDeleted && (p.WarehouseId == null || w.Id == p.WarehouseId))
            .AsNoTracking()
            .ToListAsync(ct);

        var defaultWh = warehouses.FirstOrDefault(w => w.IsDefault)?.Name
                     ?? warehouses.FirstOrDefault()?.Name
                     ?? "Default";

        var cols = new[] { "Product", "SKU", "Warehouse", "Qty on Hand", "Reorder Level", "Shortage", "Lead Time (days)", "Suggested PO Qty" };

        var rows = products.OrderBy(pr => pr.StockQuantity).Select(pr => Row(
            ("Product",          (object?)pr.Name),
            ("SKU",              (object?)(pr.SKU ?? "—")),
            ("Warehouse",        (object?)defaultWh),
            ("Qty on Hand",      (object?)pr.StockQuantity),
            ("Reorder Level",    (object?)pr.ReorderLevel),
            ("Shortage",         (object?)Math.Max(0, pr.ReorderLevel - pr.StockQuantity)),
            ("Lead Time (days)", (object?)7),       // static default; no lead-time field in schema
            ("Suggested PO Qty", (object?)(pr.ReorderLevel * 2))
        )).ToList();

        return Build(cols, rows);
    }

    // ── 4. Stock Movement History ─────────────────────────────────────────────

    private async Task<InvReportResult> StockMovementAsync(InvReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var query = db.StockMovements
            .Include(m => m.Product).ThenInclude(pr => pr!.Category)
            .Include(m => m.Warehouse)
            .Where(m => !m.IsDeleted)
            .Where(m => m.MovedAt >= from && m.MovedAt < to)
            .Where(m => p.WarehouseId == null || m.WarehouseId == p.WarehouseId);

        if (!string.IsNullOrWhiteSpace(p.MovementType))
            query = query.Where(m => m.MovementType == p.MovementType);

        var movements = await query.OrderByDescending(m => m.MovedAt).AsNoTracking().ToListAsync(ct);

        var cols = new[] { "Date", "Product", "SKU", "Movement Type", "From", "To", "Qty", "Unit Cost", "Total Value", "Reference" };

        var rows = movements.Select(m => Row(
            ("Date",          (object?)m.MovedAt.ToString("yyyy-MM-dd HH:mm")),
            ("Product",       (object?)(m.Product?.Name ?? "—")),
            ("SKU",           (object?)(m.Product?.SKU ?? "—")),
            ("Movement Type", (object?)m.MovementType),
            ("From",          (object?)(m.Quantity < 0 ? m.Warehouse?.Name ?? "System" : "Supplier")),
            ("To",            (object?)(m.Quantity > 0 ? m.Warehouse?.Name ?? "System" : "Customer")),
            ("Qty",           (object?)m.Quantity),
            ("Unit Cost",     (object?)Math.Round(m.UnitCost, 2)),
            ("Total Value",   (object?)Math.Round(Math.Abs(m.Quantity) * m.UnitCost, 2)),
            ("Reference",     (object?)(m.Reference ?? "—"))
        )).ToList();

        return Build(cols, rows);
    }

    // ── 5. Slow / Dead Stock ──────────────────────────────────────────────────

    private async Task<InvReportResult> SlowDeadStockAsync(InvReportParams p, CancellationToken ct)
    {
        var cutoff = DateTime.UtcNow.AddDays(-p.IdleDays);

        var products = await db.Products
            .Include(pr => pr.Category)
            .Where(pr => !pr.IsDeleted && pr.IsActive && pr.StockQuantity > 0)
            .Where(pr => p.CategoryId == null || pr.CategoryId == p.CategoryId)
            .AsNoTracking()
            .ToListAsync(ct);

        var lastMovements = await db.StockMovements
            .Where(m => !m.IsDeleted)
            .GroupBy(m => m.ProductId)
            .Select(g => new { ProductId = g.Key, LastMoved = g.Max(m => m.MovedAt) })
            .ToListAsync(ct);

        var lastMovDict = lastMovements.ToDictionary(x => x.ProductId, x => x.LastMoved);

        var cols = new[] { "Product", "SKU", "Category", "Last Movement", "Days Idle", "Qty on Hand", "Value (Cost)", "Suggested Action" };

        var rows = products
            .Where(pr =>
            {
                var last = lastMovDict.TryGetValue(pr.Id, out var l) ? l : pr.CreatedAt;
                return last <= cutoff;
            })
            .Select(pr =>
            {
                var last     = lastMovDict.TryGetValue(pr.Id, out var l) ? l : pr.CreatedAt;
                var daysIdle = (int)(DateTime.UtcNow - last).TotalDays;
                var value    = pr.StockQuantity * pr.CostPrice;
                var action   = daysIdle > 180 ? "Write Off" : daysIdle > 90 ? "Mark Down" : "Bundle Offer";
                return Row(
                    ("Product",        (object?)pr.Name),
                    ("SKU",            (object?)(pr.SKU ?? "—")),
                    ("Category",       (object?)(pr.Category?.Name ?? "—")),
                    ("Last Movement",  (object?)last.ToString("yyyy-MM-dd")),
                    ("Days Idle",      (object?)daysIdle),
                    ("Qty on Hand",    (object?)pr.StockQuantity),
                    ("Value (Cost)",   (object?)Math.Round(value, 2)),
                    ("Suggested Action", (object?)action)
                );
            })
            .OrderByDescending(r => (int)r["Days Idle"]!)
            .ToList();

        return Build(cols, rows);
    }

    // ── 6. Warehouse Stock Summary ────────────────────────────────────────────

    private async Task<InvReportResult> WarehouseStockAsync(InvReportParams p, CancellationToken ct)
    {
        var warehouses = await db.Warehouses
            .Where(w => !w.IsDeleted && w.IsActive)
            .Where(w => p.WarehouseId == null || w.Id == p.WarehouseId)
            .AsNoTracking()
            .ToListAsync(ct);

        var movements = await db.StockMovements
            .Include(m => m.Product).ThenInclude(pr => pr!.Category)
            .Where(m => !m.IsDeleted && m.WarehouseId != null)
            .AsNoTracking()
            .ToListAsync(ct);

        var products = await db.Products
            .Include(pr => pr.Category)
            .Where(pr => !pr.IsDeleted)
            .Where(pr => p.CategoryId == null || pr.CategoryId == p.CategoryId)
            .AsNoTracking()
            .ToListAsync(ct);

        var prodDict = products.ToDictionary(pr => pr.Id);
        var cols = new[] { "Warehouse", "Category", "Total SKUs", "Total Qty", "Total Value (Cost)", "Total Value (Retail)", "Utilisation %" };

        var rows = warehouses.SelectMany(wh =>
        {
            var whMovs = movements.Where(m => m.WarehouseId == wh.Id).ToList();
            var categories = whMovs.Select(m => m.Product?.Category?.Name).Distinct().Where(c => c != null).ToList();

            if (!categories.Any()) categories = new List<string?> { "All" };

            return categories.Select(cat =>
            {
                var catMovs     = cat == "All" ? whMovs : whMovs.Where(m => m.Product?.Category?.Name == cat).ToList();
                var skuCount    = catMovs.Select(m => m.ProductId).Distinct().Count();
                var totalQty    = catMovs.Sum(m => m.Quantity);
                var costValue   = catMovs.Sum(m => Math.Abs(m.Quantity) * m.UnitCost);
                var retailValue = catMovs.Sum(m =>
                {
                    var pr = m.ProductId != Guid.Empty && prodDict.TryGetValue(m.ProductId, out var found) ? found : null;
                    return Math.Abs(m.Quantity) * (pr?.SalePrice ?? m.UnitCost);
                });
                return Row(
                    ("Warehouse",            (object?)wh.Name),
                    ("Category",             (object?)(cat ?? "All")),
                    ("Total SKUs",           (object?)skuCount),
                    ("Total Qty",            (object?)Math.Round(totalQty, 4)),
                    ("Total Value (Cost)",   (object?)Math.Round(costValue, 2)),
                    ("Total Value (Retail)", (object?)Math.Round(retailValue, 2)),
                    ("Utilisation %",        (object?)"N/A")   // requires capacity field not in schema
                );
            });
        }).ToList();

        return Build(cols, rows);
    }

    // ── 7. Expiry & Batch Tracking ────────────────────────────────────────────

    private async Task<InvReportResult> ExpiryTrackingAsync(InvReportParams p, CancellationToken ct)
    {
        var today = DateTime.UtcNow.Date;

        var batches = await (
            from b in db.ProductBatches.AsNoTracking()
            join pr in db.Products.AsNoTracking() on b.ProductId equals pr.Id
            where b.ExpiryDate != null && b.Quantity > 0
               && (p.WarehouseId == null || b.WarehouseId == p.WarehouseId)
               && (p.CategoryId == null || pr.CategoryId == p.CategoryId)
            orderby b.ExpiryDate
            select new { pr.Name, pr.SKU, b.BatchNumber, b.ExpiryDate, b.Quantity, b.CostPrice })
            .ToListAsync(ct);

        var cols = new[] { "Product", "SKU", "Batch #", "Expiry Date", "Days to Expiry", "Qty", "Value", "Action" };

        var rows = batches.Select(b =>
        {
            var expiry = b.ExpiryDate!.Value.Date;
            var days   = (int)(expiry - today).TotalDays;
            var action = days < 0 ? "EXPIRED" : days <= p.ExpiryWindowDays ? "Expiring soon" : "OK";
            return Row(
                ("Product",        (object?)b.Name),
                ("SKU",            (object?)(b.SKU ?? "—")),
                ("Batch #",        (object?)b.BatchNumber),
                ("Expiry Date",    (object?)expiry.ToString("yyyy-MM-dd")),
                ("Days to Expiry", (object?)days),
                ("Qty",            (object?)b.Quantity),
                ("Value",          (object?)Math.Round(b.Quantity * b.CostPrice, 2)),
                ("Action",         (object?)action));
        }).ToList();

        // Default the report to items already expired or within the expiry window.
        var filtered = rows.Where(r => (int)r["Days to Expiry"]! <= p.ExpiryWindowDays).ToList();
        return Build(cols, filtered.Count > 0 ? filtered : rows);
    }

    // ── 8. Shrinkage ──────────────────────────────────────────────────────────

    private async Task<InvReportResult> ShrinkageAsync(InvReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var products = await db.Products
            .Include(pr => pr.Category)
            .Where(pr => !pr.IsDeleted && (p.CategoryId == null || pr.CategoryId == p.CategoryId))
            .AsNoTracking()
            .ToListAsync(ct);

        var movements = await db.StockMovements
            .Where(m => !m.IsDeleted && m.MovedAt >= from && m.MovedAt < to)
            .Where(m => p.WarehouseId == null || m.WarehouseId == p.WarehouseId)
            .AsNoTracking()
            .ToListAsync(ct);

        var cols = new[] { "Product", "SKU", "Opening Qty", "Received", "Sold", "Adjusted", "Closing (System)", "Counted", "Variance", "Variance Value" };

        var rows = products.Select(pr =>
        {
            var prodMovs   = movements.Where(m => m.ProductId == pr.Id).ToList();
            var received   = prodMovs.Where(m => m.MovementType == MovementTypes.Receipt).Sum(m => m.Quantity);
            var sold       = Math.Abs(prodMovs.Where(m => m.MovementType == MovementTypes.Sale).Sum(m => m.Quantity));
            var adjusted   = prodMovs.Where(m => m.MovementType == MovementTypes.Adjustment).Sum(m => m.Quantity);
            var writeoffs  = Math.Abs(prodMovs.Where(m => m.MovementType == MovementTypes.WriteOff).Sum(m => m.Quantity));

            // Opening = current stock − period net movements
            var periodNet = prodMovs.Sum(m => m.Quantity);
            var opening   = pr.StockQuantity - periodNet;
            var closing   = opening + received - sold + adjusted - writeoffs;

            // Variance = system closing vs current counted (we use product's StockQuantity as "counted")
            var counted   = pr.StockQuantity;
            var variance  = counted - closing;
            var varValue  = Math.Abs(variance) * pr.CostPrice;

            return Row(
                ("Product",          (object?)pr.Name),
                ("SKU",              (object?)(pr.SKU ?? "—")),
                ("Opening Qty",      (object?)Math.Round(opening, 4)),
                ("Received",         (object?)Math.Round(received, 4)),
                ("Sold",             (object?)Math.Round(sold, 4)),
                ("Adjusted",         (object?)Math.Round(adjusted, 4)),
                ("Closing (System)", (object?)Math.Round(closing, 4)),
                ("Counted",          (object?)Math.Round(counted, 4)),
                ("Variance",         (object?)Math.Round(variance, 4)),
                ("Variance Value",   (object?)Math.Round(varValue, 2))
            );
        }).Where(r => (decimal)r["Variance"]! != 0).OrderBy(r => r["Product"]?.ToString()).ToList();

        return Build(cols, rows);
    }

    // ── 9. UAE: Input VAT on Purchases ────────────────────────────────────────

    private async Task<InvReportResult> UaeInputVatAsync(InvReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var receipts = await db.StockMovements
            .Include(m => m.Product)
            .Include(m => m.Warehouse)
            .Where(m => !m.IsDeleted && m.MovementType == MovementTypes.Receipt)
            .Where(m => m.MovedAt >= from && m.MovedAt < to)
            .Where(m => p.WarehouseId == null || m.WarehouseId == p.WarehouseId)
            .AsNoTracking()
            .ToListAsync(ct);

        var cols = new[] { "Supplier", "Supplier TRN", "Invoice #", "Date", "Taxable Amount (AED)", "Input VAT 5% (AED)", "Recoverable", "Box Ref" };

        var rows = receipts.OrderBy(m => m.MovedAt).Select(m =>
        {
            var taxable = Math.Round(Math.Abs(m.Quantity) * m.UnitCost, 2);
            var vat     = Math.Round(taxable * 0.05m, 2);
            return Row(
                ("Supplier",              (object?)(m.Notes ?? "Supplier")),
                ("Supplier TRN",          (object?)"Pending TRN"),
                ("Invoice #",             (object?)(m.Reference ?? "—")),
                ("Date",                  (object?)m.MovedAt.ToString("yyyy-MM-dd")),
                ("Taxable Amount (AED)",  (object?)taxable),
                ("Input VAT 5% (AED)",    (object?)vat),
                ("Recoverable",           (object?)"Yes"),
                ("Box Ref",               (object?)"Box 9/10")
            );
        }).ToList();

        return Build(cols, rows);
    }

    // ── 10. UAE: Stock Adjustment VAT ─────────────────────────────────────────

    private async Task<InvReportResult> UaeStockAdjVatAsync(InvReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var adjs = await db.StockMovements
            .Include(m => m.Product)
            .Where(m => !m.IsDeleted)
            .Where(m => m.MovementType == MovementTypes.Adjustment || m.MovementType == MovementTypes.WriteOff)
            .Where(m => m.MovedAt >= from && m.MovedAt < to)
            .Where(m => m.Quantity < 0)  // only negative adjustments (write-offs / losses)
            .Where(m => p.WarehouseId == null || m.WarehouseId == p.WarehouseId)
            .AsNoTracking()
            .ToListAsync(ct);

        var cols = new[] { "Date", "Product", "Adj Type", "Qty", "Cost (AED)", "Market Value (AED)", "VAT Due (AED)", "Treatment" };

        var rows = adjs.OrderBy(m => m.MovedAt).Select(m =>
        {
            var qty    = Math.Abs(m.Quantity);
            var cost   = Math.Round(qty * m.UnitCost, 2);
            // Market value = cost (no market price field; use cost as proxy)
            var market = cost;
            var vat    = Math.Round(market * 0.05m, 2);
            return Row(
                ("Date",               (object?)m.MovedAt.ToString("yyyy-MM-dd")),
                ("Product",            (object?)(m.Product?.Name ?? "—")),
                ("Adj Type",           (object?)m.MovementType),
                ("Qty",                (object?)qty),
                ("Cost (AED)",         (object?)cost),
                ("Market Value (AED)", (object?)market),
                ("VAT Due (AED)",      (object?)vat),
                ("Treatment",          (object?)"Deemed Supply — Consult VAT Advisor")
            );
        }).ToList();

        return Build(cols, rows);
    }

    // ── 11. UAE: Consignment Stock ────────────────────────────────────────────

    private async Task<InvReportResult> UaeConsignmentAsync(InvReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        // Consignment receipts — receipts with "consignment" in notes (convention)
        var receipts = await db.StockMovements
            .Include(m => m.Product)
            .Where(m => !m.IsDeleted && m.MovementType == MovementTypes.Receipt)
            .Where(m => m.MovedAt >= from && m.MovedAt < to)
            .Where(m => p.WarehouseId == null || m.WarehouseId == p.WarehouseId)
            .AsNoTracking()
            .ToListAsync(ct);

        var sales = await db.StockMovements
            .Where(m => !m.IsDeleted && m.MovementType == MovementTypes.Sale)
            .AsNoTracking()
            .ToListAsync(ct);

        var cols = new[] { "Supplier", "Supplier TRN", "Product", "Received Date", "Qty Received", "Qty Sold", "Qty Remaining", "VAT Status" };

        var rows = receipts
            .GroupBy(m => new { m.ProductId, Supplier = m.Notes ?? "Unknown Supplier" })
            .Select(g =>
            {
                var qtyRec  = g.Sum(m => m.Quantity);
                var qtySold = Math.Abs(sales.Where(s => s.ProductId == g.Key.ProductId).Sum(s => s.Quantity));
                var qtyRem  = Math.Max(0, qtyRec - qtySold);
                var prod    = g.First().Product;
                return Row(
                    ("Supplier",      (object?)g.Key.Supplier),
                    ("Supplier TRN",  (object?)"Pending TRN"),
                    ("Product",       (object?)(prod?.Name ?? "—")),
                    ("Received Date", (object?)g.Min(m => m.MovedAt).ToString("yyyy-MM-dd")),
                    ("Qty Received",  (object?)Math.Round(qtyRec, 4)),
                    ("Qty Sold",      (object?)Math.Round(qtySold, 4)),
                    ("Qty Remaining", (object?)Math.Round(qtyRem, 4)),
                    ("VAT Status",    (object?)"Tax Point: On Sale")
                );
            }).ToList();

        return Build(cols, rows);
    }

    // ── 12. UAE: WAC Valuation ────────────────────────────────────────────────

    private async Task<InvReportResult> UaeWacValuationAsync(InvReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var products = await db.Products
            .Include(pr => pr.Category)
            .Where(pr => !pr.IsDeleted && pr.IsActive)
            .Where(pr => p.CategoryId == null || pr.CategoryId == p.CategoryId)
            .AsNoTracking()
            .ToListAsync(ct);

        var movements = await db.StockMovements
            .Where(m => !m.IsDeleted && m.MovedAt >= from && m.MovedAt < to)
            .Where(m => p.WarehouseId == null || m.WarehouseId == p.WarehouseId)
            .AsNoTracking()
            .ToListAsync(ct);

        var cols = new[] { "Product", "Opening Qty", "Receipts", "Issues", "Closing Qty", "WAC Unit Cost (AED)", "Closing Value (AED)" };

        var rows = products.Select(pr =>
        {
            var prodMovs   = movements.Where(m => m.ProductId == pr.Id).ToList();
            var receipts   = prodMovs.Where(m => m.Quantity > 0).ToList();
            var issues     = Math.Abs(prodMovs.Where(m => m.Quantity < 0).Sum(m => m.Quantity));
            var recQty     = receipts.Sum(m => m.Quantity);
            var closing    = pr.StockQuantity;
            var totalCost  = receipts.Sum(m => m.Quantity * m.UnitCost);
            var totalQty   = receipts.Sum(m => m.Quantity);
            var wac        = totalQty > 0 ? totalCost / totalQty : pr.CostPrice;
            var netPeriod  = recQty - issues;
            var opening    = closing - netPeriod;

            return Row(
                ("Product",              (object?)pr.Name),
                ("Opening Qty",          (object?)Math.Round(opening, 4)),
                ("Receipts",             (object?)Math.Round(recQty, 4)),
                ("Issues",               (object?)Math.Round(issues, 4)),
                ("Closing Qty",          (object?)Math.Round(closing, 4)),
                ("WAC Unit Cost (AED)",  (object?)Math.Round(wac, 4)),
                ("Closing Value (AED)",  (object?)Math.Round(closing * wac, 2))
            );
        }).OrderBy(r => r["Product"]?.ToString()).ToList();

        return Build(cols, rows);
    }

    // ── 13. PK: FIFO Valuation ────────────────────────────────────────────────

    private async Task<InvReportResult> PkFifoValuationAsync(InvReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var products = await db.Products
            .Include(pr => pr.Category)
            .Where(pr => !pr.IsDeleted && (p.CategoryId == null || pr.CategoryId == p.CategoryId))
            .AsNoTracking()
            .ToListAsync(ct);

        var movements = await db.StockMovements
            .Where(m => !m.IsDeleted && m.MovedAt < to)  // all movements up to end of period for FIFO layers
            .Where(m => p.WarehouseId == null || m.WarehouseId == p.WarehouseId)
            .OrderBy(m => m.MovedAt)
            .AsNoTracking()
            .ToListAsync(ct);

        var periodSales = await db.StockMovements
            .Where(m => !m.IsDeleted && m.MovementType == MovementTypes.Sale)
            .Where(m => m.MovedAt >= from && m.MovedAt < to)
            .Where(m => p.WarehouseId == null || m.WarehouseId == p.WarehouseId)
            .AsNoTracking()
            .ToListAsync(ct);

        var periodPurchases = await db.StockMovements
            .Where(m => !m.IsDeleted && m.MovementType == MovementTypes.Receipt)
            .Where(m => m.MovedAt >= from && m.MovedAt < to)
            .Where(m => p.WarehouseId == null || m.WarehouseId == p.WarehouseId)
            .AsNoTracking()
            .ToListAsync(ct);

        var cols = new[] { "Product", "SKU", "Opening Qty", "Opening Value (PKR)", "Purchases", "COGS (FIFO)", "Closing Qty", "Closing Value (PKR)" };

        var rows = products.Select(pr =>
        {
            var allMovs  = movements.Where(m => m.ProductId == pr.Id).ToList();
            var beforePeriod = allMovs.Where(m => m.MovedAt < from).ToList();
            var openQty  = beforePeriod.Sum(m => m.Quantity);
            var openVal  = beforePeriod.Where(m => m.Quantity > 0).Sum(m => m.Quantity * m.UnitCost)
                         - beforePeriod.Where(m => m.Quantity < 0).Sum(m => Math.Abs(m.Quantity) * (beforePeriod.Where(x => x.Quantity > 0).LastOrDefault()?.UnitCost ?? pr.CostPrice));

            var purchases = periodPurchases.Where(m => m.ProductId == pr.Id).ToList();
            var purQty   = purchases.Sum(m => m.Quantity);
            var purVal   = purchases.Sum(m => m.Quantity * m.UnitCost);

            var soldQty  = Math.Abs(periodSales.Where(m => m.ProductId == pr.Id).Sum(m => m.Quantity));

            // FIFO COGS: consume earliest layers first
            var layers   = new Queue<(decimal qty, decimal cost)>(
                allMovs.Where(m => m.MovedAt < to && m.Quantity > 0)
                       .Select(m => (m.Quantity, m.UnitCost)));
            decimal cogs = 0; var remaining = soldQty;
            while (remaining > 0 && layers.Count > 0)
            {
                var (lQty, lCost) = layers.Dequeue();
                var consume = Math.Min(lQty, remaining);
                cogs += consume * lCost;
                remaining -= consume;
            }

            var closeQty = openQty + purQty - soldQty;
            var closeVal = closeQty * (allMovs.Where(m => m.Quantity > 0).LastOrDefault()?.UnitCost ?? pr.CostPrice);

            return Row(
                ("Product",             (object?)pr.Name),
                ("SKU",                 (object?)(pr.SKU ?? "—")),
                ("Opening Qty",         (object?)Math.Round(openQty, 4)),
                ("Opening Value (PKR)", (object?)Math.Round(Math.Max(0, openVal), 2)),
                ("Purchases",           (object?)Math.Round(purVal, 2)),
                ("COGS (FIFO)",         (object?)Math.Round(cogs, 2)),
                ("Closing Qty",         (object?)Math.Round(Math.Max(0, closeQty), 4)),
                ("Closing Value (PKR)", (object?)Math.Round(Math.Max(0, closeVal), 2))
            );
        }).OrderBy(r => r["Product"]?.ToString()).ToList();

        return Build(cols, rows);
    }

    // ── 14. PK: Annual Stock Return ───────────────────────────────────────────

    private async Task<InvReportResult> PkAnnualStockReturnAsync(InvReportParams p, CancellationToken ct)
    {
        // Parse fiscal year "2024-25" → July 2024 – June 2025
        var fy    = p.FiscalYear ?? $"{DateTime.UtcNow.Year - 1}-{DateTime.UtcNow.Year.ToString()[2..]}";
        var parts = fy.Split('-');
        var startYear = int.TryParse(parts[0], out var sy) ? sy : DateTime.UtcNow.Year - 1;
        var from  = new DateTime(startYear, 7, 1);
        var to    = from.AddYears(1);

        var categories = await db.ProductCategories.Where(c => !c.IsDeleted).AsNoTracking().ToListAsync(ct);
        var products   = await db.Products.Where(pr => !pr.IsDeleted).AsNoTracking().ToListAsync(ct);

        var movements  = await db.StockMovements
            .Where(m => !m.IsDeleted && m.MovedAt < to)
            .Where(m => p.WarehouseId == null || m.WarehouseId == p.WarehouseId)
            .AsNoTracking()
            .ToListAsync(ct);

        var cols = new[] { "Category", "Opening Stock (PKR)", "Purchases (PKR)", "COGS (PKR)", "Closing Stock (PKR)", "Gross Profit" };

        var rows = categories.Select(cat =>
        {
            var catProds   = products.Where(pr => pr.CategoryId == cat.Id).Select(pr => pr.Id).ToHashSet();
            var catMovs    = movements.Where(m => catProds.Contains(m.ProductId)).ToList();

            var openMovs   = catMovs.Where(m => m.MovedAt < from);
            var openStock  = openMovs.Where(m => m.Quantity > 0).Sum(m => m.Quantity * m.UnitCost)
                           - openMovs.Where(m => m.Quantity < 0).Sum(m => Math.Abs(m.Quantity) * m.UnitCost);

            var periodMovs = catMovs.Where(m => m.MovedAt >= from && m.MovedAt < to).ToList();
            var purchases  = periodMovs.Where(m => m.MovementType == MovementTypes.Receipt).Sum(m => m.Quantity * m.UnitCost);
            var cogs       = Math.Abs(periodMovs.Where(m => m.MovementType == MovementTypes.Sale).Sum(m => m.Quantity * m.UnitCost));
            var closing    = Math.Max(0, openStock + purchases - cogs);
            var grossProfit = catMovs.Where(m => m.MovementType == MovementTypes.Sale)
                                     .Sum(m =>
                                     {
                                         var pr = products.FirstOrDefault(x => x.Id == m.ProductId);
                                         return Math.Abs(m.Quantity) * (pr?.SalePrice ?? m.UnitCost) - Math.Abs(m.Quantity) * m.UnitCost;
                                     });

            return Row(
                ("Category",            (object?)cat.Name),
                ("Opening Stock (PKR)", (object?)Math.Round(Math.Max(0, openStock), 2)),
                ("Purchases (PKR)",     (object?)Math.Round(purchases, 2)),
                ("COGS (PKR)",          (object?)Math.Round(cogs, 2)),
                ("Closing Stock (PKR)", (object?)Math.Round(closing, 2)),
                ("Gross Profit",        (object?)Math.Round(grossProfit, 2))
            );
        }).ToList();

        return Build(cols, rows);
    }

    // ── 15. PK: Input Tax Credit (Annex-C) ───────────────────────────────────

    private async Task<InvReportResult> PkInputTaxCreditAsync(InvReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var receipts = await db.StockMovements
            .Include(m => m.Product)
            .Where(m => !m.IsDeleted && m.MovementType == MovementTypes.Receipt)
            .Where(m => m.MovedAt >= from && m.MovedAt < to)
            .Where(m => p.WarehouseId == null || m.WarehouseId == p.WarehouseId)
            .AsNoTracking()
            .ToListAsync(ct);

        var cols = new[] { "Supplier", "STRN", "Invoice #", "Date", "Taxable Value (PKR)", "GST 17% (PKR)", "Eligible ITC (PKR)", "Blocked" };

        var rows = receipts.OrderBy(m => m.MovedAt).Select(m =>
        {
            var taxable  = Math.Round(Math.Abs(m.Quantity) * m.UnitCost, 2);
            var gst      = Math.Round(taxable * 0.17m, 2);
            var blocked  = p.ItcStatus == "blocked";

            return Row(
                ("Supplier",            (object?)(m.Notes ?? "Supplier")),
                ("STRN",                (object?)"STRN-PENDING"),
                ("Invoice #",           (object?)(m.Reference ?? "—")),
                ("Date",                (object?)m.MovedAt.ToString("yyyy-MM-dd")),
                ("Taxable Value (PKR)", (object?)taxable),
                ("GST 17% (PKR)",       (object?)gst),
                ("Eligible ITC (PKR)",  (object?)(blocked ? 0m : gst)),
                ("Blocked",             (object?)(blocked ? "Yes" : "No"))
            );
        }).ToList();

        return Build(cols, rows);
    }

    // ── 16. PK: Write-Off ─────────────────────────────────────────────────────

    private async Task<InvReportResult> PkWriteOffAsync(InvReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var writeoffs = await db.StockMovements
            .Include(m => m.Product)
            .Where(m => !m.IsDeleted && m.MovementType == MovementTypes.WriteOff)
            .Where(m => m.MovedAt >= from && m.MovedAt < to)
            .Where(m => p.WarehouseId == null || m.WarehouseId == p.WarehouseId)
            .AsNoTracking()
            .ToListAsync(ct);

        if (!string.IsNullOrWhiteSpace(p.WriteOffReason))
            writeoffs = writeoffs.Where(m => m.Notes?.Contains(p.WriteOffReason, StringComparison.OrdinalIgnoreCase) == true).ToList();

        var cols = new[] { "Date", "Product", "Batch #", "Qty Written Off", "Cost Value (PKR)", "Reason", "Approved By", "Tax Treatment" };

        var rows = writeoffs.OrderBy(m => m.MovedAt).Select(m => Row(
            ("Date",             (object?)m.MovedAt.ToString("yyyy-MM-dd")),
            ("Product",          (object?)(m.Product?.Name ?? "—")),
            ("Batch #",          (object?)"—"),   // no batch in schema
            ("Qty Written Off",  (object?)Math.Abs(m.Quantity)),
            ("Cost Value (PKR)", (object?)Math.Round(Math.Abs(m.Quantity) * m.UnitCost, 2)),
            ("Reason",           (object?)(m.Notes ?? "Not specified")),
            ("Approved By",      (object?)"—"),   // no approver field
            ("Tax Treatment",    (object?)"Deductible under Section 20(1)(xv) IT Ordinance 2001 — Verify with tax counsel")
        )).ToList();

        return Build(cols, rows);
    }

    // ── 17. PK: Inter-Provincial Stock Movement ───────────────────────────────

    private async Task<InvReportResult> PkProvincialMovementAsync(InvReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var transfers = await db.StockMovements
            .Include(m => m.Product)
            .Include(m => m.Warehouse)
            .Where(m => !m.IsDeleted && m.MovementType == MovementTypes.Transfer)
            .Where(m => m.MovedAt >= from && m.MovedAt < to)
            .AsNoTracking()
            .ToListAsync(ct);

        var cols = new[] { "Date", "Product", "From Province", "From Warehouse", "To Province", "To Warehouse", "Qty", "Value (PKR)", "GST Treatment" };

        var rows = transfers.OrderBy(m => m.MovedAt).Select(m =>
        {
            // Province inferred from warehouse address or Notes
            // Convention: warehouse address starts with province name
            var fromWh   = m.Warehouse?.Name ?? "Unknown";
            var fromAddr = m.Warehouse?.Address ?? "";
            var province = fromAddr.Split(',').FirstOrDefault()?.Trim() ?? "Punjab"; // default

            return Row(
                ("Date",           (object?)m.MovedAt.ToString("yyyy-MM-dd")),
                ("Product",        (object?)(m.Product?.Name ?? "—")),
                ("From Province",  (object?)province),
                ("From Warehouse", (object?)fromWh),
                ("To Province",    (object?)"See destination warehouse"),
                ("To Warehouse",   (object?)(m.Notes ?? "—")),
                ("Qty",            (object?)Math.Abs(m.Quantity)),
                ("Value (PKR)",    (object?)Math.Round(Math.Abs(m.Quantity) * m.UnitCost, 2)),
                ("GST Treatment",  (object?)"Inter-provincial — Consult FBR/PRA/SRB rules")
            );
        }).ToList();

        return Build(cols, rows);
    }
}
