using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Authorization;
using Softaxis.Finance.API.Controllers.Common;
using System.Security.Claims;
using Softaxis.Finance.Application.Banking.Commands;
using Softaxis.Finance.Application.Banking.Reconciliation;
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
        [FromQuery] string? search = null,
        [FromQuery] bool? reconciled = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 30,
        CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetBankTransactionsQuery(accountId, type, search, reconciled, page, pageSize), ct));

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

    private string? UserName =>
        User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("name") ?? User.FindFirstValue(ClaimTypes.Email);

    // Bank reconciliation: statement lines against the ledger lines on the bank's own account.

    [HttpGet("accounts/{id:guid}/reconciliation")]
    [RequirePermission("finance.banking.view")]
    public async Task<IActionResult> GetReconciliation(Guid id, [FromQuery] int windowDays = 5, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetReconciliationQuery(id, windowDays), ct));

    public sealed record LedgerAccountRequest(Guid? LedgerAccountId);

    [HttpPut("accounts/{id:guid}/ledger-account")]
    [RequirePermission("finance.banking.edit")]
    public async Task<IActionResult> SetLedgerAccount(Guid id, [FromBody] LedgerAccountRequest req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new SetBankLedgerAccountCommand(id, req.LedgerAccountId), ct));

    public sealed record MatchRequest(Guid JournalLineId);

    [HttpPost("transactions/{id:guid}/match")]
    [RequirePermission("finance.banking.edit")]
    public async Task<IActionResult> Match(Guid id, [FromBody] MatchRequest req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new MatchBankTransactionCommand(id, req.JournalLineId, UserName), ct));

    [HttpPost("transactions/{id:guid}/unmatch")]
    [RequirePermission("finance.banking.edit")]
    public async Task<IActionResult> Unmatch(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new UnmatchBankTransactionCommand(id), ct));

    [HttpPost("accounts/{id:guid}/auto-match")]
    [RequirePermission("finance.banking.edit")]
    public async Task<IActionResult> AutoMatch(Guid id, [FromQuery] int windowDays = 5, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new AutoMatchBankTransactionsCommand(id, windowDays, UserName), ct));
}
