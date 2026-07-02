using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Authorization;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.PurchaseBills.Commands;
using Softaxis.Finance.Application.PurchaseBills.Dtos;
using Softaxis.Finance.Application.PurchaseBills.Queries;

namespace Softaxis.Finance.API.Controllers;

[ApiController]
[Route("api/finance/purchase-bills")]
[Authorize]
public sealed class PurchaseBillsController(ISender sender) : FinanceControllerBase
{
    [HttpGet("summary")]
    [RequirePermission("finance.expenses.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetPurchaseBillsSummaryQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet]
    [RequirePermission("finance.expenses.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] int     page        = 1,
        [FromQuery] int     pageSize    = 20,
        [FromQuery] string? search      = null,
        [FromQuery] string? status      = null,
        [FromQuery] Guid?   supplierId  = null,
        [FromQuery] bool?   outstanding = null,
        CancellationToken ct = default)
    {
        var result = await sender.Send(new GetPurchaseBillsQuery(page, pageSize, search, status, supplierId, outstanding), ct);
        return OkOrError(result);
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("finance.expenses.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetPurchaseBillByIdQuery(id), ct);
        return OkOrError(result);
    }

    [HttpPost]
    [RequirePermission("finance.expenses.create")]
    public async Task<IActionResult> Create([FromBody] CreatePurchaseBillCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetById),
            result.IsSuccess ? new { id = result.Value.Id } : null!);
    }

    public sealed record UpdatePurchaseBillRequest(
        string BillDate, string DueDate, decimal TaxRate, string? Reference, string? Notes,
        IReadOnlyList<PurchaseBillItemRequest> Items);

    [HttpPut("{id:guid}")]
    [RequirePermission("finance.expenses.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePurchaseBillRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdatePurchaseBillCommand(id, req.BillDate, req.DueDate,
            req.TaxRate, req.Reference, req.Notes, req.Items), ct);
        return NoContentOrError(result);
    }

    [HttpPost("{id:guid}/approve")]
    [RequirePermission("finance.expenses.approve")]
    public async Task<IActionResult> Approve(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new ApprovePurchaseBillCommand(id), ct);
        return NoContentOrError(result);
    }

    [HttpPost("{id:guid}/cancel")]
    [RequirePermission("finance.expenses.edit")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new CancelPurchaseBillCommand(id), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission("finance.expenses.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeletePurchaseBillCommand(id), ct);
        return NoContentOrError(result);
    }
}
