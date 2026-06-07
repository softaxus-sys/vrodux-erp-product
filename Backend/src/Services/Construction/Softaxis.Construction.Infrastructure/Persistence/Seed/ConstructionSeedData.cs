using Microsoft.EntityFrameworkCore;
using Softaxis.Construction.Domain.Entities;

namespace Softaxis.Construction.Infrastructure.Persistence.Seed;

public static class ConstructionSeedData
{
    public static async Task SeedAsync(ConstructionDbContext db)
    {
        if (await db.Projects.IgnoreQueryFilters().AnyAsync()) return;

        var p1Id = new Guid("f1000001-0000-0000-0000-000000000001");
        var p2Id = new Guid("f1000001-0000-0000-0000-000000000002");
        var p3Id = new Guid("f1000001-0000-0000-0000-000000000003");

        var projects = new[]
        {
            (p1Id, "Dubai Marina Tower",    "Al Futtaim",    "Dubai Marina",   "residential",    "2025-01-01","2026-12-31", 45_000_000m, 28_000_000m, 62, "Ahmed Al-Rashid", "Omar Hassan",  "in_progress"),
            (p2Id, "Abu Dhabi Office Park",  "ADNOC",         "Al Reem Island", "commercial",     "2025-06-01","2027-03-31", 78_000_000m, 12_000_000m, 15, "Khalid Mansouri", "Sara Ali",     "planning"),
            (p3Id, "Sharjah Highway Bridge", "RTA",           "Sharjah-Dubai",  "infrastructure", "2024-09-01","2026-06-30", 32_000_000m, 29_000_000m, 92, "Fatima Hassan",   "Ali Mohammed", "in_progress"),
        };
        foreach (var (id, name, client, loc, type, start, end, contract, spent, pct, pm, se, status) in projects)
        {
            var p = new Project(name, client, loc, type, start, end, contract, pm, se, null);
            SetId(p, id); p.UpdateProgress(pct, spent, 150, status);
            var phase1 = new ProjectPhase(id, "Foundation", start, "2025-06-30"); SetId(phase1, Guid.NewGuid()); phase1.Update("completed", 100);
            var phase2 = new ProjectPhase(id, "Structural", "2025-07-01", "2026-03-31"); SetId(phase2, Guid.NewGuid()); phase2.Update("in_progress", 65);
            p.Phases.Add(phase1); p.Phases.Add(phase2);
            db.Projects.Add(p);
        }

        // Seed contractors
        var contractors = new[]
        {
            (new Guid("f2000002-0000-0000-0000-000000000001"), "Al Naboodah Construction", "Al Naboodah", "civil",     "Mohammed Al-Naboodah", "info@naboodah.ae", "+971-4-2345678", "Dubai",     "LC-2024-001", "2027-12-31", 3, 12, 85_000_000m, 4.7m),
            (new Guid("f2000002-0000-0000-0000-000000000002"), "Arabtec Holding",           "Arabtec",     "structural","Ahmed Hassan",         "info@arabtec.ae", "+971-2-3456789", "Abu Dhabi", "LC-2024-002", "2026-09-30", 2,  8, 120_000_000m, 4.5m),
            (new Guid("f2000002-0000-0000-0000-000000000003"), "Drake & Scull International","DSI",         "mep",       "Sarah Mitchell",       "info@drakescull.ae","+971-4-5678901","Dubai",    "LC-2023-003", "2026-06-30", 1,  5,  42_000_000m, 4.2m),
        };
        foreach (var (id, co, trade, tr, cp, email, phone, city, lic, licExp, active, completed, tcv, rating) in contractors)
        {
            var c = new Contractor(co, trade, cp, email, phone, city, lic, licExp);
            SetId(c, id);
            SetProp(c, "Trade", tr); SetProp(c, "Rating", rating);
            SetProp(c, "ActiveProjects", active); SetProp(c, "CompletedProjects", completed);
            SetProp(c, "TotalContractValue", tcv);
            db.Contractors.Add(c);
        }

        // Seed BOQ for project 1
        var boqId = new Guid("f3000003-0000-0000-0000-000000000001");
        var boq = new BillOfQuantity(p1Id.ToString(), "Dubai Marina Tower");
        SetId(boq, boqId); boq.Approve("Ahmed Al-Rashid");
        var items = new[]
        {
            ("B001","Excavation & earthworks","m³",   5_000m,  180m),
            ("B002","Concrete (foundations)",  "m³",   2_800m,  850m),
            ("B003","Structural steel",        "ton",    420m,3_200m),
            ("B004","Formwork",                "m²",  18_000m,   45m),
            ("B005","Rebar reinforcement",     "ton",    680m,2_100m),
        };
        int ic = 1;
        foreach (var (code, desc, unit, qty, rate) in items)
        {
            var item = new BoqItem(boqId, code, desc, unit, qty, rate);
            SetId(item, new Guid($"f4{ic++:000000}-0000-0000-0000-000000000001"));
            item.UpdateProgress(qty * 0.65m);
            boq.Items.Add(item);
        }
        db.BOQs.Add(boq);

        // Seed sites
        var siteId = new Guid("f5000005-0000-0000-0000-000000000001");
        var site = new Site("Marina Tower Site", p1Id.ToString(), "Dubai Marina Tower",
            "Plot 12, Dubai Marina", "Dubai", "Dubai", "Yusuf Al-Hamad", "Nasser Al-Balushi",
            "DM-PERMIT-2025-001", "2026-12-31", 500);
        SetId(site, siteId);
        SetProp(site, "CurrentWorkers", 320); SetProp(site, "SafetyScore", 94);
        SetProp(site, "Area", 8500m);
        db.Sites.Add(site);

        await db.SaveChangesAsync();
    }

    private static void SetId(object e, Guid id) => e.GetType().GetProperty("Id")!.SetValue(e, id);
    private static void SetProp(object e, string p, object v) => e.GetType().GetProperty(p)!.SetValue(e, v);
}
