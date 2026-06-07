using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Roles.Queries.GetRoles;

public sealed class GetRolesQueryHandler(IRoleRepository roleRepo)
    : IQueryHandler<GetRolesQuery, PagedResult<RoleSummaryDto>>
{
    public async Task<Result<PagedResult<RoleSummaryDto>>> Handle(GetRolesQuery query, CancellationToken ct)
    {
        var paged = await roleRepo.GetPagedAsync(query.Page, query.PageSize, query.Search, ct);
        var dtos  = paged.Items
            .Select(r => new RoleSummaryDto(
                r.Id, r.Name, r.Description, r.IsSystem, r.UserRoles.Count,
                r.RolePermissions
                    .Select(rp => rp.Permission.ModuleId.Split('.')[0])
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(m => m)
                    .ToList()))
            .ToList();

        return Result.Success(PagedResult<RoleSummaryDto>.Create(dtos, paged.TotalCount, paged.Page, paged.PageSize));
    }
}

