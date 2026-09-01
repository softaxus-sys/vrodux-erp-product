using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Authorization;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.Customers.Commands;
using Softaxis.Finance.Application.Customers.Queries;

namespace Softaxis.Finance.API.Controllers;

[Route("api/finance/customers")]
[Authorize]
public sealed class CustomersController(ISender sender) : FinanceControllerBase
{
    // ── Queries ───────────────────────────────────────────────────────────────

    /// <summary>GET /api/finance/customers?search=&isActive=true</summary>
    [HttpGet]
    [RequirePermission("finance.invoicing.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search   = null,
        [FromQuery] bool?   isActive = null,
        CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetCustomersQuery(search, isActive), ct));

    /// <summary>GET /api/finance/customers/{id}</summary>
    [HttpGet("{id:guid}")]
    [RequirePermission("finance.invoicing.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetCustomerByIdQuery(id), ct));

    // ── Commands ──────────────────────────────────────────────────────────────

    /// <summary>POST /api/finance/customers</summary>
    [HttpPost]
    [RequirePermission("finance.invoicing.create")]
    public async Task<IActionResult> Create(
        [FromBody] CreateCustomerCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetById),
            result.IsSuccess ? new { id = result.Value.Id } : null!);
    }

    /// <summary>PUT /api/finance/customers/{id}</summary>
    [HttpPut("{id:guid}")]
    [RequirePermission("finance.invoicing.edit")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateCustomerRequest req,
        CancellationToken ct) =>
        NoContentOrError(await sender.Send(
            new UpdateCustomerCommand(id, req.Name, req.Email, req.Phone,
                req.Address, req.AccountId, req.CcEmails, req.IsActive), ct));

    /// <summary>DELETE /api/finance/customers/{id}</summary>
    [HttpDelete("{id:guid}")]
    [RequirePermission("finance.invoicing.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteCustomerCommand(id), ct));

    // ── Request body records ─────────────────────────────────────────────────

    public sealed record UpdateCustomerRequest(
        string  Name,
        string? Email     = null,
        string? Phone     = null,
        string? Address   = null,
        Guid?   AccountId = null,
        /// <summary>Their people to copy on invoices and receipts. Comma or semicolon separated.</summary>
        string? CcEmails  = null,
        bool    IsActive  = true);
}
