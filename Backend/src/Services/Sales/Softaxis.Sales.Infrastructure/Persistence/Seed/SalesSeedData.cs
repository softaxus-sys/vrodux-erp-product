using Microsoft.EntityFrameworkCore;
using Softaxis.Sales.Domain.Entities;

namespace Softaxis.Sales.Infrastructure.Persistence.Seed;

/// <summary>
/// Idempotent seed data for the Sales module.
/// Safe to re-run — checks by fixed GUID before inserting.
/// </summary>
public static class SalesSeedData
{
    public static async Task SeedAsync(SalesDbContext db)
    {
        await SeedCustomersAsync(db);
        await db.SaveChangesAsync();
        await SeedSalesOrdersAsync(db);
        await db.SaveChangesAsync();
        await SeedQuotationsAsync(db);
        await db.SaveChangesAsync();
    }

    // ── Customers ─────────────────────────────────────────────────────────────

    private static readonly Guid CustEmiratesNBD  = new("d1000001-0000-0000-0000-000000000001");
    private static readonly Guid CustADCB         = new("d1000001-0000-0000-0000-000000000002");
    private static readonly Guid CustMAF          = new("d1000001-0000-0000-0000-000000000003");
    private static readonly Guid CustDEWA         = new("d1000001-0000-0000-0000-000000000004");
    private static readonly Guid CustEtisalat     = new("d1000001-0000-0000-0000-000000000005");
    private static readonly Guid CustDubaiProp    = new("d1000001-0000-0000-0000-000000000006");
    private static readonly Guid CustCarrefour    = new("d1000001-0000-0000-0000-000000000007");
    private static readonly Guid CustADNOC        = new("d1000001-0000-0000-0000-000000000008");
    private static readonly Guid CustLuLu         = new("d1000001-0000-0000-0000-000000000009");
    private static readonly Guid CustEmaar        = new("d1000001-0000-0000-0000-000000000010");

    private static async Task SeedCustomersAsync(SalesDbContext db)
    {
        var existing = await db.Customers.IgnoreQueryFilters()
            .Select(c => c.Id).ToHashSetAsync();

        var customers = new[]
        {
            (CustEmiratesNBD, "Emirates NBD",             "accounts@emiratesnbd.com",   "+971-4-2280000", "Baniyas Road, Deira, Dubai, UAE",          "TRN100112233"),
            (CustADCB,        "Abu Dhabi Commercial Bank","enterprise@adcb.com",         "+971-2-6200100", "ADCB HQ, Khalidiyah, Abu Dhabi, UAE",      "TRN100223344"),
            (CustMAF,         "Majid Al Futtaim",          "it.procurement@maf.ae",      "+971-4-2948888", "MOE, Barsha Heights, Dubai, UAE",          "TRN100334455"),
            (CustDEWA,        "DEWA",                      "procurement@dewa.gov.ae",    "+971-4-6019999", "Zabeel Road, Karama, Dubai, UAE",          "TRN100445566"),
            (CustEtisalat,    "Etisalat (e&)",             "enterprise@etisalat.ae",     "+971-4-1010101", "Etisalat Tower, Deira, Dubai, UAE",        "TRN100556677"),
            (CustDubaiProp,   "Dubai Properties",          "billing@dubaiproperties.ae", "+971-4-8800000", "Emaar Square, Downtown Dubai, UAE",        "TRN100667788"),
            (CustCarrefour,   "Carrefour UAE",             "it.vendor@carrefour.ae",     "+971-4-2940909", "Mall of the Emirates, Dubai, UAE",         "TRN100778899"),
            (CustADNOC,       "ADNOC",                     "erp@adnoc.ae",               "+971-2-6022222", "ADNOC HQ, Corniche, Abu Dhabi, UAE",       "TRN100889900"),
            (CustLuLu,        "LuLu Hypermarket",          "procurement@luluhyper.com",  "+971-2-6437200", "Airport Road, Abu Dhabi, UAE",             "TRN100990011"),
            (CustEmaar,       "Emaar Properties",          "vendor@emaar.ae",            "+971-4-3677333", "Emaar Square, Downtown Dubai, UAE",        "TRN101001122"),
        };

        foreach (var (id, name, email, phone, address, tax) in customers)
        {
            if (existing.Contains(id)) continue;
            var customer = new Customer(name, email, phone, address, tax, null);
            SetId(customer, id);
            db.Customers.Add(customer);
        }
    }

    // ── Sales Orders ──────────────────────────────────────────────────────────

