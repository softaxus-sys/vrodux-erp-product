using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.AccountTypes.Commands;
using Softaxis.Finance.Application.Lookups.Queries;

namespace Softaxis.Finance.API.Controllers;

/// <summary>Manage the Chart of Accounts type/subtype hierarchy (custom types, reordering).</summary>
[Route("api/finance/account-types")]
[Authorize]
public sealed class AccountTypesController(ISender sender) : FinanceControllerBase
{
    /// <summary>GET /api/finance/account-types</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetAccountTypesQuery(), ct));

    /// <summary>POST /api/finance/account-types</summary>
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateAccountTypeCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetAll), new { });
    }

    /// <summary>PUT /api/finance/account-types/{id}</summary>
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateAccountTypeRequest req,
        CancellationToken ct) =>
        OkOrError(await sender.Send(
            new UpdateAccountTypeCommand(id, req.Name, req.NormalBalance, req.IsActive), ct));

    /// <summary>DELETE /api/finance/account-types/{id}</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteAccountTypeCommand(id), ct));

    /// <summary>POST /api/finance/account-types/reorder</summary>
    [HttpPost("reorder")]
    public async Task<IActionResult> Reorder(
        [FromBody] ReorderAccountTypesCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    /// <summary>
    /// Separate request record for PUT so the id comes from the route, not the body.
    /// </summary>
    public sealed record UpdateAccountTypeRequest(
        string  Name,
        string? NormalBalance = null,
        bool    IsActive      = true);
}
