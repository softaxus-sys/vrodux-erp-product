using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.Accounts.Commands;
using Softaxis.Finance.Application.Accounts.Queries;

namespace Softaxis.Finance.API.Controllers;

[Route("api/finance/accounts")]
[Authorize]
public sealed class AccountsController(ISender sender) : FinanceControllerBase
{
    // ── Queries ───────────────────────────────────────────────────────────────

    /// <summary>GET /api/finance/accounts/summary</summary>
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetAccountsSummaryQuery(), ct));

    /// <summary>GET /api/finance/accounts?search=&accountType=asset&isActive=true</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search      = null,
        [FromQuery] string? accountType = null,
        [FromQuery] bool?   isActive    = null,
        CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetAccountsQuery(search, accountType, isActive), ct));

    /// <summary>GET /api/finance/accounts/{id}</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetAccountByIdQuery(id), ct));

    // ── Commands ──────────────────────────────────────────────────────────────

    /// <summary>POST /api/finance/accounts</summary>
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateAccountCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetById),
            result.IsSuccess ? new { id = result.Value.Id } : null!);
    }

    /// <summary>PUT /api/finance/accounts/{id}</summary>
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateAccountRequest req,
        CancellationToken ct) =>
        NoContentOrError(await sender.Send(
            new UpdateAccountCommand(id, req.AccountNumber, req.Name,
                req.AccountTypeId, req.Description, req.ParentId, req.IsActive), ct));

    /// <summary>DELETE /api/finance/accounts/{id}</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteAccountCommand(id), ct));

    // ── Request body records ─────────────────────────────────────────────────

    /// <summary>
    /// Separate request record for PUT so the id comes from the route, not the body.
    /// </summary>
    public sealed record UpdateAccountRequest(
        string  AccountNumber,
        string  Name,
        Guid    AccountTypeId,
        string? Description = null,
        Guid?   ParentId    = null,
        bool    IsActive    = true);
}
