using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.ReceiptVouchers.Commands;
using Softaxis.Finance.Application.ReceiptVouchers.Dtos;
using Softaxis.Finance.Application.ReceiptVouchers.Queries;

namespace Softaxis.Finance.API.Controllers;

[ApiController]
[Route("api/finance/receipt-vouchers")]
[Authorize]
public sealed class ReceiptVouchersController(ISender sender) : FinanceControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int     page       = 1,
        [FromQuery] int     pageSize   = 20,
        [FromQuery] string? search     = null,
        [FromQuery] string? status     = null,
        [FromQuery] Guid?   customerId = null,
        CancellationToken ct = default)
    {
        var result = await sender.Send(new GetReceiptVouchersQuery(page, pageSize, search, status, customerId), ct);
        return OkOrError(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetReceiptVoucherByIdQuery(id), ct);
        return OkOrError(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateReceiptVoucherCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetById),
            result.IsSuccess ? new { id = result.Value.Id } : null!);
    }

    public sealed record UpdateReceiptVoucherRequest(
        string ReceiptDate, decimal Amount, string? ReceiptMethod, Guid? BankAccountId,
        string? Reference, string? Notes, IReadOnlyList<ReceiptAllocationRequest> Allocations);

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateReceiptVoucherRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateReceiptVoucherCommand(id, req.ReceiptDate, req.Amount,
            req.ReceiptMethod, req.BankAccountId, req.Reference, req.Notes, req.Allocations), ct);
        return NoContentOrError(result);
    }

    [HttpPost("{id:guid}/post")]
    public async Task<IActionResult> Post(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new PostReceiptVoucherCommand(id), ct);
        return NoContentOrError(result);
    }

    [HttpPost("{id:guid}/void")]
    public async Task<IActionResult> Void(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new VoidReceiptVoucherCommand(id), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteReceiptVoucherCommand(id), ct);
        return NoContentOrError(result);
    }
}
