using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Integrations.Dtos;
using Softaxis.Finance.Application.Integrations.Queries;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Integrations;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Integrations;

internal static class IntegrationErrors
{
    public static readonly Error NoTenant = Error.Custom("Integration.Invalid",
        "Open the Integration Center from inside a workspace — it works on one workspace's books at a time.");

    public static Error UnknownKey(string key) =>
        Error.Custom("Integration.NotFound", $"'{key}' is not a known integration.");

    public static Error ItemNotFound(Guid id) => Error.NotFoundById(nameof(PostingItem), id);
}

internal static class IntegrationMappings
{
    public static PostingItemDto ToDto(PostingItem i) => new(
        i.Id, i.IntegrationKey, IntegrationCatalogue.Find(i.IntegrationKey)?.Name ?? i.IntegrationKey,
        i.SourceModule, i.SourceId, i.SourceNumber, i.SourceDate, i.Description, i.CurrencyCode,
        i.TotalAmount, i.Status, i.Attempts, i.LastError, i.LastAttemptAt, i.JournalEntryId,
        i.JournalEntryNumber, i.PostedAt, i.PostedByName, i.CreatedAt, i.SubmittedAt, i.SubmittedByName);
}

internal sealed class GetIntegrationOverviewHandler(FinanceDbContext db, PostingEngine engine)
    : IQueryHandler<GetIntegrationOverviewQuery, IntegrationOverviewDto>
{
    public async Task<Result<IntegrationOverviewDto>> Handle(GetIntegrationOverviewQuery query, CancellationToken ct)
    {
        if (PostingEngine.CurrentTenant is not { } tenantId)
            return Result.Failure<IntegrationOverviewDto>(IntegrationErrors.NoTenant);

        var settings = await db.IntegrationSettings.AsNoTracking().ToDictionaryAsync(s => s.IntegrationKey, ct);
        var mapped   = (await db.AccountMappings.AsNoTracking()
                .Select(m => new { m.IntegrationKey, m.Role }).ToListAsync(ct))
            .Select(m => (m.IntegrationKey, m.Role)).ToHashSet();

        var counts = (await db.PostingItems.AsNoTracking()
                .GroupBy(i => new { i.IntegrationKey, i.Status })
                .Select(g => new { g.Key.IntegrationKey, g.Key.Status, Count = g.Count() })
                .ToListAsync(ct))
            .ToLookup(c => c.IntegrationKey);

        var list = new List<IntegrationDto>();
        var definitions = (string.IsNullOrWhiteSpace(query.Module)
                ? IntegrationCatalogue.All
                : IntegrationCatalogue.All.Where(d => string.Equals(d.Module, query.Module, StringComparison.OrdinalIgnoreCase)).ToList())
            .Where(d => ModuleAccess.Allows(query.AllowedModules, d.Module))
            .ToList();

        foreach (var def in definitions)
        {
            var issues   = new List<string>();
            var accounts = def.Roles.Count == 0 ? [] : await engine.ResolveAccountsAsync(def, ct);

            var roles = def.Roles.Select(r =>
            {
                accounts.TryGetValue(r.Role, out var a);
                return new IntegrationRoleDto(r.Role, r.Label, r.IsDebit ? "debit" : "credit", r.DefaultAccountNumber,
                    a?.Id, a?.Number, a?.Name, mapped.Contains((def.Key, r.Role)), a is not null, a?.IsActive ?? false);
            }).ToList();

            foreach (var r in roles.Where(r => !r.IsResolved))
                issues.Add(r.IsMapped
                    ? $"The account chosen for '{r.Label}' no longer exists."
                    : $"Account {r.DefaultAccountNumber} ('{r.Label}') is missing from the chart of accounts.");
            foreach (var r in roles.Where(r => r.IsResolved && !r.IsActive))
                issues.Add($"Account {r.AccountNumber} {r.AccountName} ('{r.Label}') is inactive.");

            string health;
            string? mode = null, startDate = null, syncError = null, sourceError = null;
            DateTime? lastSync = null;
            QueueCountsDto? queue = null;
            int? sourceDocs = null, linkedDocs = null;

            if (def.Kind == IntegrationKind.Queue)
            {
                settings.TryGetValue(def.Key, out var setting);
                mode      = setting?.Mode ?? IntegrationSetting.Off;
                startDate = setting?.StartDate;
                lastSync  = setting?.LastSyncAt;
                syncError = setting?.LastSyncError;

                int Count(string status) => counts[def.Key].Where(c => c.Status == status).Sum(c => c.Count);
                queue = new QueueCountsDto(
                    Count(PostingItem.Pending) + Count(PostingItem.Posting), Count(PostingItem.Posted),
                    Count(PostingItem.Failed), Count(PostingItem.Skipped), Count(PostingItem.Reversed));

                var source = PostingSources.Find(def.Key);
                if (source is not null)
                {
                    var coverage = await engine.SourceCountAsync(source, startDate, tenantId, ct);
                    sourceDocs  = coverage.Total;
                    sourceError = coverage.Error;
                    linkedDocs  = queue.Posted;
                }

                if (queue.Failed > 0) issues.Add($"{queue.Failed} document(s) are held or failed to post.");

                var cancelled = await db.PostingItems.AsNoTracking()
                    .CountAsync(i => i.IntegrationKey == def.Key && i.Status == PostingItem.Posted && i.LastError != null, ct);
                if (cancelled > 0)
                    issues.Add($"{cancelled} posted document(s) were cancelled afterwards. Their entries are still in the ledger and need reversing.");
                if (syncError is not null) issues.Add($"The last collection failed: {syncError}");
                if (sourceError is not null) issues.Add("The source module's data could not be read.");

                health = mode == IntegrationSetting.Off ? "off"
                       : issues.Count > 0 ? "attention"
                       : "connected";
            }
            else
            {
                var coverage = await engine.CoverageAsync(def.Key, tenantId, ct);
                sourceDocs  = coverage?.Total;
                linkedDocs  = coverage?.Linked;
                sourceError = coverage?.Error;

                if (def.Kind == IntegrationKind.Native)
                {
                    var missing = (sourceDocs ?? 0) - (linkedDocs ?? 0);
                    if (missing > 0) issues.Add($"{missing} posted document(s) have no journal entry.");
                    health = issues.Count > 0 ? "attention" : "connected";
                }
                else
                {
                    health = def.Kind == IntegrationKind.Client ? "partial" : "not_connected";
                }
            }

            list.Add(new IntegrationDto(def.Key, def.Module, def.Name, def.Kind, def.Trigger, def.Notes,
                health, issues, mode, startDate, lastSync, syncError, queue,
                sourceDocs, linkedDocs, sourceError, roles,
                settings.GetValueOrDefault(def.Key)?.ApprovalLimit,
                settings.GetValueOrDefault(def.Key)?.RequireSeparateApprover ?? false,
                def.AutoAllowed));
        }

        return Result.Success(new IntegrationOverviewDto(
            list,
            list.Count(i => i.Health == "connected"),
            list.Count(i => i.Health == "attention"),
            list.Count(i => i.Health == "partial"),
            list.Count(i => i.Health is "not_connected" or "off"),
            list.Sum(i => i.Queue?.Pending ?? 0),
            list.Sum(i => i.Queue?.Failed ?? 0),
            TenantCurrency.Resolve().Trim().ToUpperInvariant()));
    }
}

