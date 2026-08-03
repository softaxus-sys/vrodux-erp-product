using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Reports.Dtos;
using Softaxis.Restaurant.Application.Reports.Queries;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Reports;

/// <summary>Z-report (session closed) / X-report (session still open) — same handler; the controller
/// exposes both routes since the only real difference is what the caller expects the session's status
/// to be. Every order tied to this SessionId counts (not just currently-paid ones), since a Z-report is
/// meant to reconcile everything that happened during the shift.</summary>
internal sealed class GetSessionReportHandler(RestaurantDbContext db)
    : IQueryHandler<GetSessionReportQuery, SessionReportDto>
{
    public async Task<Result<SessionReportDto>> Handle(GetSessionReportQuery query, CancellationToken ct) =>
        Result.Success(await ReportAggregation.BuildSessionReportAsync(db, query.SessionId, ct));
}
