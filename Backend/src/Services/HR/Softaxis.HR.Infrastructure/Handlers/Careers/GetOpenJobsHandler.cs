using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.HR.Application.Careers.Dtos;
using Softaxis.HR.Application.Careers.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Careers;

internal sealed class GetOpenJobsHandler(HrDbContext db)
    : IQueryHandler<GetOpenJobsQuery, IReadOnlyList<PublicJobDto>>
{
    public async Task<Result<IReadOnlyList<PublicJobDto>>> Handle(GetOpenJobsQuery query, CancellationToken ct)
    {
        var tenant = await CareersMappings.ResolveTenantAsync(db, query.TenantSlug, ct);
        if (tenant is null)
            return Result.Failure<IReadOnlyList<PublicJobDto>>(Error.Custom("Company.NotFound", "Company not found."));

        var jobs = await db.JobPostings.AsNoTracking()
            .Where(x => x.Status == "open" && EF.Property<Guid?>(x, TenantIsolation.Column) == tenant.Id)
            .OrderByDescending(x => x.PostedDate)
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<PublicJobDto>>(jobs.Select(CareersMappings.ToDto).ToList());
    }
}