internal sealed class GetPostingItemsHandler(FinanceDbContext db)
    : IQueryHandler<GetPostingItemsQuery, PostingItemPageDto>
{
    public async Task<Result<PostingItemPageDto>> Handle(GetPostingItemsQuery query, CancellationToken ct)
    {
        if (PostingEngine.CurrentTenant is null)
            return Result.Failure<PostingItemPageDto>(IntegrationErrors.NoTenant);

        var page     = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 200);

        var items = db.PostingItems.AsNoTracking();

        // A workspace that no longer has a module keeps its history, but this screen does not show it.
        if (query.AllowedModules is not null)
        {
            var visible = IntegrationCatalogue.All
                .Where(d => ModuleAccess.Allows(query.AllowedModules, d.Module)).Select(d => d.Key).ToList();
            items = items.Where(i => visible.Contains(i.IntegrationKey));
        }

        if (!string.IsNullOrWhiteSpace(query.Module))
        {
            var ofModule = IntegrationCatalogue.All
                .Where(d => string.Equals(d.Module, query.Module, StringComparison.OrdinalIgnoreCase)).Select(d => d.Key).ToList();
            items = items.Where(i => ofModule.Contains(i.IntegrationKey));
        }

        if (!string.IsNullOrWhiteSpace(query.IntegrationKey))
            items = items.Where(i => i.IntegrationKey == query.IntegrationKey);

        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            // "pending" includes an item a worker is on right now — to the reader it is not done yet.
            items = query.Status == PostingItem.Pending
                ? items.Where(i => i.Status == PostingItem.Pending || i.Status == PostingItem.Posting)
                : items.Where(i => i.Status == query.Status);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim();
            items = items.Where(i => i.SourceNumber.Contains(term)
                                  || i.Description.Contains(term)
                                  || (i.JournalEntryNumber != null && i.JournalEntryNumber.Contains(term)));
        }

        var total = await items.CountAsync(ct);
        var rows  = await items
            .OrderByDescending(i => i.SourceDate).ThenByDescending(i => i.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync(ct);

        return Result.Success(new PostingItemPageDto(rows.Select(IntegrationMappings.ToDto).ToList(), total, page, pageSize));
    }
}

