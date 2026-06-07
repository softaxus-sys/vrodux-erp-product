using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Inventory.Application.Brands.Commands.CreateBrand;
using Softaxis.Inventory.Application.Brands.Commands.DeleteBrand;
using Softaxis.Inventory.Application.Brands.Commands.UpdateBrand;
using Softaxis.Inventory.Application.Brands.Queries.GetBrandById;
using Softaxis.Inventory.Application.Brands.Queries.GetBrands;

namespace Softaxis.Inventory.API.Controllers;

/// <summary>Product brands — master data managed by admins.</summary>
[Authorize]
[Tags("Brands")]
[Route("api/inventory/brands")]
public sealed class BrandsController(ISender sender) : BaseApiController(sender)
{
    // ── GET /api/inventory/brands ─────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search   = null,
        [FromQuery] bool?   isActive = null,
        CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetBrandsQuery(search, isActive), ct));

    // ── GET /api/inventory/brands/{id} ────────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new GetBrandByIdQuery(id), ct));

    // ── POST /api/inventory/brands ────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateBrandRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(
            new CreateBrandCommand(req.Name, req.Code, req.Description, req.LogoUrl), ct), 201);

    // ── PUT /api/inventory/brands/{id} ────────────────────────────────────────
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateBrandRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(
            new UpdateBrandCommand(id, req.Name, req.Code, req.Description, req.LogoUrl, req.IsActive), ct));

    // ── DELETE /api/inventory/brands/{id} ─────────────────────────────────────
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new DeleteBrandCommand(id), ct));
}

public sealed record CreateBrandRequest(
    string  Name,
    string? Code,
    string? Description,
    string? LogoUrl);

public sealed record UpdateBrandRequest(
    string  Name,
    string? Code,
    string? Description,
    string? LogoUrl,
    bool    IsActive);
