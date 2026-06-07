using Microsoft.EntityFrameworkCore;
using Softaxis.Inventory.Domain.Entities;

namespace Softaxis.Inventory.Infrastructure.Persistence.Seed;

/// <summary>
/// Idempotent seed data for all Inventory master tables.
/// Runs at startup — safe to re-run (checks existence before inserting).
/// </summary>
public static class InventorySeedData
{
    // ── Deterministic IDs ──────────────────────────────────────────────────────
    // Using fixed GUIDs so re-seeding never creates duplicates.

    public static async Task SeedAsync(InventoryDbContext db)
    {
        await SeedUnitsOfMeasureAsync(db);
        await SeedBrandsAsync(db);
        await SeedCategoriesAsync(db);
        await SeedWarehousesAsync(db);
        await db.SaveChangesAsync();
        await SeedProductsAsync(db);
        await db.SaveChangesAsync();
    }

    // ── Units of Measure ───────────────────────────────────────────────────────

    private static readonly (Guid Id, string Name, string Symbol, string Description)[] UoMs =
    [
        (new Guid("10000001-0000-0000-0000-000000000001"), "Piece",      "pcs",  "Single unit / individual item"),
        (new Guid("10000001-0000-0000-0000-000000000002"), "Kilogram",   "kg",   "Metric unit of mass"),
        (new Guid("10000001-0000-0000-0000-000000000003"), "Gram",       "g",    "1/1000 of a kilogram"),
        (new Guid("10000001-0000-0000-0000-000000000004"), "Litre",      "L",    "Metric unit of volume"),
        (new Guid("10000001-0000-0000-0000-000000000005"), "Millilitre", "ml",   "1/1000 of a litre"),
        (new Guid("10000001-0000-0000-0000-000000000006"), "Metre",      "m",    "Metric unit of length"),
        (new Guid("10000001-0000-0000-0000-000000000007"), "Centimetre", "cm",   "1/100 of a metre"),
        (new Guid("10000001-0000-0000-0000-000000000008"), "Box",        "box",  "Packaged box quantity"),
        (new Guid("10000001-0000-0000-0000-000000000009"), "Carton",     "ctn",  "Bulk carton / master case"),
        (new Guid("10000001-0000-0000-0000-000000000010"), "Dozen",      "dz",   "12 units"),
        (new Guid("10000001-0000-0000-0000-000000000011"), "Pack",       "pk",   "Retail pack / bundle"),
        (new Guid("10000001-0000-0000-0000-000000000012"), "Set",        "set",  "Grouped set of items"),
        (new Guid("10000001-0000-0000-0000-000000000013"), "Pair",       "pr",   "Two matching items"),
        (new Guid("10000001-0000-0000-0000-000000000014"), "Roll",       "roll", "Rolled material (fabric, paper, etc.)"),
        (new Guid("10000001-0000-0000-0000-000000000015"), "Sheet",      "sht",  "Flat sheet of material"),
        (new Guid("10000001-0000-0000-0000-000000000016"), "Tonne",      "ton",  "1000 kilograms"),
        (new Guid("10000001-0000-0000-0000-000000000017"), "Foot",       "ft",   "Imperial unit of length"),
        (new Guid("10000001-0000-0000-0000-000000000018"), "Inch",       "in",   "Imperial unit of length"),
        (new Guid("10000001-0000-0000-0000-000000000019"), "Bottle",     "btl",  "Single bottle"),
        (new Guid("10000001-0000-0000-0000-000000000020"), "Bag",        "bag",  "Single bag"),
    ];

    private static async Task SeedUnitsOfMeasureAsync(InventoryDbContext db)
    {
        var existingIds = await db.UnitsOfMeasure
            .IgnoreQueryFilters()
            .Select(u => u.Id)
            .ToHashSetAsync();

        foreach (var (id, name, symbol, description) in UoMs)
        {
            if (existingIds.Contains(id)) continue;

            // Use reflection to bypass private constructor for seeding
            var uom = CreateUoM(id, name, symbol, description);
            db.UnitsOfMeasure.Add(uom);
        }
    }

    // ── Brands ─────────────────────────────────────────────────────────────────

