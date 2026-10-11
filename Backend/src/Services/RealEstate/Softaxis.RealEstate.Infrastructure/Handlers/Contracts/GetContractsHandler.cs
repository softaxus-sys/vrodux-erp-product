using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Contracts.Dtos;
using Softaxis.RealEstate.Application.Contracts.Queries;
using Softaxis.RealEstate.Infrastructure.Handlers.RentAlerts;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Contracts;

internal sealed class GetContractsHandler(RealEstateDbContext db)
    : IQueryHandler<GetContractsQuery, IReadOnlyList<ContractDto>>
{
    public async Task<Result<IReadOnlyList<ContractDto>>> Handle(GetContractsQuery query, CancellationToken ct)
    {
        var q = db.LeaseContracts.AsNoTracking()
            .Include(x => x.Installments)
            .Where(x => !x.IsDeleted);

        if (query.TenantId is { } tid) q = q.Where(x => x.TenantId == tid);
        if (!string.IsNullOrWhiteSpace(query.Status)) q = q.Where(x => x.Status == query.Status);

        var items = await q.OrderByDescending(x => x.CreatedAt).ToListAsync(ct);

        var today = (await RentAlertSettingsStore.GetOrCreateAsync(db, ct)).Today();

        // Few leases ever have one, so the whole workspace's set is cheaper than an IN list.
        var terminations = (await db.LeaseTerminations.AsNoTracking().ToListAsync(ct))
            .ToDictionary(t => t.ContractId);

        return Result.Success<IReadOnlyList<ContractDto>>(
            items.Select(c => ContractMappings.ToDto(c, today, terminations.GetValueOrDefault(c.Id))).ToList());
    }
}

internal sealed class GetContractByIdHandler(RealEstateDbContext db)
    : IQueryHandler<GetContractByIdQuery, ContractDetailDto>
{
    public async Task<Result<ContractDetailDto>> Handle(GetContractByIdQuery query, CancellationToken ct)
    {
        var c = await db.LeaseContracts.AsNoTracking()
            .Include(x => x.Installments)
            .FirstOrDefaultAsync(x => x.Id == query.Id && !x.IsDeleted, ct);
        if (c is null) return Result.Failure<ContractDetailDto>(Error.NotFoundById("Contract", query.Id));

        var today = (await RentAlertSettingsStore.GetOrCreateAsync(db, ct)).Today();

        var installments = c.Installments.Where(i => !i.IsDeleted)
            .OrderBy(i => i.InstallmentNumber)
            .Select(i => ContractMappings.ToDto(i, today))
            .ToList();

        var termination = await db.LeaseTerminations.AsNoTracking()
            .FirstOrDefaultAsync(t => t.ContractId == c.Id, ct);

        return Result.Success(new ContractDetailDto(
            ContractMappings.ToDto(c, today, termination), installments,
            await HistoryAsync(c.Id, c.UnitId, c.TenantId, ct),
            termination is null ? null : LeaseLifecycle.ToDto(termination)));
    }

    /// <summary>Every lease in the same tenancy, oldest first, found by walking the renewal links
    /// in both directions from this one.</summary>
    private async Task<IReadOnlyList<LeaseHistoryItemDto>> HistoryAsync(
        Guid id, Guid unitId, Guid tenantId, CancellationToken ct)
    {
        // A renewal always keeps the unit and the tenant, so this is every lease that could be linked.
        var candidates = await db.LeaseContracts.AsNoTracking()
            .Where(x => !x.IsDeleted && x.UnitId == unitId && x.TenantId == tenantId)
            .Select(x => new
            {
                x.Id, x.ContractNumber, x.StartDate, x.EndDate, x.AnnualRent, x.Status,
                x.RenewalNumber, x.RenewedFromContractId,
            })
            .ToListAsync(ct);

        var byId   = candidates.ToDictionary(x => x.Id);
        var byFrom = candidates.Where(x => x.RenewedFromContractId is not null)
                               .GroupBy(x => x.RenewedFromContractId!.Value)
                               .ToDictionary(g => g.Key, g => g.First());

        if (!byId.TryGetValue(id, out var current)) return [];

        var chain = new List<LeaseHistoryItemDto>();
        var seen  = new HashSet<Guid>();

        // Back to the original lease…
        var first = current;
        while (first.RenewedFromContractId is { } from && byId.TryGetValue(from, out var earlier) && seen.Add(earlier.Id))
            first = earlier;

        // …then forward through every renewal.
        seen.Clear();
        for (var node = first; node is not null && seen.Add(node.Id); node = byFrom.GetValueOrDefault(node.Id))
            chain.Add(new LeaseHistoryItemDto(node.Id, node.ContractNumber, node.StartDate, node.EndDate,
                node.AnnualRent, node.Status, node.RenewalNumber));

        return chain;
    }
}

/// <summary>
/// The chase queue: everything late, plus everything falling due inside the window.
/// Overdue sorts first and by age, because that is the order an operator actually works it.
/// </summary>
internal sealed class GetRentDueHandler(RealEstateDbContext db)
    : IQueryHandler<GetRentDueQuery, IReadOnlyList<RentDueItemDto>>
{
    public async Task<Result<IReadOnlyList<RentDueItemDto>>> Handle(GetRentDueQuery query, CancellationToken ct)
    {
        var today = (await RentAlertSettingsStore.GetOrCreateAsync(db, ct)).Today();
        var horizon = DateTime.Parse(today).AddDays(Math.Max(0, query.WithinDays)).ToString("yyyy-MM-dd");

        // Active leases, and leases that were renewed: the tenant is still there, so what is unpaid
        // on the earlier lease is still owed. A terminated lease is left out — what it owes is
        // settled through its final account, not chased payment by payment.
        var rows = await (
            from i in db.RentInstallments.AsNoTracking()
            join c in db.LeaseContracts.AsNoTracking() on i.ContractId equals c.Id
            join t in db.Tenants.AsNoTracking() on c.TenantId equals t.Id
            where !i.IsDeleted && !c.IsDeleted && !t.IsDeleted
                  && (c.Status == "active" || c.Status == "renewed")
                  && i.Status != "paid" && i.Status != "waived" && i.Status != "cancelled"
                  && string.Compare(i.DueDate, horizon) <= 0
            select new
            {
                i.Id, i.ContractId, c.ContractNumber, c.TenantId, TenantName = t.Name, TenantEmail = t.Email,
                c.PropertyName, c.UnitNumber, i.DueDate, i.Amount, i.AmountPaid, i.Status,
            }).ToListAsync(ct);

        var items = rows
            .Select(r =>
            {
                var overdue = string.CompareOrdinal(r.DueDate, today) < 0;
                var days = ContractMappings.DaysBetween(today, r.DueDate) ?? 0;
                return new RentDueItemDto(
                    r.Id, r.ContractId, r.ContractNumber, r.TenantId, r.TenantName, r.TenantEmail,
                    r.PropertyName, r.UnitNumber, r.DueDate, r.Amount, r.Amount - r.AmountPaid,
                    overdue ? "overdue" : r.Status,
                    overdue ? -days : 0,
                    overdue ? 0 : days);
            })
            .Where(x => query.IncludeOverdue || x.Status != "overdue")
            .OrderByDescending(x => x.Status == "overdue")
            .ThenBy(x => x.DueDate, StringComparer.Ordinal)
            .ToList();

        return Result.Success<IReadOnlyList<RentDueItemDto>>(items);
    }
}
