using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Inventory.Application.Categories.Commands.CreateCategory;
using Softaxis.Inventory.Application.Categories.Commands.DeleteCategory;
using Softaxis.Inventory.Application.Categories.Commands.UpdateCategory;
using Softaxis.Inventory.Application.Categories.Queries.GetCategories;
using Softaxis.Inventory.Application.Categories.Queries.GetCategoryById;
using Softaxis.Inventory.API.Authorization;

namespace Softaxis.Inventory.API.Controllers;

/// <summary>
/// Product category management. GET reads feed the product-create form's category dropdown, so they stay
/// authenticated-only; writes are gated on inventory.stock.* (no dedicated categories permission key).
/// </summary>
[Authorize]
[Tags("Categories")]
[Route("api/inventory/categories")]
public sealed class ProductCategoriesController(ISender sender) : BaseApiController(sender)
{
    // ── GET /api/inventory/categories ───────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] bool?   isActive,
        CancellationToken ct)
        => HandleResult(await Sender.Send(new GetCategoriesQuery(search, isActive), ct));

    // ── GET /api/inventory/categories/{id} ──────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new GetCategoryByIdQuery(id), ct));

    // ── POST /api/inventory/categories ──────────────────────────────────────
    [HttpPost]
    [RequirePermission("inventory.stock.create")]
    public async Task<IActionResult> Create([FromBody] UpsertCategoryRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(
            new CreateCategoryCommand(req.Name, req.Code, req.Description, req.ParentId, req.IsActive), ct), 201);

    // ── PUT /api/inventory/categories/{id} ──────────────────────────────────
    [HttpPut("{id:guid}")]
    [RequirePermission("inventory.stock.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertCategoryRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(
            new UpdateCategoryCommand(id, req.Name, req.Code, req.Description, req.ParentId, req.IsActive), ct));

    // ── DELETE /api/inventory/categories/{id} ───────────────────────────────
    [HttpDelete("{id:guid}")]
    [RequirePermission("inventory.stock.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new DeleteCategoryCommand(id), ct));
}

public sealed record UpsertCategoryRequest(
    string  Name,
    string? Code,
    string? Description,
    string? ParentId,
    bool    IsActive = true);
