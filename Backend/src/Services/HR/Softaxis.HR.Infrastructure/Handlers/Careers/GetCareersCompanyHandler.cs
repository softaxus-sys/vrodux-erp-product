using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Careers.Dtos;
using Softaxis.HR.Application.Careers.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Careers;

internal sealed class GetCareersCompanyHandler(HrDbContext db)
    : IQueryHandler<GetCareersCompanyQuery, CompanyDto>
{
    public async Task<Result<CompanyDto>> Handle(GetCareersCompanyQuery query, CancellationToken ct)
    {
        var tenant = await CareersMappings.ResolveTenantAsync(db, query.TenantSlug, ct);
        if (tenant is null)
            return Result.Failure<CompanyDto>(Error.Custom("Company.NotFound", "Company not found."));

        return Result.Success(new CompanyDto(tenant.Name, tenant.Slug, null));
    }
}