    private static readonly (Guid Id, string Name, string Code, string Description)[] Brands =
    [
        // Technology
        (new Guid("20000002-0000-0000-0000-000000000001"), "Samsung",        "SMSNG", "South Korean multinational electronics corporation"),
        (new Guid("20000002-0000-0000-0000-000000000002"), "Apple",          "APPLE", "American multinational technology company"),
        (new Guid("20000002-0000-0000-0000-000000000003"), "Xiaomi",         "XIOMI", "Chinese electronics and software company"),
        (new Guid("20000002-0000-0000-0000-000000000004"), "HP",             "HP",    "Hewlett-Packard — computing and printing"),
        (new Guid("20000002-0000-0000-0000-000000000005"), "Dell",           "DELL",  "American technology company"),
        (new Guid("20000002-0000-0000-0000-000000000006"), "Sony",           "SONY",  "Japanese multinational conglomerate"),
        (new Guid("20000002-0000-0000-0000-000000000007"), "LG",             "LG",    "South Korean electronics manufacturer"),
        (new Guid("20000002-0000-0000-0000-000000000008"), "Huawei",         "HUAWEI","Chinese multinational technology company"),

        // Apparel & Footwear
        (new Guid("20000002-0000-0000-0000-000000000009"), "Nike",           "NIKE",  "American athletic apparel and footwear"),
        (new Guid("20000002-0000-0000-0000-000000000010"), "Adidas",         "ADIDS", "German multinational sportswear brand"),
        (new Guid("20000002-0000-0000-0000-000000000011"), "Puma",           "PUMA",  "German multinational footwear and sportswear"),
        (new Guid("20000002-0000-0000-0000-000000000012"), "Levi's",         "LEVIS", "American clothing company, famous for denim"),

        // Food & Beverage
        (new Guid("20000002-0000-0000-0000-000000000013"), "Nestlé",         "NESTLE","Swiss multinational food and beverage company"),
        (new Guid("20000002-0000-0000-0000-000000000014"), "Unilever",       "UNLVR", "Anglo-Dutch consumer goods company"),
        (new Guid("20000002-0000-0000-0000-000000000015"), "Coca-Cola",      "COKE",  "American beverage corporation"),
        (new Guid("20000002-0000-0000-0000-000000000016"), "PepsiCo",        "PEPSI", "American food, snack and beverage corporation"),

        // Home & Personal Care
        (new Guid("20000002-0000-0000-0000-000000000017"), "Procter & Gamble","PG",   "American multinational consumer goods corporation"),
        (new Guid("20000002-0000-0000-0000-000000000018"), "Reckitt",        "RCKT",  "British consumer health company"),

        // Local / Generic
        (new Guid("20000002-0000-0000-0000-000000000019"), "Local Brand",    "LOCAL", "Locally manufactured or sourced products"),
        (new Guid("20000002-0000-0000-0000-000000000020"), "Generic",        "GEN",   "No-brand / unbranded items"),
    ];

    private static async Task SeedBrandsAsync(InventoryDbContext db)
    {
        var existingIds = await db.Brands
            .IgnoreQueryFilters()
            .Select(b => b.Id)
            .ToHashSetAsync();

        foreach (var (id, name, code, description) in Brands)
        {
            if (existingIds.Contains(id)) continue;
            db.Brands.Add(CreateBrand(id, name, code, description));
        }
    }

    // ── Product Categories ─────────────────────────────────────────────────────

