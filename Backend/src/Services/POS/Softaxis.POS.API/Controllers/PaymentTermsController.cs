using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.POS.Application.MasterData.PaymentTerms.Commands;
using Softaxis.POS.Application.MasterData.PaymentTerms.Queries;

namespace Softaxis.POS.API.Controllers;

[Authorize]
[Route("api/payment-terms")]
public sealed class PaymentTermsController(ISender sender) : BaseApiController(sender)
{
    /// <summary>Get all payment terms.</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetPaymentTermsQuery(), ct));

    /// <summary>Create (Id null) or update (Id set) a payment term.</summary>
    [HttpPut]
    public async Task<IActionResult> Upsert(
        [FromBody] UpsertPaymentTermCommand cmd, CancellationToken ct = default)
        => HandleResult(await Sender.Send(cmd, ct));

    /// <summary>Soft-delete a payment term. System terms cannot be deleted.</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new DeletePaymentTermCommand(id), ct));
}
