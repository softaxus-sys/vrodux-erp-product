using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.Users.Queries.GetUsers;

public sealed record GetUsersQuery(
    int     Page       = 1,
    int     PageSize   = 20,
    string? Search     = null,
    string? SortBy     = null,
    bool    SortDesc   = false
) : IQuery<PagedResult<UserSummaryDto>>;