internal sealed class GetPostingPreviewHandler(FinanceDbContext db, PostingEngine engine)
    : IQueryHandler<GetPostingPreviewQuery, PostingPreviewDto>
{
    public async Task<Result<PostingPreviewDto>> Handle(GetPostingPreviewQuery query, CancellationToken ct)
    {
        if (PostingEngine.CurrentTenant is null)
            return Result.Failure<PostingPreviewDto>(IntegrationErrors.NoTenant);

        var item = await db.PostingItems.AsNoTracking().FirstOrDefaultAsync(i => i.Id == query.Id, ct);
        if (item is null)
            return Result.Failure<PostingPreviewDto>(IntegrationErrors.ItemNotFound(query.Id));

        var preview = await engine.PreviewAsync(item, ct);
        if (preview is null)
            return Result.Failure<PostingPreviewDto>(IntegrationErrors.UnknownKey(item.IntegrationKey));

        var problems = preview.Entry.Problems.ToList();
        if (preview.PeriodClosed)
            problems.Add($"The fiscal period for {item.SourceDate} is closed for posting.");

        return Result.Success(new PostingPreviewDto(
            IntegrationMappings.ToDto(item),
            preview.Entry.Lines.Select(l => new PreviewLineDto(
                l.Role, l.RoleLabel, l.AccountId, l.AccountNumber, l.AccountName, l.Debit, l.Credit)).ToList(),
            preview.Entry.TotalDebit, preview.Entry.TotalCredit, preview.Rate, preview.LedgerCurrency,
            preview.PeriodClosed, preview.Entry.CanPost && !preview.PeriodClosed, problems,
            PostingEngine.ReadAmounts(item)));
    }
}

internal sealed class CheckPostingItemsHandler(FinanceDbContext db, PostingEngine engine)
    : IQueryHandler<CheckPostingItemsQuery, PostingCheckDto>
{
    public async Task<Result<PostingCheckDto>> Handle(CheckPostingItemsQuery query, CancellationToken ct)
    {
        if (PostingEngine.CurrentTenant is null)
            return Result.Failure<PostingCheckDto>(IntegrationErrors.NoTenant);
        if (query.Ids is null || query.Ids.Count == 0)
            return Result.Failure<PostingCheckDto>(Error.Custom("Integration.Invalid", "Choose at least one document to check."));
        if (query.Ids.Count > 500)
            return Result.Failure<PostingCheckDto>(Error.Custom("Integration.Invalid", "At most 500 documents can be checked at once."));

        var refusals = query.Caller is null
            ? null
            : await ApprovalGate.RefusalsAsync(db, query.Ids, query.Caller, PostBatch.Ledger(), ct);

        return Result.Success(await PostingChecker.RunAsync(db, engine, query.Ids, ct, refusals));
    }
}

internal sealed class GetAutoReadinessHandler(FinanceDbContext db, PostingEngine engine)
    : IQueryHandler<GetAutoReadinessQuery, AutoReadinessDto>
{
    public async Task<Result<AutoReadinessDto>> Handle(GetAutoReadinessQuery query, CancellationToken ct)
    {
        if (PostingEngine.CurrentTenant is not { } tenantId)
            return Result.Failure<AutoReadinessDto>(IntegrationErrors.NoTenant);

        var definition = IntegrationCatalogue.Find(query.IntegrationKey);
        var source     = PostingSources.Find(query.IntegrationKey);
        if (definition is null || source is null)
            return Result.Failure<AutoReadinessDto>(IntegrationErrors.UnknownKey(query.IntegrationKey));

        var blockers = AutoReadiness.Blockers(definition, await engine.ResolveAccountsAsync(definition, ct));

        var startDate = string.IsNullOrWhiteSpace(query.StartDate)
            ? (await db.IntegrationSettings.AsNoTracking()
                .Where(s => s.IntegrationKey == definition.Key).Select(s => s.StartDate).FirstOrDefaultAsync(ct))
            : query.StartDate.Trim();

        var uncollected = await engine.UncollectedCountAsync(source, startDate, tenantId, ct);
        if (uncollected is null)
            blockers.Add("The source module's data could not be read.");

        var pending = await db.PostingItems.AsNoTracking()
            .Where(i => i.IntegrationKey == definition.Key && i.Status == PostingItem.Pending)
            .GroupBy(i => 1)
            .Select(g => new { Count = g.Count(), Amount = g.Sum(i => i.TotalAmount) })
            .FirstOrDefaultAsync(ct);
        var failed = await db.PostingItems.AsNoTracking()
            .CountAsync(i => i.IntegrationKey == definition.Key && i.Status == PostingItem.Failed, ct);

        return Result.Success(new AutoReadinessDto(
            definition.Key, blockers.Count == 0, blockers,
            pending?.Count ?? 0, pending?.Amount ?? 0, failed, uncollected,
            TenantCurrency.Resolve().Trim().ToUpperInvariant(),
            (int)PostingQueueHostedService.Interval.TotalMinutes));
    }
}
