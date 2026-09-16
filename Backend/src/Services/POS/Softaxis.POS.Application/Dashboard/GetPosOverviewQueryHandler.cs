using System.Globalization;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Abstractions;

namespace Softaxis.POS.Application.Dashboard;

public sealed class GetPosOverviewQueryHandler(IPosDashboardReadService reads, ICurrentUser currentUser)
    : IQueryHandler<GetPosOverviewQuery, PosOverviewDto>
{
    /// <summary>Longest range served — beyond this the trend is too dense to read and the query too costly.</summary>
    public const int MaxDays = 92;

    public async Task<Result<PosOverviewDto>> Handle(GetPosOverviewQuery query, CancellationToken ct)
    {
        // POS controllers are [Authorize]-only; takings for the whole shop are a supervisor's view, not a cashier's.
        if (!currentUser.HasPermission("pos.reports.view"))
            return Result.Failure<PosOverviewDto>(Error.Custom("PosDashboard.Forbidden",
                "You need the POS reports permission to view the POS dashboard."));

        var offset = TimeSpan.FromMinutes(query.UtcOffsetMinutes);
        var today  = DateTime.UtcNow.Add(offset).Date;

        var from = ParseDay(query.From) ?? today;
        var to   = ParseDay(query.To) ?? from;
        if (to < from) (from, to) = (to, from);

        var days = (to - from).Days + 1;
        if (days > MaxDays)
            return Result.Failure<PosOverviewDto>(Error.Custom("Validation.Failed",
                $"Choose a range of {MaxDays} days or fewer."));

        // Local calendar days → the UTC window the rows are stored in.
        var startUtc = DateTime.SpecifyKind(from - offset, DateTimeKind.Utc);
        var endUtc   = DateTime.SpecifyKind(to.AddDays(1) - offset, DateTimeKind.Utc);

        return Result.Success(await reads.GetOverviewAsync(startUtc, endUtc, offset, hourly: days == 1, ct));
    }

    private static DateTime? ParseDay(string? s) =>
        DateTime.TryParseExact(s, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
            ? d.Date : null;
}
