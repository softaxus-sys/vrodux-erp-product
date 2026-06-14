using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.ExchangeRates.Commands;
using Softaxis.Finance.Application.ExchangeRates.Queries;

namespace Softaxis.Finance.API.Controllers;

[ApiController]
[Route("api/finance/exchange-rates")]
[Authorize]
public sealed class ExchangeRatesController(ISender sender) : FinanceControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? currencyCode, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetExchangeRatesQuery(currencyCode), ct));

    [HttpGet("convert")]
    public async Task<IActionResult> Convert(
        [FromQuery] string from, [FromQuery] string to, [FromQuery] decimal amount, [FromQuery] string? asOf, CancellationToken ct) =>
        OkOrError(await sender.Send(new ConvertCurrencyQuery(from, to, amount, asOf), ct));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateExchangeRateCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetAll), null!);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateExchangeRateRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateExchangeRateCommand(id, req.Rate), ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteExchangeRateCommand(id), ct));

    public sealed record UpdateExchangeRateRequest(decimal Rate);
}
