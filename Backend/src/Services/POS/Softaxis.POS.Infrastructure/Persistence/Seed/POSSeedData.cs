using Microsoft.EntityFrameworkCore;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Enums;

namespace Softaxis.POS.Infrastructure.Persistence.Seed;

/// <summary>
/// Idempotent seed data for the POS module.
/// Covers: product categories, products, customers, and closed sessions with transactions.
/// Safe to re-run — checks by fixed GUID before inserting.
/// </summary>
public static class POSSeedData
{
    // Stable cashier GUIDs (represent staff)
    private static readonly Guid CashierAhmed  = new("e0000001-0000-0000-0000-000000000001");
    private static readonly Guid CashierFatima = new("e0000001-0000-0000-0000-000000000002");

    public static async Task SeedAsync(POSDbContext db)
    {
        await SeedCategoriesAsync(db);
        await db.SaveChangesAsync();
        await SeedProductsAsync(db);
        await db.SaveChangesAsync();
        await SeedCustomersAsync(db);
        await db.SaveChangesAsync();
        await SeedSessionsAndTransactionsAsync(db);
        await db.SaveChangesAsync();
    }

    // ── Product Categories ────────────────────────────────────────────────────

    private static readonly Guid CatElectronics  = new("e1000001-0000-0000-0000-000000000001");
    private static readonly Guid CatFoodBev      = new("e1000001-0000-0000-0000-000000000002");
    private static readonly Guid CatClothing     = new("e1000001-0000-0000-0000-000000000003");
    private static readonly Guid CatHealthBeauty = new("e1000001-0000-0000-0000-000000000004");
    private static readonly Guid CatHomeKitchen  = new("e1000001-0000-0000-0000-000000000005");
    private static readonly Guid CatStationery   = new("e1000001-0000-0000-0000-000000000006");
    private static readonly Guid CatSports       = new("e1000001-0000-0000-0000-000000000007");
    private static readonly Guid CatMobiles      = new("e1000001-0000-0000-0000-000000000011");
    private static readonly Guid CatLaptops      = new("e1000001-0000-0000-0000-000000000012");
    private static readonly Guid CatBeverages    = new("e1000001-0000-0000-0000-000000000021");
    private static readonly Guid CatSnacks       = new("e1000001-0000-0000-0000-000000000022");

    private static async Task SeedCategoriesAsync(POSDbContext db)
    {
        var existing = await db.ProductCategories.IgnoreQueryFilters()
            .Select(c => c.Id).ToHashSetAsync();

        var parents = new[]
        {
            (CatElectronics,  "Electronics",       "Core electronics and tech products",  (Guid?)null, 1),
            (CatFoodBev,      "Food & Beverages",  "Packaged food, drinks, and snacks",   (Guid?)null, 2),
            (CatClothing,     "Clothing",          "Apparel and footwear",                (Guid?)null, 3),
            (CatHealthBeauty, "Health & Beauty",   "Skincare, personal care, healthcare", (Guid?)null, 4),
            (CatHomeKitchen,  "Home & Kitchen",    "Household and kitchen essentials",    (Guid?)null, 5),
            (CatStationery,   "Stationery",        "Office and school supplies",          (Guid?)null, 6),
            (CatSports,       "Sports & Fitness",  "Sports equipment and fitness gear",   (Guid?)null, 7),
        };

        foreach (var (id, name, desc, parentId, sort) in parents)
        {
            if (existing.Contains(id)) continue;
            var cat = ProductCategory.Create(name, desc, parentId, sort).Value;
            SetId(cat, id);
            db.ProductCategories.Add(cat);
        }

        await db.SaveChangesAsync();  // save parents before children

        var children = new[]
        {
            (CatMobiles,   "Mobile Phones", "Smartphones and accessories", (Guid?)CatElectronics, 1),
            (CatLaptops,   "Laptops & PCs", "Portable and desktop computers", (Guid?)CatElectronics, 2),
            (CatBeverages, "Beverages",     "Cold drinks, water, energy drinks", (Guid?)CatFoodBev, 1),
            (CatSnacks,    "Snacks",        "Chips, chocolate, confectionery", (Guid?)CatFoodBev, 2),
        };

        foreach (var (id, name, desc, parentId, sort) in children)
        {
            if (existing.Contains(id)) continue;
            var cat = ProductCategory.Create(name, desc, parentId, sort).Value;
            SetId(cat, id);
            db.ProductCategories.Add(cat);
        }
    }

