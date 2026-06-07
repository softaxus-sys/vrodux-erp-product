using Microsoft.EntityFrameworkCore;
using Softaxis.Recipe.Domain.Entities;

namespace Softaxis.Recipe.Infrastructure.Persistence.Seed;

public static class RecipeSeedData
{
    // Restaurant MenuItem IDs seeded in RestaurantSeedData
    private static readonly Guid MiLambMachboos  = new("c3000003-0000-0000-0000-000000000003");
    private static readonly Guid MiHummus        = new("c3000003-0000-0000-0000-000000000001");
    private static readonly Guid MiMixedGrill    = new("c3000003-0000-0000-0000-000000000005");
    private static readonly Guid MiUmmAli        = new("c3000003-0000-0000-0000-000000000007");

    public static async Task SeedAsync(RecipeDbContext db)
    {
        if (await db.Recipes.IgnoreQueryFilters().AnyAsync()) return;

        // ── Recipe 1: Lamb Machboos ───────────────────────────────────────────
        var r1Id = new Guid("b1000001-0000-0000-0000-000000000001");
        var r1 = new Recipe.Domain.Entities.Recipe(
            MiLambMachboos, "Lamb Machboos",
            "Traditional slow-cooked spiced lamb with basmati rice",
            servings: 1, prepTimeMinutes: 30, cookTimeMinutes: 90,
            instructions: "1. Marinate lamb with spices 2 hours.\n2. Sear lamb until golden.\n3. Cook onions until caramelised.\n4. Add rice and stock, simmer 45 min.",
            notes: "Serve with side salad and lemon");
        SetId(r1, r1Id); r1.Activate();

        var r1Ingredients = new[]
        {
            (new Guid("b2000002-0000-0000-0000-000000000001"), (Guid?)null, "Lamb Shoulder",  0.35m, "kg",  38m),
            (new Guid("b2000002-0000-0000-0000-000000000002"), (Guid?)null, "Basmati Rice",   0.15m, "kg",  8m),
            (new Guid("b2000002-0000-0000-0000-000000000003"), (Guid?)null, "Onion",          0.10m, "kg",  3m),
            (new Guid("b2000002-0000-0000-0000-000000000004"), (Guid?)null, "Machboos Spice", 0.02m, "kg",  45m),
            (new Guid("b2000002-0000-0000-0000-000000000005"), (Guid?)null, "Tomato",         0.08m, "kg",  4m),
            (new Guid("b2000002-0000-0000-0000-000000000006"), (Guid?)null, "Vegetable Stock",0.30m, "L",   5m),
            (new Guid("b2000002-0000-0000-0000-000000000007"), (Guid?)null, "Cooking Oil",    0.02m, "L",   12m),
        };
        foreach (var (id, invId, name, qty, unit, cost) in r1Ingredients)
        {
            var ing = new RecipeIngredient(r1Id, invId, name, qty, unit, cost);
            SetId(ing, id); r1.Ingredients.Add(ing);
        }

        // ── Recipe 2: Hummus Platter ──────────────────────────────────────────
        var r2Id = new Guid("b1000001-0000-0000-0000-000000000002");
        var r2 = new Recipe.Domain.Entities.Recipe(
            MiHummus, "Hummus Platter",
            "Classic chickpea hummus with olive oil drizzle and pita bread",
            servings: 1, prepTimeMinutes: 15, cookTimeMinutes: 0,
            instructions: "1. Blend chickpeas with tahini, lemon, garlic.\n2. Season with salt.\n3. Plate with olive oil and paprika.\n4. Serve with warm pita.",
            notes: "Can be prepared in bulk and refrigerated up to 3 days");
        SetId(r2, r2Id); r2.Activate();

        var r2Ingredients = new[]
        {
            (new Guid("b2000002-0000-0000-0000-000000000011"), (Guid?)null, "Chickpeas (cooked)", 0.12m, "kg",  6m),
            (new Guid("b2000002-0000-0000-0000-000000000012"), (Guid?)null, "Tahini",              0.03m, "kg",  22m),
            (new Guid("b2000002-0000-0000-0000-000000000013"), (Guid?)null, "Lemon Juice",         0.02m, "L",   8m),
            (new Guid("b2000002-0000-0000-0000-000000000014"), (Guid?)null, "Garlic",              0.01m, "kg",  15m),
            (new Guid("b2000002-0000-0000-0000-000000000015"), (Guid?)null, "Olive Oil",           0.02m, "L",   35m),
            (new Guid("b2000002-0000-0000-0000-000000000016"), (Guid?)null, "Pita Bread",          2m,    "pcs", 1.5m),
        };
        foreach (var (id, invId, name, qty, unit, cost) in r2Ingredients)
        {
            var ing = new RecipeIngredient(r2Id, invId, name, qty, unit, cost);
            SetId(ing, id); r2.Ingredients.Add(ing);
        }

        // ── Recipe 3: Mixed Grill Platter ─────────────────────────────────────
        var r3Id = new Guid("b1000001-0000-0000-0000-000000000003");
        var r3 = new Recipe.Domain.Entities.Recipe(
            MiMixedGrill, "Mixed Grill Platter",
            "Assortment of marinated grilled meats with sides",
            servings: 2, prepTimeMinutes: 20, cookTimeMinutes: 25,
            instructions: "1. Marinate meats overnight.\n2. Grill lamb chops 6 min each side.\n3. Grill chicken 8 min each side.\n4. Grill kofta 10 min.",
            notes: "Serves 2. Double quantities for larger portions");
        SetId(r3, r3Id); r3.Activate();

        var r3Ingredients = new[]
        {
            (new Guid("b2000002-0000-0000-0000-000000000021"), (Guid?)null, "Lamb Chops",     0.20m, "kg",  55m),
            (new Guid("b2000002-0000-0000-0000-000000000022"), (Guid?)null, "Chicken Thigh",  0.20m, "kg",  22m),
            (new Guid("b2000002-0000-0000-0000-000000000023"), (Guid?)null, "Minced Lamb",    0.15m, "kg",  40m),
            (new Guid("b2000002-0000-0000-0000-000000000024"), (Guid?)null, "Grill Marinade", 0.05m, "L",   18m),
            (new Guid("b2000002-0000-0000-0000-000000000025"), (Guid?)null, "Pita Bread",     4m,    "pcs", 1.5m),
        };
        foreach (var (id, invId, name, qty, unit, cost) in r3Ingredients)
        {
            var ing = new RecipeIngredient(r3Id, invId, name, qty, unit, cost);
            SetId(ing, id); r3.Ingredients.Add(ing);
        }

        // ── Recipe 4: Umm Ali ─────────────────────────────────────────────────
        var r4Id = new Guid("b1000001-0000-0000-0000-000000000004");
        var r4 = new Recipe.Domain.Entities.Recipe(
            MiUmmAli, "Umm Ali",
            "Traditional Egyptian bread pudding with nuts and cream",
            servings: 1, prepTimeMinutes: 10, cookTimeMinutes: 20,
            instructions: "1. Tear puff pastry into dish.\n2. Pour hot milk and cream mix.\n3. Top with nuts and coconut.\n4. Bake 200°C for 20 min until golden.",
            notes: "Best served immediately from oven");
        SetId(r4, r4Id); r4.Activate();

        var r4Ingredients = new[]
        {
            (new Guid("b2000002-0000-0000-0000-000000000031"), (Guid?)null, "Puff Pastry",    0.08m, "kg",  18m),
            (new Guid("b2000002-0000-0000-0000-000000000032"), (Guid?)null, "Full Cream Milk",0.15m, "L",   4m),
            (new Guid("b2000002-0000-0000-0000-000000000033"), (Guid?)null, "Heavy Cream",    0.05m, "L",   16m),
            (new Guid("b2000002-0000-0000-0000-000000000034"), (Guid?)null, "Mixed Nuts",     0.03m, "kg",  55m),
            (new Guid("b2000002-0000-0000-0000-000000000035"), (Guid?)null, "Sugar",          0.02m, "kg",  3m),
            (new Guid("b2000002-0000-0000-0000-000000000036"), (Guid?)null, "Desiccated Coconut", 0.01m, "kg", 12m),
        };
        foreach (var (id, invId, name, qty, unit, cost) in r4Ingredients)
        {
            var ing = new RecipeIngredient(r4Id, invId, name, qty, unit, cost);
            SetId(ing, id); r4.Ingredients.Add(ing);
        }

        db.Recipes.AddRange(r1, r2, r3, r4);
        await db.SaveChangesAsync();
    }

    private static void SetId(object e, Guid id) => e.GetType().GetProperty("Id")!.SetValue(e, id);
}
