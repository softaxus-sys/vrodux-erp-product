using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Integrations.Commands;
using Softaxis.Finance.Application.Integrations.Dtos;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Integrations;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Integrations;

internal sealed class UpdateIntegrationSettingHandler(FinanceDbContext db, PostingEngine engine)
    : ICommandHandler<UpdateIntegrationSettingCommand>
{
    public async Task<Result> Handle(UpdateIntegrationSettingCommand cmd, CancellationToken ct)
    {
        if (PostingEngine.CurrentTenant is null)
            return Result.Failure(IntegrationErrors.NoTenant);

        var definition = IntegrationCatalogue.Find(cmd.IntegrationKey);
        if (definition is null)
            return Result.Failure(IntegrationErrors.UnknownKey(cmd.IntegrationKey));

        // Only a queue-backed integration has anything to switch: Finance's own documents always
        // post, and the rest have no server-side posting to turn on.
        if (definition.Kind != IntegrationKind.Queue)
            return Result.Failure(Error.Custom("Integration.Conflict",
                $"'{definition.Name}' cannot be switched on or off from here."));

        var setting = await db.IntegrationSettings.FirstOrDefaultAsync(s => s.IntegrationKey == definition.Key, ct);
        if (setting is null)
        {
            setting = new IntegrationSetting(definition.Key);
            db.IntegrationSettings.Add(setting);
        }

        // Automatic posting writes to the ledger with nobody looking, so switching it on — or
        // widening what it covers by moving the start date — is refused unless the caller has
        // been shown what it will do, and unless every account it needs is there to post to.
        var newStart   = string.IsNullOrWhiteSpace(cmd.StartDate) ? null : cmd.StartDate.Trim();
        var turningOn  = cmd.Mode == IntegrationSetting.Auto
                      && (setting.Mode != IntegrationSetting.Auto || setting.StartDate != newStart);
        if (turningOn)
        {
            if (!cmd.AcknowledgeAuto)
                return Result.Failure(Error.Custom("Integration.Invalid",
                    "Automatic posting has to be confirmed before it is switched on."));

            // Without a start date every document the module has ever recorded would be posted
            // unattended — including periods already entered in the books by hand.
            if (newStart is null)
                return Result.Failure(Error.Custom("Integration.Invalid",
                    "Automatic posting needs a start date, so it is clear which documents it covers."));

            if (!definition.AutoAllowed)
                return Result.Failure(Error.Custom("Integration.Conflict",
                    $"{definition.Name} are always posted by a person: they carry no tax and are not tied to an invoice, so they cannot be posted without being looked at."));

            if (setting.RequireSeparateApprover)
                return Result.Failure(Error.Custom("Integration.Conflict",
                    "This integration requires a second person to approve each document, which automatic posting cannot do. Turn that rule off first."));

            var blockers = AutoReadiness.Blockers(definition, await engine.ResolveAccountsAsync(definition, ct));
            if (blockers.Count > 0)
                return Result.Failure(Error.Custom("Integration.Conflict",
                    "Automatic posting cannot be switched on yet. " + string.Join(" ", blockers)));
        }

        setting.Configure(cmd.Mode, cmd.StartDate, cmd.UserName);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}

internal sealed class SaveAccountMappingsHandler(FinanceDbContext db)
    : ICommandHandler<SaveAccountMappingsCommand>
{
    public async Task<Result> Handle(SaveAccountMappingsCommand cmd, CancellationToken ct)
    {
        if (PostingEngine.CurrentTenant is null)
            return Result.Failure(IntegrationErrors.NoTenant);

        var definition = IntegrationCatalogue.Find(cmd.IntegrationKey);
        if (definition is null)
            return Result.Failure(IntegrationErrors.UnknownKey(cmd.IntegrationKey));

        if (definition.Kind != IntegrationKind.Queue)
            return Result.Failure(Error.Custom("Integration.Conflict",
                $"'{definition.Name}' posts to fixed accounts and has no mapping to change."));

        foreach (var input in cmd.Mappings)
            if (definition.Roles.All(r => r.Role != input.Role))
                return Result.Failure(Error.Custom("Integration.Invalid",
                    $"'{input.Role}' is not a posting role of '{definition.Name}'."));

        var accountIds = cmd.Mappings.Where(m => m.AccountId is not null).Select(m => m.AccountId!.Value).Distinct().ToList();
        var usable = await db.Accounts.AsNoTracking()
            .Where(a => accountIds.Contains(a.Id) && !a.IsDeleted && a.IsActive)
            .Select(a => a.Id)
            .ToListAsync(ct);

        if (usable.Count != accountIds.Count)
            return Result.Failure(Error.Custom("Integration.Invalid",
                "One of the chosen accounts no longer exists or is inactive."));

        var existing = await db.AccountMappings.Where(m => m.IntegrationKey == definition.Key).ToListAsync(ct);

        foreach (var input in cmd.Mappings)
        {
            var row = existing.FirstOrDefault(m => m.Role == input.Role);

            if (input.AccountId is null)
            {
                if (row is not null) db.AccountMappings.Remove(row);
            }
            else if (row is null)
            {
                db.AccountMappings.Add(new AccountMapping(definition.Key, input.Role, input.AccountId.Value));
            }
            else if (row.AccountId != input.AccountId.Value)
            {
                row.SetAccount(input.AccountId.Value);
            }
        }

        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}

internal sealed class SyncIntegrationsHandler(PostingEngine engine)
    : ICommandHandler<SyncIntegrationsCommand, SyncResultDto>
{
    public async Task<Result<SyncResultDto>> Handle(SyncIntegrationsCommand cmd, CancellationToken ct)
    {
        if (PostingEngine.CurrentTenant is null)
            return Result.Failure<SyncResultDto>(IntegrationErrors.NoTenant);

        if (cmd.IntegrationKey is not null && IntegrationCatalogue.Find(cmd.IntegrationKey) is null)
            return Result.Failure<SyncResultDto>(IntegrationErrors.UnknownKey(cmd.IntegrationKey));

        var outcomes = await engine.SyncAsync(cmd.IntegrationKey, cmd.UserName, ct);

        return Result.Success(new SyncResultDto(
            outcomes.Sum(o => o.Collected), outcomes.Sum(o => o.Posted), outcomes.Sum(o => o.Failed),
            outcomes.Select(o => new SyncResultItemDto(o.IntegrationKey, o.Collected, o.Posted, o.Failed, o.Error)).ToList()));
    }
}

internal static class PostBatch
{
    /// <summary>
    /// Posts what the caller's approval level allows. The rest is reported as refused with the
    /// reason, untouched in the queue — not failed, so nothing about it is lost or retried.
    /// </summary>
    public static async Task<PostResultDto> RunGatedAsync(
        FinanceDbContext db, PostingEngine engine, IReadOnlyCollection<Guid> ids, string? userName,
        PostingCaller? caller, CancellationToken ct)
    {
        // A null caller is for code that is not acting for a signed-in person; every controller supplies one.
        var refusals = caller is null
            ? []
            : await ApprovalGate.RefusalsAsync(db, ids, caller, Ledger(), ct);

        var result = await RunAsync(engine, ids.Where(id => !refusals.ContainsKey(id)).ToList(), userName, ct);
        if (refusals.Count == 0) return result;

        var items = result.Items.Concat(refusals.Select(r => new PostResultItemDto(r.Key, "refused", r.Value, null))).ToList();
        return new PostResultDto(result.Posted, result.Failed, result.Unchanged + refusals.Count, items);
    }

    public static string Ledger() => Softaxis.BuildingBlocks.Domain.Multitenancy.TenantCurrency.Resolve().Trim().ToUpperInvariant();

    public static async Task<PostResultDto> RunAsync(
        PostingEngine engine, IEnumerable<Guid> ids, string? userName, CancellationToken ct)
    {
        var results = new List<PostResultItemDto>();
        int posted = 0, failed = 0;
        foreach (var id in ids.Distinct())
        {
            var outcome = await engine.PostAsync(id, userName, ct);
            results.Add(new PostResultItemDto(outcome.ItemId, outcome.Status, outcome.Error, outcome.JournalEntryNumber));

            // An item somebody else got to first, or that was never postable, is neither a
            // success of this request nor a failure of it — it is counted as unchanged.
            if (outcome.Changed && outcome.Status == PostingItem.Posted) posted++;
            else if (outcome.Changed && outcome.Status == PostingItem.Failed) failed++;
        }

        return new PostResultDto(posted, failed, results.Count - posted - failed, results);
    }
}

internal sealed class PostItemsHandler(FinanceDbContext db, PostingEngine engine)
    : ICommandHandler<PostItemsCommand, PostResultDto>
{
    public async Task<Result<PostResultDto>> Handle(PostItemsCommand cmd, CancellationToken ct)
    {
        if (PostingEngine.CurrentTenant is null)
            return Result.Failure<PostResultDto>(IntegrationErrors.NoTenant);

        if (cmd.ControlTotal is not { } expected)
            return Result.Success(await PostBatch.RunGatedAsync(db, engine, cmd.Ids, cmd.UserName, cmd.Caller, ct));

        var refusals = cmd.Caller is null
            ? new Dictionary<Guid, string>()
            : await ApprovalGate.RefusalsAsync(db, cmd.Ids, cmd.Caller, PostBatch.Ledger(), ct);

        // The caller approved a figure. If mappings, rates, a period or the documents themselves
        // changed since, the selection no longer comes to it — and nothing is posted.
        var check = await PostingChecker.RunAsync(db, engine, cmd.Ids, ct, refusals);
        if (Math.Abs(check.TotalDebit - expected) > 0.005m)
            return Result.Failure<PostResultDto>(Error.Custom("PostingItem.Conflict",
                $"These documents no longer come to the total that was checked ({expected:N2}); they now come to {check.TotalDebit:N2}. Run the checks again."));
        if (!check.Balanced)
            return Result.Failure<PostResultDto>(Error.Custom("PostingItem.Conflict",
                "The selection's debits and credits do not agree. Nothing was posted."));

        // Only what passed. A blocked document stays as it is instead of being marked failed
        // for a reason the user has already been shown.
        var ready = check.Results.Where(r => r.CanPost).Select(r => r.ItemId).ToList();
        return Result.Success(await PostBatch.RunAsync(engine, ready, cmd.UserName, ct));
    }
}

internal static class AutoReadiness
{
    /// <summary>Reasons an integration cannot post unattended: a role with no usable account.</summary>
    public static List<string> Blockers(
        IntegrationDefinition definition, IReadOnlyDictionary<string, ResolvedAccount> accounts)
    {
        var blockers = new List<string>();
        foreach (var role in definition.Roles)
        {
            if (!accounts.TryGetValue(role.Role, out var account))
                blockers.Add($"'{role.Label}' has no account to post to.");
            else if (!account.IsActive)
                blockers.Add($"Account {account.Number} {account.Name} ('{role.Label}') is inactive.");
        }
        return blockers;
    }
}

internal sealed class RetryFailedHandler(FinanceDbContext db, PostingEngine engine)
    : ICommandHandler<RetryFailedCommand, PostResultDto>
{
    public async Task<Result<PostResultDto>> Handle(RetryFailedCommand cmd, CancellationToken ct)
    {
        if (PostingEngine.CurrentTenant is null)
            return Result.Failure<PostResultDto>(IntegrationErrors.NoTenant);

        var ids = await db.PostingItems.AsNoTracking()
            .Where(i => i.Status == PostingItem.Failed
                     && (cmd.IntegrationKey == null || i.IntegrationKey == cmd.IntegrationKey))
            .OrderBy(i => i.SourceDate)
            .Select(i => i.Id)
            .Take(PostItemsValidator.MaxItems)
            .ToListAsync(ct);

        return Result.Success(await PostBatch.RunGatedAsync(db, engine, ids, cmd.UserName, cmd.Caller, ct));
    }
}

internal sealed class SubmitItemsHandler(FinanceDbContext db) : ICommandHandler<SubmitItemsCommand, SubmitResultDto>
{
    public async Task<Result<SubmitResultDto>> Handle(SubmitItemsCommand cmd, CancellationToken ct)
    {
        if (PostingEngine.CurrentTenant is null)
            return Result.Failure<SubmitResultDto>(IntegrationErrors.NoTenant);
        if (cmd.UserId is null)
            return Result.Failure<SubmitResultDto>(Error.Custom("Auth.Unresolved",
                "Who you are could not be established, so nothing was submitted."));

        var ids   = cmd.Ids.Distinct().ToList();
        var items = await db.PostingItems.Where(i => ids.Contains(i.Id)).ToListAsync(ct);
        int changed = 0, unchanged = 0;
        var problems = new List<string>();

        foreach (var item in items)
        {
            if (!ModuleAccess.Allows(cmd.Modules, item.SourceModule))
            {
                problems.Add($"{item.SourceNumber}: belongs to a module your workspace does not have.");
                continue;
            }

            if (cmd.Withdraw)
            {
                if (item.SubmittedAt is null) { unchanged++; continue; }
                if (item.SubmittedByUserId != cmd.UserId)
                {
                    problems.Add($"{item.SourceNumber}: only the person who submitted it can withdraw it.");
                    continue;
                }
                item.WithdrawSubmission();
                changed++;
                continue;
            }

            if (item.Status != PostingItem.Pending)
            {
                problems.Add($"{item.SourceNumber}: only waiting documents can be submitted ({item.Status}).");
                continue;
            }
            if (item.SubmittedAt is not null) { unchanged++; continue; }

            item.Submit(cmd.UserId, cmd.UserName);
            changed++;
        }

        problems.AddRange(ids.Except(items.Select(i => i.Id)).Select(_ => "A document is no longer in the queue."));
        await db.SaveChangesAsync(ct);
        return Result.Success(new SubmitResultDto(changed, unchanged, problems));
    }
}

internal sealed class UpdateApprovalRulesHandler(FinanceDbContext db) : ICommandHandler<UpdateApprovalRulesCommand>
{
    public async Task<Result> Handle(UpdateApprovalRulesCommand cmd, CancellationToken ct)
    {
        if (PostingEngine.CurrentTenant is null)
            return Result.Failure(IntegrationErrors.NoTenant);

        var definition = IntegrationCatalogue.Find(cmd.IntegrationKey);
        if (definition is null || definition.Kind != IntegrationKind.Queue)
            return Result.Failure(IntegrationErrors.UnknownKey(cmd.IntegrationKey));

        var setting = await db.IntegrationSettings.FirstOrDefaultAsync(s => s.IntegrationKey == definition.Key, ct);
        if (setting is null)
        {
            setting = new IntegrationSetting(definition.Key);
            db.IntegrationSettings.Add(setting);
        }

        if (cmd.RequireSeparateApprover && setting.Mode == IntegrationSetting.Auto)
            return Result.Failure(Error.Custom("Integration.Conflict",
                "A second approver cannot be required while this integration posts automatically. Switch it to manual posting first."));

        setting.SetApprovalRules(cmd.ApprovalLimit, cmd.RequireSeparateApprover, cmd.UserName);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class SkipItemHandler(FinanceDbContext db) : ICommandHandler<SkipItemCommand>
{
    public async Task<Result> Handle(SkipItemCommand cmd, CancellationToken ct)
    {
        if (PostingEngine.CurrentTenant is null)
            return Result.Failure(IntegrationErrors.NoTenant);

        var item = await db.PostingItems.FirstOrDefaultAsync(i => i.Id == cmd.Id, ct);
        if (item is null)
            return Result.Failure(IntegrationErrors.ItemNotFound(cmd.Id));
        if (!item.CanSkip)
            return Result.Failure(Error.Custom("PostingItem.Conflict", $"A {item.Status} item cannot be skipped."));

        item.Skip(cmd.Reason);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class RequeueItemHandler(FinanceDbContext db) : ICommandHandler<RequeueItemCommand>
{
    public async Task<Result> Handle(RequeueItemCommand cmd, CancellationToken ct)
    {
        if (PostingEngine.CurrentTenant is null)
            return Result.Failure(IntegrationErrors.NoTenant);

        var item = await db.PostingItems.FirstOrDefaultAsync(i => i.Id == cmd.Id, ct);
        if (item is null)
            return Result.Failure(IntegrationErrors.ItemNotFound(cmd.Id));
        if (!item.CanRequeue)
            return Result.Failure(Error.Custom("PostingItem.Conflict", "Only a skipped item can be put back in the queue."));

        item.Requeue();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class ReverseItemHandler(FinanceDbContext db, PostingEngine engine) : ICommandHandler<ReverseItemCommand>
{
    public async Task<Result> Handle(ReverseItemCommand cmd, CancellationToken ct)
    {
        if (PostingEngine.CurrentTenant is null)
            return Result.Failure(IntegrationErrors.NoTenant);

        var item = await db.PostingItems.FirstOrDefaultAsync(i => i.Id == cmd.Id, ct);
        if (item is null)
            return Result.Failure(IntegrationErrors.ItemNotFound(cmd.Id));

        if (cmd.Caller is not null)
        {
            var setting = await db.IntegrationSettings.AsNoTracking().FirstOrDefaultAsync(s => s.IntegrationKey == item.IntegrationKey, ct);
            if (ApprovalGate.EvaluateReversal(item, setting, cmd.Caller, PostBatch.Ledger()) is { } why)
                return Result.Failure(Error.Custom("PostingItem.Conflict", why));
        }

        var refusal = await engine.ReverseAsync(item, cmd.Reason, cmd.UserName, ct);
        return refusal is null
            ? Result.Success()
            : Result.Failure(Error.Custom("PostingItem.Conflict", refusal));
    }
}
