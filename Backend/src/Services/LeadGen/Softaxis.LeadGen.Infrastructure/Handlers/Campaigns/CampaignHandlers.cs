using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.LeadGen.Application;
using Softaxis.LeadGen.Application.Abstractions;
using Softaxis.LeadGen.Application.Campaigns;
using Softaxis.LeadGen.Domain.Entities;
using Softaxis.LeadGen.Infrastructure.Handlers.Setup;
using Softaxis.LeadGen.Infrastructure.Mail;
using Softaxis.LeadGen.Infrastructure.Persistence;
using Softaxis.LeadGen.Infrastructure.Services;

namespace Softaxis.LeadGen.Infrastructure.Handlers.Campaigns;

internal static class CampaignMapping
{
    public static async Task<CampaignDto> ToDtoAsync(LeadGenDbContext db, Campaign c, CancellationToken ct)
    {
        var address = await db.Mailboxes.AsNoTracking().Where(m => m.Id == c.MailboxId).Select(m => m.Address).FirstOrDefaultAsync(ct);
        var by = await db.Recipients.AsNoTracking().Where(r => r.CampaignId == c.Id).GroupBy(r => r.Status)
            .Select(g => new { g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.N, ct);
        int N(string s) => by.GetValueOrDefault(s);
        var counts = new CampaignCountsDto(by.Values.Sum(), N(RecipientStatus.Pending), N(RecipientStatus.Active), N(RecipientStatus.Completed),
            N(RecipientStatus.Replied), N(RecipientStatus.Bounced), N(RecipientStatus.Unsubscribed), N(RecipientStatus.Stopped),
            N(RecipientStatus.Failed), N(RecipientStatus.Skipped));

        var sent = await db.Messages.AsNoTracking().CountAsync(m => m.CampaignId == c.Id && m.Direction == MessageDirection.Out && m.Status != MessageStatus.Failed && m.Status != MessageStatus.Queued, ct);
        var contacted = await db.Recipients.AsNoTracking().CountAsync(r => r.CampaignId == c.Id && r.CurrentStep > 0, ct);
        var replies = counts.Replied;
        double Pct(int a, int b) => b == 0 ? 0 : Math.Round(a * 100.0 / b, 1);

        var steps = c.Steps.OrderBy(s => s.Number).Select(s => new StepDto(s.Id, s.Number, s.DelayDays, s.Subject, s.Body)).ToList();
        return new CampaignDto(c.Id, c.Name, c.MailboxId, address, c.Status, c.PauseReason, c.TimeZoneId, c.WindowStart, c.WindowEnd,
            c.SendDays, c.DailyCap, c.StopOnReply, steps, counts, sent, replies, Pct(replies, contacted), Pct(counts.Bounced, contacted),
            c.CreatedByName, c.CreatedAt, c.StartedAt);
    }

    public static async Task<Campaign?> LoadAsync(LeadGenDbContext db, Guid id, CancellationToken ct) =>
        await db.Campaigns.Include(c => c.Steps).FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted, ct);
}

internal sealed class GetCampaignsHandler(LeadGenDbContext db) : IQueryHandler<GetCampaignsQuery, IReadOnlyList<CampaignDto>>
{
    public async Task<Result<IReadOnlyList<CampaignDto>>> Handle(GetCampaignsQuery q, CancellationToken ct)
    {
        var rows = await db.Campaigns.AsNoTracking().Include(c => c.Steps).Where(c => !c.IsDeleted).OrderByDescending(c => c.CreatedAt).Take(200).ToListAsync(ct);
        var list = new List<CampaignDto>();
        foreach (var c in rows) list.Add(await CampaignMapping.ToDtoAsync(db, c, ct));
        return Result.Success<IReadOnlyList<CampaignDto>>(list);
    }
}

internal sealed class GetCampaignByIdHandler(LeadGenDbContext db) : IQueryHandler<GetCampaignByIdQuery, CampaignDto>
{
    public async Task<Result<CampaignDto>> Handle(GetCampaignByIdQuery q, CancellationToken ct)
    {
        var c = await db.Campaigns.AsNoTracking().Include(x => x.Steps).FirstOrDefaultAsync(x => x.Id == q.Id && !x.IsDeleted, ct);
        return c is null ? Result.Failure<CampaignDto>(Error.NotFoundById("Campaign", q.Id)) : Result.Success(await CampaignMapping.ToDtoAsync(db, c, ct));
    }
}

