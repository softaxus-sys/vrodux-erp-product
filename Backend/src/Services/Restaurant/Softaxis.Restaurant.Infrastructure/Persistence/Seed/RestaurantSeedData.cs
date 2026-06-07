using Microsoft.EntityFrameworkCore;
using Softaxis.Restaurant.Domain.Entities;

namespace Softaxis.Restaurant.Infrastructure.Persistence.Seed;

public static class RestaurantSeedData
{
    public static async Task SeedAsync(RestaurantDbContext db)
    {
        if (await db.Tables.IgnoreQueryFilters().AnyAsync()) return;

        // Tables
        var t1Id = new Guid("c1000001-0000-0000-0000-000000000001");
        var t2Id = new Guid("c1000001-0000-0000-0000-000000000002");
        var t3Id = new Guid("c1000001-0000-0000-0000-000000000003");
        var t4Id = new Guid("c1000001-0000-0000-0000-000000000004");
        var t5Id = new Guid("c1000001-0000-0000-0000-000000000005");
        var t6Id = new Guid("c1000001-0000-0000-0000-000000000006");

        var tables = new[]
        {
            (t1Id, "T01", "indoor",  2, "available"),
            (t2Id, "T02", "indoor",  4, "occupied"),
            (t3Id, "T03", "indoor",  4, "available"),
            (t4Id, "T04", "outdoor", 6, "reserved"),
            (t5Id, "T05", "vip",     8, "available"),
            (t6Id, "T06", "bar",     2, "occupied"),
        };
        foreach (var (id, num, section, cap, status) in tables)
        {
            var t = new Table(num, section, cap);
            SetId(t, id); SetProp(t, "Status", status);
            db.Tables.Add(t);
        }

        // Menu categories
        var cat1Id = new Guid("c2000002-0000-0000-0000-000000000001");
        var cat2Id = new Guid("c2000002-0000-0000-0000-000000000002");
        var cat3Id = new Guid("c2000002-0000-0000-0000-000000000003");
        var cat4Id = new Guid("c2000002-0000-0000-0000-000000000004");
        var cat5Id = new Guid("c2000002-0000-0000-0000-000000000005");

        var cats = new[]
        {
            (cat1Id, "Starters",  "Appetizers and soups",        1),
            (cat2Id, "Mains",     "Main course dishes",          2),
            (cat3Id, "Grills",    "Grilled meats and seafood",   3),
            (cat4Id, "Desserts",  "Sweet treats and pastries",   4),
            (cat5Id, "Beverages", "Hot and cold drinks",         5),
        };
        foreach (var (id, name, desc, order) in cats)
        {
            var c = new MenuCategory(name, desc, order);
            SetId(c, id); db.MenuCategories.Add(c);
        }

        // Menu items
        var items = new[]
        {
            (new Guid("c3000003-0000-0000-0000-000000000001"), cat1Id, "Hummus Platter",        "Classic hummus with pita bread",            35m,  10, "sesame"),
            (new Guid("c3000003-0000-0000-0000-000000000002"), cat1Id, "Fattoush Salad",        "Fresh vegetable salad with sumac dressing", 28m,   8, null),
            (new Guid("c3000003-0000-0000-0000-000000000003"), cat2Id, "Lamb Machboos",         "Slow-cooked spiced lamb with rice",         85m,  25, "dairy"),
            (new Guid("c3000003-0000-0000-0000-000000000004"), cat2Id, "Grilled Hammour",       "Local fish with saffron rice",              95m,  20, "fish"),
            (new Guid("c3000003-0000-0000-0000-000000000005"), cat3Id, "Mixed Grill Platter",   "Assorted grilled meats",                   145m,  30, null),
            (new Guid("c3000003-0000-0000-0000-000000000006"), cat3Id, "Shish Tawook",          "Marinated chicken skewers",                 65m,  20, null),
            (new Guid("c3000003-0000-0000-0000-000000000007"), cat4Id, "Umm Ali",               "Traditional bread pudding",                 32m,  15, "dairy,nuts"),
            (new Guid("c3000003-0000-0000-0000-000000000008"), cat4Id, "Baklava",               "Honey and nut pastry",                      25m,   5, "nuts,gluten"),
            (new Guid("c3000003-0000-0000-0000-000000000009"), cat5Id, "Fresh Mint Lemonade",   "Freshly squeezed with mint",                22m,   5, null),
            (new Guid("c3000003-0000-0000-0000-000000000010"), cat5Id, "Arabic Coffee",         "Traditional cardamom coffee",               15m,   5, null),
        };
        foreach (var (id, catId, name, desc, price, prep, allergens) in items)
        {
            var i = new MenuItem(catId, name, desc, price, prep, allergens);
            SetId(i, id); db.MenuItems.Add(i);
        }

        // Active order on T02
        var ord1Id = new Guid("c4000004-0000-0000-0000-000000000001");
        var ord1 = new Order(t2Id, "T02", "Mohammed", 3, "dine_in", null);
        SetId(ord1, ord1Id); SetProp(ord1, "Status", "sent");

        var oi1 = new OrderItem(ord1Id, new Guid("c3000003-0000-0000-0000-000000000001"), "Hummus Platter",   1, 35m,  null);
        var oi2 = new OrderItem(ord1Id, new Guid("c3000003-0000-0000-0000-000000000003"), "Lamb Machboos",    2, 85m,  "extra spicy");
        var oi3 = new OrderItem(ord1Id, new Guid("c3000003-0000-0000-0000-000000000009"), "Fresh Mint Lemonade", 3, 22m, null);
        SetId(oi1, new Guid("c5000005-0000-0000-0000-000000000001"));
        SetId(oi2, new Guid("c5000005-0000-0000-0000-000000000002"));
        SetId(oi3, new Guid("c5000005-0000-0000-0000-000000000003"));
        ord1.Items.Add(oi1); ord1.Items.Add(oi2); ord1.Items.Add(oi3);
        ord1.Recalculate();
        db.Orders.Add(ord1);

        // Active order on T06 (bar)
        var ord2Id = new Guid("c4000004-0000-0000-0000-000000000002");
        var ord2 = new Order(t6Id, "T06", "Sara", 1, "dine_in", null);
        SetId(ord2, ord2Id); SetProp(ord2, "Status", "open");

        var oi4 = new OrderItem(ord2Id, new Guid("c3000003-0000-0000-0000-000000000010"), "Arabic Coffee", 2, 15m, null);
        SetId(oi4, new Guid("c5000005-0000-0000-0000-000000000004"));
        ord2.Items.Add(oi4); ord2.Recalculate();
        db.Orders.Add(ord2);

        // Reservations
        var res1 = new Reservation("Ahmed Al-Rashid", "+971501234567", "ahmed@email.com", 4,
            "2026-05-27", "19:00", "Window table preferred");
        SetId(res1, new Guid("c6000006-0000-0000-0000-000000000001"));
        res1.AssignTable(t4Id, "T04");

        var res2 = new Reservation("Corporate Group", "+971043456789", "events@corp.ae", 8,
            "2026-05-28", "20:00", "Birthday celebration, need cake");
        SetId(res2, new Guid("c6000006-0000-0000-0000-000000000002"));
        res2.AssignTable(t5Id, "T05");

        db.Reservations.AddRange(res1, res2);
        await db.SaveChangesAsync();
    }

    private static void SetId(object e, Guid id) => e.GetType().GetProperty("Id")!.SetValue(e, id);
    private static void SetProp(object e, string p, object v) => e.GetType().GetProperty(p)!.SetValue(e, v);
}
