using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Identity.Application.Permissions.Queries.GetPermissions;

namespace Softaxis.Identity.API.Controllers;

[Authorize]
[Tags("Permissions")]
public sealed class PermissionsController(ISender sender) : BaseApiController(sender)
{
    /// <summary>Get all available permissions, optionally filtered by module.</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? moduleId = null, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetPermissionsQuery(moduleId), ct));
}
