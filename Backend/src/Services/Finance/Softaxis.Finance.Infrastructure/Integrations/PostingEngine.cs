using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Integrations;

/// <param name="Changed">False when this call did nothing — the item was already posted, is being
/// posted by someone else, or is not in a postable state.</param>
internal sealed record PostOutcome(Guid ItemId, string Status, string? Error, string? JournalEntryNumber, bool Changed = true);

internal sealed record SyncOutcome(string IntegrationKey, int Collected, int Posted, int Failed, string? Error);

internal sealed record PostingPreview(BuiltEntry Entry, decimal Rate, bool PeriodClosed, string LedgerCurrency);

/// <summary>
/// What the source document says at this moment, against what the queue holds for it.
/// </summary>
/// <param name="Problem">Why the item must not be posted as it stands, or null.</param>
/// <param name="Gone">The document no longer qualifies at all (cancelled, deleted, posted elsewhere).</param>
/// <param name="Changed">The document's current row, when its figures differ from the queue's.</param>
internal sealed record SourceVerdict(string? Problem, bool Gone = false, SourceRow? Changed = null)
{
    public static readonly SourceVerdict Ok = new((string?)null);
}

/// <summary>How many source documents exist for an integration, and how many are tied to the ledger.</summary>
internal sealed record Coverage(int? Total, int? Linked, string? Error);

/// <summary>
/// Accounts, rates and period status looked up once for a batch of previews. Checking 500
/// documents of one day otherwise asks the same four questions 500 times.
/// </summary>
internal sealed class PreviewCache
{
    public Dictionary<string, Dictionary<string, ResolvedAccount>> Accounts { get; } = [];
    public Dictionary<(string Currency, string Date), decimal> Rates { get; } = [];
    public Dictionary<string, bool> ClosedDates { get; } = [];
}

/// <summary>
/// Collects documents from other modules into the posting queue and posts them to the ledger.
///
/// <para>Everything here requires a resolved workspace. Source reads are raw cross-schema SQL,
/// which the tenant query filter does not cover, so a missing tenant must stop the call rather
/// than read across workspaces.</para>
/// </summary>
internal sealed class PostingEngine(FinanceDbContext db, ILogger<PostingEngine> logger)
{
    private const int BatchSize = 500;

    /// <summary>A claim older than this is taken to be a worker that died mid-post.</summary>
    private static readonly TimeSpan StaleClaim = TimeSpan.FromMinutes(10);

    public static Guid? CurrentTenant => TenantAmbient.IsResolved ? TenantAmbient.TenantId : null;

    // ── Accounts ─────────────────────────────────────────────────────────────

    /// <summary>Role → account: the workspace's mapping where one exists, else the default number.</summary>
    public async Task<Dictionary<string, ResolvedAccount>> ResolveAccountsAsync(
        IntegrationDefinition definition, CancellationToken ct)
    {
        var mappings = await db.AccountMappings.AsNoTracking()
            .Where(m => m.IntegrationKey == definition.Key)
            .ToDictionaryAsync(m => m.Role, m => m.AccountId, ct);

        var mappedIds      = mappings.Values.ToList();
        var defaultNumbers = definition.Roles.Select(r => r.DefaultAccountNumber).Distinct().ToList();

        var accounts = await db.Accounts.AsNoTracking()
            .Where(a => !a.IsDeleted && (mappedIds.Contains(a.Id) || defaultNumbers.Contains(a.AccountNumber)))
            .Select(a => new ResolvedAccount(a.Id, a.AccountNumber, a.Name, a.IsActive))
            .ToListAsync(ct);

        var result = new Dictionary<string, ResolvedAccount>();
        foreach (var role in definition.Roles)
        {
            // A mapping whose account has since been deleted resolves to nothing — reported as a
            // missing mapping, not quietly replaced by the default the workspace chose against.
            var account = mappings.TryGetValue(role.Role, out var mappedId)
                ? accounts.FirstOrDefault(a => a.Id == mappedId)
                : accounts.FirstOrDefault(a => a.Number == role.DefaultAccountNumber);

            if (account is not null)
                result[role.Role] = account;
        }

        return result;
    }