    private static readonly (Guid Id, string Name, string Code, string? ParentId)[] Categories =
    [
        // ── Top-level ────────────────────────────────────────────────────────
        (new Guid("30000003-0000-0000-0000-000000000001"), "Electronics",        "ELEC",   null),
        (new Guid("30000003-0000-0000-0000-000000000002"), "Food & Beverages",   "F&B",    null),
        (new Guid("30000003-0000-0000-0000-000000000003"), "Clothing & Apparel", "CLOTH",  null),
        (new Guid("30000003-0000-0000-0000-000000000004"), "Health & Beauty",    "HB",     null),
        (new Guid("30000003-0000-0000-0000-000000000005"), "Home & Living",      "HOME",   null),
        (new Guid("30000003-0000-0000-0000-000000000006"), "Stationery",         "STAT",   null),
        (new Guid("30000003-0000-0000-0000-000000000007"), "Automotive",         "AUTO",   null),
        (new Guid("30000003-0000-0000-0000-000000000008"), "Sports & Outdoors",  "SPORT",  null),
        (new Guid("30000003-0000-0000-0000-000000000009"), "Toys & Games",       "TOY",    null),
        (new Guid("30000003-0000-0000-0000-000000000010"), "Raw Materials",      "RAW",    null),
        (new Guid("30000003-0000-0000-0000-000000000011"), "Packaging",          "PKG",    null),
        (new Guid("30000003-0000-0000-0000-000000000012"), "Services",           "SVC",    null),

        // ── Electronics → subcategories ──────────────────────────────────────
        (new Guid("30000003-0000-0000-0000-000000000101"), "Mobile Phones",      "ELEC-MOB",  "30000003-0000-0000-0000-000000000001"),
        (new Guid("30000003-0000-0000-0000-000000000102"), "Laptops",            "ELEC-LAP",  "30000003-0000-0000-0000-000000000001"),
        (new Guid("30000003-0000-0000-0000-000000000103"), "Tablets",            "ELEC-TAB",  "30000003-0000-0000-0000-000000000001"),
        (new Guid("30000003-0000-0000-0000-000000000104"), "TV & Displays",      "ELEC-TV",   "30000003-0000-0000-0000-000000000001"),
        (new Guid("30000003-0000-0000-0000-000000000105"), "Audio & Headphones", "ELEC-AUD",  "30000003-0000-0000-0000-000000000001"),
        (new Guid("30000003-0000-0000-0000-000000000106"), "Cameras",            "ELEC-CAM",  "30000003-0000-0000-0000-000000000001"),
        (new Guid("30000003-0000-0000-0000-000000000107"), "Computer Parts",     "ELEC-COMP", "30000003-0000-0000-0000-000000000001"),
        (new Guid("30000003-0000-0000-0000-000000000108"), "Accessories",        "ELEC-ACC",  "30000003-0000-0000-0000-000000000001"),
        (new Guid("30000003-0000-0000-0000-000000000109"), "Printers & Scanners","ELEC-PRT",  "30000003-0000-0000-0000-000000000001"),
        (new Guid("30000003-0000-0000-0000-000000000110"), "Networking",         "ELEC-NET",  "30000003-0000-0000-0000-000000000001"),

        // ── Food & Beverages → subcategories ─────────────────────────────────
        (new Guid("30000003-0000-0000-0000-000000000201"), "Beverages",          "F&B-BEV",   "30000003-0000-0000-0000-000000000002"),
        (new Guid("30000003-0000-0000-0000-000000000202"), "Snacks & Confectionery","F&B-SNK","30000003-0000-0000-0000-000000000002"),
        (new Guid("30000003-0000-0000-0000-000000000203"), "Dairy Products",     "F&B-DAI",   "30000003-0000-0000-0000-000000000002"),
        (new Guid("30000003-0000-0000-0000-000000000204"), "Bakery & Bread",     "F&B-BAK",   "30000003-0000-0000-0000-000000000002"),
        (new Guid("30000003-0000-0000-0000-000000000205"), "Rice & Grains",      "F&B-RICE",  "30000003-0000-0000-0000-000000000002"),
        (new Guid("30000003-0000-0000-0000-000000000206"), "Cooking Essentials", "F&B-COOK",  "30000003-0000-0000-0000-000000000002"),
        (new Guid("30000003-0000-0000-0000-000000000207"), "Frozen Foods",       "F&B-FRZ",   "30000003-0000-0000-0000-000000000002"),
        (new Guid("30000003-0000-0000-0000-000000000208"), "Fruits & Vegetables","F&B-FV",    "30000003-0000-0000-0000-000000000002"),
        (new Guid("30000003-0000-0000-0000-000000000209"), "Meat & Poultry",     "F&B-MEAT",  "30000003-0000-0000-0000-000000000002"),

        // ── Clothing & Apparel → subcategories ───────────────────────────────
        (new Guid("30000003-0000-0000-0000-000000000301"), "Men's Wear",         "CLT-MEN",   "30000003-0000-0000-0000-000000000003"),
        (new Guid("30000003-0000-0000-0000-000000000302"), "Women's Wear",       "CLT-WMN",   "30000003-0000-0000-0000-000000000003"),
        (new Guid("30000003-0000-0000-0000-000000000303"), "Kids' Wear",         "CLT-KID",   "30000003-0000-0000-0000-000000000003"),
        (new Guid("30000003-0000-0000-0000-000000000304"), "Footwear",           "CLT-FTW",   "30000003-0000-0000-0000-000000000003"),
        (new Guid("30000003-0000-0000-0000-000000000305"), "Sportswear",         "CLT-SPT",   "30000003-0000-0000-0000-000000000003"),
        (new Guid("30000003-0000-0000-0000-000000000306"), "Accessories",        "CLT-ACC",   "30000003-0000-0000-0000-000000000003"),

        // ── Health & Beauty → subcategories ──────────────────────────────────
        (new Guid("30000003-0000-0000-0000-000000000401"), "Skincare",           "HB-SKIN",   "30000003-0000-0000-0000-000000000004"),
        (new Guid("30000003-0000-0000-0000-000000000402"), "Haircare",           "HB-HAIR",   "30000003-0000-0000-0000-000000000004"),
        (new Guid("30000003-0000-0000-0000-000000000403"), "Personal Care",      "HB-PC",     "30000003-0000-0000-0000-000000000004"),
        (new Guid("30000003-0000-0000-0000-000000000404"), "Healthcare & OTC",   "HB-MED",    "30000003-0000-0000-0000-000000000004"),
        (new Guid("30000003-0000-0000-0000-000000000405"), "Fragrances",         "HB-FRAG",   "30000003-0000-0000-0000-000000000004"),
        (new Guid("30000003-0000-0000-0000-000000000406"), "Makeup & Cosmetics", "HB-COS",    "30000003-0000-0000-0000-000000000004"),

        // ── Home & Living → subcategories ────────────────────────────────────
        (new Guid("30000003-0000-0000-0000-000000000501"), "Furniture",          "HOME-FURN", "30000003-0000-0000-0000-000000000005"),
        (new Guid("30000003-0000-0000-0000-000000000502"), "Kitchen & Cookware", "HOME-KIT",  "30000003-0000-0000-0000-000000000005"),
        (new Guid("30000003-0000-0000-0000-000000000503"), "Bedding & Linens",   "HOME-BED",  "30000003-0000-0000-0000-000000000005"),
        (new Guid("30000003-0000-0000-0000-000000000504"), "Decor & Lighting",   "HOME-DEC",  "30000003-0000-0000-0000-000000000005"),
        (new Guid("30000003-0000-0000-0000-000000000505"), "Cleaning Supplies",  "HOME-CLN",  "30000003-0000-0000-0000-000000000005"),
        (new Guid("30000003-0000-0000-0000-000000000506"), "Garden & Outdoor",   "HOME-GAR",  "30000003-0000-0000-0000-000000000005"),

        // ── Stationery → subcategories ────────────────────────────────────────
        (new Guid("30000003-0000-0000-0000-000000000601"), "Office Supplies",    "STAT-OFF",  "30000003-0000-0000-0000-000000000006"),
        (new Guid("30000003-0000-0000-0000-000000000602"), "Paper Products",     "STAT-PAP",  "30000003-0000-0000-0000-000000000006"),
        (new Guid("30000003-0000-0000-0000-000000000603"), "Writing Instruments","STAT-WRT",  "30000003-0000-0000-0000-000000000006"),
        (new Guid("30000003-0000-0000-0000-000000000604"), "Art & Craft",        "STAT-ART",  "30000003-0000-0000-0000-000000000006"),

        // ── Automotive → subcategories ────────────────────────────────────────
        (new Guid("30000003-0000-0000-0000-000000000701"), "Car Parts",          "AUTO-PART", "30000003-0000-0000-0000-000000000007"),
        (new Guid("30000003-0000-0000-0000-000000000702"), "Car Accessories",    "AUTO-ACC",  "30000003-0000-0000-0000-000000000007"),
        (new Guid("30000003-0000-0000-0000-000000000703"), "Lubricants & Fluids","AUTO-LUB",  "30000003-0000-0000-0000-000000000007"),
        (new Guid("30000003-0000-0000-0000-000000000704"), "Tyres & Wheels",     "AUTO-TYR",  "30000003-0000-0000-0000-000000000007"),

        // ── Sports & Outdoors → subcategories ─────────────────────────────────
        (new Guid("30000003-0000-0000-0000-000000000801"), "Fitness Equipment",  "SPT-FIT",   "30000003-0000-0000-0000-000000000008"),
        (new Guid("30000003-0000-0000-0000-000000000802"), "Cricket",            "SPT-CRK",   "30000003-0000-0000-0000-000000000008"),
        (new Guid("30000003-0000-0000-0000-000000000803"), "Football",           "SPT-FTBL",  "30000003-0000-0000-0000-000000000008"),
        (new Guid("30000003-0000-0000-0000-000000000804"), "Camping & Hiking",   "SPT-CAMP",  "30000003-0000-0000-0000-000000000008"),

        // ── Raw Materials → subcategories ─────────────────────────────────────
        (new Guid("30000003-0000-0000-0000-000000000901"), "Metals",             "RAW-MET",   "30000003-0000-0000-0000-000000000010"),
        (new Guid("30000003-0000-0000-0000-000000000902"), "Chemicals",          "RAW-CHEM",  "30000003-0000-0000-0000-000000000010"),
        (new Guid("30000003-0000-0000-0000-000000000903"), "Fabric & Textiles",  "RAW-FAB",   "30000003-0000-0000-0000-000000000010"),
        (new Guid("30000003-0000-0000-0000-000000000904"), "Plastics & Polymers","RAW-PLAS",  "30000003-0000-0000-0000-000000000010"),
        (new Guid("30000003-0000-0000-0000-000000000905"), "Wood & Timber",      "RAW-WOOD",  "30000003-0000-0000-0000-000000000010"),
    ];

