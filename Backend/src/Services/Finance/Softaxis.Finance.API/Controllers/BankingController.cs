using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.API.Controllers;

[ApiController]
[Route("api/finance/banking")]
[Authorize]
public sealed class BankingController(FinanceDbContext db) : ControllerBase
{
    public record BankAccountDto(
        Guid      Id,
        string    AccountName,
        string    BankName,
        string    AccountNumber,
        string    Iban,
        string    Currency,
        decimal   Balance,
        decimal   AvailableBalance,
        string    Status,
        string    AccountType,
        string    LastSynced);

    public record BankTxDto(
        Guid    Id,
        Guid    AccountId,
        string  Date,
        string  Description,
        string  Reference,
        decimal Amount,
        string  Type,
        string  Category,
        bool    Reconciled,
        decimal Balance);

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var accounts = await db.BankAccounts.AsNoTracking()
            .Where(x => !x.IsDeleted && x.Status == "active")
            .Select(x => new { x.Balance }).ToListAsync(ct);

        var now = DateTime.UtcNow;
        var monthStart = $"{now:yyyy-MM-01}";

        var txStats = await db.BankTransactions.AsNoTracking()
            .Where(x => string.Compare(x.Date, monthStart) >= 0)
            .GroupBy(x => x.Type)
            .Select(g => new { Type = g.Key, Total = g.Sum(t => t.Amount) })
            .ToListAsync(ct);

        var unreconciled = await db.BankTransactions.AsNoTracking()
            .Where(x => !x.Reconciled).CountAsync(ct);

        return Ok(new
        {
            totalBalance          = accounts.Sum(a => a.Balance),
            totalAccounts         = accounts.Count,
            totalCreditThisMonth  = txStats.FirstOrDefault(t => t.Type == "credit")?.Total ?? 0m,
            totalDebitThisMonth   = txStats.FirstOrDefault(t => t.Type == "debit")?.Total ?? 0m,
            unreconciled,
        });
    }

    [HttpGet("accounts")]
    public async Task<IActionResult> GetAccounts(CancellationToken ct)
    {
        var items = await db.BankAccounts.AsNoTracking()
            .Where(x => !x.IsDeleted)
            .OrderBy(x => x.AccountName)
            .Select(x => new BankAccountDto(
                x.Id, x.AccountName, x.BankName, x.AccountNumber, x.Iban,
                x.Currency, x.Balance, x.AvailableBalance, x.Status, x.AccountType,
                x.LastSynced.ToString("yyyy-MM-ddTHH:mm:ssZ")))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpGet("transactions")]
    public async Task<IActionResult> GetTransactions(
        [FromQuery] Guid?   accountId = null,
        [FromQuery] string? type      = null,
        CancellationToken ct = default)
    {
        IQueryable<BankTransaction> query = db.BankTransactions.AsNoTracking();

        if (accountId.HasValue) query = query.Where(x => x.AccountId == accountId.Value);
        if (!string.IsNullOrWhiteSpace(type)) query = query.Where(x => x.Type == type);

        var items = await query
            .OrderByDescending(x => x.Date)
            .Select(x => new BankTxDto(
                x.Id, x.AccountId, x.Date, x.Description, x.Reference,
                x.Amount, x.Type, x.Category, x.Reconciled, x.Balance))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpPost("accounts")]
    public async Task<IActionResult> CreateAccount([FromBody] CreateBankAccountRequest req, CancellationToken ct)
    {
        var acc = new BankAccount(req.AccountName, req.BankName, req.AccountNumber,
            req.Iban, req.Currency, req.AccountType);
        db.BankAccounts.Add(acc);
        await db.SaveChangesAsync(ct);
        return Created($"/api/finance/banking/accounts/{acc.Id}", new { acc.Id });
    }

    /// <summary>
    /// Records a manual bank transaction (inflow / outflow / transfer).
    /// For transfers, pass ToAccountId — two transactions are created and both balances updated.
    /// </summary>
    [HttpPost("transactions")]
    public async Task<IActionResult> CreateTransaction(
        [FromBody] CreateTransactionRequest req, CancellationToken ct)
    {
        var account = await db.BankAccounts.FindAsync([req.AccountId], ct);
        if (account is null)
            return NotFound(new { error = "Bank account not found." });

        var type = req.Type.ToLowerInvariant(); // "credit" | "debit"
        if (type is not "credit" and not "debit")
            return BadRequest(new { error = "Type must be 'credit' or 'debit'." });

        // Update source account balance
        var newBalance    = type == "credit" ? account.Balance + req.Amount : account.Balance - req.Amount;
        var newAvailable  = type == "credit" ? account.AvailableBalance + req.Amount : account.AvailableBalance - req.Amount;
        account.UpdateBalance(newBalance, newAvailable);

        var txn = new BankTransaction(
            req.AccountId, req.Date,
            req.Description, req.Reference ?? "",
            req.Amount, type, req.Category);
        txn.SetBalance(newBalance);
        db.BankTransactions.Add(txn);

        // Transfer: create mirrored credit on destination account
        if (req.ToAccountId.HasValue && type == "debit")
        {
            var toAccount = await db.BankAccounts.FindAsync([req.ToAccountId.Value], ct);
            if (toAccount is null)
                return NotFound(new { error = "Destination bank account not found." });

            var toBalance   = toAccount.Balance + req.Amount;
            var toAvailable = toAccount.AvailableBalance + req.Amount;
            toAccount.UpdateBalance(toBalance, toAvailable);

            var toTxn = new BankTransaction(
                req.ToAccountId.Value, req.Date,
                $"Transfer from {account.AccountName}: {req.Description}",
                req.Reference ?? "",
                req.Amount, "credit", req.Category);
            toTxn.SetBalance(toBalance);
            db.BankTransactions.Add(toTxn);
        }

        await db.SaveChangesAsync(ct);
        return Created($"/api/finance/banking/transactions/{txn.Id}", new { txn.Id });
    }

    [HttpPost("transactions/{id:guid}/reconcile")]
    public async Task<IActionResult> Reconcile(Guid id, CancellationToken ct)
    {
        var txn = await db.BankTransactions.FindAsync([id], ct);
        if (txn is null) return NotFound();
        txn.Reconcile();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    public record CreateBankAccountRequest(
        string AccountName, string BankName, string AccountNumber,
        string Iban, string Currency, string AccountType);

    public record CreateTransactionRequest(
        Guid    AccountId,
        string  Date,
        string  Description,
        string  Type,
        string  Category,
        decimal Amount,
        string? Reference    = null,
        Guid?   ToAccountId  = null);
}
