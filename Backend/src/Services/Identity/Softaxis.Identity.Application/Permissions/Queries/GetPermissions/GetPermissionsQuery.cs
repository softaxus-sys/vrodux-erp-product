using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.Permissions.Queries.GetPermissions;

public sealed record GetPermissionsQuery(string? ModuleId = null) : IQuery<IReadOnlyList<PermissionDto>>;
