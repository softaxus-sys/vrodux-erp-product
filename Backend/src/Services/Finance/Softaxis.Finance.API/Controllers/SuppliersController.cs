using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.Suppliers.Commands;
using Softaxis.Finance.Application.Suppliers.Queries;

namespace Softaxis.Finance.API.Controllers;

[Route("api/finance/suppliers")]
[Authorize]
public sealed class SuppliersController(ISender sender) : FinanceControllerBase
{
    // ── Queries ───────────────────────────────────────────────────────────────

    /// <summary>GET /api/finance/suppliers?search=&isActive=true</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search   = null,
        [FromQuery] bool?   isActive = null,
        CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetSuppliersQuery(search, isActive), ct));

    /// <summary>GET /api/finance/suppliers/{id}</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetSupplierByIdQuery(id), ct));

    // ── Commands ──────────────────────────────────────────────────────────────

    /// <summary>POST /api/finance/suppliers</summary>
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateSupplierCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetById),
            result.IsSuccess ? new { id = result.Value.Id } : null!);
    }

    /// <summary>PUT /api/finance/suppliers/{id}</summary>
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateSupplierRequest req,
        CancellationToken ct) =>
        NoContentOrError(await sender.Send(
            new UpdateSupplierCommand(id, req.Name, req.Email, req.Phone,
                req.Address, req.AccountId, req.IsActive), ct));

    /// <summary>DELETE /api/finance/suppliers/{id}</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteSupplierCommand(id), ct));

    // ── Request body records ─────────────────────────────────────────────────

    public sealed record UpdateSupplierRequest(
        string  Name,
        string? Email     = null,
        string? Phone     = null,
        string? Address   = null,
        Guid?   AccountId = null,
        bool    IsActive  = true);
}