internal sealed class GetRecipientsHandler(LeadGenDbContext db) : IQueryHandler<GetRecipientsQuery, PagedResult<RecipientDto>>
{
    public async Task<Result<PagedResult<RecipientDto>>> Handle(GetRecipientsQuery q, CancellationToken ct)
    {
        var page = Math.Max(1, q.Page); var size = Math.Clamp(q.PageSize, 1, 200);
        var query = db.Recipients.AsNoTracking().Where(r => r.CampaignId == q.CampaignId);
        if (!string.IsNullOrWhiteSpace(q.Status)) query = query.Where(r => r.Status == q.Status);
        var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(r => r.LastSentAt ?? r.CreatedAt).Skip((page - 1) * size).Take(size).ToListAsync(ct);
        var ids = rows.Select(r => r.ProspectId).ToList();
        var names = await db.Prospects.AsNoTracking().Where(p => ids.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Name, ct);
        var items = rows.Select(r => new RecipientDto(r.Id, r.ProspectId, names.GetValueOrDefault(r.ProspectId, "—"), r.Email, r.Status,
            r.CurrentStep, r.NextSendAt, r.LastSentAt, r.LastError, r.ThreadId)).ToList();
        return Result.Success(new PagedResult<RecipientDto>(items, total, page, size));
    }
}

internal static class CampaignWrite
{
    public static async Task<Error?> ApplyAsync(LeadGenDbContext db, Campaign c, CampaignInput i, CancellationToken ct)
    {
        var mailbox = await db.Mailboxes.AsNoTracking().FirstOrDefaultAsync(m => m.Id == i.MailboxId && !m.IsDeleted, ct);
        if (mailbox is null) return Error.Custom("Campaign.Invalid", "Choose a connected mailbox to send from.");

        // Once emails have gone out, steps that were already sent cannot be removed from under their recipients.
        var maxSent = c.Id == Guid.Empty ? 0 : await db.Recipients.Where(r => r.CampaignId == c.Id).Select(r => (int?)r.CurrentStep).MaxAsync(ct) ?? 0;
        if (i.Steps.Count < maxSent)
            return Error.Custom("Campaign.Conflict", $"Emails up to step {maxSent} have already been sent, so the sequence cannot be shorter than {maxSent}.");

        c.Configure(i.Name, i.MailboxId, i.TimeZoneId, i.WindowStart, i.WindowEnd, i.SendDays, i.DailyCap, i.StopOnReply);

        // Steps are matched by number and updated in place. Messages refer to a step by its number, and a
        // delete-then-insert of the same number would fight the unique index within one save.
        var existing = c.Steps.ToDictionary(s => s.Number);
        var n = 1;
        foreach (var s in i.Steps)
        {
            var delay = n == 1 ? 0 : s.DelayDays;
            if (existing.TryGetValue(n, out var step)) step.Update(delay, s.Subject.Trim(), s.Body.Trim());
            else
            {
                step = new CampaignStep(c.Id, n, delay, s.Subject.Trim(), s.Body.Trim());
                c.Steps.Add(step);
                db.Steps.Add(step);
            }
            n++;
        }
        foreach (var extra in existing.Values.Where(s => s.Number >= n)) { db.Steps.Remove(extra); c.Steps.Remove(extra); }
        return null;
    }
}

internal sealed class CreateCampaignHandler(LeadGenDbContext db, ICurrentUser user) : ICommandHandler<CreateCampaignCommand, CampaignDto>
{
    public async Task<Result<CampaignDto>> Handle(CreateCampaignCommand cmd, CancellationToken ct)
    {
        var c = new Campaign(cmd.Input.Name, cmd.Input.MailboxId, user.Id, user.Name);
        db.Campaigns.Add(c);
        if (await CampaignWrite.ApplyAsync(db, c, cmd.Input, ct) is { } error)
        { db.Entry(c).State = EntityState.Detached; return Result.Failure<CampaignDto>(error); }
        await db.SaveChangesAsync(ct);
        return Result.Success(await CampaignMapping.ToDtoAsync(db, c, ct));
    }
}

