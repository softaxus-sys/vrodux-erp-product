using Microsoft.EntityFrameworkCore;
using Softaxis.Seo.Application.Abstractions;
using Softaxis.Seo.Domain.Entities;
using Softaxis.Seo.Infrastructure.Crawl;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Credits;

public sealed record SpendResult(bool Ok, long Balance, bool AlreadyDone = false);

/// <summary>
/// The only code that changes an SEO credit balance — the same guarded-spend pattern the Lead Generation credits use.
/// A balance moves by one SQL statement (<c>UPDATE … SET Balance = Balance - n WHERE Balance &gt;= n</c>), never by reading it,
/// subtracting in memory and saving, so two audits starting at once cannot both spend the last credit. Every movement writes a
/// ledger row under an idempotency key, so a retried request or a restarted job posts once and only once.
/// </summary>
public interface ISeoCreditService
{
    Task<SeoWallet> EnsureWalletAsync(CancellationToken ct);
    Task<long> BalanceAsync(CancellationToken ct);
    Task<SpendResult> TrySpendAsync(int amount, string reason, string? refType, Guid? refId, string key, CancellationToken ct);
    Task<SpendResult> AddAsync(int amount, string type, string reason, string? refType, Guid? refId, string key, CancellationToken ct);
    /// <summary>Guarded removal that is NOT usage (a swap to another module): never below zero, not counted as spent.</summary>
    Task<SpendResult> RemoveAsync(int amount, string type, string reason, string? refType, Guid? refId, string key, CancellationToken ct);
}

internal sealed class SeoCreditService(SeoDbContext db, SeoOptions options, ICurrentUser currentUser) : ISeoCreditService
{
    public async Task<SeoWallet> EnsureWalletAsync(CancellationToken ct)
    {
        var wallet = await db.Wallets.FirstOrDefaultAsync(ct);
        if (wallet is null)
        {
            try
            {
                wallet = SeoWallet.CreateEmpty();
                db.Wallets.Add(wallet);
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException)
            {
                db.ChangeTracker.Clear();
                wallet = await db.Wallets.FirstAsync(ct);   // another request created it first (unique per workspace)
            }
        }

        if (!wallet.WelcomeGranted)
        {
            // Idempotent: the key is fixed, so a second caller cannot grant it twice.
            if (options.WelcomeCredits > 0)
                await AddAsync(options.WelcomeCredits, SeoCreditTypes.Grant, "Welcome credits", null, null, "welcome-grant", ct);
            await db.Wallets.Where(w => !w.WelcomeGranted).ExecuteUpdateAsync(s => s.SetProperty(w => w.WelcomeGranted, true), ct);
            wallet = await db.Wallets.AsNoTracking().FirstAsync(ct);
        }
        return wallet;
    }

    public async Task<long> BalanceAsync(CancellationToken ct) => (await EnsureWalletAsync(ct)).Balance;

    public async Task<SpendResult> TrySpendAsync(int amount, string reason, string? refType, Guid? refId, string key, CancellationToken ct)
    {
        if (amount <= 0) return new SpendResult(true, await BalanceAsync(ct), AlreadyDone: true);
        await EnsureWalletAsync(ct);

        var existing = await db.CreditLedger.AsNoTracking().FirstOrDefaultAsync(l => l.IdempotencyKey == key, ct);
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
        db.CreditLedger.Add(new SeoCreditEntry(SeoCreditTypes.Spend, -amount, balance, reason, refType, refId, key, currentUser.Username));
        try { await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); }
        catch (DbUpdateException)
        {
            // The same key was posted by a concurrent request: undo ours, theirs already holds.
            await tx.RollbackAsync(ct);
            db.ChangeTracker.Clear();
            var prior = await db.CreditLedger.AsNoTracking().FirstOrDefaultAsync(l => l.IdempotencyKey == key, ct);
            return new SpendResult(prior is not null, prior?.BalanceAfter ?? balance, AlreadyDone: true);
        }
        return new SpendResult(true, balance);
    }

    public async Task<SpendResult> RemoveAsync(int amount, string type, string reason, string? refType, Guid? refId, string key, CancellationToken ct)
    {
        if (amount <= 0) return new SpendResult(true, await BalanceAsync(ct), AlreadyDone: true);
        await EnsureWalletAsync(ct);
        var existing = await db.CreditLedger.AsNoTracking().FirstOrDefaultAsync(l => l.IdempotencyKey == key, ct);
        if (existing is not null) return new SpendResult(true, existing.BalanceAfter, AlreadyDone: true);

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var rows = await db.Wallets.Where(w => w.Balance >= amount).ExecuteUpdateAsync(s => s
            .SetProperty(w => w.Balance, w => w.Balance - amount)
            .SetProperty(w => w.UpdatedAt, DateTime.UtcNow), ct);
        if (rows == 0)
        {
            await tx.RollbackAsync(ct);
            return new SpendResult(false, await db.Wallets.AsNoTracking().Select(w => w.Balance).FirstAsync(ct));
        }
        var balance = await db.Wallets.AsNoTracking().Select(w => w.Balance).FirstAsync(ct);
        db.CreditLedger.Add(new SeoCreditEntry(type, -amount, balance, reason, refType, refId, key, currentUser.Username));
        try { await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); }
        catch (DbUpdateException)
        {
            await tx.RollbackAsync(ct);
            db.ChangeTracker.Clear();
            var prior = await db.CreditLedger.AsNoTracking().FirstOrDefaultAsync(l => l.IdempotencyKey == key, ct);
            return new SpendResult(prior is not null, prior?.BalanceAfter ?? balance, AlreadyDone: true);
        }
        return new SpendResult(true, balance);
    }

    public async Task<SpendResult> AddAsync(int amount, string type, string reason, string? refType, Guid? refId, string key, CancellationToken ct)
    {
        if (amount == 0) return new SpendResult(true, await db.Wallets.AsNoTracking().Select(w => w.Balance).FirstOrDefaultAsync(ct), AlreadyDone: true);
        if (!await db.Wallets.AnyAsync(ct))
        {
            try { db.Wallets.Add(SeoWallet.CreateEmpty()); await db.SaveChangesAsync(ct); }
            catch (DbUpdateException) { db.ChangeTracker.Clear(); }
        }

        var existing = await db.CreditLedger.AsNoTracking().FirstOrDefaultAsync(l => l.IdempotencyKey == key, ct);
        if (existing is not null) return new SpendResult(true, existing.BalanceAfter, AlreadyDone: true);

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        // A negative adjustment may not take the balance below zero.
        var rows = amount > 0
            ? await db.Wallets.ExecuteUpdateAsync(s => s
                .SetProperty(w => w.Balance, w => w.Balance + amount)
                .SetProperty(w => w.LifetimeAdded, w => w.LifetimeAdded + amount)
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
        db.CreditLedger.Add(new SeoCreditEntry(type, amount, balance, reason, refType, refId, key, currentUser.Username));
        try { await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); }
        catch (DbUpdateException)
        {
            await tx.RollbackAsync(ct);
            db.ChangeTracker.Clear();
            var prior = await db.CreditLedger.AsNoTracking().FirstOrDefaultAsync(l => l.IdempotencyKey == key, ct);
            return new SpendResult(prior is not null, prior?.BalanceAfter ?? balance, AlreadyDone: true);
        }
        return new SpendResult(true, balance);
    }
}
