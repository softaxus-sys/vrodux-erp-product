using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Identity.Application.Roles.Commands.CreateRole;
using Softaxis.Identity.Application.Roles.Commands.DeleteRole;
using Softaxis.Identity.Application.Roles.Commands.UpdateRole;
using Softaxis.Identity.Application.Roles.Commands.UpdateRolePermissions;
using Softaxis.Identity.Application.Roles.Queries.GetRoleById;
using Softaxis.Identity.Application.Roles.Queries.GetRoles;

namespace Softaxis.Identity.API.Controllers;

/// <summary>
/// Role management — CRUD + permission matrix updates.
/// </summary>
[Authorize]
[Tags("Roles")]
public sealed class RolesController(ISender sender) : BaseApiController(sender)
{
    [HttpGet]
    public async Task<IActionResult> GetRoles([FromQuery] int page = 1, [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetRolesQuery(page, pageSize, search), ct));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new GetRoleByIdQuery(id), ct));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateRoleCommand command, CancellationToken ct)
        => HandleResult(await Sender.Send(command, ct), 201);

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateRoleRequest request, CancellationToken ct)
        => HandleResult(await Sender.Send(new UpdateRoleCommand(id, request.Name, request.Description), ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new DeleteRoleCommand(id), ct));

    /// <summary>Replace the full permission set for a role.</summary>
    [HttpPut("{id:guid}/permissions")]
    public async Task<IActionResult> UpdatePermissions(Guid id, [FromBody] UpdateRolePermissionsRequest request, CancellationToken ct)
        => HandleResult(await Sender.Send(new UpdateRolePermissionsCommand(id, request.PermissionIds), ct));
}

public sealed record UpdateRoleRequest(string Name, string Description);
public sealed record UpdateRolePermissionsRequest(List<Guid> PermissionIds);
