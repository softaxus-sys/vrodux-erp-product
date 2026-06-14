using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.HR.Application.Careers.Dtos;
using Softaxis.HR.Application.Careers.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Careers;

internal sealed class GetOpenJobByIdHandler(HrDbContext db)
    : IQueryHandler<GetOpenJobByIdQuery, PublicJobDto>
{
    public async Task<Result<PublicJobDto>> Handle(GetOpenJobByIdQuery query, CancellationToken ct)
    {
        var tenant = await CareersMappings.ResolveTenantAsync(db, query.TenantSlug, ct);
        if (tenant is null)
            return Result.Failure<PublicJobDto>(Error.Custom("Company.NotFound", "Company not found."));

        var job = await db.JobPostings.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == query.Id && x.Status == "open"
                && EF.Property<Guid?>(x, TenantIsolation.Column) == tenant.Id, ct);

        if (job is null)
            return Result.Failure<PublicJobDto>(Error.Custom("JobPosting.NotFound", "Job posting not found."));

        return Result.Success(CareersMappings.ToDto(job));
    }
}
