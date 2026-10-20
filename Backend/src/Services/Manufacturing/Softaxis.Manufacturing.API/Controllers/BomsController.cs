using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Manufacturing.API.Authorization;
using Softaxis.Manufacturing.API.Controllers.Common;
using Softaxis.Manufacturing.Application.Boms.Commands;
using Softaxis.Manufacturing.Application.Boms.Queries;

namespace Softaxis.Manufacturing.API.Controllers;

[Route("api/manufacturing/boms")][Authorize]
public sealed class BomsController(ISender sender) : ManufacturingControllerBase
{
    // Readable with either key: planning an order means picking a BOM.
    [HttpGet]
    [RequirePermission("manufacturing.boms.view", "manufacturing.orders.view")]
    public async Task<IActionResult> GetAll([FromQuery] string? status, [FromQuery] string? search,
        [FromQuery] Guid? productId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetBomsQuery(status, search, productId), ct));

    [HttpGet("{id:guid}")]
    [RequirePermission("manufacturing.boms.view", "manufacturing.orders.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetBomByIdQuery(id), ct));

    [HttpPost]
    [RequirePermission("manufacturing.boms.create")]
    public async Task<IActionResult> Create([FromBody] UpsertBomRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new CreateBomCommand(
            req.Name, req.ProductId, req.OutputQuantity, req.Unit, req.Notes, req.Lines ?? [], req.Operations, req.ByProducts), ct));

    [HttpPut("{id:guid}")]
    [RequirePermission("manufacturing.boms.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertBomRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateBomCommand(
            id, req.Name, req.ProductId, req.OutputQuantity, req.Unit, req.Notes, req.Lines ?? [], req.Operations, req.ByProducts), ct));

    [HttpPatch("{id:guid}/status")]
    [RequirePermission("manufacturing.boms.edit")]
    public async Task<IActionResult> SetStatus(Guid id, [FromBody] StatusRequest req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new SetBomStatusCommand(id, req.Status), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("manufacturing.boms.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteBomCommand(id), ct));

    public sealed record UpsertBomRequest(
        string Name, Guid ProductId, decimal OutputQuantity, string? Unit, string? Notes,
        List<BomLineInput>? Lines, List<BomOperationInput>? Operations = null, List<BomByProductInput>? ByProducts = null);

    public sealed record StatusRequest(string Status);
}
