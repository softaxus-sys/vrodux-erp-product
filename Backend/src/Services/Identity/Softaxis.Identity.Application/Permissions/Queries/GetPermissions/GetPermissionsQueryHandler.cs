using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Permissions.Queries.GetPermissions;

public sealed class GetPermissionsQueryHandler(IPermissionRepository permissionRepo)
    : IQueryHandler<GetPermissionsQuery, IReadOnlyList<PermissionDto>>
{
    public async Task<Result<IReadOnlyList<PermissionDto>>> Handle(GetPermissionsQuery query, CancellationToken ct)
    {
        var perms = string.IsNullOrWhiteSpace(query.ModuleId)
            ? await permissionRepo.GetAllAsync(ct)
            : await permissionRepo.GetByModuleAsync(query.ModuleId, ct);

        var dtos = perms
            .Select(p => new PermissionDto(p.Id, p.ModuleId, p.Action, p.Description, p.Key))
            .ToList();

        return Result.Success<IReadOnlyList<PermissionDto>>(dtos);
    }
}
