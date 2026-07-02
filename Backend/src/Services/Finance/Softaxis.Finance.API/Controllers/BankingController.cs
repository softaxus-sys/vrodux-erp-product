using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Authorization;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.Banking.Commands;
using Softaxis.Finance.Application.Banking.Queries;

namespace Softaxis.Finance.API.Controllers;

[ApiController]
[Route("api/finance/banking")]
[Authorize]
public sealed class BankingController(ISender sender) : FinanceControllerBase
{
    [HttpGet("summary")]
    [RequirePermission("finance.banking.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetBankingSummaryQuery(), ct));

    [HttpGet("accounts")]
    [RequirePermission("finance.banking.view")]
    public async Task<IActionResult> GetAccounts(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetBankAccountsQuery(), ct));

    [HttpGet("transactions")]
    [RequirePermission("finance.banking.view")]
    public async Task<IActionResult> GetTransactions(
        [FromQuery] Guid? accountId = null,
        [FromQuery] string? type = null,
        CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetBankTransactionsQuery(accountId, type), ct));

    [HttpPost("accounts")]
    [RequirePermission("finance.banking.create")]
    public async Task<IActionResult> CreateAccount([FromBody] CreateBankAccountCommand cmd, CancellationToken ct) =>
        CreatedAtUrlOrError(await sender.Send(cmd, ct),
            id => $"/api/finance/banking/accounts/{id}",
            id => new { Id = id });

    /// <summary>
    /// Records a manual bank transaction (inflow / outflow / transfer).
    /// For transfers, pass ToAccountId — two transactions are created and both balances updated.
    /// </summary>
    [HttpPost("transactions")]
    [RequirePermission("finance.banking.create")]
    public async Task<IActionResult> CreateTransaction([FromBody] CreateBankTransactionCommand cmd, CancellationToken ct) =>
        CreatedAtUrlOrError(await sender.Send(cmd, ct),
            id => $"/api/finance/banking/transactions/{id}",
            id => new { Id = id });

    [HttpPost("transactions/{id:guid}/reconcile")]
    [RequirePermission("finance.banking.edit")]
    public async Task<IActionResult> Reconcile(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new ReconcileBankTransactionCommand(id), ct));
}
