namespace Softaxis.Restaurant.Application.Abstractions;

/// <summary>
/// Pushes lightweight "something changed, refetch" signals to connected KDS/table-board clients over
/// SignalR (see RestaurantHub in the API layer). Deliberately signal-only, not full payloads — the
/// frontend already has the React Query fetchers; duplicating DTO shaping into a second push path
/// would only invite drift. Implementations must never let a broadcast failure fail the command that
/// triggered it (best-effort, swallow-and-log).
/// </summary>
public interface IRestaurantRealtimeNotifier
{
    Task NotifyKitchenChangedAsync(CancellationToken ct = default);
    Task NotifyTablesChangedAsync(CancellationToken ct = default);
}
