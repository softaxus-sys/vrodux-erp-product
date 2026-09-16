using Softaxis.POS.Application.Dashboard;

namespace Softaxis.POS.Application.Abstractions;

/// <summary>Aggregations for the retail POS dashboard, computed in the database.</summary>
public interface IPosDashboardReadService
{
    /// <param name="startUtc">Inclusive UTC start of the local range.</param>
    /// <param name="endUtc">Exclusive UTC end of the local range.</param>
    /// <param name="offset">Caller's UTC offset, for bucketing the trend on the local clock.</param>
    /// <param name="hourly">True for a single-day range (hour buckets), false for day buckets.</param>
    Task<PosOverviewDto> GetOverviewAsync(
        DateTime startUtc, DateTime endUtc, TimeSpan offset, bool hourly, CancellationToken ct = default);
}