    private static async Task SeedSalesOrdersAsync(SalesDbContext db)
    {
        var existing = await db.SalesOrders.IgnoreQueryFilters()
            .Select(o => o.Id).ToHashSetAsync();

        // (orderId, customerId, status, expectedDate, notes, items[(itemId, desc, qty, price, discount, taxRate)])
        var orders = new[]
        {
            (new Guid("d2000002-0000-0000-0000-000000000001"), CustEmiratesNBD, "delivered", "2026-03-15",
             "ERP HR Module delivery — Emirates NBD",
             new[] {
                 (new Guid("d3000003-0000-0000-0000-000000000001"), "ERP HR Module — Enterprise License",     1m,  65000m,  0m, 5m),
                 (new Guid("d3000003-0000-0000-0000-000000000002"), "Implementation & Go-Live Support",       1m,  15000m,  0m, 5m),
             }),

            (new Guid("d2000002-0000-0000-0000-000000000002"), CustADCB, "delivered", "2026-03-25",
             "POS system deployment — ADCB branches",
             new[] {
                 (new Guid("d3000003-0000-0000-0000-000000000003"), "POS System License (10 terminals)",     10m,   4500m,  5m, 5m),
                 (new Guid("d3000003-0000-0000-0000-000000000004"), "Annual Maintenance & Support Plan",      1m,  12000m,  0m, 5m),
             }),

            (new Guid("d2000002-0000-0000-0000-000000000003"), CustMAF, "delivered", "2026-04-10",
             "Inventory module — Majid Al Futtaim",
             new[] {
                 (new Guid("d3000003-0000-0000-0000-000000000005"), "Inventory Management Module",            1m,  48000m,  0m, 5m),
                 (new Guid("d3000003-0000-0000-0000-000000000006"), "On-site Training (5 days)",              5m,   2000m,  0m, 5m),
             }),

            (new Guid("d2000002-0000-0000-0000-000000000004"), CustDEWA, "shipped", "2026-05-10",
             "Finance & Accounting module — DEWA",
             new[] {
                 (new Guid("d3000003-0000-0000-0000-000000000007"), "Finance & Accounting Module License",    1m,  42000m,  0m, 5m),
                 (new Guid("d3000003-0000-0000-0000-000000000008"), "Data Migration Services",                1m,   8000m,  0m, 5m),
             }),

            (new Guid("d2000002-0000-0000-0000-000000000005"), CustEtisalat, "confirmed", "2026-05-25",
             "CRM module + API integration — Etisalat",
             new[] {
                 (new Guid("d3000003-0000-0000-0000-000000000009"), "CRM Module Enterprise License",          1m,  38000m,  0m, 5m),
                 (new Guid("d3000003-0000-0000-0000-000000000010"), "API Integration Package",                1m,   8500m,  0m, 5m),
                 (new Guid("d3000003-0000-0000-0000-000000000011"), "Training Package (10 users)",            1m,   4500m, 10m, 5m),
             }),

            (new Guid("d2000002-0000-0000-0000-000000000006"), CustDubaiProp, "confirmed", "2026-06-05",
             "Real Estate module — Dubai Properties",
             new[] {
                 (new Guid("d3000003-0000-0000-0000-000000000012"), "Real Estate Management Module",          1m,  55000m,  0m, 5m),
                 (new Guid("d3000003-0000-0000-0000-000000000013"), "Customisation & White-labelling",        1m,  12000m,  0m, 5m),
             }),

            (new Guid("d2000002-0000-0000-0000-000000000007"), CustCarrefour, "pending", "2026-06-20",
             "Retail POS — Carrefour UAE rollout",
             new[] {
                 (new Guid("d3000003-0000-0000-0000-000000000014"), "Retail POS License (50 terminals)",     50m,   3200m, 10m, 5m),
                 (new Guid("d3000003-0000-0000-0000-000000000015"), "Setup & Configuration Services",         1m,  18000m,  0m, 5m),
             }),

            (new Guid("d2000002-0000-0000-0000-000000000008"), CustADNOC, "pending", "2026-06-30",
             "Purchase & Vendor module — ADNOC",
             new[] {
                 (new Guid("d3000003-0000-0000-0000-000000000016"), "Purchase & Vendor Management Module",    1m,  35000m,  0m, 5m),
                 (new Guid("d3000003-0000-0000-0000-000000000017"), "ERP Integration Consulting",             1m,  14000m,  0m, 5m),
             }),

            (new Guid("d2000002-0000-0000-0000-000000000009"), CustLuLu, "cancelled", "2026-04-30",
             "LuLu cancelled — budget freeze",
             new[] {
                 (new Guid("d3000003-0000-0000-0000-000000000018"), "Multi-branch POS System (20 terminals)",20m,   4500m,  0m, 5m),
             }),
        };

        foreach (var (orderId, customerId, status, expectedDate, notes, items) in orders)
        {
            if (existing.Contains(orderId)) continue;

            var order = new SalesOrder(customerId, null, notes, expectedDate);
            SetId(order, orderId);

            foreach (var (itemId, desc, qty, price, discount, taxRate) in items)
            {
                var item = new SalesOrderItem(orderId, null, desc, qty, price, discount, taxRate);
                SetId(item, itemId);
                db.SalesOrderItems.Add(item);
            }

            if (status != "pending")
                order.Update(customerId, null, notes, expectedDate, status);

            db.SalesOrders.Add(order);
        }
    }

