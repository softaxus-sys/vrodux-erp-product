using Microsoft.EntityFrameworkCore;
using Softaxis.RealEstate.Domain.Entities;

namespace Softaxis.RealEstate.Infrastructure.Persistence.Seed;

public static class RealEstateSeedData
{
    public static async Task SeedAsync(RealEstateDbContext db)
    {
        if (await db.Properties.IgnoreQueryFilters().AnyAsync()) return;

        var prop1Id = new Guid("e1000001-0000-0000-0000-000000000001");
        var prop2Id = new Guid("e1000001-0000-0000-0000-000000000002");
        var ten1Id  = new Guid("e2000002-0000-0000-0000-000000000001");
        var ten2Id  = new Guid("e2000002-0000-0000-0000-000000000002");
        var ten3Id  = new Guid("e2000002-0000-0000-0000-000000000003");

        // Properties
        var prop1 = new Property("Marina Heights Tower", "residential", "Marina Walk, Dubai Marina",
            "Dubai", "Dubai", 45_000m, 120, 185_000_000m, "Emaar Properties", "Luxury residential tower");
        SetId(prop1, prop1Id); prop1.UpdateOccupancy(85);

        var prop2 = new Property("Business Bay Square", "commercial", "Business Bay, Sheikh Zayed Road",
            "Dubai", "Dubai", 28_000m, 60, 220_000_000m, "DAMAC Properties", "Premium office tower");
        SetId(prop2, prop2Id); prop2.UpdateOccupancy(42);

        // Units for prop1
        var units = new[]
        {
            (new Guid("e3000003-0000-0000-0000-000000000001"), prop1Id, "101", "1br",  750m,  1, 85_000m,  1_200_000m, "vacant",  (Guid?)null, (string?)null),
            (new Guid("e3000003-0000-0000-0000-000000000002"), prop1Id, "201", "2br", 1200m,  2, 130_000m, 1_800_000m, "rented",  ten1Id,      "Ahmed Al-Rashid"),
            (new Guid("e3000003-0000-0000-0000-000000000003"), prop1Id, "301", "3br", 1800m,  3, 180_000m, 2_500_000m, "rented",  ten2Id,      "Sara Mohammed"),
            (new Guid("e3000003-0000-0000-0000-000000000004"), prop2Id, "A01", "office", 500m, 1, 95_000m,  1_400_000m, "rented",  ten3Id,      "Tech Corp FZ LLC"),
        };
        foreach (var (id, pid, num, type, area, floor, rent, sale, status, tenId, tenName) in units)
        {
            var u = new PropertyUnit(pid, num, type, area, floor, rent, sale);
            SetId(u, id);
            if (tenId.HasValue) u.Occupy(tenId.Value, tenName!);
            if (pid == prop1Id) prop1.Units.Add(u); else prop2.Units.Add(u);
        }

        db.Properties.Add(prop1); db.Properties.Add(prop2);

        // Tenants
        var tenants = new (Guid, string, string, string, string, string, string?, string?, string?, int, decimal)[]
        {
            (ten1Id,  "Ahmed Al-Rashid",  "individual", "ahmed@email.com",   "+971501234567", "UAE",     "784-1990-1234567-1", null,              null,          1, 130_000m),
            (ten2Id,  "Sara Mohammed",    "individual", "sara@email.com",    "+971502345678", "UAE",     "784-1988-2345678-2", null,              null,          1, 180_000m),
            (ten3Id,  "Tech Corp FZ LLC", "company",    "info@techcorp.ae",  "+971043456789", "UAE",     null,                 "Tech Corp FZ LLC","TL-2024-001", 1, 95_000m),
        };
        foreach (var (id, name, type, email, phone, nat, natId, co, tl, ac, paid) in tenants)
        {
            var t = new Tenant(name, type, email, phone, nat, natId, co, tl);
            SetId(t, id); t.UpdateStats(ac, paid);
            db.Tenants.Add(t);
        }

        // Lease contracts
        var con1Id = new Guid("e4000004-0000-0000-0000-000000000001");
        var con2Id = new Guid("e4000004-0000-0000-0000-000000000002");
        var con3Id = new Guid("e4000004-0000-0000-0000-000000000003");
        var c1 = new LeaseContract(prop1Id, "Marina Heights Tower",
            new Guid("e3000003-0000-0000-0000-000000000002"), "201",
            ten1Id, "Ahmed Al-Rashid", "2025-01-01", "2025-12-31", 130_000m, 4, 32_500m, "EJ-2025-001", null);
        SetId(c1, con1Id); c1.RecordPayment(65_000m);

        var c2 = new LeaseContract(prop1Id, "Marina Heights Tower",
            new Guid("e3000003-0000-0000-0000-000000000003"), "301",
            ten2Id, "Sara Mohammed", "2025-03-01", "2026-02-28", 180_000m, 2, 45_000m, "EJ-2025-002", null);
        SetId(c2, con2Id); c2.RecordPayment(90_000m);

        var c3 = new LeaseContract(prop2Id, "Business Bay Square",
            new Guid("e3000003-0000-0000-0000-000000000004"), "A01",
            ten3Id, "Tech Corp FZ LLC", "2025-06-01", "2026-05-31", 95_000m, 1, 23_750m, "EJ-2025-003", null);
        SetId(c3, con3Id); c3.RecordPayment(47_500m);

        db.LeaseContracts.AddRange(c1, c2, c3);

        // Brokers
        var brokers = new[]
        {
            (new Guid("e5000005-0000-0000-0000-000000000001"), "Khalid Al-Mansouri", "Betterhomes",       "khalid@betterhomes.ae", "+971501111111", "BRN-2023-001", "2027-12-31", "residential", 45, 2_250_000m, 2.5m, 4.8m),
            (new Guid("e5000005-0000-0000-0000-000000000002"), "Fatima Hassan",      "Allsopp & Allsopp", "fatima@allsopp.ae",     "+971502222222", "BRN-2023-002", "2026-09-30", "commercial",  28, 3_100_000m, 2.0m, 4.6m),
        };
        foreach (var (id, name, agency, email, phone, lic, licExp, spec, deals, comm, rate, rating) in brokers)
        {
            var br = new Broker(name, agency, email, phone, lic, licExp, spec, rate);
            SetId(br, id);
            SetProp(br, "DealsCompleted", deals);
            SetProp(br, "TotalCommission", comm);
            SetProp(br, "Rating", rating);
            db.Brokers.Add(br);
        }

        await db.SaveChangesAsync();
    }

    private static void SetId(object e, Guid id) => e.GetType().GetProperty("Id")!.SetValue(e, id);
    private static void SetProp(object e, string p, object v) => e.GetType().GetProperty(p)!.SetValue(e, v);
}
