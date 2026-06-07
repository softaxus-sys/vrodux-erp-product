using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.Roles.Queries.GetRoles;

public sealed record GetRolesQuery(int Page = 1, int PageSize = 50, string? Search = null)
    : IQuery<PagedResult<RoleSummaryDto>>;

