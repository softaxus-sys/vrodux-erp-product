using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Contracts.Dtos;
using Softaxis.RealEstate.Application.Contracts.Queries;
using Softaxis.RealEstate.Infrastructure.Handlers.RentAlerts;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Contracts;

internal sealed class GetContractsSummaryHandler(RealEstateDbContext db)
    : IQueryHandler<GetContractsSummaryQuery, ContractsSummaryDto>
{
    public async Task<Result<ContractsSummaryDto>> Handle(GetContractsSummaryQuery query, CancellationToken ct)
    {
        var today = (await RentAlertSettingsStore.GetOrCreateAsync(db, ct)).Today();

        var all = await db.LeaseContracts.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.AnnualRent, x.TotalPaid, x.EndDate }).ToListAsync(ct);

        var expiringSoon = DateTime.Parse(today).AddDays(60).ToString("yyyy-MM-dd");
        var monthEnd     = DateTime.Parse(today).AddDays(30).ToString("yyyy-MM-dd");

        var open = await (
            from i in db.RentInstallments.AsNoTracking()
            join c in db.LeaseContracts.AsNoTracking() on i.ContractId equals c.Id
            where !i.IsDeleted && !c.IsDeleted && c.Status == "active"
                  && i.Status != "paid" && i.Status != "waived"
            select new { i.DueDate, i.Amount, i.AmountPaid }).ToListAsync(ct);

        var overdue = open.Where(i => string.CompareOrdinal(i.DueDate, today) < 0).ToList();
        var dueSoon = open.Where(i => string.CompareOrdinal(i.DueDate, today) >= 0
                                   && string.CompareOrdinal(i.DueDate, monthEnd) <= 0).ToList();

        return Result.Success(new ContractsSummaryDto(
            all.Count,
            all.Count(x => x.Status == "active"),
            all.Count(x => x.Status == "expired"),
            all.Count(x => x.Status == "terminated"),
            all.Sum(x => x.AnnualRent),
            all.Sum(x => x.TotalPaid),
            all.Sum(x => x.AnnualRent - x.TotalPaid),
            all.Count(x => x.Status == "active" && string.Compare(x.EndDate, expiringSoon, StringComparison.Ordinal) <= 0),
            overdue.Count,
            overdue.Sum(x => x.Amount - x.AmountPaid),
            dueSoon.Count,
            dueSoon.Sum(x => x.Amount - x.AmountPaid)));
    }
}
