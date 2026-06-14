using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Reports.Dtos;
using Softaxis.Finance.Application.Reports.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Reports;

internal sealed class GetArAgingHandler(FinanceDbContext db) : IQueryHandler<GetArAgingQuery, AgingReportDto>
{
    public async Task<Result<AgingReportDto>> Handle(GetArAgingQuery query, CancellationToken ct)
    {
        var asOf = DateOnly.TryParse(query.AsOf, out var parsed) ? parsed : DateOnly.FromDateTime(DateTime.UtcNow);

        var invoices = await db.Invoices.AsNoTracking().Include(x => x.Items)
            .Where(x => x.Status == "sent" || x.Status == "partially_paid" || x.Status == "overdue")
            .ToListAsync(ct);

        var lines = invoices
            .Select(x =>
            {
                var (daysOverdue, bucket) = AgingHelpers.Classify(x.DueDate, asOf);
                return new AgingLineDto(x.Id, x.InvoiceNumber, x.CustomerId, x.CustomerName,
                    x.InvoiceDate, x.DueDate, x.Total, x.AmountPaid, x.AmountDue, daysOverdue, bucket);
            })
            .Where(l => l.AmountDue > 0)
            .OrderBy(l => l.DueDate)
            .ToList();

        return Result.Success(new AgingReportDto(
            asOf.ToString("yyyy-MM-dd"), lines, AgingHelpers.BuildBucketTotals(lines), lines.Sum(l => l.AmountDue)));
    }
}
