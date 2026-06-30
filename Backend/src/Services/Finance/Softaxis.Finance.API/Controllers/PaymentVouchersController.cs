using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Authorization;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.PaymentVouchers.Commands;
using Softaxis.Finance.Application.PaymentVouchers.Dtos;
using Softaxis.Finance.Application.PaymentVouchers.Queries;

namespace Softaxis.Finance.API.Controllers;

[ApiController]
[Route("api/finance/payment-vouchers")]
[Authorize]
public sealed class PaymentVouchersController(ISender sender) : FinanceControllerBase
{
    [HttpGet]
    [RequirePermission("finance.expenses.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] int     page       = 1,
        [FromQuery] int     pageSize   = 20,
        [FromQuery] string? search     = null,
        [FromQuery] string? status     = null,
        [FromQuery] Guid?   supplierId = null,
        CancellationToken ct = default)
    {
        var result = await sender.Send(new GetPaymentVouchersQuery(page, pageSize, search, status, supplierId), ct);
        return OkOrError(result);
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("finance.expenses.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetPaymentVoucherByIdQuery(id), ct);
        return OkOrError(result);
    }

    [HttpPost]
    [RequirePermission("finance.expenses.create")]
    public async Task<IActionResult> Create([FromBody] CreatePaymentVoucherCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetById),
            result.IsSuccess ? new { id = result.Value.Id } : null!);
    }

    public sealed record UpdatePaymentVoucherRequest(
        string PaymentDate, decimal Amount, string? PaymentMethod, Guid? BankAccountId,
        string? Reference, string? Notes, IReadOnlyList<PaymentAllocationRequest> Allocations);

    [HttpPut("{id:guid}")]
    [RequirePermission("finance.expenses.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePaymentVoucherRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdatePaymentVoucherCommand(id, req.PaymentDate, req.Amount,
            req.PaymentMethod, req.BankAccountId, req.Reference, req.Notes, req.Allocations), ct);
        return NoContentOrError(result);
    }

    [HttpPost("{id:guid}/post")]
    [RequirePermission("finance.expenses.approve")]
    public async Task<IActionResult> Post(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new PostPaymentVoucherCommand(id), ct);
        return NoContentOrError(result);
    }

    [HttpPost("{id:guid}/void")]
    [RequirePermission("finance.expenses.approve")]
    public async Task<IActionResult> Void(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new VoidPaymentVoucherCommand(id), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission("finance.expenses.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeletePaymentVoucherCommand(id), ct);
        return NoContentOrError(result);
    }
}
