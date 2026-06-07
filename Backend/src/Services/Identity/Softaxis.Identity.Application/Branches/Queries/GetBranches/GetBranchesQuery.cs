using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.Branches.Queries.GetBranches;

public sealed record GetBranchesQuery(int Page, int PageSize, string? Status)
    : IQuery<PagedResult<BranchDto>>;
