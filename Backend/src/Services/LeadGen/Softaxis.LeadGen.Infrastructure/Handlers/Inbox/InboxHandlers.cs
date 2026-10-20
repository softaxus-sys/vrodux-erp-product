using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.LeadGen.Application;
using Softaxis.LeadGen.Application.Abstractions;
using Softaxis.LeadGen.Application.Inbox;
using Softaxis.LeadGen.Domain.Entities;
using Softaxis.LeadGen.Infrastructure.Handlers.Setup;
using Softaxis.LeadGen.Infrastructure.Mail;
using Softaxis.LeadGen.Infrastructure.Persistence;
using Softaxis.LeadGen.Infrastructure.Services;

namespace Softaxis.LeadGen.Infrastructure.Handlers.Inbox;

internal static class InboxMapping
{
    public static async Task<List<ThreadDto>> ToDtosAsync(LeadGenDbContext db, IReadOnlyList<OutreachThread> rows, CancellationToken ct)
    {
        var mailboxIds = rows.Select(t => t.MailboxId).Distinct().ToList();
        var prospectIds = rows.Where(t => t.ProspectId != null).Select(t => t.ProspectId!.Value).Distinct().ToList();
        var campaignIds = rows.Where(t => t.CampaignId != null).Select(t => t.CampaignId!.Value).Distinct().ToList();
        var boxes = await db.Mailboxes.AsNoTracking().Where(m => mailboxIds.Contains(m.Id)).ToDictionaryAsync(m => m.Id, m => m.Address, ct);
        var prospects = await db.Prospects.AsNoTracking().Where(p => prospectIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Name, ct);
        var campaigns = await db.Campaigns.AsNoTracking().Where(c => campaignIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.Name, ct);

        return rows.Select(t => new ThreadDto(
            t.Id, t.MailboxId, boxes.GetValueOrDefault(t.MailboxId), t.ProspectId,
            t.ProspectId is { } p ? prospects.GetValueOrDefault(p) : null, t.CampaignId,
            t.CampaignId is { } c ? campaigns.GetValueOrDefault(c) : null, t.Counterparty, t.Subject, t.Classification,
            t.MessageCount, t.UnreadCount, t.HasReply, t.AssignedUserId, t.AssignedName, t.IsArchived, t.LastMessageAt, t.Snippet)).ToList();
    }

    public static MessageDto ToDto(OutreachMessage m) => new(m.Id, m.Direction, m.Status, m.FromAddress, m.ToAddress, m.Cc, m.Subject,
        m.BodyText, m.OccurredAt, m.IsRead, m.Error, m.StepNumber);
}

internal sealed class GetThreadsHandler(LeadGenDbContext db, ICurrentUser user) : IQueryHandler<GetThreadsQuery, PagedResult<ThreadDto>>
{
    public async Task<Result<PagedResult<ThreadDto>>> Handle(GetThreadsQuery q, CancellationToken ct)
    {
        var f = q.Filter; var page = Math.Max(1, q.Page); var size = Math.Clamp(q.PageSize, 1, 100);
        var query = db.Threads.AsNoTracking().Where(t => !t.IsDeleted);

        // The inbox is for conversations, so by default only threads somebody has answered.
        if (f.RepliesOnly != false) query = query.Where(t => t.HasReply);
        if (f.Archived is { } a) query = query.Where(t => t.IsArchived == a);
        if (f.MailboxId is { } mb) query = query.Where(t => t.MailboxId == mb);
        if (!string.IsNullOrWhiteSpace(f.Classification)) query = query.Where(t => t.Classification == f.Classification);
        if (f.Unread == true) query = query.Where(t => t.UnreadCount > 0);
        if (f.Mine == true && user.Id is { } me) query = query.Where(t => t.AssignedUserId == me);
        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            var s = f.Search.Trim();
            query = query.Where(t => t.Counterparty.Contains(s) || t.Subject.Contains(s) || (t.Snippet != null && t.Snippet.Contains(s)));
        }

        var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(t => t.LastMessageAt).Skip((page - 1) * size).Take(size).ToListAsync(ct);
        return Result.Success(new PagedResult<ThreadDto>(await InboxMapping.ToDtosAsync(db, rows, ct), total, page, size));
    }
}

internal sealed class GetThreadHandler(LeadGenDbContext db) : IQueryHandler<GetThreadQuery, ThreadDetailDto>
{
    public async Task<Result<ThreadDetailDto>> Handle(GetThreadQuery q, CancellationToken ct)
    {
        var t = await db.Threads.AsNoTracking().FirstOrDefaultAsync(x => x.Id == q.Id && !x.IsDeleted, ct);
        if (t is null) return Result.Failure<ThreadDetailDto>(Error.NotFoundById("Thread", q.Id));
        var messages = await db.Messages.AsNoTracking().Where(m => m.ThreadId == t.Id && !m.IsDeleted).OrderBy(m => m.OccurredAt).ToListAsync(ct);
        var dto = (await InboxMapping.ToDtosAsync(db, [t], ct))[0];
        return Result.Success(new ThreadDetailDto(dto, messages.Select(InboxMapping.ToDto).ToList()));
    }
}

