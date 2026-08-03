using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Reports.Dtos;
using Softaxis.Restaurant.Application.Reports.Queries;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Reports;

internal sealed class GetSalesByCategoryReportHandler(RestaurantDbContext db)
    : IQueryHandler<GetSalesByCategoryReportQuery, IReadOnlyList<SalesByCategoryRow>>
{
    public async Task<Result<IReadOnlyList<SalesByCategoryRow>>> Handle(GetSalesByCategoryReportQuery query, CancellationToken ct)
    {
        var from = ReportAggregation.StartOf(query.From);
        var to = ReportAggregation.EndOfExclusive(query.To);

        var result = await ReportAggregation.TopCategoriesAsync(db, from, to, query.BranchId, take: int.MaxValue, ct);
        return Result.Success(result);
    }
}
