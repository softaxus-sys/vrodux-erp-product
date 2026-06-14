using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Careers.Dtos;

namespace Softaxis.HR.Application.Careers.Queries;

public sealed record GetOpenJobByIdQuery(string TenantSlug, Guid Id) : IQuery<PublicJobDto>;
