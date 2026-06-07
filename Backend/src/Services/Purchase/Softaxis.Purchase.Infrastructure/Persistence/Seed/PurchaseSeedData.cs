using Microsoft.EntityFrameworkCore;
using Softaxis.Purchase.Domain.Entities;

namespace Softaxis.Purchase.Infrastructure.Persistence.Seed;

/// <summary>
/// Idempotent seed data for the Purchase module.
/// Safe to re-run — checks by fixed GUID before inserting.
/// </summary>
public static class PurchaseSeedData
{
    public static async Task SeedAsync(PurchaseDbContext db)
    {
        await SeedVendorsAsync(db);
        await db.SaveChangesAsync();
        await SeedPurchaseOrdersAsync(db);
        await db.SaveChangesAsync();
    }

    // ── Vendors ───────────────────────────────────────────────────────────────

    private static readonly Guid VndTechworld   = new("c1000001-0000-0000-0000-000000000001");
    private static readonly Guid VndGlobalElec  = new("c1000001-0000-0000-0000-000000000002");
    private static readonly Guid VndAlSaeed     = new("c1000001-0000-0000-0000-000000000003");
    private static readonly Guid VndNasimTrade  = new("c1000001-0000-0000-0000-000000000004");
    private static readonly Guid VndOfficePro   = new("c1000001-0000-0000-0000-000000000005");
    private static readonly Guid VndFoodLink    = new("c1000001-0000-0000-0000-000000000006");
    private static readonly Guid VndApparelCo   = new("c1000001-0000-0000-0000-000000000007");
    private static readonly Guid VndMediSupply  = new("c1000001-0000-0000-0000-000000000008");

    private static async Task SeedVendorsAsync(PurchaseDbContext db)
    {
        var existing = await db.Vendors.IgnoreQueryFilters()
            .Select(v => v.Id).ToHashSetAsync();

        var vendors = new[]
        {
            (VndTechworld,  "Techworld Trading LLC",       "TWLD", "Electronics",  "Ahmed Al Rashid",    "ahmed@techworld.ae",      "+971-4-3345678",  "Deira, Dubai, UAE",             "TRN100234567", "Net 30",  "AED", 4.5m),
            (VndGlobalElec, "Global Electronics FZE",      "GELC", "Electronics",  "Sara Johnson",       "sara@globalelec.ae",      "+971-4-8829900",  "Jebel Ali FZ, Dubai, UAE",     "TRN100345678", "Net 45",  "AED", 4.2m),
            (VndAlSaeed,    "Al Saeed Wholesale Co.",      "ALSW", "General",      "Mohammed Al Saeed",  "msaeed@alsaeed.ae",       "+971-6-5567890",  "Industrial Area, Sharjah, UAE","TRN100456789", "Net 30",  "AED", 3.8m),
            (VndNasimTrade, "Nasim International Trading", "NAIM", "Food & FMCG",  "Khalid Nasim",       "khalid@nasimtrade.pk",    "+92-21-34567890", "SITE Area, Karachi, Pakistan",  "NTN1234567-0", "Net 15",  "PKR", 4.0m),
            (VndOfficePro,  "OfficePro Supplies LLC",      "OPRO", "Stationery",   "Fatima Al Hajj",     "fatima@officepro.ae",     "+971-2-6123456",  "Mussafah, Abu Dhabi, UAE",     "TRN100567890", "Net 30",  "AED", 4.3m),
            (VndFoodLink,   "FoodLink Distribution LLC",   "FDLK", "Food & FMCG",  "Rania Hassan",       "rania@foodlink.ae",       "+971-4-2234567",  "Al Quoz, Dubai, UAE",          "TRN100678901", "Net 14",  "AED", 3.9m),
            (VndApparelCo,  "Apparel Connections FZE",     "APCO", "Clothing",     "David Chen",         "david@apparelco.hk",      "+852-23456789",   "Kwun Tong, Hong Kong",          "51234567-001", "Net 60",  "USD", 4.1m),
            (VndMediSupply, "MediSupply Arabia LLC",        "MEDS", "Healthcare",   "Dr. Layla Al Amri",  "layla@medisupply.ae",     "+971-2-4412345",  "Khalifa City A, Abu Dhabi, UAE","TRN100789012", "Net 30",  "AED", 4.7m),
        };

        foreach (var (id, name, code, category, contact, email, phone, address, tax, terms, currency, rating) in vendors)
        {
            if (existing.Contains(id)) continue;
            var vendor = new Vendor(name, code, category, contact, email, phone, address, tax, terms, currency, null);
            SetId(vendor, id);
            // Set rating via update method
            vendor.Update(name, code, category, contact, email, phone, address, tax, terms, currency, null, "active", rating);
            db.Vendors.Add(vendor);
        }
    }

    // ── Purchase Orders ───────────────────────────────────────────────────────

