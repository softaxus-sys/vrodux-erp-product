using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Reports.Queries.GetDailySummary;

public sealed class GetDailySummaryQueryHandler(IReportService reportService)
    : IQueryHandler<GetDailySummaryQuery, DailySummaryDto>
{
    public async Task<Result<DailySummaryDto>> Handle(GetDailySummaryQuery query, CancellationToken ct)
    {
        var summary = await reportService.GetDailySummaryAsync(query.Date, query.CashierId, ct);
        return Result.Success(summary);
    }
}
