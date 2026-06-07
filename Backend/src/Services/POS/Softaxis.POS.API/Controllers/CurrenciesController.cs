using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.POS.Application.MasterData.Currencies.Commands;
using Softaxis.POS.Application.MasterData.Currencies.Queries;

namespace Softaxis.POS.API.Controllers;

[Authorize]
public sealed class CurrenciesController(ISender sender) : BaseApiController(sender)
{
    /// <summary>Get all active currencies.</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetCurrenciesQuery(), ct));

    /// <summary>Create (Id null) or update (Id set) a currency.</summary>
    [HttpPut]
    public async Task<IActionResult> Upsert(
        [FromBody] UpsertCurrencyCommand cmd, CancellationToken ct = default)
        => HandleResult(await Sender.Send(cmd, ct));

    /// <summary>Soft-delete a currency. System currencies cannot be deleted.</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new DeleteCurrencyCommand(id), ct));
}
