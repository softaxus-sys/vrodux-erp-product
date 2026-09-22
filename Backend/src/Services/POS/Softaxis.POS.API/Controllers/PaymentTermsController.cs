using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.POS.API.Authorization;
using Softaxis.POS.Application.MasterData.PaymentTerms.Commands;
using Softaxis.POS.Application.MasterData.PaymentTerms.Queries;

namespace Softaxis.POS.API.Controllers;

[Authorize]
[Route("api/payment-terms")]
public sealed class PaymentTermsController(ISender sender) : BaseApiController(sender)
{
    /// <summary>Get all payment terms.</summary>
    // Read left open: feeds the sale screen / customer form for operators who hold no POS configuration key.
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetPaymentTermsQuery(), ct));

    /// <summary>Create (Id null) or update (Id set) a payment term.</summary>
    [RequirePermission("pos.sessions.approve")]
    [HttpPut]
    public async Task<IActionResult> Upsert(
        [FromBody] UpsertPaymentTermCommand cmd, CancellationToken ct = default)
        => HandleResult(await Sender.Send(cmd, ct));

    /// <summary>Soft-delete a payment term. System terms cannot be deleted.</summary>
    [RequirePermission("pos.sessions.approve")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new DeletePaymentTermCommand(id), ct));
}