    private static async Task SeedCategoriesAsync(InventoryDbContext db)
    {
        var existingIds = await db.ProductCategories
            .IgnoreQueryFilters()
            .Select(c => c.Id)
            .ToHashSetAsync();

        // Insert parents first, then children
        var parents  = Categories.Where(c => c.ParentId is null).ToArray();
        var children = Categories.Where(c => c.ParentId is not null).ToArray();

        foreach (var (id, name, code, _) in parents)
        {
            if (existingIds.Contains(id)) continue;
            db.ProductCategories.Add(CreateCategory(id, name, code, null));
        }

        // SaveChanges so parent PKs exist before FK reference
        await db.SaveChangesAsync();

        foreach (var (id, name, code, parentId) in children)
        {
            if (existingIds.Contains(id)) continue;
            db.ProductCategories.Add(CreateCategory(id, name, code, parentId));
        }
    }

    // ── Default Warehouse ──────────────────────────────────────────────────────

    private static readonly Guid DefaultWarehouseId = new("40000004-0000-0000-0000-000000000001");

    private static async Task SeedWarehousesAsync(InventoryDbContext db)
    {
        var exists = await db.Warehouses
            .IgnoreQueryFilters()
            .AnyAsync(w => w.Id == DefaultWarehouseId);

        if (exists) return;

        db.Warehouses.Add(CreateWarehouse(
            DefaultWarehouseId,
            "Main Warehouse",
            "WH-MAIN",
            "Primary storage facility",
            isDefault: true));
    }

