using Microsoft.EntityFrameworkCore;
using Softaxis.Finance.Application.Integrations.Dtos;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Integrations;

/// <summary>Which modules a workspace may see documents of, by the licence codes in the user's token.</summary>
internal static class ModuleAccess
{
    /// <summary>Null list = no restriction. Finance itself is always allowed: this is Finance's screen.</summary>
    public static bool Allows(IReadOnlyList<string>? modules, string module)
    {
        if (modules is null || string.Equals(module, "finance", StringComparison.OrdinalIgnoreCase))
            return true;

        // The licence code for purchasing is spelled two ways across the product.
        string Norm(string m) => m.Trim().ToLowerInvariant() switch { "purchasing" => "purchase", var x => x };
        var wanted = Norm(module);
        return modules.Any(m => Norm(m) == wanted);
    }
}

/// <summary>
/// The approval levels. Who may post a given document is decided here, in one place, for the
/// posting screen, the module panels, the check dialog and every retry.
///
/// <para>Rules, per integration: a value limit above which only holders of the high-value
/// permission may post; and a second-person rule — the document must have been submitted, and the
/// submitter cannot be the approver. A document of a module the workspace does not have is never
/// postable by anyone through this screen.</para>
/// </summary>
internal static class ApprovalGate
{
    public static string? Evaluate(
        PostingItem item, IntegrationSetting? setting, PostingCaller caller, string ledgerCurrency)
    {
        if (!ModuleAccess.Allows(caller.Modules, item.SourceModule))
            return "This document belongs to a module your workspace does not have.";

        if (setting?.ApprovalLimit is { } limit && item.TotalAmount > limit && !caller.CanApproveHigh)
            return $"This document ({item.TotalAmount:N2} {ledgerCurrency}) is above the approval limit of {limit:N2}. It needs someone with high-value approval.";

        if (setting?.RequireSeparateApprover == true)
        {
            if (item.SubmittedAt is null)
                return "This document has not been submitted for approval yet.";
            if (caller.UserId is null || item.SubmittedByUserId is null)
                return "Who submitted this document, or who you are, cannot be established, so it was not posted.";
            if (item.SubmittedByUserId == caller.UserId)
                return "You submitted this document. Someone else has to approve it.";
        }

        return null;
    }

    /// <summary>Reversing undoes a posting, so it follows the same limit and licence — not the second-person rule.</summary>
    public static string? EvaluateReversal(
        PostingItem item, IntegrationSetting? setting, PostingCaller caller, string ledgerCurrency)
    {
        if (!ModuleAccess.Allows(caller.Modules, item.SourceModule))
            return "This document belongs to a module your workspace does not have.";
        if (setting?.ApprovalLimit is { } limit && item.TotalAmount > limit && !caller.CanApproveHigh)
            return $"This entry ({item.TotalAmount:N2} {ledgerCurrency}) is above the approval limit of {limit:N2}. Reversing it needs someone with high-value approval.";
        return null;
    }

    public static async Task<Dictionary<Guid, string>> RefusalsAsync(
        FinanceDbContext db, IReadOnlyCollection<Guid> ids, PostingCaller caller, string ledgerCurrency, CancellationToken ct)
    {
        var wanted = ids.Distinct().ToList();
        var items  = await db.PostingItems.AsNoTracking().Where(i => wanted.Contains(i.Id)).ToListAsync(ct);
        var keys   = items.Select(i => i.IntegrationKey).Distinct().ToList();
        var rules  = await db.IntegrationSettings.AsNoTracking()
            .Where(s => keys.Contains(s.IntegrationKey)).ToDictionaryAsync(s => s.IntegrationKey, ct);

        var refusals = new Dictionary<Guid, string>();
        foreach (var item in items)
            if (Evaluate(item, rules.GetValueOrDefault(item.IntegrationKey), caller, ledgerCurrency) is { } why)
                refusals[item.Id] = why;
        return refusals;
    }
}
