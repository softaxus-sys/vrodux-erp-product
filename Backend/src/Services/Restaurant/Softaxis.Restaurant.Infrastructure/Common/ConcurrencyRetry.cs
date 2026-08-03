using Microsoft.EntityFrameworkCore;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Common;

/// <summary>
/// Retries an operation that mutates an `Order` (now that `Order.RowVersion` is a real EF concurrency
/// token) when two requests race on the same row — e.g. two waiters adding items to the same order at
/// once. Each retry re-runs the whole operation, so it must re-load the entity fresh rather than reuse
/// a stale tracked instance. Replaces the previous raw-SQL `ExecuteSqlAsync` workaround in the payment
/// endpoint, which sidestepped concurrency conflicts entirely instead of handling them.
///
/// <c>db</c> is required so a retry can clear the change tracker first: the handler's own DbContext
/// instance is reused across attempts (it's a per-request scoped dependency, not created fresh per
/// attempt), and EF Core's identity resolution means re-querying for an already-tracked entity just
/// returns the same in-memory (stale, still-conflicting) instance instead of fresh row data — without
/// clearing the tracker, every "retry" would silently repeat the same failing SaveChanges until
/// `maxAttempts` is exhausted and the exception escapes anyway.
/// </summary>
internal static class ConcurrencyRetry
{
    public static async Task<T> ExecuteAsync<T>(RestaurantDbContext db, Func<Task<T>> operation, int maxAttempts = 3)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                return await operation();
            }
            catch (DbUpdateConcurrencyException) when (attempt < maxAttempts)
            {
                db.ChangeTracker.Clear();
            }
        }
    }
}
