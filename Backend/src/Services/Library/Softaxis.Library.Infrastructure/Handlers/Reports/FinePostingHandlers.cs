using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Library.Application.Reports;
using Softaxis.Library.Infrastructure.Persistence;

namespace Softaxis.Library.Infrastructure.Handlers.Reports;

/// <summary>What has been collected and is not in the accounts yet.</summary>
internal sealed class GetUnpostedFinePaymentsHandler(LibraryDbContext db)
    : IQueryHandler<GetUnpostedFinePaymentsQuery, FinePostingPreviewDto>
{
    // One journal entry for more than this would be unreadable; the rest is posted in a second pass.
    private const int MaxPayments = 5000;

    public async Task<Result<FinePostingPreviewDto>> Handle(GetUnpostedFinePaymentsQuery q, CancellationToken ct)
    {
        var through = LibraryDates.Clean(q.Through) ?? LibraryDates.Today(q.Today);

        var rows = await (
            from p in db.FinePayments.AsNoTracking()
            where p.JournalEntryId == null && string.Compare(p.PaidOn, through) <= 0
            join f in db.Fines.AsNoTracking() on p.FineId equals f.Id
            join m in db.Members.AsNoTracking() on p.MemberId equals m.Id into members
            from m in members.DefaultIfEmpty()
            orderby p.PaidOn, p.CreatedAt
            select new { p.Id, p.PaidOn, p.Method, p.Amount, f.Type, f.Title, Name = m != null ? m.FullName : null, Number = m != null ? m.MemberNumber : null }
        ).Take(MaxPayments).ToListAsync(ct);

        var payments = rows.Select(r => new UnpostedPaymentDto(
            r.Id, r.PaidOn, r.Name ?? "—", r.Number ?? "—", r.Type, r.Title, r.Method, r.Amount)).ToList();

        return Result.Success(new FinePostingPreviewDto(
            payments.Sum(p => p.Amount), payments.Count,
            payments.Count == 0 ? null : payments[0].PaidOn,
            payments.Count == 0 ? null : payments[^1].PaidOn,
            Group(payments, p => p.Method), Group(payments, p => p.FineType), payments));
    }

    private static List<AmountByKeyDto> Group(List<UnpostedPaymentDto> payments, Func<UnpostedPaymentDto, string> key) =>
        payments.GroupBy(key).Select(g => new AmountByKeyDto(g.Key, g.Sum(p => p.Amount), g.Count()))
            .OrderByDescending(g => g.Amount).ToList();
}

internal sealed class MarkFinePaymentsPostedHandler(LibraryDbContext db)
    : ICommandHandler<MarkFinePaymentsPostedCommand, FinePostingResultDto>
{
    public async Task<Result<FinePostingResultDto>> Handle(MarkFinePaymentsPostedCommand cmd, CancellationToken ct)
    {
        var ids = cmd.PaymentIds.Distinct().ToList();
        var payments = await db.FinePayments.Where(p => ids.Contains(p.Id)).ToListAsync(ct);

        if (payments.Count != ids.Count)
            return Result.Failure<FinePostingResultDto>(Error.Custom("FinePosting.NotFound",
                "Some of these payments no longer exist. Nothing was marked — open the posting again."));

        // All or nothing: a payment in two journal entries is money counted twice.
        var already = payments.Count(p => p.IsPosted);
        if (already > 0)
            return Result.Failure<FinePostingResultDto>(Error.Custom("FinePosting.Conflict",
                $"{already} of these payments {(already == 1 ? "is" : "are")} already in the accounts. Nothing was marked — open the posting again."));

        foreach (var p in payments) p.MarkPosted(cmd.JournalEntryId, cmd.JournalEntryNumber);
        await db.SaveChangesAsync(ct);

        return Result.Success(new FinePostingResultDto(payments.Count, payments.Sum(p => p.Amount), cmd.JournalEntryNumber));
    }
}

internal sealed class GetFinePostingHistoryHandler(LibraryDbContext db)
    : IQueryHandler<GetFinePostingHistoryQuery, IReadOnlyList<FinePostingHistoryDto>>
{
    public async Task<Result<IReadOnlyList<FinePostingHistoryDto>>> Handle(GetFinePostingHistoryQuery q, CancellationToken ct)
    {
        var rows = await db.FinePayments.AsNoTracking()
            .Where(p => p.JournalEntryId != null)
            .GroupBy(p => new { p.JournalEntryId, p.JournalEntryNumber })
            .Select(g => new
            {
                g.Key.JournalEntryId, g.Key.JournalEntryNumber,
                PostedAt = g.Max(p => p.PostedAt), Amount = g.Sum(p => p.Amount), Payments = g.Count(),
                From = g.Min(p => p.PaidOn), To = g.Max(p => p.PaidOn),
            })
            .OrderByDescending(x => x.PostedAt).Take(50).ToListAsync(ct);

        return Result.Success<IReadOnlyList<FinePostingHistoryDto>>(rows.Select(r => new FinePostingHistoryDto(
            r.JournalEntryId!.Value, r.JournalEntryNumber, r.PostedAt ?? DateTime.UtcNow, r.Amount, r.Payments,
            r.From!, r.To!)).ToList());
    }
}