    // ── Private factories using init-only property setting ─────────────────────

    private static UnitOfMeasure CreateUoM(Guid id, string name, string symbol, string description)
    {
        // Use public constructor then override Id via reflection
        var uom = new UnitOfMeasure(name, symbol, description);
        SetId(uom, id);
        return uom;
    }

    private static Brand CreateBrand(Guid id, string name, string code, string description)
    {
        var brand = new Brand(name, code, description, null);
        SetId(brand, id);
        return brand;
    }

    private static ProductCategory CreateCategory(Guid id, string name, string code, string? parentId)
    {
        var cat = new ProductCategory(name, code, null, parentId);
        SetId(cat, id);
        return cat;
    }

    private static Warehouse CreateWarehouse(Guid id, string name, string code, string address, bool isDefault)
    {
        var wh = new Warehouse(name, code, address, null, null);
        SetId(wh, id);
        if (isDefault) SetDefault(wh);
        return wh;
    }

    private static void SetId(object entity, Guid id)
    {
        var prop = entity.GetType().GetProperty("Id")!;
        prop.SetValue(entity, id);
    }

    private static void SetDefault(Warehouse wh) => wh.SetDefault();

    // ── Products ───────────────────────────────────────────────────────────────

    // Category IDs (from above)
    private static readonly Guid CatMobile    = new("30000003-0000-0000-0000-000000000101");
    private static readonly Guid CatLaptops   = new("30000003-0000-0000-0000-000000000102");
    private static readonly Guid CatTV        = new("30000003-0000-0000-0000-000000000104");
    private static readonly Guid CatAudio     = new("30000003-0000-0000-0000-000000000105");
    private static readonly Guid CatBeverages = new("30000003-0000-0000-0000-000000000201");
    private static readonly Guid CatSnacks    = new("30000003-0000-0000-0000-000000000202");
    private static readonly Guid CatMensWear  = new("30000003-0000-0000-0000-000000000301");
    private static readonly Guid CatFootwear  = new("30000003-0000-0000-0000-000000000304");
    private static readonly Guid CatSkincare  = new("30000003-0000-0000-0000-000000000401");
    private static readonly Guid CatPersonal  = new("30000003-0000-0000-0000-000000000403");
    private static readonly Guid CatOffice    = new("30000003-0000-0000-0000-000000000601");
    private static readonly Guid CatFitness   = new("30000003-0000-0000-0000-000000000801");

