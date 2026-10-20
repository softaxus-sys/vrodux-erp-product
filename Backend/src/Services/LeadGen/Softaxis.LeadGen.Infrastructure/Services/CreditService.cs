using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.LeadGen.Application.Abstractions;
using Softaxis.LeadGen.Domain.Entities;
using Softaxis.LeadGen.Infrastructure.Persistence;

namespace Softaxis.LeadGen.Infrastructure.Services;

public sealed record SpendResult(bool Ok, long Balance, bool AlreadyDone = false);

/// <summary>
/// The only code that changes a credit balance.
///
/// A balance is moved by one guarded SQL statement — <c>UPDATE … SET Balance = Balance - n WHERE
/// Balance &gt;= n</c> — never by reading it, subtracting in memory and saving. Two people revealing
/// at the same moment therefore cannot both spend the last credit: the second statement matches no
/// row and is refused. Every movement also writes a ledger row under an idempotency key, so a retried
/// request, a repeated webhook or a restarted job posts once and only once.
/// </summary>
public interface ICreditService
{
    Task<CreditWallet> EnsureWalletAsync(CancellationToken ct);
    Task<long> BalanceAsync(CancellationToken ct);
    Task<SpendResult> TrySpendAsync(int amount, string reason, string? refType, Guid? refId, string key, CancellationToken ct);
    Task<SpendResult> AddAsync(int amount, string type, string reason, string? refType, Guid? refId, string key, CancellationToken ct);
}

