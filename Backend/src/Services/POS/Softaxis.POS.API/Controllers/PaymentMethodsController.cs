using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.POS.API.Authorization;
using Softaxis.POS.Application.PaymentMethods.Commands.DeletePaymentMethod;
using Softaxis.POS.Application.PaymentMethods.Commands.SavePaymentMethods;
using Softaxis.POS.Application.PaymentMethods.Queries.GetPaymentMethods;

namespace Softaxis.POS.API.Controllers;

[Authorize]
[Route("api/payment-methods")]
public sealed class PaymentMethodsController(ISender sender) : BaseApiController(sender)
{
    /// <summary>Get all payment methods (system + custom, ordered by SortOrder).</summary>
    // Read left open: feeds the sale screen / customer form for operators who hold no POS configuration key.
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetPaymentMethodsQuery(), ct));

    /// <summary>Bulk-save payment method configuration (enable/disable, reorder, add custom).</summary>
    [RequirePermission("pos.sessions.approve")]
    [HttpPut]
    public async Task<IActionResult> Save(
        [FromBody] SavePaymentMethodsCommand cmd, CancellationToken ct = default)
        => HandleResult(await Sender.Send(cmd, ct));

    /// <summary>Delete a custom payment method by ID. System methods cannot be deleted.</summary>
    [RequirePermission("pos.sessions.approve")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new DeletePaymentMethodCommand(id), ct));
}
