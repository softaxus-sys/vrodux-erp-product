using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Common;

/// <summary>
/// Reads and updates the POS service's shift/cash-drawer session (`pos.pos_sessions`) from within
/// Restaurant — same physical database, different schema, no project reference between the two
/// services (mirrors POS's own `CrossSchemaProductService` pattern for reaching into Inventory's
/// schema). Keeps restaurant sales reconciling in the same Z-report/cash-drawer total as retail POS
/// sales, without duplicating the session/shift domain model into a second service.
/// </summary>
internal static class PosSessionLedger
{
    // Raw-SQL projection row — matches SessionStatus.Open = 1 in Softaxis.POS.Domain.Enums.
    private sealed class SessionRow
    {
        public Guid Id { get; set; }
        public Guid CashierId { get; set; }
        public int Status { get; set; }
    }

    private const int OpenStatus = 1;

    /// <summary>Confirms a POS session exists, belongs to this tenant, and is currently open.
    /// Returns the session's cashier id on success.</summary>
    public static async Task<Result<Guid>> ValidateOpenSessionAsync(
        RestaurantDbContext db, Guid sessionId, CancellationToken ct)
    {
        // Raw SQL bypasses EF's global tenant filter — replicate it explicitly (same pattern as
        // POS's CrossSchemaProductService).
        int bypass = TenantAmbient.BypassFilter ? 1 : 0;
        Guid tenant = TenantAmbient.TenantId ?? Guid.Empty;

        var row = await db.Database
            .SqlQuery<SessionRow>($"""
                SELECT TOP 1 Id, CashierId, Status
                FROM [pos].[pos_sessions]
                WHERE Id = {sessionId} AND ({bypass} = 1 OR TenantId = {tenant})
                """)
            .FirstOrDefaultAsync(ct);

        if (row is null)
            return Result.Failure<Guid>(Error.Custom("PosSession.NotFound", "The selected POS session was not found."));
        if (row.Status != OpenStatus)
            return Result.Failure<Guid>(Error.Custom("PosSession.Conflict", "The selected POS session is not open."));

        return Result.Success(row.CashierId);
    }

    /// <summary>Returns "open"/"closed" for the given session, or null if it doesn't exist for this
    /// tenant — used by the Z/X report, which is read-only and shouldn't hard-fail just because a
    /// stale/foreign session id was passed in (the order-derived totals are still meaningful).</summary>
    public static async Task<string?> GetStatusLabelAsync(RestaurantDbContext db, Guid sessionId, CancellationToken ct)
    {
        int bypass = TenantAmbient.BypassFilter ? 1 : 0;
        Guid tenant = TenantAmbient.TenantId ?? Guid.Empty;

        var row = await db.Database
            .SqlQuery<SessionRow>($"""
                SELECT TOP 1 Id, CashierId, Status
                FROM [pos].[pos_sessions]
                WHERE Id = {sessionId} AND ({bypass} = 1 OR TenantId = {tenant})
                """)
            .FirstOrDefaultAsync(ct);

        return row is null ? null : row.Status == OpenStatus ? "open" : "closed";
    }

    /// <summary>
    /// Mirrors <c>POSSession.RecordTransaction(amount, isRefund: false)</c> — bumps the shift's
    /// running totals (transaction count, gross sales, expected cash) so a restaurant sale shows up
    /// in the same end-of-shift Z-report as a retail POS sale.
    /// </summary>
    public static Task RecordSaleAsync(RestaurantDbContext db, Guid sessionId, decimal amount, CancellationToken ct) =>
        RecordTransactionAsync(db, sessionId, amount, isRefund: false, ct);

    /// <summary>
    /// Mirrors <c>POSSession.RecordTransaction(amount, isRefund: true)</c> exactly — bumps
    /// TotalRefunds only. Note this does NOT decrease ExpectedCash (that's the existing POS domain
    /// behaviour being replicated here, not a choice made for Restaurant — see the domain method).
    /// </summary>
    public static Task RecordRefundAsync(RestaurantDbContext db, Guid sessionId, decimal amount, CancellationToken ct) =>
        RecordTransactionAsync(db, sessionId, amount, isRefund: true, ct);

    private static async Task RecordTransactionAsync(
        RestaurantDbContext db, Guid sessionId, decimal amount, bool isRefund, CancellationToken ct)
    {
        int bypass = TenantAmbient.BypassFilter ? 1 : 0;
        Guid tenant = TenantAmbient.TenantId ?? Guid.Empty;
        var now = DateTime.UtcNow;
        var salesDelta = isRefund ? 0 : amount;
        var refundsDelta = isRefund ? amount : 0;
        var expectedCashDelta = isRefund ? 0 : amount; // matches POSSession.RecordTransaction exactly

        // Status = {OpenStatus} guard: never mutate a shift's totals once it's closed — its
        // Z-report is final at that point. A refund against an order whose shift has since closed
        // still succeeds on the order (see RefundOrderHandler); it just silently no-ops here instead
        // of retroactively amending an already-reconciled shift.
        await db.Database.ExecuteSqlAsync($"""
            UPDATE [pos].[pos_sessions]
            SET TotalTransactions = TotalTransactions + 1,
                TotalSales        = TotalSales + {salesDelta},
                TotalRefunds      = TotalRefunds + {refundsDelta},
                ExpectedCash      = ExpectedCash + {expectedCashDelta},
                UpdatedAt         = {now}
            WHERE Id = {sessionId} AND Status = {OpenStatus} AND ({bypass} = 1 OR TenantId = {tenant})
            """, ct);
    }
}
