using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.POS.Application.MasterData.TaxRates.Commands;
using Softaxis.POS.Application.MasterData.TaxRates.Queries;

namespace Softaxis.POS.API.Controllers;

[Authorize]
[Route("api/tax-rates")]
public sealed class TaxRatesController(ISender sender) : BaseApiController(sender)
{
    /// <summary>Get all tax rates.</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetTaxRatesQuery(), ct));

    /// <summary>Create (Id null) or update (Id set) a tax rate.</summary>
    [HttpPut]
    public async Task<IActionResult> Upsert(
        [FromBody] UpsertTaxRateCommand cmd, CancellationToken ct = default)
        => HandleResult(await Sender.Send(cmd, ct));

    /// <summary>Soft-delete a tax rate. System rates cannot be deleted.</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new DeleteTaxRateCommand(id), ct));
}
