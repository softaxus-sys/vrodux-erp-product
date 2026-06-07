using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Users.Queries.GetUsers;

public sealed class GetUsersQueryHandler(
    IUserRepository userRepo,
    ICurrentUser    currentUser,
    ITenantContext  tenantContext)
    : IQueryHandler<GetUsersQuery, PagedResult<UserSummaryDto>>
{
    public async Task<Result<PagedResult<UserSummaryDto>>> Handle(GetUsersQuery query, CancellationToken ct)
    {
        // Non-super-admins only see users within their own tenant.
        Guid? tenantScope = currentUser.IsSuperAdmin ? null : tenantContext.TenantId;

        var paged = await userRepo.GetPagedAsync(
            query.Page, query.PageSize,
            query.Search, query.SortBy, query.SortDesc, tenantScope, ct);

        var dtos = paged.Items
            .Select(u => new UserSummaryDto(
                u.Id, u.Email.Value, u.Username, u.FullName,
                u.Status.ToString(), u.EmailVerified, u.CreatedAt,
                u.UserRoles.Count))
            .ToList();

        return Result.Success(PagedResult<UserSummaryDto>.Create(dtos, paged.TotalCount, paged.Page, paged.PageSize));
    }
}

