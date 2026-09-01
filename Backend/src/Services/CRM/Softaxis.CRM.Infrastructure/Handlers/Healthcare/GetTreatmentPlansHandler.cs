using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Healthcare.Dtos;
using Softaxis.CRM.Application.Healthcare.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Healthcare;

internal sealed class GetTreatmentPlansHandler(CrmDbContext db)
    : IQueryHandler<GetTreatmentPlansQuery, PagedResult<TreatmentPlanDto>>
{
    /// <summary>Capped so a hand-edited pageSize cannot ask for the whole table.</summary>
    private const int MaxPageSize = 200;

    public async Task<Result<PagedResult<TreatmentPlanDto>>> Handle(GetTreatmentPlansQuery query, CancellationToken ct)
    {
        var page     = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, MaxPageSize);

        // TenantIsolation.ApplyTenantId replaces the configuration filter on IsDeleted, so it is
        // applied by hand here. Without it a deleted row stayed in the list.
        var q = db.TreatmentPlans.AsNoTracking().Where(x => !x.IsDeleted);

        if (query.PatientId is { } scopeId)
            q = q.Where(x => x.PatientId == scopeId);

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(x => x.Status == query.Status);

        if (!string.IsNullOrWhiteSpace(query.Search))
            q = q.Where(x => x.PatientName.Contains(query.Search)
                          || x.Diagnosis.Contains(query.Search)
                          || x.Doctor.Contains(query.Search));

        // Counted before paging so the caller knows how many pages exist.
        var total = await q.CountAsync(ct);

        var items = await q
            .OrderByDescending(x => x.CreatedAt)
            .ThenBy(x => x.Id)          // stable: an import lands many rows on one timestamp
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return Result.Success(PagedResult<TreatmentPlanDto>.Create(
            items.Select(HealthcareMappings.ToDto).ToList(), total, page, pageSize));
    }
}
