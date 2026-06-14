using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Careers.Dtos;

namespace Softaxis.HR.Application.Careers.Queries;

public sealed record GetCareersCompanyQuery(string TenantSlug) : IQuery<CompanyDto>;
