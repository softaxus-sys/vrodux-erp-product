using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Inventory.Application.CatalogueMove;

namespace Softaxis.Inventory.API.Controllers;

/// <summary>
/// Moves one workspace's product catalogue from the POS schema into Inventory (see
/// docs/product-catalogue-unification.md). Platform-operator only: it changes where a customer's whole
/// catalogue lives, so it is never something a workspace does to itself. Always read the dry run first.
/// </summary>
[Authorize(Policy = "SuperAdminOnly")]
[Route("api/admin/catalogue-move")]
[Tags("Catalogue move")]
public sealed class CatalogueMoveController(ISender sender) : BaseApiController(sender)
{
    /// <summary>Where the workspace's catalogue lives today, and any earlier move.</summary>
    [HttpGet("{tenantId:guid}")]
    public async Task<IActionResult> Status(Guid tenantId, CancellationToken ct)
        => HandleResult(await Sender.Send(new GetCatalogueMoveStatusQuery(tenantId), ct));

    /// <summary>The dry run: what a move would do and what would stop it. Changes nothing.</summary>
    [HttpGet("{tenantId:guid}/preview")]
    public async Task<IActionResult> Preview(Guid tenantId, CancellationToken ct)
        => HandleResult(await Sender.Send(new PreviewCatalogueMoveQuery(tenantId), ct));

    /// <summary>Runs the move. Refused unless the dry run has no blockers, and checked again at this moment.</summary>
    [HttpPost("{tenantId:guid}/run")]
    public async Task<IActionResult> Run(Guid tenantId, CancellationToken ct)
    {
        var who = User.FindFirstValue("username") ?? User.FindFirstValue(ClaimTypes.Email)
                  ?? User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "super admin";
        return HandleResult(await Sender.Send(new RunCatalogueMoveCommand(tenantId, who), ct));
    }
}