    // Brand IDs
    private static readonly Guid BrandSamsung = new("20000002-0000-0000-0000-000000000001");
    private static readonly Guid BrandApple   = new("20000002-0000-0000-0000-000000000002");
    private static readonly Guid BrandXiaomi  = new("20000002-0000-0000-0000-000000000003");
    private static readonly Guid BrandHP      = new("20000002-0000-0000-0000-000000000004");
    private static readonly Guid BrandDell    = new("20000002-0000-0000-0000-000000000005");
    private static readonly Guid BrandSony    = new("20000002-0000-0000-0000-000000000006");
    private static readonly Guid BrandNike    = new("20000002-0000-0000-0000-000000000009");
    private static readonly Guid BrandAdidas  = new("20000002-0000-0000-0000-000000000010");
    private static readonly Guid BrandNestle  = new("20000002-0000-0000-0000-000000000013");
    private static readonly Guid BrandUnilev  = new("20000002-0000-0000-0000-000000000014");
    private static readonly Guid BrandCoke    = new("20000002-0000-0000-0000-000000000015");
    private static readonly Guid BrandPG      = new("20000002-0000-0000-0000-000000000017");
    private static readonly Guid BrandGeneric = new("20000002-0000-0000-0000-000000000020");

    // UoM IDs
    private static readonly Guid UomPcs  = new("10000001-0000-0000-0000-000000000001");
    private static readonly Guid UomKg   = new("10000001-0000-0000-0000-000000000002");
    private static readonly Guid UomL    = new("10000001-0000-0000-0000-000000000004");
    private static readonly Guid UomBox  = new("10000001-0000-0000-0000-000000000008");
    private static readonly Guid UomPack = new("10000001-0000-0000-0000-000000000011");