internal sealed class GetInboxCountsHandler(LeadGenDbContext db) : IQueryHandler<GetInboxCountsQuery, InboxCountsDto>
{
    public async Task<Result<InboxCountsDto>> Handle(GetInboxCountsQuery q, CancellationToken ct)
    {
        var open = db.Threads.AsNoTracking().Where(t => !t.IsDeleted && !t.IsArchived && t.HasReply);
        var unread = await open.CountAsync(t => t.UnreadCount > 0, ct);
        var replies = await open.CountAsync(ct);
        var attention = await open.CountAsync(t => t.UnreadCount > 0 &&
            (t.Classification == ThreadClass.Interested || t.Classification == ThreadClass.Question || t.Classification == ThreadClass.None), ct);
        return Result.Success(new InboxCountsDto(unread, replies, attention));
    }
}

internal sealed class ReplyHandler(
    LeadGenDbContext db, IOutreachEngine engine, IOutreachPolicy policy, ICurrentUser user) : ICommandHandler<ReplyCommand, MessageDto>
{
    public async Task<Result<MessageDto>> Handle(ReplyCommand cmd, CancellationToken ct)
    {
        var thread = await db.Threads.FirstOrDefaultAsync(t => t.Id == cmd.ThreadId && !t.IsDeleted, ct);
        if (thread is null) return Result.Failure<MessageDto>(Error.NotFoundById("Thread", cmd.ThreadId));

        var mailbox = await db.Mailboxes.FirstOrDefaultAsync(m => m.Id == thread.MailboxId && !m.IsDeleted, ct);
        if (mailbox is null || !mailbox.CanSend)
            return Result.Failure<MessageDto>(Error.Custom("Inbox.Conflict", "The mailbox for this conversation is not connected."));

        var gate = await policy.CanSendAsync(ct);
        if (!gate.Ok) return Result.Failure<MessageDto>(Error.Custom("Inbox.Conflict", gate.Reason!));

        // Someone who asked to be left alone stays left alone, even in a conversation they started.
        var suppressed = await SuppressionSupport.LoadAsync(db, ct);
        if (SuppressionSupport.IsSuppressed(suppressed, thread.Counterparty, null, null))
            return Result.Failure<MessageDto>(Error.Custom("Inbox.Conflict", "This person asked not to be contacted, so you cannot write to them."));

        var cfg = await db.PlatformSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        if (cfg is not null && mailbox.RemainingToday(DateTime.UtcNow, cfg.MaxDailySendsPerMailbox) <= 0)
            return Result.Failure<MessageDto>(Error.Custom("Inbox.Conflict", "This mailbox has reached today's sending limit. Try again tomorrow."));

        try
        {
            var msg = await engine.SendReplyAsync(thread, mailbox, cmd.Body, ct);
            if (thread.AssignedUserId is null && user.Id is { } me) { thread.Assign(me, user.Name); await db.SaveChangesAsync(ct); }
            return Result.Success(InboxMapping.ToDto(msg));
        }
        catch (MailAuthException ex)
        {
            mailbox.MarkError(ex.Message);
            await db.SaveChangesAsync(ct);
            return Result.Failure<MessageDto>(Error.Custom("Inbox.Conflict", ex.Message));
        }
        catch (Exception ex) when (ex is MailRejectedException or MailTransientException)
        {
            return Result.Failure<MessageDto>(Error.Custom("Inbox.Conflict", ex.Message));
        }
    }
}

internal sealed class UpdateThreadHandler(LeadGenDbContext db) : ICommandHandler<UpdateThreadCommand, ThreadDto>
{
    public async Task<Result<ThreadDto>> Handle(UpdateThreadCommand cmd, CancellationToken ct)
    {
        var t = await db.Threads.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (t is null) return Result.Failure<ThreadDto>(Error.NotFoundById("Thread", cmd.Id));

        if (cmd.MarkRead == true)
        {
            t.MarkRead();
            foreach (var m in await db.Messages.Where(m => m.ThreadId == t.Id && m.Direction == MessageDirection.In && !m.IsRead).ToListAsync(ct)) m.SetRead(true);
        }
        if (cmd.Archived is { } arch) t.Archive(arch);
        if (cmd.ClearAssignee) t.Assign(null, null);
        else if (cmd.AssignedUserId is { } uid) t.Assign(uid, cmd.AssignedName);

        if (cmd.Classification is { } label && label != t.Classification)
        {
            t.Classify(label);
            var prospect = t.ProspectId is { } pid ? await db.Prospects.FirstOrDefaultAsync(p => p.Id == pid, ct) : null;

            if (label == ThreadClass.Unsubscribe)
            {
                await SuppressionSupport.AddAsync(db, SuppressionKind.Email, t.Counterparty, SuppressionReason.Unsubscribed, "inbox", null, alsoGlobal: true, ct);
                foreach (var r in await db.Recipients.Where(r => r.Email == t.Counterparty && (r.Status == RecipientStatus.Pending || r.Status == RecipientStatus.Active || r.Status == RecipientStatus.Completed)).ToListAsync(ct))
                    r.Close(RecipientStatus.Unsubscribed);
                prospect?.SetStatus(ProspectStatus.DoNotContact);
            }
            else if (label == ThreadClass.NotInterested) prospect?.SetStatus(ProspectStatus.Rejected);
        }

        await db.SaveChangesAsync(ct);
        return Result.Success((await InboxMapping.ToDtosAsync(db, [t], ct))[0]);
    }
}