    // ── Collect ──────────────────────────────────────────────────────────────

    public async Task<Coverage> SourceCountAsync(PostingSource source, string? startDate, Guid tenantId, CancellationToken ct)
    {
        try
        {
            var total = await db.Database
                .SqlQueryRaw<int>($"SELECT COUNT(*) AS [Value] {source.FromWhere}", tenantId, startDate ?? "0001-01-01")
                .SingleAsync(ct);
            return new Coverage(total, null, null);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return new Coverage(null, null, Short(ex));
        }
    }

    /// <summary>Source documents that are not in the queue yet — what the next collection would add.</summary>
    public async Task<int?> UncollectedCountAsync(PostingSource source, string? startDate, Guid tenantId, CancellationToken ct)
    {
        try
        {
            var sql =
                $"SELECT COUNT(*) AS [Value] {source.FromWhere} " +
                "AND NOT EXISTS (SELECT 1 FROM [finance].[posting_items] q " +
                $"WHERE q.[TenantId] = {{0}} AND q.[IntegrationKey] = {{2}} AND q.[SourceId] = {source.IdExpr})";

            return await db.Database
                .SqlQueryRaw<int>(sql, tenantId, startDate ?? "0001-01-01", source.Key)
                .SingleAsync(ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Posting queue: could not count uncollected {Key} documents.", source.Key);
            return null;
        }
    }

    /// <summary>Adds any source documents not yet in the queue. Returns how many were added.</summary>
    public async Task<int> CollectAsync(
        PostingSource source, IntegrationDefinition definition, string? startDate, Guid tenantId, CancellationToken ct)
    {
        var sql =
            $"SELECT TOP ({BatchSize}) {source.Select} {source.FromWhere} " +
            "AND NOT EXISTS (SELECT 1 FROM [finance].[posting_items] q " +
            $"WHERE q.[TenantId] = {{0}} AND q.[IntegrationKey] = {{2}} AND q.[SourceId] = {source.IdExpr}) " +
            $"ORDER BY {source.OrderBy}";

        var rows = await db.Database
            .SqlQueryRaw<SourceRow>(sql, tenantId, startDate ?? "0001-01-01", source.Key)
            .ToListAsync(ct);

        if (rows.Count == 0)
            return 0;

        var currency = TenantCurrency.Resolve().Trim().ToUpperInvariant();
        foreach (var row in rows)
        {
            var amounts = source.Amounts(row);
            var total   = amounts
                .Where(a => definition.Roles.Any(r => r.Role == a.Key && r.IsDebit))
                .Sum(a => Math.Abs(a.Value));

            var item = new PostingItem(
                source.Key, definition.Module, row.Id, row.Number, row.Date,
                string.IsNullOrWhiteSpace(row.Description) ? definition.Name : row.Description!,
                currency, JsonSerializer.Serialize(amounts), total);

            // Collected all the same, so it is visible and counted — but never as "pending",
            // which is the only state automatic posting picks up.
            if (source.Check?.Invoke(row) is { } problem)
                item.Hold(HeldPrefix + problem);

            db.PostingItems.Add(item);
        }

        try
        {
            await db.SaveChangesAsync(ct);
            return rows.Count;
        }
        catch (DbUpdateException ex)
        {
            // Two collectors raced and the unique key refused the second. Nothing is lost: the
            // rows are in the queue, just not from this pass.
            logger.LogInformation(ex, "Posting queue: a concurrent collection of {Key} won the race.", source.Key);
            db.ChangeTracker.Clear();
            return 0;
        }
    }

    // ── Keeping the queue true to its sources ────────────────────────────────

    public const string HeldPrefix = "Held for review: ";

    private const string GoneMessage =
        "The source document no longer qualifies for posting: it was cancelled, deleted, changed status, or has been entered in the accounts another way.";

    public static bool SameAmounts(IReadOnlyDictionary<string, decimal> a, IReadOnlyDictionary<string, decimal> b) =>
        a.Keys.Union(b.Keys).All(k => Math.Abs(a.GetValueOrDefault(k) - b.GetValueOrDefault(k)) < 0.005m);

    private static decimal DebitTotal(IntegrationDefinition definition, Dictionary<string, decimal> amounts) =>
        amounts.Where(a => definition.Roles.Any(r => r.Role == a.Key && r.IsDebit)).Sum(a => Math.Abs(a.Value));

    /// <summary>
    /// Reads the document behind a queued item again and says whether the item may be posted.
    /// A document is collected once and can sit in the queue for days; in that time it can be
    /// cancelled, corrected, or posted through its own module's screen. Anything that cannot be
    /// confirmed is a refusal — an unreadable source is not treated as an unchanged one.
    /// </summary>
    public async Task<SourceVerdict> VerifyAsync(PostingItem item, CancellationToken ct)
    {
        if (CurrentTenant is not { } tenantId)
            return new SourceVerdict("No workspace is resolved.");

        // Queue documents are always in the workspace's own currency. A different code means the
        // workspace's currency changed, or the item was collected without one — either way a
        // conversion here would be inventing a figure.
        var ledger = TenantCurrency.Resolve().Trim().ToUpperInvariant();
        if (!string.Equals(item.CurrencyCode, ledger, StringComparison.OrdinalIgnoreCase))
            return new SourceVerdict(
                $"The document was collected in {item.CurrencyCode} but the ledger is kept in {ledger}. It was not converted.");

        var source = PostingSources.Find(item.IntegrationKey);
        if (source is null)
            return new SourceVerdict($"'{item.IntegrationKey}' has no source to check the document against.");

        SourceRow? row;
        try
        {
            row = (await db.Database
                    .SqlQueryRaw<SourceRow>($"SELECT {source.Select} {source.FromWhere} AND {source.IdExpr} = {{2}}",
                        tenantId, "0001-01-01", item.SourceId)
                    .ToListAsync(ct))
                .FirstOrDefault();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Posting queue: could not re-read {Key} document {SourceId}.", item.IntegrationKey, item.SourceId);
            return new SourceVerdict("The source document could not be read again, so it was not posted.");
        }

        if (row is null)
            return new SourceVerdict(GoneMessage, Gone: true);

        if (source.Check?.Invoke(row) is { } problem)
            return new SourceVerdict(HeldPrefix + problem);

        if (!SameAmounts(source.Amounts(row), ReadAmounts(item)))
            return new SourceVerdict("The source document changed after it was collected.", Changed: row);

        return SourceVerdict.Ok;
    }

    private void ApplyRefresh(PostingItem item, PostingSource source, IntegrationDefinition definition, SourceRow row)
    {
        var amounts = source.Amounts(row);
        item.Refresh(row.Date, JsonSerializer.Serialize(amounts), DebitTotal(definition, amounts));
    }

    /// <summary>
    /// Brings open items up to date with their documents: figures refreshed, documents that no
    /// longer qualify taken out of the queue, and anything with a problem held back.
    /// </summary>
    public async Task ReconcileOpenAsync(PostingSource source, IntegrationDefinition definition, Guid tenantId, CancellationToken ct)
    {
        var open = await db.PostingItems
            .Where(i => i.IntegrationKey == source.Key && (i.Status == PostingItem.Pending || i.Status == PostingItem.Failed))
            .OrderBy(i => i.CreatedAt)
            .Take(BatchSize)
            .ToListAsync(ct);
        if (open.Count == 0)
            return;

        var sql =
            $"SELECT {source.Select} {source.FromWhere} " +
            "AND EXISTS (SELECT 1 FROM [finance].[posting_items] q " +
            $"WHERE q.[TenantId] = {{0}} AND q.[IntegrationKey] = {{2}} AND q.[SourceId] = {source.IdExpr} " +
            "AND q.[Status] IN ('pending', 'failed'))";

        var rows = (await db.Database.SqlQueryRaw<SourceRow>(sql, tenantId, "0001-01-01", source.Key).ToListAsync(ct))
            .GroupBy(r => r.Id).ToDictionary(g => g.Key, g => g.First());

        foreach (var item in open)
        {
            if (!rows.TryGetValue(item.SourceId, out var row))
            {
                item.Skip(GoneMessage);
                continue;
            }

            if (item.SourceDate != row.Date || !SameAmounts(source.Amounts(row), ReadAmounts(item)))
                ApplyRefresh(item, source, definition, row);

            if (source.Check?.Invoke(row) is { } problem)
                item.Hold(HeldPrefix + problem);
            else
                item.ReleaseHold(HeldPrefix);
        }

        await db.SaveChangesAsync(ct);
        db.ChangeTracker.Clear();
    }

    /// <summary>
    /// Marks posted items whose document was cancelled afterwards. Their entries are still in the
    /// ledger; nothing is reversed here, because undoing a posting is a person's decision.
    /// </summary>
    public async Task<int> FlagCancelledAsync(PostingSource source, Guid tenantId, CancellationToken ct)
    {
        if (source.CancelledWhere is null || source.CancelledFrom is null)
            return 0;

        var sql =
            $"SELECT {source.IdExpr} AS [Value] {source.CancelledFrom} WHERE {source.CancelledWhere} " +
            "AND EXISTS (SELECT 1 FROM [finance].[posting_items] q " +
            $"WHERE q.[TenantId] = {{0}} AND q.[IntegrationKey] = {{1}} AND q.[SourceId] = {source.IdExpr} " +
            "AND q.[Status] = 'posted' AND q.[LastError] IS NULL)";

        var ids = await db.Database.SqlQueryRaw<Guid>(sql, tenantId, source.Key).ToListAsync(ct);
        if (ids.Count == 0)
            return 0;

        var items = await db.PostingItems
            .Where(i => i.IntegrationKey == source.Key && ids.Contains(i.SourceId) && i.Status == PostingItem.Posted)
            .ToListAsync(ct);
        foreach (var item in items)
            item.FlagCancelled("The source document was cancelled after this entry was posted. Reverse the entry.");

        await db.SaveChangesAsync(ct);
        db.ChangeTracker.Clear();
        return items.Count;
    }

    public async Task<IReadOnlyList<SyncOutcome>> SyncAsync(string? onlyKey, string? userName, CancellationToken ct)
    {
        var tenantId = CurrentTenant ?? throw new InvalidOperationException("No workspace is resolved.");
        var outcomes = new List<SyncOutcome>();

        var settings = await db.IntegrationSettings
            .Where(s => s.Mode != IntegrationSetting.Off && (onlyKey == null || s.IntegrationKey == onlyKey))
            .AsNoTracking()
            .ToListAsync(ct);

        foreach (var setting in settings)
        {
            var source     = PostingSources.Find(setting.IntegrationKey);
            var definition = IntegrationCatalogue.Find(setting.IntegrationKey);
            if (source is null || definition is null)
                continue;

            int collected = 0, posted = 0, failed = 0;
            string? error = null;

            try
            {
                collected = await CollectAsync(source, definition, setting.StartDate, tenantId, ct);

                // Before anything is posted: what is already waiting must still be true.
                await ReconcileOpenAsync(source, definition, tenantId, ct);
                await FlagCancelledAsync(source, tenantId, ct);

                // Never unattended: a document type that needs a person's eye, one that needs a second
                // person to approve, and — below — any single document above the approval limit.
                if (setting.Mode == IntegrationSetting.Auto && definition.AutoAllowed && !setting.RequireSeparateApprover)
                {
                    var approvalLimit = setting.ApprovalLimit;
                    var pendingIds = await db.PostingItems.AsNoTracking()
                        .Where(i => i.IntegrationKey == setting.IntegrationKey && i.Status == PostingItem.Pending
                                 && (approvalLimit == null || i.TotalAmount <= approvalLimit))
                        .OrderBy(i => i.SourceDate).ThenBy(i => i.CreatedAt)
                        .Select(i => i.Id)
                        .Take(BatchSize)
                        .ToListAsync(ct);

                    foreach (var id in pendingIds)
                    {
                        var outcome = await PostAsync(id, userName ?? "Automatic posting", ct);
                        if (outcome.Changed && outcome.Status == PostingItem.Posted) posted++;
                        else if (outcome.Changed && outcome.Status == PostingItem.Failed) failed++;
                    }
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                db.ChangeTracker.Clear();
                error = Short(ex);
                logger.LogError(ex, "Posting queue: sync of {Key} failed for workspace {TenantId}.", setting.IntegrationKey, tenantId);
            }

            await db.IntegrationSettings
                .Where(s => s.Id == setting.Id)
                .ExecuteUpdateAsync(u => u
                    .SetProperty(s => s.LastSyncAt, DateTime.UtcNow)
                    .SetProperty(s => s.LastSyncError, error), ct);

            outcomes.Add(new SyncOutcome(setting.IntegrationKey, collected, posted, failed, error));
        }

        return outcomes;
    }

    // ── Preview and post ─────────────────────────────────────────────────────

    public static Dictionary<string, decimal> ReadAmounts(PostingItem item) =>
        JsonSerializer.Deserialize<Dictionary<string, decimal>>(item.AmountsJson) ?? [];

    public async Task<PostingPreview?> PreviewAsync(PostingItem item, CancellationToken ct, PreviewCache? cache = null)
    {
        var definition = IntegrationCatalogue.Find(item.IntegrationKey);
        if (definition is null)
            return null;

        cache ??= new PreviewCache();

        if (!cache.Accounts.TryGetValue(definition.Key, out var accounts))
            cache.Accounts[definition.Key] = accounts = await ResolveAccountsAsync(definition, ct);

        if (!cache.Rates.TryGetValue((item.CurrencyCode, item.SourceDate), out var rate))
            cache.Rates[(item.CurrencyCode, item.SourceDate)] = rate =
                await GlPoster.GetRateAsync(db, item.CurrencyCode, item.SourceDate, ct);

        if (!cache.ClosedDates.TryGetValue(item.SourceDate, out var closed))
            cache.ClosedDates[item.SourceDate] = closed = await GlPoster.IsPeriodClosedAsync(db, item.SourceDate, ct);

        var entry = PostingLineBuilder.Build(definition, ReadAmounts(item), accounts, rate);

        return new PostingPreview(entry, rate, closed, TenantCurrency.Resolve().Trim().ToUpperInvariant());
    }

    /// <summary>
    /// Posts one queued document. Safe to call twice at once, and safe to call on an item that is
    /// already posted: only one caller can claim an item, and only a claimed item is posted.
    /// </summary>
    public async Task<PostOutcome> PostAsync(Guid itemId, string? userName, CancellationToken ct)
    {
        // Whatever an earlier item left tracked must not ride along on this one's save.
        db.ChangeTracker.Clear();

        var now   = DateTime.UtcNow;
        var stale = now - StaleClaim;

        // The claim. A single UPDATE, so of two simultaneous callers exactly one sees a row
        // change — the other finds nothing to claim and posts nothing.
        var claimed = await db.PostingItems
            .Where(i => i.Id == itemId
                     && (i.Status == PostingItem.Pending
                      || i.Status == PostingItem.Failed
                      || (i.Status == PostingItem.Posting && i.UpdatedAt < stale)))
            .ExecuteUpdateAsync(u => u
                .SetProperty(i => i.Status, PostingItem.Posting)
                .SetProperty(i => i.UpdatedAt, now), ct);

        if (claimed == 0)
        {
            var current = await db.PostingItems.AsNoTracking().FirstOrDefaultAsync(i => i.Id == itemId, ct);
            return new PostOutcome(itemId, current?.Status ?? "missing",
                current is null ? "The item no longer exists." : null, current?.JournalEntryNumber, Changed: false);
        }

        try
        {
            var item = await db.PostingItems.FirstAsync(i => i.Id == itemId, ct);

            var definition = IntegrationCatalogue.Find(item.IntegrationKey)
                ?? throw new PostingRefused($"'{item.IntegrationKey}' is not a known integration.");
            var tenantId = CurrentTenant ?? throw new PostingRefused("No workspace is resolved.");

            // The document as it is now, not as it was when it was collected.
            var verdict = await VerifyAsync(item, ct);
            if (verdict.Changed is { } current && PostingSources.Find(item.IntegrationKey) is { } changedSource)
            {
                // The figures are brought up to date, and the item is failed rather than posted:
                // whoever approved it — a person or the switch to automatic — approved other numbers.
                ApplyRefresh(item, changedSource, definition, current);
                await db.SaveChangesAsync(ct);
                throw new PostingRefused("The source document changed after it was collected. Its figures have been updated — check it and post it again.");
            }
            if (verdict.Problem is not null)
                throw new PostingRefused(verdict.Problem);

            var preview = await PreviewAsync(item, ct)
                ?? throw new PostingRefused($"'{item.IntegrationKey}' is not a known integration.");

            if (preview.PeriodClosed)
                throw new PostingRefused($"The fiscal period for {item.SourceDate} is closed for posting.");
            if (!preview.Entry.CanPost)
                throw new PostingRefused(string.Join(" ", preview.Entry.Problems));

            var lines = preview.Entry.Lines
                .Select(l => new GlPoster.Line(l.AccountNumber!, l.Debit, l.Credit, $"{l.RoleLabel} — {item.SourceNumber}"))
                .ToList();

            // One transaction for the journal entry, the item's "posted" state and the mark left
            // on the source document. There is no moment at which the ledger holds an entry the
            // queue does not know about — or one for a document its own module has since posted.
            await using var tx = await db.Database.BeginTransactionAsync(ct);

            var entryId = await GlPoster.PostAsync(db, item.SourceDate,
                $"{definition.Name}: {item.SourceNumber}", item.SourceNumber, lines, ct)
                ?? throw new PostingRefused("The document has no amounts to post.");

            var entryNumber = db.JournalEntries.Local.First(e => e.Id == entryId).EntryNumber;
            item.MarkPosted(entryId, entryNumber, userName);
            await db.SaveChangesAsync(ct);

            if (!await LinkBackAsync(item, entryId, entryNumber, tenantId, ct))
                throw new PostingRefused("The document was entered in the accounts from its own module while this was being posted. Nothing was posted here.");

            await tx.CommitAsync(ct);

            return new PostOutcome(itemId, PostingItem.Posted, null, entryNumber);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            db.ChangeTracker.Clear();

            if (ex is not PostingRefused)
                logger.LogError(ex, "Posting queue: item {ItemId} failed to post.", itemId);

            var message = ex is PostingRefused ? ex.Message : Short(ex);
            var item = await db.PostingItems.FirstOrDefaultAsync(i => i.Id == itemId, ct);
            if (item is not null)
            {
                item.MarkFailed(message);
                await db.SaveChangesAsync(ct);
            }

            return new PostOutcome(itemId, PostingItem.Failed, message, null);
        }
    }

    public async Task<string?> ReverseAsync(PostingItem item, string? reason, string? userName, CancellationToken ct)
    {
        if (!item.CanReverse)
            return "Only a posted item can be reversed.";
        if (await GlPoster.IsPeriodClosedAsync(db, item.SourceDate, ct))
            return $"The fiscal period for {item.SourceDate} is closed for posting.";

        var entryId = item.JournalEntryId;
        await GlPoster.VoidAsync(db, entryId, ct);
        item.MarkReversed(string.IsNullOrWhiteSpace(reason) ? null : $"Reversed by {userName ?? "a user"}: {reason.Trim()}");
        await db.SaveChangesAsync(ct);

        if (entryId is not null && CurrentTenant is { } tenantId)
        {
            try
            {
                if (item.IntegrationKey == "hr.payroll")
                    await db.Database.ExecuteSqlAsync($"""
                        UPDATE [hr].[payroll_runs] SET [JournalEntryId] = NULL, [JournalEntryNumber] = NULL
                        WHERE [Id] = {item.SourceId} AND [TenantId] = {tenantId} AND [JournalEntryId] = {entryId}
                        """, ct);
                else if (item.IntegrationKey == "library.fine")
                    await db.Database.ExecuteSqlAsync($"""
                        UPDATE [library].[fine_payments] SET [JournalEntryId] = NULL, [JournalEntryNumber] = NULL, [PostedAt] = NULL
                        WHERE [Id] = {item.SourceId} AND [TenantId] = {tenantId} AND [JournalEntryId] = {entryId}
                        """, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Posting queue: could not clear the journal link on {Key} document {SourceId}.", item.IntegrationKey, item.SourceId);
            }
        }

        return null;
    }

    /// <summary>
    /// Payroll runs and library fine payments can each be posted from their own module's screen
    /// as well. Whichever posts first writes its journal entry onto the document, and the other
    /// then leaves it alone. The only places Finance writes outside its own schema, only ever
    /// into a link column that is still empty, and inside the posting transaction: if the column
    /// has been filled in the meantime, this returns false and the posting is rolled back.
    /// </summary>
    private async Task<bool> LinkBackAsync(PostingItem item, Guid entryId, string entryNumber, Guid tenantId, CancellationToken ct)
    {
        var rows = item.IntegrationKey switch
        {
            "hr.payroll" => await db.Database.ExecuteSqlAsync($"""
                UPDATE [hr].[payroll_runs] SET [JournalEntryId] = {entryId}, [JournalEntryNumber] = {entryNumber}
                WHERE [Id] = {item.SourceId} AND [TenantId] = {tenantId} AND [JournalEntryId] IS NULL
                """, ct),
            "library.fine" => await db.Database.ExecuteSqlAsync($"""
                UPDATE [library].[fine_payments] SET [JournalEntryId] = {entryId}, [JournalEntryNumber] = {entryNumber}, [PostedAt] = GETUTCDATE()
                WHERE [Id] = {item.SourceId} AND [TenantId] = {tenantId} AND [JournalEntryId] IS NULL
                """, ct),
            _ => 1,
        };
        return rows == 1;
    }

    // ── Coverage of documents that do not go through the queue ───────────────

    /// <summary>Key → (count of documents that should have reached the ledger, count that are linked to an entry).
    /// {0} is the workspace. A null second query means "none of them are".</summary>
    private static readonly Dictionary<string, (string Total, string? Linked)> CoverageSql = new()
    {
        ["finance.invoice"] = (
            "SELECT COUNT(*) AS [Value] FROM [finance].[invoices] WHERE [TenantId] = {0} AND [IsDeleted] = 0 AND [Status] NOT IN ('draft','cancelled')",
            "SELECT COUNT(*) AS [Value] FROM [finance].[invoices] WHERE [TenantId] = {0} AND [IsDeleted] = 0 AND [Status] NOT IN ('draft','cancelled') AND [JournalEntryId] IS NOT NULL"),
        ["finance.purchase-bill"] = (
            "SELECT COUNT(*) AS [Value] FROM [finance].[purchase_bills] WHERE [TenantId] = {0} AND [IsDeleted] = 0 AND [Status] IN ('approved','partially_paid','paid')",
            "SELECT COUNT(*) AS [Value] FROM [finance].[purchase_bills] WHERE [TenantId] = {0} AND [IsDeleted] = 0 AND [Status] IN ('approved','partially_paid','paid') AND [JournalEntryId] IS NOT NULL"),
        ["finance.receipt-voucher"] = (
            "SELECT COUNT(*) AS [Value] FROM [finance].[receipt_vouchers] WHERE [TenantId] = {0} AND [IsDeleted] = 0 AND [Status] = 'posted'",
            "SELECT COUNT(*) AS [Value] FROM [finance].[receipt_vouchers] WHERE [TenantId] = {0} AND [IsDeleted] = 0 AND [Status] = 'posted' AND [JournalEntryId] IS NOT NULL"),
        ["finance.payment-voucher"] = (
            "SELECT COUNT(*) AS [Value] FROM [finance].[payment_vouchers] WHERE [TenantId] = {0} AND [IsDeleted] = 0 AND [Status] = 'posted'",
            "SELECT COUNT(*) AS [Value] FROM [finance].[payment_vouchers] WHERE [TenantId] = {0} AND [IsDeleted] = 0 AND [Status] = 'posted' AND [JournalEntryId] IS NOT NULL"),
        ["finance.expense"] = (
            "SELECT COUNT(*) AS [Value] FROM [finance].[expenses] WHERE [TenantId] = {0} AND [IsDeleted] = 0 AND [Status] = 'paid'",
            "SELECT COUNT(*) AS [Value] FROM [finance].[expenses] WHERE [TenantId] = {0} AND [IsDeleted] = 0 AND [Status] = 'paid' AND [JournalEntryId] IS NOT NULL"),
        ["finance.bank-transaction"] = (
            "SELECT COUNT(*) AS [Value] FROM [finance].[bank_transactions] WHERE [TenantId] = {0}", null),
        ["manufacturing.production"] = (
            "SELECT COUNT(*) AS [Value] FROM [manufacturing].[production_orders] WHERE [TenantId] = {0} AND [IsDeleted] = 0 AND [Status] = 'completed'",
            "SELECT COUNT(*) AS [Value] FROM [manufacturing].[production_orders] WHERE [TenantId] = {0} AND [IsDeleted] = 0 AND [Status] = 'completed' AND [JournalEntryId] IS NOT NULL"),
        ["visa.invoice"] = (
            "SELECT COUNT(*) AS [Value] FROM [visa].[visa_cases] WHERE [TenantId] = {0} AND [IsDeleted] = 0 AND [Status] <> 'cancelled'",
            "SELECT COUNT(*) AS [Value] FROM [visa].[visa_cases] WHERE [TenantId] = {0} AND [IsDeleted] = 0 AND [Status] <> 'cancelled' AND [InvoiceId] IS NOT NULL"),
        ["sales.quotation"] = (
            "SELECT COUNT(*) AS [Value] FROM [sales].[sales_quotations] WHERE [TenantId] = {0} AND [IsDeleted] = 0 AND [Status] IN ('accepted','converted')",
            "SELECT COUNT(*) AS [Value] FROM [sales].[sales_quotations] WHERE [TenantId] = {0} AND [IsDeleted] = 0 AND [Status] IN ('accepted','converted') AND [InvoiceId] IS NOT NULL"),
        ["sales.return"] = (
            "SELECT COUNT(*) AS [Value] FROM [sales].[sales_returns] WHERE [TenantId] = {0} AND [IsDeleted] = 0 AND [Status] IN ('approved','completed')", null),
        ["purchase.grn"] = (
            "SELECT (SELECT COUNT(*) FROM [purchase].[goods_receipt_notes] WHERE [TenantId] = {0} AND [IsDeleted] = 0 AND [Status] = 'posted') + (SELECT COUNT(*) FROM [purchase].[purchase_returns] WHERE [TenantId] = {0} AND [IsDeleted] = 0 AND [Status] = 'posted') AS [Value]", null),
        ["inventory.movement"] = (
            "SELECT COUNT(*) AS [Value] FROM [inventory].[stock_movements] WHERE [TenantId] = {0} AND [IsDeleted] = 0 AND [MovementType] IN ('Adjustment','WriteOff')", null),
        ["tours.payment"] = (
            "SELECT COUNT(*) AS [Value] FROM [hospitality].[TourPayments] WHERE [TenantId] = {0} AND [IsVoided] = 0", null),
        ["tours.trip"] = (
            "SELECT COUNT(*) AS [Value] FROM [hospitality].[TourBookings] WHERE [TenantId] = {0} AND [IsDeleted] = 0 AND [Status] = 'completed'", null),
        ["hospitality.booking"] = (
            "SELECT COUNT(*) AS [Value] FROM [hospitality].[Bookings] WHERE [TenantId] = {0} AND [IsDeleted] = 0 AND [PaidAmount] > 0", null),
    };

    public async Task<Coverage?> CoverageAsync(string key, Guid tenantId, CancellationToken ct)
    {
        if (!CoverageSql.TryGetValue(key, out var sql))
            return null;

        try
        {
            var total  = await db.Database.SqlQueryRaw<int>(sql.Total, tenantId).SingleAsync(ct);
            var linked = sql.Linked is null ? 0 : await db.Database.SqlQueryRaw<int>(sql.Linked, tenantId).SingleAsync(ct);
            return new Coverage(total, linked, null);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return new Coverage(null, null, Short(ex));
        }
    }

    private static string Short(Exception ex)
    {
        var message = (ex.InnerException ?? ex).Message;
        return message.Length > 400 ? message[..400] : message;
    }

    /// <summary>A refusal the user can act on — bad mapping, closed period — rather than a fault.</summary>
    private sealed class PostingRefused(string message) : Exception(message);
}