internal sealed class UpdateCampaignHandler(LeadGenDbContext db) : ICommandHandler<UpdateCampaignCommand, CampaignDto>
{
    public async Task<Result<CampaignDto>> Handle(UpdateCampaignCommand cmd, CancellationToken ct)
    {
        var c = await CampaignMapping.LoadAsync(db, cmd.Id, ct);
        if (c is null) return Result.Failure<CampaignDto>(Error.NotFoundById("Campaign", cmd.Id));
        if (c.Status == CampaignStatus.Active)
            return Result.Failure<CampaignDto>(Error.Custom("Campaign.Conflict", "Pause the campaign before editing it."));
        if (await CampaignWrite.ApplyAsync(db, c, cmd.Input, ct) is { } error) return Result.Failure<CampaignDto>(error);
        await db.SaveChangesAsync(ct);
        return Result.Success(await CampaignMapping.ToDtoAsync(db, c, ct));
    }
}

internal sealed class DeleteCampaignHandler(LeadGenDbContext db) : ICommandHandler<DeleteCampaignCommand>
{
    public async Task<Result> Handle(DeleteCampaignCommand cmd, CancellationToken ct)
    {
        var c = await db.Campaigns.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (c is null) return Result.Failure(Error.NotFoundById("Campaign", cmd.Id));
        foreach (var r in await db.Recipients.Where(r => r.CampaignId == c.Id && (r.Status == RecipientStatus.Pending || r.Status == RecipientStatus.Active)).ToListAsync(ct))
            r.Close(RecipientStatus.Stopped);
        c.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class AddRecipientsHandler(LeadGenDbContext db) : ICommandHandler<AddRecipientsCommand, AddRecipientsResult>
{
    public async Task<Result<AddRecipientsResult>> Handle(AddRecipientsCommand cmd, CancellationToken ct)
    {
        var c = await db.Campaigns.FirstOrDefaultAsync(x => x.Id == cmd.CampaignId && !x.IsDeleted, ct);
        if (c is null) return Result.Failure<AddRecipientsResult>(Error.NotFoundById("Campaign", cmd.CampaignId));
        if (c.Status is CampaignStatus.Completed or CampaignStatus.Stopped)
            return Result.Failure<AddRecipientsResult>(Error.Custom("Campaign.Conflict", "This campaign has ended. Create a new one."));

        var ids = cmd.ProspectIds.Distinct().ToList();
        var prospects = await db.Prospects.AsNoTracking().Where(p => ids.Contains(p.Id) && !p.IsDeleted).ToListAsync(ct);
        var suppressed = await SuppressionSupport.LoadAsync(db, ct);

        // Anyone already waiting in ANY live campaign would be emailed twice; keep them where they are.
        var busy = (await db.Recipients.AsNoTracking().Where(r => ids.Contains(r.ProspectId)
                && (r.Status == RecipientStatus.Pending || r.Status == RecipientStatus.Active)).Select(r => r.ProspectId).ToListAsync(ct)).ToHashSet();
        var inThis = (await db.Recipients.AsNoTracking().Where(r => r.CampaignId == c.Id && ids.Contains(r.ProspectId)).Select(r => r.ProspectId).ToListAsync(ct)).ToHashSet();

        int added = 0, noEmail = 0, notSendable = 0, sup = 0, dup = 0, notRevealed = 0;
        var now = DateTime.UtcNow;
        foreach (var p in prospects)
        {
            if (!p.IsRevealed) { notRevealed++; continue; }
            if (string.IsNullOrWhiteSpace(p.Email)) { noEmail++; continue; }
            if (p.Status == ProspectStatus.DoNotContact || SuppressionSupport.IsSuppressed(suppressed, p.Email, p.Domain, p.PhoneE164)) { sup++; continue; }
            if (!EmailStatus.Sendable(p.EmailStatus)) { notSendable++; continue; }
            if (busy.Contains(p.Id) || inThis.Contains(p.Id)) { dup++; continue; }

            var r = new CampaignRecipient(c.Id, p.Id, p.Email);
            if (c.Status == CampaignStatus.Active)
                r.Schedule(SendSchedule.NextSlot(now, c.TimeZoneId, c.WindowStart, c.WindowEnd, c.SendDays));
            db.Recipients.Add(r);
            added++;
        }
        await db.SaveChangesAsync(ct);
        return Result.Success(new AddRecipientsResult(added, noEmail, notSendable, sup, dup, notRevealed));
    }
}

internal sealed class RemoveRecipientsHandler(LeadGenDbContext db) : ICommandHandler<RemoveRecipientsCommand, int>
{
    public async Task<Result<int>> Handle(RemoveRecipientsCommand cmd, CancellationToken ct)
    {
        var ids = cmd.RecipientIds.Distinct().ToList();
        // Only people who have not been contacted can simply be removed; someone mid-sequence is stopped instead,
        // so their conversation and history stay attached.
        var rows = await db.Recipients.Where(r => r.CampaignId == cmd.CampaignId && ids.Contains(r.Id)).ToListAsync(ct);
        var removed = 0;
        foreach (var r in rows)
        {
            if (r.CurrentStep == 0 && r.ThreadId is null) { db.Recipients.Remove(r); removed++; }
            else if (RecipientStatus.IsOpen(r.Status)) { r.Close(RecipientStatus.Stopped); removed++; }
        }
        await db.SaveChangesAsync(ct);
        return Result.Success(removed);
    }
}

internal sealed class StartCampaignHandler(LeadGenDbContext db, IOutreachPolicy policy) : ICommandHandler<StartCampaignCommand, CampaignDto>
{
    public async Task<Result<CampaignDto>> Handle(StartCampaignCommand cmd, CancellationToken ct)
    {
        var c = await CampaignMapping.LoadAsync(db, cmd.Id, ct);
        if (c is null) return Result.Failure<CampaignDto>(Error.NotFoundById("Campaign", cmd.Id));
        if (c.Status == CampaignStatus.Active) return Result.Success(await CampaignMapping.ToDtoAsync(db, c, ct));
        if (c.Status is CampaignStatus.Completed or CampaignStatus.Stopped)
            return Result.Failure<CampaignDto>(Error.Custom("Campaign.Conflict", "This campaign has ended. Duplicate it to send again."));

        var gate = await policy.CanSendAsync(ct);
        if (!gate.Ok) return Result.Failure<CampaignDto>(Error.Custom("Campaign.Conflict", gate.Reason!));

        var mailbox = await db.Mailboxes.AsNoTracking().FirstOrDefaultAsync(m => m.Id == c.MailboxId && !m.IsDeleted, ct);
        if (mailbox is null || mailbox.Status != MailboxStatus.Connected)
            return Result.Failure<CampaignDto>(Error.Custom("Campaign.Conflict", "The mailbox is not connected. Reconnect or resume it first."));
        if (c.Steps.Count == 0) return Result.Failure<CampaignDto>(Error.Custom("Campaign.Conflict", "Add at least one email."));

        var open = await db.Recipients.Where(r => r.CampaignId == c.Id && (r.Status == RecipientStatus.Pending || r.Status == RecipientStatus.Active)).ToListAsync(ct);
        if (open.Count == 0) return Result.Failure<CampaignDto>(Error.Custom("Campaign.Conflict", "Add some recipients first."));

        var now = DateTime.UtcNow;
        foreach (var r in open.Where(r => r.NextSendAt is null))
            r.Schedule(SendSchedule.NextSlot(now, c.TimeZoneId, c.WindowStart, c.WindowEnd, c.SendDays));
        c.Start();
        await db.SaveChangesAsync(ct);
        return Result.Success(await CampaignMapping.ToDtoAsync(db, c, ct));
    }
}

internal sealed class PauseCampaignHandler(LeadGenDbContext db) : ICommandHandler<PauseCampaignCommand, CampaignDto>
{
    public async Task<Result<CampaignDto>> Handle(PauseCampaignCommand cmd, CancellationToken ct)
    {
        var c = await CampaignMapping.LoadAsync(db, cmd.Id, ct);
        if (c is null) return Result.Failure<CampaignDto>(Error.NotFoundById("Campaign", cmd.Id));
        c.Pause("Paused by you.");
        await db.SaveChangesAsync(ct);
        return Result.Success(await CampaignMapping.ToDtoAsync(db, c, ct));
    }
}

internal sealed class StopCampaignHandler(LeadGenDbContext db) : ICommandHandler<StopCampaignCommand, CampaignDto>
{
    public async Task<Result<CampaignDto>> Handle(StopCampaignCommand cmd, CancellationToken ct)
    {
        var c = await CampaignMapping.LoadAsync(db, cmd.Id, ct);
        if (c is null) return Result.Failure<CampaignDto>(Error.NotFoundById("Campaign", cmd.Id));
        foreach (var r in await db.Recipients.Where(r => r.CampaignId == c.Id && (r.Status == RecipientStatus.Pending || r.Status == RecipientStatus.Active)).ToListAsync(ct))
            r.Close(RecipientStatus.Stopped);
        c.Stop();
        await db.SaveChangesAsync(ct);
        return Result.Success(await CampaignMapping.ToDtoAsync(db, c, ct));
    }
}

/// <summary>Renders one step for one prospect so the user sees exactly what a recipient will read — merge fields, footer and all.</summary>
internal sealed class PreviewEmailHandler(LeadGenDbContext db, IEmailRenderer renderer, IUnsubscribeTokens tokens)
    : IQueryHandler<PreviewEmailQuery, PreviewDto>
{
    public async Task<Result<PreviewDto>> Handle(PreviewEmailQuery q, CancellationToken ct)
    {
        var c = await db.Campaigns.AsNoTracking().Include(x => x.Steps).FirstOrDefaultAsync(x => x.Id == q.CampaignId && !x.IsDeleted, ct);
        if (c is null) return Result.Failure<PreviewDto>(Error.NotFoundById("Campaign", q.CampaignId));
        var step = c.Steps.FirstOrDefault(s => s.Number == q.Step);
        if (step is null) return Result.Failure<PreviewDto>(Error.NotFoundById("Step", q.Step));

        var prospect = q.ProspectId is { } pid
            ? await db.Prospects.AsNoTracking().FirstOrDefaultAsync(p => p.Id == pid && !p.IsDeleted, ct)
            : await (from r in db.Recipients.AsNoTracking() join p in db.Prospects.AsNoTracking() on r.ProspectId equals p.Id
                     where r.CampaignId == c.Id && !p.IsDeleted select p).FirstOrDefaultAsync(ct);
        var sample = prospect ?? SamplePreview.Prospect();

        var profile = await db.Profiles.AsNoTracking().FirstOrDefaultAsync(ct);
        var mailbox = await db.Mailboxes.AsNoTracking().FirstOrDefaultAsync(m => m.Id == c.MailboxId, ct);
        var rendered = renderer.Render(step.Subject, step.Body, sample, profile, mailbox?.DisplayName,
            tokens.UrlFor(TenantAmbient.TenantId ?? Guid.Empty, sample.Email ?? "name@example.com", c.Id));

        var warnings = new List<string>();
        if (prospect is null) warnings.Add("No recipients yet, so this shows sample details.");
        if (string.IsNullOrWhiteSpace(profile?.SenderBusinessName) || string.IsNullOrWhiteSpace(profile?.SenderAddress))
            warnings.Add("Add your business name and postal address in Settings. They appear in the footer and are required to send.");
        foreach (var field in MergeFields.Used(step.Subject + " " + step.Body))
            if (prospect is not null && SamplePreview.IsEmpty(prospect, field, profile, mailbox?.DisplayName))
                warnings.Add($"{{{{{field}}}}} is empty for this prospect, so that part will read oddly.");

        return Result.Success(new PreviewDto(rendered.Subject, rendered.Text, sample.Email ?? "name@example.com", warnings));
    }
}

internal static class SamplePreview
{
    public static Prospect Prospect()
    {
        var p = new Prospect(null, "Al Noor Dental Clinic", "AE");
        p.SetListing(null, "dental", null, "Dubai", "Dubai", "Dubai Marina", null, null, null, null, null, null, "alnoor.ae", "alnoor.ae", null, null, null, null, null);
        p.SetContactEmail("hello@alnoor.ae", EmailStatus.Likely, true);
        return p;
    }

    public static bool IsEmpty(Prospect p, string field, LeadGenProfile? profile, string? senderName) => field switch
    {
        "area" => string.IsNullOrWhiteSpace(p.Area ?? p.City ?? p.Region),
        "city" => string.IsNullOrWhiteSpace(p.City ?? p.Region),
        "region" => string.IsNullOrWhiteSpace(p.Region),
        "website" => string.IsNullOrWhiteSpace(p.Domain),
        "category" => string.IsNullOrWhiteSpace(p.Category),
        "sender_name" => string.IsNullOrWhiteSpace(senderName ?? profile?.SenderBusinessName),
        "sender_business" => string.IsNullOrWhiteSpace(profile?.SenderBusinessName),
        _ => false,
    };
}

internal sealed class SendCampaignTestHandler(
    LeadGenDbContext db, IEmailRenderer renderer, IUnsubscribeTokens tokens, IMailboxAuth auth,
    IMailTransportFactory transports, IOutreachPolicy policy, IMemoryCache cache) : ICommandHandler<SendCampaignTestCommand>
{
    public async Task<Result> Handle(SendCampaignTestCommand cmd, CancellationToken ct)
    {
        var c = await db.Campaigns.AsNoTracking().Include(x => x.Steps).FirstOrDefaultAsync(x => x.Id == cmd.CampaignId && !x.IsDeleted, ct);
        if (c is null) return Result.Failure(Error.NotFoundById("Campaign", cmd.CampaignId));
        var step = c.Steps.FirstOrDefault(s => s.Number == cmd.Step);
        if (step is null) return Result.Failure(Error.NotFoundById("Step", cmd.Step));

        var mailbox = await db.Mailboxes.FirstOrDefaultAsync(m => m.Id == c.MailboxId && !m.IsDeleted, ct);
        if (mailbox is null || !mailbox.CanSend) return Result.Failure(Error.Custom("Campaign.Conflict", "The mailbox is not connected."));

        var key = $"leadgen:ctest:{mailbox.Id}:{DateTime.UtcNow:yyyyMMdd}";
        var used = cache.GetOrCreate(key, e => { e.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(24); return 0; });
        if (used >= 5) return Result.Failure(Error.Custom("Campaign.Conflict", "You can send up to 5 test emails a day per mailbox."));
        var gate = await policy.CanSendAsync(ct);
        if (!gate.Ok) return Result.Failure(Error.Custom("Campaign.Conflict", gate.Reason!));

        var prospect = await (from r in db.Recipients.AsNoTracking() join p in db.Prospects.AsNoTracking() on r.ProspectId equals p.Id
                              where r.CampaignId == c.Id && !p.IsDeleted select p).FirstOrDefaultAsync(ct) ?? SamplePreview.Prospect();
        var profile = await db.Profiles.AsNoTracking().FirstOrDefaultAsync(ct);
        var rendered = renderer.Render(step.Subject, step.Body, prospect, profile, mailbox.DisplayName,
            tokens.UrlFor(TenantAmbient.TenantId ?? Guid.Empty, cmd.To, c.Id));

        try
        {
            var creds = await auth.ResolveAsync(mailbox, ct);
            var domain = mailbox.Address[(mailbox.Address.IndexOf('@') + 1)..];
            await transports.For(mailbox.Provider).SendAsync(creds, new OutgoingEmail(
                mailbox.Address, mailbox.DisplayName, cmd.To.Trim(), null, "[Test] " + rendered.Subject, rendered.Text, rendered.Html,
                $"<{Guid.NewGuid():N}@{domain}>", null, [], null, null, null), ct);
            cache.Set(key, used + 1, TimeSpan.FromHours(24));
            await db.SaveChangesAsync(ct);
            return Result.Success();
        }
        catch (MailAuthException ex) { mailbox.MarkError(ex.Message); await db.SaveChangesAsync(ct); return Result.Failure(Error.Custom("Campaign.Conflict", ex.Message)); }
        catch (Exception ex) when (ex is MailRejectedException or MailTransientException) { return Result.Failure(Error.Custom("Campaign.Conflict", ex.Message)); }
    }
}
