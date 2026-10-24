using Microsoft.EntityFrameworkCore;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Common;

/// <summary>
/// Human-readable order numbers that cannot clash between branches: <c>HB2-20261024-0042</c> - the
/// branch's own code, the date, and a counter held for that branch and day.
///
/// <para>
/// Needed once a branch can run on its own server. The old <c>ORD-yyyyMMdd-XXXX</c> (four random hex
/// digits) is not unique and says nothing about where a bill came from, so two branches would print
/// indistinguishable numbers and a receipt could not be traced to its branch server.
/// </para>
///
/// <para>
/// The counter is a row per (branch, day) incremented atomically in SQL, so two tills in one branch
/// never draw the same number. Orders with no branch keep the old format, so a single-location
/// workspace sees nothing change.
/// </para>
///
/// <para>
/// Cutover note: a branch moved from Cloud to Local mode mid-day would restart its counter on the new
/// server and could repeat a number issued earlier that day. Switch after the day's shifts are closed
/// (docs/branch-server-design.md §9).
/// </para>
/// </summary>
internal static class OrderNumbering
{
    public static async Task AssignAsync(RestaurantDbContext db, CancellationToken ct)
    {
        var fresh = db.ChangeTracker.Entries<Order>()
            .Where(e => e.State == EntityState.Added && e.Entity.BranchId is not null && !e.Entity.HasBranchNumber)
            .Select(e => e.Entity)
            .ToList();
        if (fresh.Count == 0) return;

        var codes = new Dictionary<Guid, string>();
        foreach (var order in fresh)
        {
            var branchId = order.BranchId!.Value;
            if (!codes.TryGetValue(branchId, out var code))
                codes[branchId] = code = await CodeOfAsync(db, branchId, ct);

            // UTC date: every server draws from the same clock, so the prefix and the counter agree
            // on which day a number belongs to. It is a label, not the business date.
            var day = DateTime.UtcNow.Date;
            var next = await NextAsync(db, branchId, day, ct);
            order.SetBranchNumber($"{code}-{day:yyyyMMdd}-{next:D4}");
        }
    }

    /// <summary>The branch's short code, or the first 4 characters of its id when it has none.</summary>
    private static async Task<string> CodeOfAsync(RestaurantDbContext db, Guid branchId, CancellationToken ct)
    {
        try
        {
            var found = await db.Database
                .SqlQuery<string?>($"SELECT [Code] AS [Value] FROM [identity].[branches] WHERE [Id] = {branchId}")
                .ToListAsync(ct);
            var code = found.FirstOrDefault()?.Trim();
            if (!string.IsNullOrEmpty(code))
                return new string(code.Where(char.IsLetterOrDigit).Take(8).ToArray()).ToUpperInvariant();
        }
        catch
        {
            // The branch table is not reachable or not yet synced; the id still gives a stable, unique prefix.
        }
        return branchId.ToString("N")[..4].ToUpperInvariant();
    }

    private static async Task<int> NextAsync(RestaurantDbContext db, Guid branchId, DateTime day, CancellationToken ct)
    {
        // MERGE with HOLDLOCK: the insert-or-increment is one atomic statement, so concurrent tills in the
        // same branch serialise on the row instead of both reading the same "last" value.
        var rows = await db.Database.SqlQuery<int>($"""
            MERGE [restaurant].[OrderCounters] WITH (HOLDLOCK) AS t
            USING (SELECT {branchId} AS BranchId, {day} AS BusinessDate) AS s
               ON t.BranchId = s.BranchId AND t.BusinessDate = s.BusinessDate
            WHEN MATCHED THEN UPDATE SET LastNumber = t.LastNumber + 1
            WHEN NOT MATCHED THEN INSERT (BranchId, BusinessDate, LastNumber) VALUES (s.BranchId, s.BusinessDate, 1)
            OUTPUT inserted.LastNumber AS [Value];
            """).ToListAsync(ct);
        return rows.Single();
    }
}
