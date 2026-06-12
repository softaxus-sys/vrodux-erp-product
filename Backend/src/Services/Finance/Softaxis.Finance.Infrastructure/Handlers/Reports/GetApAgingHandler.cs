using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Reports.Dtos;
using Softaxis.Finance.Application.Reports.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Reports;

internal sealed class GetApAgingHandler(FinanceDbContext db) : IQueryHandler<GetApAgingQuery, AgingReportDto>
{
    public async Task<Result<AgingReportDto>> Handle(GetApAgingQuery query, CancellationToken ct)
    {
        var asOf = DateOnly.TryParse(query.AsOf, out var parsed) ? parsed : DateOnly.FromDateTime(DateTime.UtcNow);

        var bills = await db.PurchaseBills.AsNoTracking().Include(x => x.Items)
            .Where(x => x.Status == "approved" || x.Status == "partially_paid")
            .ToListAsync(ct);

        var lines = bills
            .Select(x =>
            {
                var (daysOverdue, bucket) = AgingHelpers.Classify(x.DueDate, asOf);
                return new AgingLineDto(x.Id, x.BillNumber, x.SupplierId, x.SupplierName,
                    x.BillDate, x.DueDate, x.Total, x.AmountPaid, x.AmountDue, daysOverdue, bucket);
            })
            .Where(l => l.AmountDue > 0)
            .OrderBy(l => l.DueDate)
            .ToList();

        return Result.Success(new AgingReportDto(
            asOf.ToString("yyyy-MM-dd"), lines, AgingHelpers.BuildBucketTotals(lines), lines.Sum(l => l.AmountDue)));
    }
}
