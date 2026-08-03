using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.POS.API.Authorization;
using Softaxis.POS.Application.PaymentGateway.Commands;
using Softaxis.POS.Application.PaymentGateway.Queries;

namespace Softaxis.POS.API.Controllers;

[Authorize]
public sealed class PaymentGatewayController(ISender sender) : BaseApiController(sender)
{
    /// <summary>GET /api/paymentgateway/catalog — the static provider catalog (manual + coming-soon list).</summary>
    [HttpGet("catalog")]
    public async Task<IActionResult> GetCatalog(CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetPaymentGatewayCatalogQuery(), ct));

    /// <summary>GET /api/paymentgateway — this tenant's configured gateway (defaults to "manual" if never configured).</summary>
    [HttpGet]
    [RequirePermission("pos.payment-gateway.view")]
    public async Task<IActionResult> GetConfig(CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetPaymentGatewayConfigQuery(), ct));

    /// <summary>PUT /api/paymentgateway — configure/select the tenant's payment gateway.</summary>
    [HttpPut]
    [RequirePermission("pos.payment-gateway.edit")]
    public async Task<IActionResult> UpsertConfig([FromBody] UpsertPaymentGatewayConfigCommand cmd, CancellationToken ct = default)
        => HandleResult(await Sender.Send(cmd, ct));
}
