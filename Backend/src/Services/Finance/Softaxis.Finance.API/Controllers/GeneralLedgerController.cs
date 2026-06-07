using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.API.Controllers;

[ApiController]
[Route("api/finance/gl")]
[Authorize]
public sealed class GeneralLedgerController(FinanceDbContext db) : ControllerBase
{
    public record TrialBalanceLine(
        string  AccountCode,
        string  AccountName,
        string  AccountType,
        decimal OpeningBalance,
        decimal TotalDebits,
        decimal TotalCredits,
        decimal ClosingBalance);

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var accounts = await db.Accounts.AsNoTracking()
            .Where(x => !x.IsDeleted).CountAsync(ct);

        var lines = await db.JournalLines.AsNoTracking()
            .Where(l => l.JournalEntry!.Status == "posted")
            .Select(l => new { l.DebitAmount, l.CreditAmount })
            .ToListAsync(ct);

        var totalDebits  = lines.Sum(l => l.DebitAmount);
        var totalCredits = lines.Sum(l => l.CreditAmount);

        return Ok(new
        {
            totalDebits,
            totalCredits,
            isBalanced    = Math.Abs(totalDebits - totalCredits) < 0.01m,
            periods       = new[] { "2026-01", "2026-02", "2026-03", "2026-04", "2026-05" },
            accounts,
            currentPeriod = $"{DateTime.UtcNow:yyyy-MM}",
        });
    }

    [HttpGet("trial-balance")]
    public async Task<IActionResult> GetTrialBalance(CancellationToken ct)
    {
        var accounts = await db.Accounts.AsNoTracking()
            .Where(x => !x.IsDeleted && x.IsActive)
            .OrderBy(x => x.AccountNumber)
            .ToListAsync(ct);

        var lines = await db.JournalLines.AsNoTracking()
            .Where(l => l.JournalEntry!.Status == "posted")   // only posted entries affect the ledger
            .GroupBy(l => l.AccountId)
            .Select(g => new
            {
                AccountId    = g.Key,
                TotalDebits  = g.Sum(l => l.DebitAmount),
                TotalCredits = g.Sum(l => l.CreditAmount),
            })
            .ToListAsync(ct);

        var result = accounts.Select(a =>
        {
            var line   = lines.FirstOrDefault(l => l.AccountId == a.Id);
            var debits  = line?.TotalDebits  ?? 0m;
            var credits = line?.TotalCredits ?? 0m;
            return new TrialBalanceLine(
                a.AccountNumber, a.Name, a.AccountType,
                a.Balance,
                debits, credits,
                a.Balance + debits - credits);
        }).ToList();

        return Ok(result);
    }

    // ── Financial statements ──────────────────────────────────────────────────

    public record StatementLine(string AccountCode, string AccountName, decimal Amount);

    private sealed class PostedLine
    {
        public Guid    AccountId { get; set; }
        public decimal Debit     { get; set; }
        public decimal Credit    { get; set; }
        public string  Date      { get; set; } = "";
    }

    private async Task<(List<Softaxis.Finance.Domain.Entities.Account> accounts, List<PostedLine> lines)> LoadPostedAsync(CancellationToken ct)
    {
        var accounts = await db.Accounts.AsNoTracking()
            .Where(x => !x.IsDeleted).OrderBy(x => x.AccountNumber).ToListAsync(ct);

        var lines = await db.JournalLines.AsNoTracking()
            .Where(l => l.JournalEntry!.Status == "posted")
            .Select(l => new PostedLine
            {
                AccountId = l.AccountId,
                Debit     = l.DebitAmount,
                Credit    = l.CreditAmount,
                Date      = l.JournalEntry!.Date,
            })
            .ToListAsync(ct);

        return (accounts, lines);
    }

    // GET /api/finance/gl/profit-loss?from=yyyy-MM-dd&to=yyyy-MM-dd
    [HttpGet("profit-loss")]
    public async Task<IActionResult> GetProfitLoss([FromQuery] string? from, [FromQuery] string? to, CancellationToken ct)
    {
        var f = from ?? $"{DateTime.UtcNow.Year}-01-01";
        var t = to   ?? DateTime.UtcNow.ToString("yyyy-MM-dd");
        var (accounts, lines) = await LoadPostedAsync(ct);
        var inPeriod = lines.Where(l => string.CompareOrdinal(l.Date, f) >= 0 && string.CompareOrdinal(l.Date, t) <= 0).ToList();

        StatementLine? Line(Softaxis.Finance.Domain.Entities.Account a, bool creditNormal)
        {
            var ls = inPeriod.Where(l => l.AccountId == a.Id);
            var amount = creditNormal ? ls.Sum(l => l.Credit - l.Debit) : ls.Sum(l => l.Debit - l.Credit);
            return amount == 0 ? null : new StatementLine(a.AccountNumber, a.Name, Math.Round(amount, 2));
        }

        var revenue  = accounts.Where(a => a.AccountType == "income").Select(a => Line(a, true)).Where(x => x != null).Cast<StatementLine>().ToList();
        var expenses = accounts.Where(a => a.AccountType == "expense").Select(a => Line(a, false)).Where(x => x != null).Cast<StatementLine>().ToList();
        var totalRevenue  = revenue.Sum(x => x.Amount);
        var totalExpenses = expenses.Sum(x => x.Amount);

        return Ok(new
        {
            from = f, to = t,
            revenue, totalRevenue,
            expenses, totalExpenses,
            netProfit = Math.Round(totalRevenue - totalExpenses, 2),
        });
    }

    // GET /api/finance/gl/balance-sheet?asOf=yyyy-MM-dd
    [HttpGet("balance-sheet")]
    public async Task<IActionResult> GetBalanceSheet([FromQuery] string? asOf, CancellationToken ct)
    {
        var d = asOf ?? DateTime.UtcNow.ToString("yyyy-MM-dd");
        var (accounts, lines) = await LoadPostedAsync(ct);
        var upto = lines.Where(l => string.CompareOrdinal(l.Date, d) <= 0).ToList();

        decimal Movement(Guid id, bool debitNormal)
        {
            var ls = upto.Where(l => l.AccountId == id);
            return debitNormal ? ls.Sum(l => l.Debit - l.Credit) : ls.Sum(l => l.Credit - l.Debit);
        }

        StatementLine? Line(Softaxis.Finance.Domain.Entities.Account a, bool debitNormal)
        {
            var amount = a.Balance + Movement(a.Id, debitNormal);
            return amount == 0 ? null : new StatementLine(a.AccountNumber, a.Name, Math.Round(amount, 2));
        }

        var assets      = accounts.Where(a => a.AccountType == "asset").Select(a => Line(a, true)).Where(x => x != null).Cast<StatementLine>().ToList();
        var liabilities = accounts.Where(a => a.AccountType == "liability").Select(a => Line(a, false)).Where(x => x != null).Cast<StatementLine>().ToList();
        var equity      = accounts.Where(a => a.AccountType == "equity").Select(a => Line(a, false)).Where(x => x != null).Cast<StatementLine>().ToList();

        var retained = accounts.Where(a => a.AccountType == "income").Sum(a => Movement(a.Id, false))
                     - accounts.Where(a => a.AccountType == "expense").Sum(a => Movement(a.Id, true));
        retained = Math.Round(retained, 2);

        var totalAssets = assets.Sum(x => x.Amount);
        var totalLiab   = liabilities.Sum(x => x.Amount);
        var totalEquity = equity.Sum(x => x.Amount) + retained;
        var totalLiabEq = totalLiab + totalEquity;

        return Ok(new
        {
            asOf = d,
            assets, totalAssets,
            liabilities, totalLiabilities = totalLiab,
            equity, retainedEarnings = retained, totalEquity,
            totalLiabilitiesAndEquity = totalLiabEq,
            isBalanced = Math.Abs(totalAssets - totalLiabEq) < 0.01m,
        });
    }

    // GET /api/finance/gl/cash-flow?from=yyyy-MM-dd&to=yyyy-MM-dd  (direct method over cash/bank accounts)
    [HttpGet("cash-flow")]
    public async Task<IActionResult> GetCashFlow([FromQuery] string? from, [FromQuery] string? to, CancellationToken ct)
    {
        var f = from ?? $"{DateTime.UtcNow.Year}-01-01";
        var t = to   ?? DateTime.UtcNow.ToString("yyyy-MM-dd");
        var (accounts, lines) = await LoadPostedAsync(ct);

        var cashAccts = accounts.Where(a => a.AccountType == "asset"
            && (a.Name.Contains("cash", StringComparison.OrdinalIgnoreCase)
             || a.Name.Contains("bank", StringComparison.OrdinalIgnoreCase))).ToList();
        var cashIds = cashAccts.Select(a => a.Id).ToHashSet();

        var before   = lines.Where(l => cashIds.Contains(l.AccountId) && string.CompareOrdinal(l.Date, f) < 0);
        var inPeriod = lines.Where(l => cashIds.Contains(l.AccountId)
            && string.CompareOrdinal(l.Date, f) >= 0 && string.CompareOrdinal(l.Date, t) <= 0).ToList();

        var opening  = cashAccts.Sum(a => a.Balance) + before.Sum(l => l.Debit - l.Credit);
        var inflows  = inPeriod.Sum(l => l.Debit);
        var outflows = inPeriod.Sum(l => l.Credit);
        var net      = inflows - outflows;

        return Ok(new
        {
            from = f, to = t,
            openingCash = Math.Round(opening, 2),
            inflows     = Math.Round(inflows, 2),
            outflows    = Math.Round(outflows, 2),
            netCashFlow = Math.Round(net, 2),
            closingCash = Math.Round(opening + net, 2),
        });
    }
}