    // ── Sales Quotations ──────────────────────────────────────────────────────

    private static async Task SeedQuotationsAsync(SalesDbContext db)
    {
        var existing = await db.SalesQuotations.IgnoreQueryFilters()
            .Select(q => q.Id).ToHashSetAsync();

        // (quotationId, customerId, status, validUntil, discountPercent, notes, items[(itemId, desc, qty, price, itemDiscount, taxRate)])
        var quotations = new[]
        {
            (new Guid("d4000004-0000-0000-0000-000000000001"), CustEmaar, "sent", "2026-06-30", 0m,
             "Emaar — full ERP suite quotation",
             new[] {
                 (new Guid("d5000005-0000-0000-0000-000000000001"), "ERP Suite — Base License",               1m, 120000m, 0m, 5m),
                 (new Guid("d5000005-0000-0000-0000-000000000002"), "HR Module Add-on",                       1m,  35000m, 0m, 5m),
                 (new Guid("d5000005-0000-0000-0000-000000000003"), "Real Estate Module Add-on",              1m,  55000m, 0m, 5m),
                 (new Guid("d5000005-0000-0000-0000-000000000004"), "Finance Module Add-on",                  1m,  42000m, 0m, 5m),
                 (new Guid("d5000005-0000-0000-0000-000000000005"), "12 Months Support & SLA",                1m,  24000m, 0m, 5m),
             }),

            (new Guid("d4000004-0000-0000-0000-000000000002"), CustLuLu, "approved", "2026-07-15", 5m,
             "LuLu revised quotation — 5% corporate discount",
             new[] {
                 (new Guid("d5000005-0000-0000-0000-000000000006"), "Multi-branch POS (20 terminals)",       20m,   4500m, 5m, 5m),
                 (new Guid("d5000005-0000-0000-0000-000000000007"), "Central Management Dashboard",           1m,  18000m, 0m, 5m),
                 (new Guid("d5000005-0000-0000-0000-000000000008"), "Annual Maintenance Plan",                1m,  15000m, 0m, 5m),
             }),

            (new Guid("d4000004-0000-0000-0000-000000000003"), CustADNOC, "draft", "2026-07-31", 0m,
             "ADNOC — extended module proposal",
             new[] {
                 (new Guid("d5000005-0000-0000-0000-000000000009"), "Purchase & Vendor Management Module",    1m,  35000m, 0m, 5m),
                 (new Guid("d5000005-0000-0000-0000-000000000010"), "Inventory Management Module",            1m,  48000m, 0m, 5m),
                 (new Guid("d5000005-0000-0000-0000-000000000011"), "ERP Integration & API",                  1m,  14000m, 0m, 5m),
             }),

            (new Guid("d4000004-0000-0000-0000-000000000004"), CustCarrefour, "rejected", "2026-05-31", 10m,
             "Carrefour rejected — competitor chosen",
             new[] {
                 (new Guid("d5000005-0000-0000-0000-000000000012"), "Retail POS (50 terminals)",             50m,   3200m,10m, 5m),
                 (new Guid("d5000005-0000-0000-0000-000000000013"), "Inventory Module",                       1m,  48000m, 0m, 5m),
             }),
        };

        foreach (var (quotationId, customerId, status, validUntil, discountPct, notes, items) in quotations)
        {
            if (existing.Contains(quotationId)) continue;

            var quotation = new SalesQuotation(customerId, null, notes, validUntil, discountPct);
            SetId(quotation, quotationId);

            foreach (var (itemId, desc, qty, price, itemDiscount, taxRate) in items)
            {
                var item = new SalesQuotationItem(quotationId, null, desc, qty, price, itemDiscount, taxRate);
                SetId(item, itemId);
                db.SalesQuotationItems.Add(item);
            }

            if (status != "draft")
                quotation.Update(customerId, null, notes, validUntil, discountPct, status);

            db.SalesQuotations.Add(quotation);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static void SetId(object entity, Guid id) =>
        entity.GetType().GetProperty("Id")!.SetValue(entity, id);
}
