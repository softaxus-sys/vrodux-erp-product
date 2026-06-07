using Microsoft.EntityFrameworkCore;
using Softaxis.Hospitality.Domain.Entities;

namespace Softaxis.Hospitality.Infrastructure.Persistence.Seed;

public static class HospitalitySeedData
{
    public static async Task SeedAsync(HospitalityDbContext db)
    {
        if (await db.Rooms.IgnoreQueryFilters().AnyAsync()) return;

        var r1Id = new Guid("d1000001-0000-0000-0000-000000000001");
        var r2Id = new Guid("d1000001-0000-0000-0000-000000000002");
        var r3Id = new Guid("d1000001-0000-0000-0000-000000000003");
        var r4Id = new Guid("d1000001-0000-0000-0000-000000000004");
        var r5Id = new Guid("d1000001-0000-0000-0000-000000000005");

        var rooms = new[]
        {
            (r1Id, "101", "standard", 1, 2, 350m,  "city",   false, "available", "clean"),
            (r2Id, "201", "deluxe",   2, 2, 550m,  "sea",    true,  "occupied",  "dirty"),
            (r3Id, "301", "suite",    3, 4, 950m,  "sea",    true,  "available", "clean"),
            (r4Id, "401", "presidential", 4, 6, 2500m, "sea", true, "available", "inspected"),
            (r5Id, "102", "standard", 1, 2, 350m,  "garden", false, "maintenance","dirty"),
        };
        foreach (var (id, num, type, floor, cap, rate, view, balcony, status, hkStatus) in rooms)
        {
            var r = new Room(num, type, floor, cap, rate, view, balcony);
            SetId(r, id);
            SetProp(r, "Status", status);
            SetProp(r, "HousekeepingStatus", hkStatus);
            if (status == "occupied")
            {
                SetProp(r, "CurrentGuestName", "Ahmed Al-Rashid");
                SetProp(r, "CurrentBookingId", "BK-20260501-A1B2");
            }
            db.Rooms.Add(r);
        }

        // Bookings
        var b1Id = new Guid("d2000002-0000-0000-0000-000000000001");
        var b2Id = new Guid("d2000002-0000-0000-0000-000000000002");
        var b3Id = new Guid("d2000002-0000-0000-0000-000000000003");

        var bkgs = new[]
        {
            (b1Id, r2Id, "201", "deluxe",   "Ahmed Al-Rashid",  "ahmed@email.com",  "+971501234567", "UAE",     "2026-05-20", "2026-05-27", 7,  2, 0, 550m,  "checked_in",  "direct",    null),
            (b2Id, r3Id, "301", "suite",     "Sara Mohammed",    "sara@email.com",   "+971502345678", "UAE",     "2026-05-28", "2026-05-31", 3,  2, 1, 950m,  "confirmed",   "online",    "Late check-in"),
            (b3Id, r1Id, "101", "standard",  "John Smith",       "john@email.com",   "+447700900123", "UK",      "2026-06-01", "2026-06-05", 4,  1, 0, 350m,  "confirmed",   "agent",     null),
        };
        foreach (var (id, roomId, roomNum, roomType, guest, email, phone, nat, ci, co, nights, adults, children, rate, status, source, req) in bkgs)
        {
            var b = new Booking(roomId, roomNum, roomType, guest, email, phone, nat, ci, co, nights, adults, children, rate, source, req);
            SetId(b, id);
            SetProp(b, "Status", status);
            SetProp(b, "TotalAmount", nights * rate);
            SetProp(b, "PaidAmount", status == "checked_in" ? nights * rate : 0m);
            db.Bookings.Add(b);
        }

        // Housekeeping tasks
        var hk1 = new HousekeepingTask(r2Id, "201", "stay_clean", "normal", null);
        SetId(hk1, new Guid("d3000003-0000-0000-0000-000000000001"));
        hk1.Assign("Maria Santos"); hk1.Start();

        var hk2 = new HousekeepingTask(r5Id, "102", "deep_clean", "high", "Guest reported AC issue");
        SetId(hk2, new Guid("d3000003-0000-0000-0000-000000000002"));
        hk2.Assign("Juan dela Cruz");

        var hk3 = new HousekeepingTask(r1Id, "101", "inspection", "normal", null);
        SetId(hk3, new Guid("d3000003-0000-0000-0000-000000000003"));
        hk3.Assign("Supervisor Kim"); hk3.Start(); hk3.Complete(); hk3.Verify();

        db.HousekeepingTasks.AddRange(hk1, hk2, hk3);
        await db.SaveChangesAsync();
    }

    private static void SetId(object e, Guid id) => e.GetType().GetProperty("Id")!.SetValue(e, id);
    private static void SetProp(object e, string p, object v) => e.GetType().GetProperty(p)!.SetValue(e, v);
}