    // ── Products ──────────────────────────────────────────────────────────────

    private static readonly Guid PrdIPhone15Pro    = new("e2000002-0000-0000-0000-000000000001");
    private static readonly Guid PrdGalaxyS24      = new("e2000002-0000-0000-0000-000000000002");
    private static readonly Guid PrdXiaomi14       = new("e2000002-0000-0000-0000-000000000003");
    private static readonly Guid PrdHPEliteBook    = new("e2000002-0000-0000-0000-000000000004");
    private static readonly Guid PrdDellXPS15      = new("e2000002-0000-0000-0000-000000000005");
    private static readonly Guid PrdCocaCola24     = new("e2000002-0000-0000-0000-000000000006");
    private static readonly Guid PrdWater12        = new("e2000002-0000-0000-0000-000000000007");
    private static readonly Guid PrdRedBull24      = new("e2000002-0000-0000-0000-000000000008");
    private static readonly Guid PrdKitKat48       = new("e2000002-0000-0000-0000-000000000009");
    private static readonly Guid PrdLays160        = new("e2000002-0000-0000-0000-000000000010");
    private static readonly Guid PrdNikeShoes      = new("e2000002-0000-0000-0000-000000000011");
    private static readonly Guid PrdAdidasPolo     = new("e2000002-0000-0000-0000-000000000012");
    private static readonly Guid PrdNeutrogena     = new("e2000002-0000-0000-0000-000000000013");
    private static readonly Guid PrdDoveBodyWash   = new("e2000002-0000-0000-0000-000000000014");
    private static readonly Guid PrdA4Paper        = new("e2000002-0000-0000-0000-000000000015");
    private static readonly Guid PrdResistanceBand = new("e2000002-0000-0000-0000-000000000016");

    private static async Task SeedProductsAsync(POSDbContext db)
    {
        var existing = await db.Products.IgnoreQueryFilters()
            .Select(p => p.Id).ToHashSetAsync();

        // (id, name, sku, barcode, categoryId, salePrice, costPrice, taxRate, unit, stock, reorder, trackInventory)
        var products = new[]
        {
            (PrdIPhone15Pro,    "Apple iPhone 15 Pro 256GB",         "MOB-APL-15P",   "0194253389858", CatMobiles,    5499m, 3800m, 5m,  "pcs", 15m,  5m, true),
            (PrdGalaxyS24,      "Samsung Galaxy S24 Ultra 256GB",    "MOB-SAM-S24U",  "8806094914435", CatMobiles,    4899m, 3200m, 5m,  "pcs", 28m,  5m, true),
            (PrdXiaomi14,       "Xiaomi 14 Pro 512GB",               "MOB-XMI-14P",   "6941812745367", CatMobiles,    2499m, 1600m, 5m,  "pcs", 20m,  5m, true),
            (PrdHPEliteBook,    "HP EliteBook 840 G10 Core i7",      "LAP-HP-840G10", "0198122456781", CatLaptops,    3499m, 2400m, 5m,  "pcs", 12m,  3m, true),
            (PrdDellXPS15,      "Dell XPS 15 Core i9 32GB",          "LAP-DEL-XPS15", "0884116418963", CatLaptops,    4299m, 2900m, 5m,  "pcs",  8m,  3m, true),
            (PrdCocaCola24,     "Coca-Cola 500ml (24-Pack)",         "BEV-COKE-500",  "4902102141773", CatBeverages,   450m,  280m, 0m,  "box", 80m, 20m, true),
            (PrdWater12,        "Nestlé Pure Life 1.5L (12-Pack)",   "BEV-NEST-1L5",  "6281003027400", CatBeverages,   120m,   70m, 0m,  "box",120m, 30m, true),
            (PrdRedBull24,      "Red Bull Energy Drink 250ml (24pk)","BEV-RBULL-250", "9002490100070", CatBeverages,   480m,  300m, 0m,  "box", 50m, 15m, true),
            (PrdKitKat48,       "Nestlé KitKat 40g (48-Pack)",       "SNK-KK-40G",    "7613034626219", CatSnacks,      480m,  280m, 0m,  "box", 60m, 15m, true),
            (PrdLays160,        "Lay's Classic Chips 160g",          "SNK-LAYS-160",  "6281003060438", CatSnacks,       18m,   10m, 0m,  "pcs",200m, 50m, true),
            (PrdNikeShoes,      "Nike Air Max 270 (assorted)",       "FTW-NK-AM270",  "00191886358382",CatClothing,    449m,  270m, 0m,  "pcs", 22m,  5m, true),
            (PrdAdidasPolo,     "Adidas Essentials Polo Shirt",      "CLT-AD-POLO",   "00888591563281",CatClothing,    129m,   70m, 0m,  "pcs", 38m, 10m, true),
            (PrdNeutrogena,     "Neutrogena Hydro Boost Gel 50ml",   "SK-NG-HB50",    "0086800880403", CatHealthBeauty, 89m,   45m, 0m,  "pcs", 55m, 15m, true),
            (PrdDoveBodyWash,   "Dove Men+Care Body Wash 400ml",     "PC-DOVE-400",   "0011111070673", CatHealthBeauty, 45m,   25m, 0m,  "pcs", 70m, 20m, true),
            (PrdA4Paper,        "A4 Copy Paper 80gsm (500 sheets)",  "OFF-A4-80G",    "5000006004071", CatStationery,   18m,    9m, 0m,  "box",150m, 30m, true),
            (PrdResistanceBand, "Resistance Band Set (5 levels)",    "FIT-RB-SET5",   "0685479884511", CatSports,       85m,   40m, 5m,  "set", 30m,  8m, true),
        };

        foreach (var (id, name, sku, barcode, catId, salePrice, costPrice, taxRate, unit, stock, reorder, track) in products)
        {
            if (existing.Contains(id)) continue;
            var product = Product.Create(name, null, sku, barcode, catId, salePrice, costPrice, taxRate, unit, stock, reorder, track, null).Value;
            SetId(product, id);
            db.Products.Add(product);
        }
    }