    private static async Task SeedProductsAsync(InventoryDbContext db)
    {
        var existing = await db.Products.IgnoreQueryFilters()
            .Select(p => p.Id).ToHashSetAsync();

        // (id, name, sku, barcode, categoryId, brandId, uomId, salePrice, costPrice, taxRate, unit, stock, reorder, track)
        var products = new[]
        {
            // ── Mobile Phones ──────────────────────────────────────────────────
            (new Guid("50000005-0000-0000-0000-000000000001"), "Samsung Galaxy S24 Ultra 256GB",  "MOB-SAM-S24U",  "8806094914435", CatMobile,   BrandSamsung, UomPcs,  4899m,  3200m, 5m, "pcs",  28m,  5m, true),
            (new Guid("50000005-0000-0000-0000-000000000002"), "Apple iPhone 15 Pro 256GB",        "MOB-APL-15P",   "0194253389858", CatMobile,   BrandApple,   UomPcs,  5499m,  3800m, 5m, "pcs",  15m,  5m, true),
            (new Guid("50000005-0000-0000-0000-000000000003"), "Xiaomi 14 Pro 512GB",              "MOB-XMI-14P",   "6941812745367", CatMobile,   BrandXiaomi,  UomPcs,  2499m,  1600m, 5m, "pcs",  20m,  5m, true),
            (new Guid("50000005-0000-0000-0000-000000000004"), "Samsung Galaxy A55 128GB",         "MOB-SAM-A55",   "8806095013892", CatMobile,   BrandSamsung, UomPcs,  1299m,   820m, 5m, "pcs",  35m, 10m, true),

            // ── Laptops ────────────────────────────────────────────────────────
            (new Guid("50000005-0000-0000-0000-000000000011"), "HP EliteBook 840 G10 Core i7",     "LAP-HP-840G10", "0198122456781", CatLaptops,  BrandHP,      UomPcs,  3499m,  2400m, 5m, "pcs",  12m,  3m, true),
            (new Guid("50000005-0000-0000-0000-000000000012"), "Dell XPS 15 Core i9 32GB",         "LAP-DEL-XPS15", "0884116418963", CatLaptops,  BrandDell,    UomPcs,  4299m,  2900m, 5m, "pcs",   8m,  3m, true),
            (new Guid("50000005-0000-0000-0000-000000000013"), "Apple MacBook Pro 14 M3",           "LAP-APL-MBP14", "0194253775513", CatLaptops,  BrandApple,   UomPcs,  5999m,  4200m, 5m, "pcs",   6m,  2m, true),
            (new Guid("50000005-0000-0000-0000-000000000014"), "HP Pavilion 15 Core i5",            "LAP-HP-PAV15",  "0195161768122", CatLaptops,  BrandHP,      UomPcs,  1799m,  1200m, 5m, "pcs",  18m,  5m, true),

            // ── TV & Displays ──────────────────────────────────────────────────
            (new Guid("50000005-0000-0000-0000-000000000021"), "Samsung 65\" 4K Neo QLED",          "TV-SAM-65QLED", "8806094901092", CatTV,       BrandSamsung, UomPcs,  3299m,  2100m, 5m, "pcs",  10m,  2m, true),
            (new Guid("50000005-0000-0000-0000-000000000022"), "Sony Bravia 55\" OLED A80L",        "TV-SNY-55OLED", "4548736143494", CatTV,       BrandSony,    UomPcs,  2899m,  1900m, 5m, "pcs",   7m,  2m, true),

            // ── Audio ──────────────────────────────────────────────────────────
            (new Guid("50000005-0000-0000-0000-000000000031"), "Sony WH-1000XM5 Headphones",        "AUD-SNY-XM5",   "4548736132398", CatAudio,    BrandSony,    UomPcs,   899m,   550m, 5m, "pcs",  25m,  5m, true),
            (new Guid("50000005-0000-0000-0000-000000000032"), "Apple AirPods Pro 2nd Gen",          "AUD-APL-APP2",  "0194253549061", CatAudio,    BrandApple,   UomPcs,   749m,   480m, 5m, "pcs",  30m, 10m, true),

            // ── Beverages ──────────────────────────────────────────────────────
            (new Guid("50000005-0000-0000-0000-000000000041"), "Coca-Cola 500ml (24-Pack)",          "BEV-COKE-500",  "4902102141773", CatBeverages,BrandCoke,    UomBox,    450m,   280m, 0m, "box",  80m, 20m, true),
            (new Guid("50000005-0000-0000-0000-000000000042"), "Nestlé Pure Life Water 1.5L (12pk)","BEV-NEST-1L5",  "6281003027400", CatBeverages,BrandNestle,  UomBox,    120m,    70m, 0m, "box", 120m, 30m, true),
            (new Guid("50000005-0000-0000-0000-000000000043"), "Red Bull Energy Drink 250ml (24pk)","BEV-RBULL-250", "9002490100070", CatBeverages,BrandGeneric, UomBox,    480m,   300m, 0m, "box",  50m, 15m, true),

            // ── Snacks ─────────────────────────────────────────────────────────
            (new Guid("50000005-0000-0000-0000-000000000051"), "Nestlé KitKat 40g (48-pack)",        "SNK-KK-40G",    "7613034626219", CatSnacks,   BrandNestle,  UomBox,    480m,   280m, 0m, "box",  60m, 15m, true),
            (new Guid("50000005-0000-0000-0000-000000000052"), "Lay's Classic Chips 160g",           "SNK-LAYS-160",  "6281003060438", CatSnacks,   BrandGeneric, UomPcs,     18m,    10m, 0m, "pcs", 200m, 50m, true),

            // ── Men's Wear ─────────────────────────────────────────────────────
            (new Guid("50000005-0000-0000-0000-000000000061"), "Nike Dri-FIT T-Shirt",              "CLT-NK-DFIT",   "00885178463845",CatMensWear, BrandNike,    UomPcs,   149m,    80m, 0m, "pcs",  45m, 10m, true),
            (new Guid("50000005-0000-0000-0000-000000000062"), "Adidas Essentials Polo Shirt",       "CLT-AD-POLO",   "00888591563281",CatMensWear, BrandAdidas,  UomPcs,   129m,    70m, 0m, "pcs",  38m, 10m, true),

            // ── Footwear ───────────────────────────────────────────────────────
            (new Guid("50000005-0000-0000-0000-000000000071"), "Nike Air Max 270",                   "FTW-NK-AM270",  "00191886358382",CatFootwear, BrandNike,    UomPcs,   449m,   270m, 0m, "pcs",  22m,  5m, true),
            (new Guid("50000005-0000-0000-0000-000000000072"), "Adidas Ultraboost 23",               "FTW-AD-UB23",   "00195924202297",CatFootwear, BrandAdidas,  UomPcs,   399m,   240m, 0m, "pcs",  18m,  5m, true),

            // ── Skincare ───────────────────────────────────────────────────────
            (new Guid("50000005-0000-0000-0000-000000000081"), "Neutrogena Hydro Boost Gel 50ml",    "SK-NG-HB50",    "0086800880403", CatSkincare, BrandPG,      UomPcs,    89m,    45m, 0m, "pcs",  55m, 15m, true),
            (new Guid("50000005-0000-0000-0000-000000000082"), "Nivea Soft Moisturising Cream 200ml","SK-NIV-200",    "4005900038111", CatSkincare, BrandUnilev,  UomPcs,    35m,    18m, 0m, "pcs",  80m, 20m, true),

            // ── Personal Care ──────────────────────────────────────────────────
            (new Guid("50000005-0000-0000-0000-000000000091"), "Dove Men+Care Body Wash 400ml",      "PC-DOVE-400",   "0011111070673", CatPersonal, BrandUnilev,  UomPcs,    45m,    25m, 0m, "pcs",  70m, 20m, true),
            (new Guid("50000005-0000-0000-0000-000000000092"), "Oral-B Pro 3 Electric Toothbrush",   "PC-OB-PRO3",    "4210201302384", CatPersonal, BrandPG,      UomPcs,   199m,   110m, 5m, "pcs",  25m,  5m, true),

            // ── Office Supplies ────────────────────────────────────────────────
            (new Guid("50000005-0000-0000-0000-000000000101"), "A4 Copy Paper 80gsm (500 sheets)",   "OFF-A4-80G",    "5000006004071", CatOffice,   BrandGeneric, UomBox,    18m,     9m, 0m, "box", 150m, 30m, true),
            (new Guid("50000005-0000-0000-0000-000000000102"), "Staedtler Ballpoint Pens (Box 50)",  "OFF-STD-BP50",  "4007817017043", CatOffice,   BrandGeneric, UomBox,    35m,    18m, 0m, "box",  60m, 15m, true),

            // ── Fitness Equipment ──────────────────────────────────────────────
            (new Guid("50000005-0000-0000-0000-000000000111"), "Resistance Band Set (5 levels)",     "FIT-RB-SET5",   "0685479884511", CatFitness,  BrandGeneric, UomPcs,    85m,    40m, 5m, "set",  30m,  8m, true),
            (new Guid("50000005-0000-0000-0000-000000000112"), "Yoga Mat 6mm Anti-Slip",             "FIT-YM-6MM",    "0093842145117", CatFitness,  BrandGeneric, UomPcs,    65m,    30m, 5m, "pcs",  25m,  5m, true),
        };

        foreach (var (id, name, sku, barcode, catId, brandId, uomId, salePrice, costPrice, taxRate, unit, stock, reorder, track) in products)
        {
            if (existing.Contains(id)) continue;
            var product = new Product(name, null, sku, barcode, catId, brandId, uomId,
                salePrice, costPrice, taxRate, unit, stock, reorder, track, null);
            SetId(product, id);
            db.Products.Add(product);
        }
    }
}
