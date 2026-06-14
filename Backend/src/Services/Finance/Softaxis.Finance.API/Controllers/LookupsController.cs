using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.Lookups.Queries;

namespace Softaxis.Finance.API.Controllers;

/// <summary>Read-only master data used by Finance forms (account types, currencies).</summary>
[Route("api/finance/lookups")]
[Authorize]
public sealed class LookupsController(ISender sender) : FinanceControllerBase
{
    /// <summary>GET /api/finance/lookups/account-types</summary>
    [HttpGet("account-types")]
    public async Task<IActionResult> GetAccountTypes(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetAccountTypesQuery(), ct));

    /// <summary>GET /api/finance/lookups/currencies</summary>
    [HttpGet("currencies")]
    public async Task<IActionResult> GetCurrencies(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetCurrenciesQuery(), ct));
}