    // ── Customers ─────────────────────────────────────────────────────────────

    private static readonly Guid CustWalkIn   = new("e3000003-0000-0000-0000-000000000001");
    private static readonly Guid CustAhmed    = new("e3000003-0000-0000-0000-000000000002");
    private static readonly Guid CustFatima   = new("e3000003-0000-0000-0000-000000000003");
    private static readonly Guid CustMohammed = new("e3000003-0000-0000-0000-000000000004");
    private static readonly Guid CustSara     = new("e3000003-0000-0000-0000-000000000005");
    private static readonly Guid CustKhalid   = new("e3000003-0000-0000-0000-000000000006");
    private static readonly Guid CustOmar     = new("e3000003-0000-0000-0000-000000000007");
    private static readonly Guid CustLayla    = new("e3000003-0000-0000-0000-000000000008");

    private static async Task SeedCustomersAsync(POSDbContext db)
    {
        var existing = await db.Customers.IgnoreQueryFilters()
            .Select(c => c.Id).ToHashSetAsync();

        var customers = new[]
        {
            (CustWalkIn,   "Walk-In Customer",       (string?)null,             (string?)null,           (string?)null,                 "Default walk-in customer"),
            (CustAhmed,    "Ahmed Al Rashid",        "+971-50-1234567",         "ahmed.alrashid@gmail.com","Al Barsha, Dubai, UAE",       "Regular loyalty customer"),
            (CustFatima,   "Fatima Hassan",          "+971-55-2345678",         "fatima.h@hotmail.com",   "Jumeirah, Dubai, UAE",         "Premium member"),
            (CustMohammed, "Mohammed Al Mansoori",   "+971-56-3456789",         "mmansoori@yahoo.com",    "Khalidiyah, Abu Dhabi, UAE",   "Gold tier customer"),
            (CustSara,     "Sara Johnson",           "+971-52-4567890",         "sara.j@gmail.com",       "JBR, Dubai, UAE",              "New customer"),
            (CustKhalid,   "Khalid Al Zaabi",        "+971-54-5678901",         "k.alzaabi@gmail.com",    "Al Ain, UAE",                  "Wholesale buyer"),
            (CustOmar,     "Omar Abdullah",          "+971-50-6789012",         "omar.abd@icloud.com",    "Deira, Dubai, UAE",            "Returning customer"),
            (CustLayla,    "Layla Al Amri",          "+971-55-7890123",         "layla.amri@gmail.com",   "Muscat, Oman",                 "Cross-border shopper"),
        };

        foreach (var (id, name, phone, email, address, notes) in customers)
        {
            if (existing.Contains(id)) continue;
            var customer = Customer.Create(name, phone, email, address, notes).Value;
            SetId(customer, id);
            // Add loyalty points via reflection for established customers
            if (id == CustAhmed)    SetProp(customer, "LoyaltyPoints", 850m);
            if (id == CustFatima)   SetProp(customer, "LoyaltyPoints", 2100m);
            if (id == CustMohammed) SetProp(customer, "LoyaltyPoints", 4500m);
            if (id == CustKhalid)   SetProp(customer, "LoyaltyPoints", 320m);
            db.Customers.Add(customer);
        }
    }