internal sealed class CreditService(
    LeadGenDbContext db, IPlatformSettings settings, ICurrentUserAccessor accessor,
    INotificationDispatcher dispatcher, Microsoft.Extensions.Logging.ILogger<CreditService> logger) : ICreditService
{
    public async Task<CreditWallet> EnsureWalletAsync(CancellationToken ct)
    {
        var wallet = await db.Wallets.FirstOrDefaultAsync(ct);
        if (wallet is null)
        {
            try
            {
                wallet = CreditWallet.CreateEmpty();
                db.Wallets.Add(wallet);
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException)
            {
                db.ChangeTracker.Clear();
                wallet = await db.Wallets.FirstAsync(ct);   // someone else created it first
            }
        }

        if (!wallet.TrialGranted)
        {
            var s = await settings.GetAsync(ct);
            if (s.TrialGrantCredits > 0)
            {
                // Idempotent: the key is fixed, so a second caller cannot grant it twice.
                await AddAsync(s.TrialGrantCredits, LedgerType.Grant, "Welcome credits", null, null, "trial-grant", ct);
            }
            await MarkTrialGrantedAsync(ct);
            wallet = await db.Wallets.AsNoTracking().FirstAsync(ct);
        }
        return wallet;
    }

    private async Task MarkTrialGrantedAsync(CancellationToken ct) =>
        await db.Wallets.Where(w => !w.TrialGranted).ExecuteUpdateAsync(s => s.SetProperty(w => w.TrialGranted, true), ct);

    public async Task<long> BalanceAsync(CancellationToken ct) =>
        (await EnsureWalletAsync(ct)).Balance;

    public async Task<SpendResult> TrySpendAsync(int amount, string reason, string? refType, Guid? refId, string key, CancellationToken ct)
    {
        if (amount <= 0) return new SpendResult(true, await BalanceAsync(ct), AlreadyDone: true);
        await EnsureWalletAsync(ct);

        var existing = await db.Ledger.AsNoTracking().FirstOrDefaultAsync(l => l.IdempotencyKey == key, ct);
        if (existing is not null) return new SpendResult(true, existing.BalanceAfter, AlreadyDone: true);

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var rows = await db.Wallets.Where(w => w.Balance >= amount).ExecuteUpdateAsync(s => s
            .SetProperty(w => w.Balance, w => w.Balance - amount)
            .SetProperty(w => w.LifetimeSpent, w => w.LifetimeSpent + amount)
            .SetProperty(w => w.UpdatedAt, DateTime.UtcNow), ct);

        if (rows == 0)
        {
            await tx.RollbackAsync(ct);
            return new SpendResult(false, await db.Wallets.AsNoTracking().Select(w => w.Balance).FirstAsync(ct));
        }

        var balance = await db.Wallets.AsNoTracking().Select(w => w.Balance).FirstAsync(ct);
        db.Ledger.Add(new CreditLedgerEntry(LedgerType.Spend, -amount, balance, reason, refType, refId, key,
            accessor.UserId, accessor.UserName));
        try { await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); }
        catch (DbUpdateException)
        {
            // The same key was posted by a concurrent request. Undo ours; theirs already holds.
            await tx.RollbackAsync(ct);
            db.ChangeTracker.Clear();
            var prior = await db.Ledger.AsNoTracking().FirstOrDefaultAsync(l => l.IdempotencyKey == key, ct);
            return new SpendResult(prior is not null, prior?.BalanceAfter ?? balance, AlreadyDone: true);
        }

        _ = NotifyIfLowAsync(balance, ct);
        return new SpendResult(true, balance);
    }

    public async Task<SpendResult> AddAsync(int amount, string type, string reason, string? refType, Guid? refId, string key, CancellationToken ct)
    {
        if (amount == 0) return new SpendResult(true, await db.Wallets.AsNoTracking().Select(w => w.Balance).FirstOrDefaultAsync(ct), AlreadyDone: true);
        if (!await db.Wallets.AnyAsync(ct))
        {
            try { db.Wallets.Add(CreditWallet.CreateEmpty()); await db.SaveChangesAsync(ct); }
            catch (DbUpdateException) { db.ChangeTracker.Clear(); }
        }

        var existing = await db.Ledger.AsNoTracking().FirstOrDefaultAsync(l => l.IdempotencyKey == key, ct);
        if (existing is not null) return new SpendResult(true, existing.BalanceAfter, AlreadyDone: true);

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        // A negative adjustment may not take the balance below zero.
        var rows = amount > 0
            ? await db.Wallets.ExecuteUpdateAsync(s => s
                .SetProperty(w => w.Balance, w => w.Balance + amount)
                .SetProperty(w => w.LifetimePurchased, w => w.LifetimePurchased + (type == LedgerType.Purchase ? amount : 0))
                .SetProperty(w => w.LifetimeRefunded, w => w.LifetimeRefunded + (type == LedgerType.Refund ? amount : 0))
                .SetProperty(w => w.UpdatedAt, DateTime.UtcNow), ct)
            : await db.Wallets.Where(w => w.Balance >= -amount).ExecuteUpdateAsync(s => s
                .SetProperty(w => w.Balance, w => w.Balance + amount)
                .SetProperty(w => w.UpdatedAt, DateTime.UtcNow), ct);

        if (rows == 0)
        {
            await tx.RollbackAsync(ct);
            return new SpendResult(false, await db.Wallets.AsNoTracking().Select(w => w.Balance).FirstAsync(ct));
        }

        var balance = await db.Wallets.AsNoTracking().Select(w => w.Balance).FirstAsync(ct);
        db.Ledger.Add(new CreditLedgerEntry(type, amount, balance, reason, refType, refId, key, accessor.UserId, accessor.UserName));
        try { await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); }
        catch (DbUpdateException)
        {
            await tx.RollbackAsync(ct);
            db.ChangeTracker.Clear();
            var prior = await db.Ledger.AsNoTracking().FirstOrDefaultAsync(l => l.IdempotencyKey == key, ct);
            return new SpendResult(prior is not null, prior?.BalanceAfter ?? balance, AlreadyDone: true);
        }
        return new SpendResult(true, balance);
    }

    /// <summary>Tells the people who can top up that the balance is running low. Never throws.</summary>
    private async Task NotifyIfLowAsync(long balance, CancellationToken ct)
    {
        try
        {
            var threshold = await db.Wallets.AsNoTracking().Select(w => w.LowBalanceAlert).FirstOrDefaultAsync(ct);
            if (threshold is null || balance > threshold) return;
            if (accessor.UserId is not { } user) return;
            await dispatcher.PublishAsync(new NotificationRequest(
                user, NotificationModules.LeadGen, NotificationEvents.LeadGenCreditsLow,
                "Lead generation credits are running low",
                $"{balance} credits left. Top up to keep finding and revealing prospects.",
                Link: "/lead-generation/credits", Type: "warning", TenantId: TenantAmbient.TenantId), ct);
        }
        catch (Exception ex) { logger.LogWarning(ex, "Low-credit notification failed."); }
    }
}
