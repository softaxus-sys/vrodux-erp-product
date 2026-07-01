using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Inventory.API.Authorization;
using Softaxis.Inventory.Application.Warehouses.Commands.CreateWarehouse;
using Softaxis.Inventory.Application.Warehouses.Commands.DeleteWarehouse;
using Softaxis.Inventory.Application.Warehouses.Commands.SetDefaultWarehouse;
using Softaxis.Inventory.Application.Warehouses.Commands.UpdateWarehouse;
using Softaxis.Inventory.Application.Warehouses.Queries.GetWarehouseById;
using Softaxis.Inventory.Application.Warehouses.Queries.GetWarehouses;

namespace Softaxis.Inventory.API.Controllers;

/// <summary>Warehouse management.</summary>
[Authorize]
[Tags("Warehouses")]
public sealed class WarehousesController(ISender sender) : BaseApiController(sender)
{
    // ── GET /api/inventory/warehouses ───────────────────────────────────────
    [HttpGet]
    [RequirePermission("inventory.warehouses.view")]
    public async Task<IActionResult> GetAll(CancellationToken ct)
        => HandleResult(await Sender.Send(new GetWarehousesQuery(), ct));

    // ── GET /api/inventory/warehouses/{id} ──────────────────────────────────
    [HttpGet("{id:guid}")]
    [RequirePermission("inventory.warehouses.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new GetWarehouseByIdQuery(id), ct));

    // ── POST /api/inventory/warehouses ──────────────────────────────────────
    [HttpPost]
    [RequirePermission("inventory.warehouses.create")]
    public async Task<IActionResult> Create([FromBody] UpsertWarehouseRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(
            new CreateWarehouseCommand(req.Name, req.Code, req.Address, req.ContactPerson, req.Phone, req.IsActive), ct), 201);

    // ── PUT /api/inventory/warehouses/{id} ──────────────────────────────────
    [HttpPut("{id:guid}")]
    [RequirePermission("inventory.warehouses.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertWarehouseRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(
            new UpdateWarehouseCommand(id, req.Name, req.Code, req.Address, req.ContactPerson, req.Phone, req.IsActive), ct));

    // ── PATCH /api/inventory/warehouses/{id}/set-default ────────────────────
    [HttpPatch("{id:guid}/set-default")]
    [RequirePermission("inventory.warehouses.edit")]
    public async Task<IActionResult> SetDefault(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new SetDefaultWarehouseCommand(id), ct));

    // ── DELETE /api/inventory/warehouses/{id} ───────────────────────────────
    [HttpDelete("{id:guid}")]
    [RequirePermission("inventory.warehouses.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new DeleteWarehouseCommand(id), ct));
}

public sealed record UpsertWarehouseRequest(
    string  Name,
    string? Code,
    string? Address,
    string? ContactPerson,
    string? Phone,
    bool    IsActive = true);