    private static async Task SeedPurchaseOrdersAsync(PurchaseDbContext db)
    {
        var existing = await db.PurchaseOrders.IgnoreQueryFilters()
            .Select(p => p.Id).ToHashSetAsync();

        // (orderId, vendorId, status, expectedDate, notes, items[(desc, qty, unitCost, taxRate)])
        var orders = new[]
        {
            (new Guid("c2000002-0000-0000-0000-000000000001"), VndTechworld, "received", "2026-03-10",
             "Samsung Galaxy S24 Ultra batch Q1",
             new[] {
                 (new Guid("c3000003-0000-0000-0000-000000000001"), "Samsung Galaxy S24 Ultra 256GB", 20m, 3200m, 5m),
                 (new Guid("c3000003-0000-0000-0000-000000000002"), "Samsung Galaxy A55 128GB",        30m,  820m, 5m),
             }),

            (new Guid("c2000002-0000-0000-0000-000000000002"), VndGlobalElec, "received", "2026-03-20",
             "Apple devices Q1 restock",
             new[] {
                 (new Guid("c3000003-0000-0000-0000-000000000003"), "Apple iPhone 15 Pro 256GB",  10m, 3800m, 5m),
                 (new Guid("c3000003-0000-0000-0000-000000000004"), "Apple MacBook Pro 14 M3",      4m, 4200m, 5m),
                 (new Guid("c3000003-0000-0000-0000-000000000005"), "Apple AirPods Pro 2nd Gen",   20m,  480m, 5m),
             }),

            (new Guid("c2000002-0000-0000-0000-000000000003"), VndAlSaeed, "received", "2026-04-05",
             "Clothing & footwear April batch",
             new[] {
                 (new Guid("c3000003-0000-0000-0000-000000000006"), "Nike Air Max 270 (assorted)",        15m,  270m, 0m),
                 (new Guid("c3000003-0000-0000-0000-000000000007"), "Adidas Ultraboost 23 (assorted)",    12m,  240m, 0m),
                 (new Guid("c3000003-0000-0000-0000-000000000008"), "Nike Dri-FIT T-Shirts (assorted)",   30m,   80m, 0m),
             }),

            (new Guid("c2000002-0000-0000-0000-000000000004"), VndFoodLink, "received", "2026-04-12",
             "Beverages & snacks April replenishment",
             new[] {
                 (new Guid("c3000003-0000-0000-0000-000000000009"), "Coca-Cola 500ml 24-Pack",            50m,  280m, 0m),
                 (new Guid("c3000003-0000-0000-0000-000000000010"), "Nestlé Pure Life Water 1.5L 12-Pack",80m,   70m, 0m),
                 (new Guid("c3000003-0000-0000-0000-000000000011"), "Red Bull 250ml 24-Pack",             30m,  300m, 0m),
                 (new Guid("c3000003-0000-0000-0000-000000000012"), "Nestlé KitKat 48-Pack",              40m,  280m, 0m),
             }),

            (new Guid("c2000002-0000-0000-0000-000000000005"), VndOfficePro, "received", "2026-04-18",
             "Office supplies Q2",
             new[] {
                 (new Guid("c3000003-0000-0000-0000-000000000013"), "A4 Copy Paper 80gsm 500-sheet (box)", 100m,   9m, 0m),
                 (new Guid("c3000003-0000-0000-0000-000000000014"), "Staedtler Ballpoint Pens (Box 50)",    40m,  18m, 0m),
             }),

            (new Guid("c2000002-0000-0000-0000-000000000006"), VndTechworld, "sent", "2026-05-25",
             "HP & Dell laptops May order",
             new[] {
                 (new Guid("c3000003-0000-0000-0000-000000000015"), "HP EliteBook 840 G10 Core i7",  8m, 2400m, 5m),
                 (new Guid("c3000003-0000-0000-0000-000000000016"), "Dell XPS 15 Core i9 32GB",      5m, 2900m, 5m),
                 (new Guid("c3000003-0000-0000-0000-000000000017"), "HP Pavilion 15 Core i5",        10m, 1200m, 5m),
             }),

            (new Guid("c2000002-0000-0000-0000-000000000007"), VndApparelCo, "draft", "2026-06-10",
             "Adidas Essentials polo shirts restock",
             new[] {
                 (new Guid("c3000003-0000-0000-0000-000000000018"), "Adidas Essentials Polo Shirt (assorted sizes)", 50m, 70m, 0m),
             }),

            (new Guid("c2000002-0000-0000-0000-000000000008"), VndMediSupply, "draft", "2026-06-15",
             "Personal care & skincare restocking",
             new[] {
                 (new Guid("c3000003-0000-0000-0000-000000000019"), "Dove Men+Care Body Wash 400ml",          40m,  25m, 0m),
                 (new Guid("c3000003-0000-0000-0000-000000000020"), "Oral-B Pro 3 Electric Toothbrush",       15m, 110m, 5m),
                 (new Guid("c3000003-0000-0000-0000-000000000021"), "Neutrogena Hydro Boost Gel 50ml",        30m,  45m, 0m),
                 (new Guid("c3000003-0000-0000-0000-000000000022"), "Nivea Soft Moisturising Cream 200ml",    50m,  18m, 0m),
             }),
        };

        foreach (var (orderId, vendorId, status, expectedDate, notes, items) in orders)
        {
            if (existing.Contains(orderId)) continue;

            var order = new PurchaseOrder(vendorId, notes, expectedDate);
            SetId(order, orderId);

            foreach (var (itemId, description, qty, unitCost, taxRate) in items)
            {
                var item = new PurchaseOrderItem(orderId, null, description, qty, unitCost, taxRate);
                SetId(item, itemId);
                db.PurchaseOrderItems.Add(item);
            }

            if (status != "draft") order.UpdateStatus(status);
            db.PurchaseOrders.Add(order);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static void SetId(object entity, Guid id) =>
        entity.GetType().GetProperty("Id")!.SetValue(entity, id);
}
