using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.POS.Application.MasterData.Vouchers.Commands;
using Softaxis.POS.Application.MasterData.Vouchers.Queries;
// RedeemVoucherCommand lives in the Commands namespace above

namespace Softaxis.POS.API.Controllers;

[Authorize]
[Route("api/vouchers")]
public sealed class VouchersController(ISender sender) : BaseApiController(sender)
{
    /// <summary>Get all vouchers.</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetVouchersQuery(), ct));

    /// <summary>Create (Id null) or update (Id set) a voucher.</summary>
    [HttpPut]
    public async Task<IActionResult> Upsert(
        [FromBody] UpsertVoucherCommand cmd, CancellationToken ct = default)
        => HandleResult(await Sender.Send(cmd, ct));

    /// <summary>Soft-delete a voucher.</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new DeleteVoucherCommand(id), ct));

    /// <summary>Validate a voucher code against a cart subtotal (preview — does not consume).</summary>
    [HttpPost("validate")]
    public async Task<IActionResult> Validate(
        [FromBody] ValidateVoucherRequest req, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new ValidateVoucherQuery(req.Code, req.Subtotal), ct));

    /// <summary>Validate AND consume a voucher (increments usage). Used by external POS flows.</summary>
    [HttpPost("redeem")]
    public async Task<IActionResult> Redeem(
        [FromBody] ValidateVoucherRequest req, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new RedeemVoucherCommand(req.Code, req.Subtotal), ct));
}

public sealed record ValidateVoucherRequest(string Code, decimal Subtotal);
