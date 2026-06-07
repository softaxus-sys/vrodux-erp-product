using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Inventory.Application.UnitsOfMeasure.Commands.CreateUoM;
using Softaxis.Inventory.Application.UnitsOfMeasure.Commands.DeleteUoM;
using Softaxis.Inventory.Application.UnitsOfMeasure.Commands.UpdateUoM;
using Softaxis.Inventory.Application.UnitsOfMeasure.Queries.GetUoMById;
using Softaxis.Inventory.Application.UnitsOfMeasure.Queries.GetUoMs;

namespace Softaxis.Inventory.API.Controllers;

/// <summary>Units of measure — master data managed by admins.</summary>
[Authorize]
[Tags("UnitsOfMeasure")]
[Route("api/inventory/units-of-measure")]
public sealed class UnitsOfMeasureController(ISender sender) : BaseApiController(sender)
{
    // ── GET /api/inventory/units-of-measure ───────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search   = null,
        [FromQuery] bool?   isActive = null,
        CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetUoMsQuery(search, isActive), ct));

    // ── GET /api/inventory/units-of-measure/{id} ──────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new GetUoMByIdQuery(id), ct));

    // ── POST /api/inventory/units-of-measure ──────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUoMRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(
            new CreateUoMCommand(req.Name, req.Symbol, req.Description), ct), 201);

    // ── PUT /api/inventory/units-of-measure/{id} ──────────────────────────────
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUoMRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(
            new UpdateUoMCommand(id, req.Name, req.Symbol, req.Description, req.IsActive), ct));

    // ── DELETE /api/inventory/units-of-measure/{id} ───────────────────────────
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new DeleteUoMCommand(id), ct));
}

public sealed record CreateUoMRequest(
    string  Name,
    string  Symbol,
    string? Description);

public sealed record UpdateUoMRequest(
    string  Name,
    string  Symbol,
    string? Description,
    bool    IsActive);