    // ── Sessions & Transactions ───────────────────────────────────────────────

    private static readonly Guid Session1 = new("e4000004-0000-0000-0000-000000000001");
    private static readonly Guid Session2 = new("e4000004-0000-0000-0000-000000000002");
    private static readonly Guid Session3 = new("e4000004-0000-0000-0000-000000000003");
    private static readonly Guid Session4 = new("e4000004-0000-0000-0000-000000000004");

    private static async Task SeedSessionsAndTransactionsAsync(POSDbContext db)
    {
        var existingSessions = await db.Sessions.IgnoreQueryFilters()
            .Select(s => s.Id).ToHashSetAsync();

        // Load seeded products for line item creation
        var productIds = new[] { PrdIPhone15Pro, PrdGalaxyS24, PrdCocaCola24, PrdWater12, PrdKitKat48, PrdLays160, PrdNikeShoes, PrdDoveBodyWash, PrdA4Paper };
        var products = await db.Products.IgnoreQueryFilters()
            .Where(p => productIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id);

        // If products haven't been saved yet, skip transactions
        if (products.Count == 0) return;

        // ── Session 1 ─────────────────────────────────────────────────────────
        // Closed — 3 days ago, Register 1, Ahmed cashier
        if (!existingSessions.Contains(Session1))
        {
            var s1 = POSSession.Open(CashierAhmed, "REG-001", 5000m).Value;
            SetId(s1, Session1);
            SetProp(s1, "OpenedAt", DateTime.UtcNow.AddDays(-3));

            // Txn 1: Ahmed customer buys iPhone + Coke
            var txn1Id = new Guid("e5000005-0000-0000-0000-000000000001");
            AddTransaction(db, s1, txn1Id, "TXN-2026052101", CashierAhmed, CustAhmed,
                new[] { (products[PrdIPhone15Pro], 1m, 0m), (products[PrdCocaCola24], 2m, 0m) },
                PaymentMethod.Card, 0m);

            // Txn 2: Walk-in customer buys snacks
            var txn2Id = new Guid("e5000005-0000-0000-0000-000000000002");
            AddTransaction(db, s1, txn2Id, "TXN-2026052102", CashierAhmed, CustWalkIn,
                new[] { (products[PrdKitKat48], 1m, 0m), (products[PrdLays160], 3m, 0m), (products[PrdWater12], 1m, 0m) },
                PaymentMethod.Cash, 50m);

            // Txn 3: Khalid buys Nike shoes
            var txn3Id = new Guid("e5000005-0000-0000-0000-000000000003");
            AddTransaction(db, s1, txn3Id, "TXN-2026052103", CashierAhmed, CustKhalid,
                new[] { (products[PrdNikeShoes], 2m, 0m) },
                PaymentMethod.Card, 0m);

            s1.Close(5000m + s1.TotalSales * 0.3m, "Normal close — end of shift");  // partial cash
            db.Sessions.Add(s1);
        }

        // ── Session 2 ─────────────────────────────────────────────────────────
        // Closed — 2 days ago, Register 2, Fatima cashier
        if (!existingSessions.Contains(Session2))
        {
            var s2 = POSSession.Open(CashierFatima, "REG-002", 3000m).Value;
            SetId(s2, Session2);
            SetProp(s2, "OpenedAt", DateTime.UtcNow.AddDays(-2));

            // Txn 4: Fatima customer buys Samsung + water
            var txn4Id = new Guid("e5000005-0000-0000-0000-000000000004");
            AddTransaction(db, s2, txn4Id, "TXN-2026052201", CashierFatima, CustFatima,
                new[] { (products[PrdGalaxyS24], 1m, 0m), (products[PrdWater12], 2m, 0m) },
                PaymentMethod.DigitalWallet, 0m);

            // Txn 5: Mohammed buys office supplies
            var txn5Id = new Guid("e5000005-0000-0000-0000-000000000005");
            AddTransaction(db, s2, txn5Id, "TXN-2026052202", CashierFatima, CustMohammed,
                new[] { (products[PrdA4Paper], 5m, 0m), (products[PrdDoveBodyWash], 2m, 0m) },
                PaymentMethod.Cash, 20m);

            s2.Close(3000m + s2.TotalSales * 0.2m, "Normal close");
            db.Sessions.Add(s2);
        }

        // ── Session 3 ─────────────────────────────────────────────────────────
        // Closed — yesterday, Register 1, Ahmed cashier
        if (!existingSessions.Contains(Session3))
        {
            var s3 = POSSession.Open(CashierAhmed, "REG-001", 5000m).Value;
            SetId(s3, Session3);
            SetProp(s3, "OpenedAt", DateTime.UtcNow.AddDays(-1));

            // Txn 6: Sara buys Adidas polo shirts
            var txn6Id = new Guid("e5000005-0000-0000-0000-000000000006");
            AddTransaction(db, s3, txn6Id, "TXN-2026052301", CashierAhmed, CustSara,
                new[] { (products[PrdNikeShoes], 1m, 0m) },
                PaymentMethod.Card, 0m);

            // Txn 7: Omar walk-in buys beverages and snacks
            var txn7Id = new Guid("e5000005-0000-0000-0000-000000000007");
            AddTransaction(db, s3, txn7Id, "TXN-2026052302", CashierAhmed, CustOmar,
                new[] { (products[PrdCocaCola24], 3m, 0m), (products[PrdKitKat48], 2m, 0m), (products[PrdLays160], 5m, 0m) },
                PaymentMethod.Cash, 100m);

            s3.Close(5000m + s3.TotalSales * 0.25m, "Normal close");
            db.Sessions.Add(s3);
        }

        // ── Session 4 ─────────────────────────────────────────────────────────
        // Open — today (current shift), Register 2, Fatima cashier
        if (!existingSessions.Contains(Session4))
        {
            var s4 = POSSession.Open(CashierFatima, "REG-002", 3000m).Value;
            SetId(s4, Session4);
            SetProp(s4, "OpenedAt", DateTime.UtcNow.AddHours(-3));

            // Txn 8: Layla buys iPhone 15 Pro
            var txn8Id = new Guid("e5000005-0000-0000-0000-000000000008");
            AddTransaction(db, s4, txn8Id, "TXN-2026052401", CashierFatima, CustLayla,
                new[] { (products[PrdIPhone15Pro], 1m, 0m) },
                PaymentMethod.Card, 0m);

            // Close session 4 so it doesn't collide with real cashier sessions
            s4.Close(3000m + s4.TotalSales * 0.4m, "Seed close — shift ended");
            db.Sessions.Add(s4);
        }
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private static void AddTransaction(
        POSDbContext db,
        POSSession session,
        Guid txnId,
        string txnNumber,
        Guid cashierId,
        Guid? customerId,
        (Product product, decimal qty, decimal discountPercent)[] lineItems,
        PaymentMethod paymentMethod,
        decimal extraCashChange)
    {
        var txnResult = POSTransaction.CreateSale(txnNumber, session.Id, cashierId, customerId);
        if (txnResult.IsFailure) return;

        var txn = txnResult.Value;
        SetId(txn, txnId);

        // Build line items
        var lines = new List<POSLineItem>();
        foreach (var (product, qty, discountPct) in lineItems)
        {
            var lineResult = POSLineItem.Create(txnId, product, qty, null, discountPct);
            if (lineResult.IsFailure) continue;
            var line = lineResult.Value;
            SetId(line, Guid.NewGuid());
            lines.Add(line);
        }

        // Build payment (single payment for simplicity)
        var totalAmount = lines.Sum(l => l.LineTotal);
        var payResult = POSPayment.Create(txnId, paymentMethod, totalAmount + extraCashChange);
        if (payResult.IsFailure) return;
        var payment = payResult.Value;
        SetId(payment, Guid.NewGuid());

        // Complete the transaction
        txn.Complete(lines, new[] { payment }, null);
        session.RecordTransaction(txn.TotalAmount, false);

        db.Transactions.Add(txn);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static void SetId(object entity, Guid id) =>
        entity.GetType().GetProperty("Id")!.SetValue(entity, id);

    private static void SetProp(object entity, string propName, object value) =>
        entity.GetType().GetProperty(propName)!.SetValue(entity, value);
}
