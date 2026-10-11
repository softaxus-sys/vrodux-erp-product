using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Trade.API.Authorization;
using Softaxis.Trade.API.Controllers.Common;
using Softaxis.Trade.Application.Parties;

namespace Softaxis.Trade.API.Controllers;

/// <summary>
/// Suppliers, buyers, forwarders, agents, carriers and banks. Reading them is open to anyone who
/// can work on shipments — the shipment form picks from this list — while changing them needs
/// <c>trade.parties.*</c>.
/// </summary>
[Route("api/trade/parties")][Authorize]
public sealed class PartiesController(ISender sender) : TradeControllerBase
{
    [HttpGet]
    [RequirePermission("trade.parties.view", "trade.shipments.view", "trade.shipments.create", "trade.shipments.edit")]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search, [FromQuery] string? kind, [FromQuery] bool activeOnly, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetPartiesQuery(search, kind, activeOnly), ct));

    [HttpPost]
    [RequirePermission("trade.parties.create")]
    public async Task<IActionResult> Create([FromBody] PartyInput party, CancellationToken ct) =>
        OkOrError(await sender.Send(new CreatePartyCommand(party), ct));

    [HttpPut("{id:guid}")]
    [RequirePermission("trade.parties.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] PartyInput party, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdatePartyCommand(id, party), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("trade.parties.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeletePartyCommand(id), ct));
}
