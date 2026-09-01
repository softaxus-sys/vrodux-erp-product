using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Insurance.Dtos;
using Softaxis.CRM.Application.Insurance.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Insurance;

internal sealed class GetPoliciesHandler(CrmDbContext db)
    : IQueryHandler<GetPoliciesQuery, PagedResult<PolicyDto>>
{
    /// <summary>Capped so a hand-edited pageSize cannot ask for the whole table.</summary>
    private const int MaxPageSize = 200;

    public async Task<Result<PagedResult<PolicyDto>>> Handle(GetPoliciesQuery query, CancellationToken ct)
    {
        var page     = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, MaxPageSize);

        // TenantIsolation.ApplyTenantId replaces the configuration filter on IsDeleted, so it is
        // applied by hand here. Without it a deleted row stayed in the list.
        var q = db.Policies.AsNoTracking().Where(x => !x.IsDeleted);

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(x => x.Status == query.Status);

        if (!string.IsNullOrWhiteSpace(query.Search))
            q = q.Where(x => x.PolicyNumber.Contains(query.Search)
                          || x.HolderName.Contains(query.Search)
                          || x.ProductType.Contains(query.Search));

        // Counted before paging so the caller knows how many pages exist.
        var total = await q.CountAsync(ct);

        var items = await q
            .OrderByDescending(x => x.CreatedAt)
            .ThenBy(x => x.Id)          // stable: an import lands many rows on one timestamp
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return Result.Success(PagedResult<PolicyDto>.Create(
            items.Select(InsuranceMappings.ToDto).ToList(), total, page, pageSize));
    }
}
