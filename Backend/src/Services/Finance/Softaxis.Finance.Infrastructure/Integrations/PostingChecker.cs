using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Finance.Application.Integrations.Dtos;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Integrations;

/// <summary>
/// Checks a selection of queued documents the way posting would, without writing anything.
///
/// <para>Shared by the check endpoint and by posting itself, so the figures a user approves and
/// the figures that are then posted come from one calculation.</para>
/// </summary>
internal static class PostingChecker
{
    public static async Task<PostingCheckDto> RunAsync(
        FinanceDbContext db, PostingEngine engine, IReadOnlyCollection<Guid> ids, CancellationToken ct,
        IReadOnlyDictionary<Guid, string>? refusals = null)
    {
        var wanted = ids.Distinct().ToList();
        var items  = await db.PostingItems.AsNoTracking()
            .Where(i => wanted.Contains(i.Id))
            .OrderBy(i => i.SourceDate).ThenBy(i => i.SourceNumber)
            .ToListAsync(ct);

        var cache    = new PreviewCache();
        var results  = new List<PostingCheckItemDto>();
        var accounts = new Dictionary<string, (string Name, decimal Debit, decimal Credit)>();

        foreach (var item in items)
        {
            var problems = new List<string>();
            decimal debit = 0, credit = 0;

            if (!item.CanPost)
                problems.Add(item.Status == PostingItem.Posted
                    ? $"Already posted as {item.JournalEntryNumber}."
                    : $"A {item.Status} document cannot be posted.");

            if (refusals is not null && refusals.TryGetValue(item.Id, out var refusal))
                problems.Add(refusal);

            // Only an open item is checked against its document: a posted one has already been
            // reported above, and its document may rightly no longer be "waiting".
            if (item.CanPost)
            {
                var verdict = await engine.VerifyAsync(item, ct);
                if (verdict.Changed is not null)
                    problems.Add("The source document changed after it was collected. Collect again to update its figures, then check it.");
                else if (verdict.Problem is not null)
                    problems.Add(verdict.Problem);
            }

            var preview = await engine.PreviewAsync(item, ct, cache);
            if (preview is null)
            {
                problems.Add($"'{item.IntegrationKey}' is not a known integration.");
            }
            else
            {
                debit  = preview.Entry.TotalDebit;
                credit = preview.Entry.TotalCredit;

                problems.AddRange(preview.Entry.Problems);
                if (preview.Entry.Lines.Count == 0)
                    problems.Add("The document has no amounts to post.");
                if (preview.PeriodClosed)
                    problems.Add($"The fiscal period for {item.SourceDate} is closed for posting.");

                if (problems.Count == 0)
                    foreach (var line in preview.Entry.Lines)
                    {
                        accounts.TryGetValue(line.AccountNumber!, out var sum);
                        accounts[line.AccountNumber!] = (line.AccountName ?? "", sum.Debit + line.Debit, sum.Credit + line.Credit);
                    }
            }

            results.Add(new PostingCheckItemDto(item.Id, item.IntegrationKey, item.SourceNumber, item.SourceDate,
                item.Status, debit, credit, problems.Count == 0, problems));
        }

        // An id that matched nothing is reported rather than dropped: the caller asked about it.
        foreach (var missing in wanted.Except(items.Select(i => i.Id)))
            results.Add(new PostingCheckItemDto(missing, "", "—", "", "missing", 0, 0, false,
                ["The document is no longer in the queue."]));

        var ready       = results.Where(r => r.CanPost).ToList();
        var totalDebit  = ready.Sum(r => r.TotalDebit);
        var totalCredit = ready.Sum(r => r.TotalCredit);

        return new PostingCheckDto(
            results.Count, ready.Count, results.Count - ready.Count,
            totalDebit, totalCredit, totalDebit == totalCredit,
            TenantCurrency.Resolve().Trim().ToUpperInvariant(),
            accounts.OrderBy(a => a.Key)
                .Select(a => new PostingCheckAccountDto(a.Key, a.Value.Name, a.Value.Debit, a.Value.Credit)).ToList(),
            results);
    }
}
