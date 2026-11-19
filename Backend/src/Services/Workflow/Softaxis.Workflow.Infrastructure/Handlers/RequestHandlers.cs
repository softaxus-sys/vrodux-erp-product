using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Workflow.Application;
using Softaxis.Workflow.Domain.Entities;
using Softaxis.Workflow.Infrastructure.Persistence;
using Softaxis.Workflow.Infrastructure.Services;

namespace Softaxis.Workflow.Infrastructure.Handlers;

/// <summary>Loading, visibility and mapping shared by every request handler.</summary>
internal static class Req
{
    public static Task<WfRequest?> LoadAsync(WorkflowDbContext db, Guid id, CancellationToken ct) =>
        db.Requests.Include(r => r.Steps).ThenInclude(s => s.Assignees)
            .FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted, ct);

    public static bool CanSee(WfRequest r, WfAccess a)
    {
        var me = a.UserId;
        if (r.RequesterId == me) return true;
        if (r.Status == RequestStatus.Draft) return false;           // a draft is nobody else's business
        if (a.SeesAll) return true;
        return r.Steps.Any(s => s.Assignees.Any(x => x.UserId == me));
    }

    public static WfRequestStep? Current(WfRequest r) =>
        r.Steps.Where(s => s.Status == StepStatus.Pending).OrderBy(s => s.Order).FirstOrDefault();

    public static async Task<RequestDetailDto> DetailAsync(WorkflowDbContext db, WfAccess access, ICurrentUser user, WfRequest r, CancellationToken ct)
    {
        var atts = await db.Attachments.AsNoTracking().Where(a => a.RequestId == r.Id && !a.IsDeleted).OrderBy(a => a.CreatedAt)
            .Select(a => new AttachmentDto(a.Id, a.FieldKey, a.FileName, a.ContentType, a.Size, a.UploadedByName, a.CreatedAt)).ToListAsync(ct);
        var comments = await db.Comments.AsNoTracking().Where(c => c.RequestId == r.Id).OrderBy(c => c.CreatedAt)
            .Select(c => new CommentDto(c.Id, c.AuthorId, c.AuthorName, c.Text, c.CreatedAt)).ToListAsync(ct);
        var timeline = await db.Audit.AsNoTracking().Where(a => a.RequestId == r.Id && a.Action != "request.viewed").OrderBy(a => a.At)
            .Select(a => new TimelineDto(a.At, a.UserName, a.Action, a.Detail)).ToListAsync(ct);

        var me = access.UserId;
        var current = Current(r);
        var isAssignee = current is not null && current.Assignees.Any(a => a.UserId == me);
        var mayApprove = user.IsSuperAdmin || user.HasPermission(WfPerm.Approve);
        var steps = r.Steps.OrderBy(s => s.Order).Select(s => new RequestStepDto(s.Id, s.Order, s.Kind, s.PositionName, s.Label, s.Status,
            s.Assignees.Select(a => new StepAssigneeDto(a.UserId, a.Name, a.Designation)).ToList(),
            s.DecidedByName, s.DecidedByDesignation, s.DecidedAt, s.Comment, s.SkipReason, s.PdfData is not null, s.ActivatedAt)).ToList();

        return new RequestDetailDto(r.Id, r.Number, r.FormId, r.FormName, r.FormKey, r.FormVersion, r.FieldsJson, r.BaseId, r.BaseName, r.UnitId, r.UnitName,
            r.Title, r.DataJson, r.Amount, r.Status, r.RequesterId, r.RequesterName, r.RequesterEmail, r.RequesterDesignation, r.CreatedAt,
            r.SubmittedAt, r.CompletedAt, r.FinalReason, r.ResubmittedFromId, steps, atts, comments, timeline,
            CanDecide: r.Status == RequestStatus.Pending && isAssignee && mayApprove,
            CurrentStepId: current?.Id,
            CanEdit: r.Status == RequestStatus.Draft && r.RequesterId == me,
            CanCancel: r.Status == RequestStatus.Pending && (r.RequesterId == me || access.IsAdmin),
            CanReassign: r.Status == RequestStatus.Pending && access.CanReassign,
            CanResubmit: r.Status is RequestStatus.Rejected or RequestStatus.Cancelled && r.RequesterId == me);
    }

    public static string Link(Guid id) => $"/workflow/requests/{id}";

    public static NotificationRequest Alert(Guid to, string ev, string title, string message, Guid requestId, Guid? actor, string type = "info") =>
        new(to, "workflow", ev, title, message, Link(requestId), type, "request", requestId, null, actor);
}

/// <summary>The business rules of moving a request along its chain.</summary>
internal sealed class RequestEngine(WorkflowDbContext db, FlowResolver resolver, INotificationDispatcher notifier, WfBranding branding)
{
    /// <summary>
    /// Freezes the approval chain for this request and starts it. The chain is resolved now, with the people
    /// who hold each position today, and kept: a later change to the matrix never rewires a request already in flight.
    /// </summary>
    public async Task<Result> SubmitAsync(WfRequest r, ICurrentUser user, CancellationToken ct)
    {
        var resolved = await resolver.ResolveAsync(r.FormId, r.BaseId, r.UnitId, r.Amount, r.BaseName, r.UnitName, ct);
        if (resolved.Flow is null || resolved.Problems.Count > 0)
            return Result.Failure(Wf.Conflict("Request", string.Join(" ", resolved.Problems.Distinct())));

        var me = user.Id ?? Guid.Empty;
        var steps = new List<WfRequestStep>();
        var assigneeRows = new List<WfStepAssignee>();
        var n = 0;
        foreach (var s in resolved.Steps.Where(x => x.Applies))
        {
            n++;
            var step = new WfRequestStep(r.Id, n, s.Kind, s.PositionId, s.PositionName, s.Label);
            var others = s.Holders.Where(h => h.UserId != me).ToList();
            if (others.Count == 0)
                step.Skip("The requester holds this position, so they cannot approve their own request.");
            else
                foreach (var h in others) assigneeRows.Add(step.NewAssignee(h.UserId, h.Name, h.Email, h.Designation));
            steps.Add(step);
        }
        if (!steps.Any(s => s.Kind == StepKind.Approve && s.Status != StepStatus.Skipped))
            return Result.Failure(Wf.Conflict("Request", "Nobody other than you could approve this request. Ask an administrator to check the approval flow."));

        db.Steps.AddRange(steps);
        db.Assignees.AddRange(assigneeRows);
        var first = steps.First(s => s.Status != StepStatus.Skipped);
        first.Activate();
        r.MarkSubmitted();

        // Designation of the requester, from the directory when we have them there.
        if (r.RequesterEmail is { } em)
        {
            var emp = await db.Employees.AsNoTracking().FirstOrDefaultAsync(e => e.Email == em.ToLower() && !e.IsDeleted, ct);
            if (emp?.Designation is { } d) r.SetRequesterInfo(r.RequesterEmail, d);
        }
        Wf.Log(db, user, "request.submitted", "request", r.Id, r.Id, $"{r.FormName} · {r.BaseName} · {steps.Count} steps");

        return Result.Success();
    }

    /// <summary>Tells whoever the request is now waiting on. Called after the save, so nobody is alerted to a change that didn't commit.</summary>
    public async Task NotifyCurrentAsync(WfRequest r, Guid? actor, CancellationToken ct)
    {
        var cur = r.Steps.Where(s => s.Status == StepStatus.Pending).OrderBy(s => s.Order).FirstOrDefault();
        if (cur is null) return;
        var ids = await db.Assignees.AsNoTracking().Where(a => a.StepId == cur.Id).Select(a => a.UserId).ToListAsync(ct);
        await NotifyStepAsync(r, cur, ids, actor, ct);
    }

    public async Task NotifyStepAsync(WfRequest r, WfRequestStep step, IEnumerable<Guid> recipients, Guid? actor, CancellationToken ct)
    {
        var who = recipients.Distinct().ToList();
        if (who.Count == 0) return;
        var verb = step.Kind == StepKind.Review ? "review" : "approval";
        await notifier.PublishManyAsync(who.Select(u => Req.Alert(u, "request.awaiting",
            $"{r.FormName} awaiting your {verb}",
            $"{r.Number} · {r.RequesterName} · {r.BaseName}{(r.Amount > 0 ? $" · {r.Amount:N2}" : "")}", r.Id, actor, "mention")), ct);
    }

    /// <summary>Records one decision, moves the request on (or ends it) and issues the decision PDF.</summary>
    public async Task DecideAsync(WfRequest r, WfRequestStep step, bool approve, string? comment, ICurrentUser user, string? designation, CancellationToken ct)
    {
        step.Decide(approve, user.Id!.Value, user.Name ?? "Unknown", designation, comment);
        var settings = await Wf.SettingsAsync(db, ct);

        WfRequestStep? next = null;
        if (approve)
        {
            next = r.Steps.Where(s => s.Order > step.Order && s.Status == StepStatus.Waiting).OrderBy(s => s.Order).FirstOrDefault();
            if (next is not null) next.Activate();
            else r.Complete(RequestStatus.Approved, null);
        }
        else
        {
            foreach (var s in r.Steps.Where(s => s.Status == StepStatus.Waiting)) s.Skip("The request was rejected before it reached this step.");
            r.Complete(RequestStatus.Rejected, comment);
        }
        r.Touch();

        // The PDF is rendered after the state change so the chain it prints already shows this decision.
        var atts = await db.Attachments.AsNoTracking().Where(a => a.RequestId == r.Id && !a.IsDeleted).ToListAsync(ct);
        var brand = await branding.GetAsync(TenantAmbient.TenantId, ct);
        var (name, data, hash) = DecisionPdf.Build(new DecisionPdf.Input(r, r.Steps.ToList(), atts, brand, settings.TimeZoneId, step.Id));
        step.AttachPdf(name, data, hash);

        Wf.Log(db, user, approve ? "request.approved" : "request.rejected", "request", r.Id, r.Id,
            $"Step {step.Order} ({step.PositionName}){(string.IsNullOrWhiteSpace(comment) ? "" : $": {comment}")}");
        if (r.Status == RequestStatus.Approved) Wf.Log(db, user, "request.completed", "request", r.Id, r.Id, "All approvals received");

        // Commit first (this is where a concurrent decision is caught), then tell people.
        await db.SaveChangesAsync(ct);

        // Tell whoever is next, or tell the requester how it ended.
        if (next is not null)
        {
            await NotifyStepAsync(r, next, next.Assignees.Select(a => a.UserId), user.Id, ct);
            await notifier.PublishAsync(Req.Alert(r.RequesterId, "request.progress", $"{r.FormName} moved on",
                $"{r.Number} was approved by {user.Name} and is now with {next.PositionName}.", r.Id, user.Id, "success"), ct);
        }
        else
        {
            var ok = r.Status == RequestStatus.Approved;
            await notifier.PublishAsync(Req.Alert(r.RequesterId, ok ? "request.approved" : "request.rejected",
                ok ? $"{r.FormName} approved" : $"{r.FormName} rejected",
                ok ? $"{r.Number} has been fully approved." : $"{r.Number} was rejected by {user.Name}{(string.IsNullOrWhiteSpace(comment) ? "." : $": {comment}")}",
                r.Id, user.Id, ok ? "success" : "error"), ct);
        }
    }
}

// ── Queries ─────────────────────────────────────────────────────────────────

internal sealed class GetRequestsHandler(WorkflowDbContext db, WfAccess access) : IQueryHandler<GetRequestsQuery, Paged<RequestSummaryDto>>
{
    public async Task<Result<Paged<RequestSummaryDto>>> Handle(GetRequestsQuery q, CancellationToken ct)
    {
        var me = access.UserId;
        var query = db.Requests.AsNoTracking().Where(r => !r.IsDeleted);
        var scope = (q.Scope ?? "mine").ToLowerInvariant();
        switch (scope)
        {
            case "todo":
                query = query.Where(r => r.Status == RequestStatus.Pending && db.Steps.Any(s => s.RequestId == r.Id && s.Status == StepStatus.Pending
                    && db.Assignees.Any(a => a.StepId == s.Id && a.UserId == me)));
                break;
            case "watching":
                query = query.Where(r => r.RequesterId != me && r.Status != RequestStatus.Draft && db.Assignees.Any(a => a.RequestId == r.Id && a.UserId == me));
                break;
            case "all":
                if (access.SeesAll) query = query.Where(r => r.Status != RequestStatus.Draft || r.RequesterId == me);
                else query = query.Where(r => r.RequesterId == me || (r.Status != RequestStatus.Draft && db.Assignees.Any(a => a.RequestId == r.Id && a.UserId == me)));
                break;
            default:
                query = query.Where(r => r.RequesterId == me);
                break;
        }
        if (!string.IsNullOrWhiteSpace(q.Status)) query = query.Where(r => r.Status == q.Status);
        if (q.BaseId is { } b) query = query.Where(r => r.BaseId == b);
        if (q.FormId is { } f) query = query.Where(r => r.FormId == f);
        if (Wf.ValidDate(q.From)) { var d = DateTime.Parse(q.From!).ToUniversalTime(); query = query.Where(r => (r.SubmittedAt ?? r.CreatedAt) >= d); }
        if (Wf.ValidDate(q.To)) { var d = DateTime.Parse(q.To!).AddDays(1).ToUniversalTime(); query = query.Where(r => (r.SubmittedAt ?? r.CreatedAt) < d); }
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(r => r.Number.Contains(s) || r.FormName.Contains(s) || r.RequesterName.Contains(s) || (r.Title != null && r.Title.Contains(s)));
        }

        var total = await query.CountAsync(ct);
        var size = Math.Clamp(q.PageSize, 1, 100); var page = Math.Max(1, q.Page);
        var ordered = scope == "todo" ? query.OrderBy(r => r.SubmittedAt) : query.OrderByDescending(r => r.UpdatedAt ?? r.CreatedAt);
        var rows = await ordered.Skip((page - 1) * size).Take(size).ToListAsync(ct);

        var ids = rows.Select(r => r.Id).ToList();
        var steps = await db.Steps.AsNoTracking().Where(s => ids.Contains(s.RequestId)).ToListAsync(ct);
        var stepIds = steps.Select(s => s.Id).ToList();
        var assignees = await db.Assignees.AsNoTracking().Where(a => ids.Contains(a.RequestId)).ToListAsync(ct);

        var list = rows.Select(r =>
        {
            var mine = steps.Where(s => s.RequestId == r.Id).OrderBy(s => s.Order).ToList();
            var cur = mine.FirstOrDefault(s => s.Status == StepStatus.Pending);
            var who = cur is null ? null : string.Join(", ", assignees.Where(a => a.StepId == cur.Id).Select(a => a.Name));
            var onMe = cur is not null && assignees.Any(a => a.StepId == cur.Id && a.UserId == me);
            return new RequestSummaryDto(r.Id, r.Number, r.FormId, r.FormName, r.FormKey, r.BaseId, r.BaseName, r.UnitName, r.Title, r.Amount, r.Status,
                r.RequesterId, r.RequesterName, r.CreatedAt, r.SubmittedAt, r.CompletedAt, who,
                cur is null ? null : (cur.Label ?? cur.PositionName), mine.Count(s => s.Status is StepStatus.Approved), mine.Count(s => s.Status != StepStatus.Skipped),
                onMe, cur?.ActivatedAt);
        }).ToList();
        return Result.Success(new Paged<RequestSummaryDto>(list, total, page, size));
    }
}

internal sealed class GetRequestHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : IQueryHandler<GetRequestQuery, RequestDetailDto>
{
    public async Task<Result<RequestDetailDto>> Handle(GetRequestQuery q, CancellationToken ct)
    {
        var r = await Req.LoadAsync(db, q.Id, ct);
        if (r is null || !Req.CanSee(r, access)) return Result.Failure<RequestDetailDto>(Wf.NotFound("Request"));

        // Reading a request is an action worth recording ("who looked at this refund?"), but one entry per
        // person per few minutes — a refresh must not bury the trail.
        var me = access.UserId; var since = DateTime.UtcNow.AddMinutes(-5);
        if (!await db.Audit.AnyAsync(a => a.RequestId == r.Id && a.UserId == me && a.Action == "request.viewed" && a.At > since, ct))
        {
            Wf.Log(db, user, "request.viewed", "request", r.Id, r.Id);
            await db.SaveChangesAsync(ct);
        }
        return Result.Success(await Req.DetailAsync(db, access, user, r, ct));
    }
}

// ── Commands ────────────────────────────────────────────────────────────────

internal sealed class SaveRequestHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user, RequestEngine engine)
    : ICommandHandler<SaveRequestCommand, RequestDetailDto>
{
    public async Task<Result<RequestDetailDto>> Handle(SaveRequestCommand c, CancellationToken ct)
    {
        if (user.Id is null) return Result.Failure<RequestDetailDto>(Wf.Forbidden("Sign in again."));
        var form = await db.Forms.FirstOrDefaultAsync(f => f.Id == c.FormId && !f.IsDeleted, ct);
        if (form is null || !form.IsActive) return Result.Failure<RequestDetailDto>(Wf.NotFound("Form"));
        var b = await db.Bases.FirstOrDefaultAsync(x => x.Id == c.BaseId && !x.IsDeleted && x.IsActive, ct);
        if (b is null) return Result.Failure<RequestDetailDto>(Wf.NotFound("Base"));
        if (!await access.CanUseBaseAsync(b.Id, ct)) return Result.Failure<RequestDetailDto>(Wf.Forbidden($"You do not have access to {b.Name}."));
        WfUnit? unit = null;
        if (c.UnitId is { } uid)
        {
            unit = await db.Units.FirstOrDefaultAsync(x => x.Id == uid && !x.IsDeleted && x.IsActive, ct);
            if (unit is null) return Result.Failure<RequestDetailDto>(Wf.NotFound("Unit"));
        }

        WfRequest r;
        if (c.Id is { } id)
        {
            var existing = await Req.LoadAsync(db, id, ct);
            if (existing is null || existing.RequesterId != user.Id) return Result.Failure<RequestDetailDto>(Wf.NotFound("Request"));
            if (existing.Status != RequestStatus.Draft) return Result.Failure<RequestDetailDto>(Wf.Conflict("Request", "A submitted request can't be edited. Cancel it and start again, or ask the approver to reject it."));
            r = existing;
            if (existing.FormId != form.Id) return Result.Failure<RequestDetailDto>(Wf.Invalid("A draft can't change its form."));
            r.SetBase(b.Id, b.Name);
            r.SetForm(form.FieldsJson, form.Version);
        }
        else
        {
            var settings = await Wf.SettingsAsync(db, ct);
            r = new WfRequest(Wf.NewNumber(settings.NumberPrefix), form.Id, form.Key, form.Name, form.Version, form.FieldsJson, b.Id, b.Name,
                unit?.Id, unit?.Name, user.Id.Value, user.Name ?? "Unknown");
            r.SetRequesterInfo(user.Email, null);
            db.Requests.Add(r);
        }

        var fields = FormEngine.Parse(r.FieldsJson);
        var attKeys = c.Id is null ? new HashSet<string>()
            : (await db.Attachments.AsNoTracking().Where(a => a.RequestId == r.Id && !a.IsDeleted && a.FieldKey != null).Select(a => a.FieldKey!).ToListAsync(ct)).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var checkedForm = FormEngine.Check(fields, c.Data, attKeys, strict: c.Submit);
        if (checkedForm.Errors.Count > 0)
            return Result.Failure<RequestDetailDto>(Wf.Invalid(string.Join(" ", checkedForm.Errors.Take(6))));

        var title = checkedForm.Title ?? (string.IsNullOrWhiteSpace(c.Title) ? null : c.Title.Trim());
        r.SetContent(title ?? form.Name, checkedForm.Data.ToJsonString(), checkedForm.Amount, unit?.Id, unit?.Name);
        if (c.Id is not null) Wf.Log(db, user, "request.draft.saved", "request", r.Id, r.Id);
        else Wf.Log(db, user, "request.created", "request", r.Id, r.Id, $"{form.Name} · {b.Name}");

        if (c.Submit)
        {
            if (r.Steps.Count > 0) return Result.Failure<RequestDetailDto>(Wf.Conflict("Request", "This request was already submitted."));
            var res = await engine.SubmitAsync(r, user, ct);
            if (res.IsFailure)
            {
                // Keep what the person typed as a draft; only the submission is refused.
                await db.SaveChangesAsync(ct);
                return Result.Failure<RequestDetailDto>(Wf.Conflict("Request", $"{res.Error.Description} Your request was saved as a draft ({r.Number})."));
            }
        }
        await db.SaveChangesAsync(ct);
        var saved = (await Req.LoadAsync(db, r.Id, ct))!;
        if (c.Submit) await engine.NotifyCurrentAsync(saved, user.Id, ct);
        return Result.Success(await Req.DetailAsync(db, access, user, saved, ct));
    }
}

internal sealed class SubmitRequestHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user, RequestEngine engine)
    : ICommandHandler<SubmitRequestCommand, RequestDetailDto>
{
    public async Task<Result<RequestDetailDto>> Handle(SubmitRequestCommand c, CancellationToken ct)
    {
        var r = await Req.LoadAsync(db, c.Id, ct);
        if (r is null || r.RequesterId != user.Id) return Result.Failure<RequestDetailDto>(Wf.NotFound("Request"));
        if (r.Status != RequestStatus.Draft) return Result.Failure<RequestDetailDto>(Wf.Conflict("Request", "This request was already submitted."));
        if (!await access.CanUseBaseAsync(r.BaseId, ct)) return Result.Failure<RequestDetailDto>(Wf.Forbidden("You no longer have access to that location."));

        var attKeys = (await db.Attachments.AsNoTracking().Where(a => a.RequestId == r.Id && !a.IsDeleted && a.FieldKey != null).Select(a => a.FieldKey!).ToListAsync(ct)).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var data = JsonDocument.Parse(r.DataJson).RootElement;
        var chk = FormEngine.Check(FormEngine.Parse(r.FieldsJson), data, attKeys, strict: true);
        if (chk.Errors.Count > 0) return Result.Failure<RequestDetailDto>(Wf.Invalid(string.Join(" ", chk.Errors.Take(6))));
        r.SetContent(r.Title, chk.Data.ToJsonString(), chk.Amount, r.UnitId, r.UnitName);

        var res = await engine.SubmitAsync(r, user, ct);
        if (res.IsFailure) return Result.Failure<RequestDetailDto>(res.Error);
        await db.SaveChangesAsync(ct);
        var saved = (await Req.LoadAsync(db, r.Id, ct))!;
        await engine.NotifyCurrentAsync(saved, user.Id, ct);
        return Result.Success(await Req.DetailAsync(db, access, user, saved, ct));
    }
}

internal sealed class DecideRequestHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user, RequestEngine engine)
    : ICommandHandler<DecideRequestCommand, RequestDetailDto>
{
    public async Task<Result<RequestDetailDto>> Handle(DecideRequestCommand c, CancellationToken ct)
    {
        if (user.Id is not { } me) return Result.Failure<RequestDetailDto>(Wf.Forbidden("Sign in again."));
        var approve = c.Action?.ToLowerInvariant() switch { "approve" => true, "reject" => false, _ => (bool?)null };
        if (approve is null) return Result.Failure<RequestDetailDto>(Wf.Invalid("Choose approve or reject."));
        if (approve == false && string.IsNullOrWhiteSpace(c.Comment)) return Result.Failure<RequestDetailDto>(Wf.Invalid("Give a reason for rejecting."));
        if (c.Comment is { Length: > 2000 }) return Result.Failure<RequestDetailDto>(Wf.Invalid("That comment is too long."));
        if (!user.IsSuperAdmin && !user.HasPermission(WfPerm.Approve))
            return Result.Failure<RequestDetailDto>(Wf.Forbidden("You do not have permission to approve or reject requests."));

        var r = await Req.LoadAsync(db, c.Id, ct);
        if (r is null || !Req.CanSee(r, access)) return Result.Failure<RequestDetailDto>(Wf.NotFound("Request"));
        if (r.Status != RequestStatus.Pending) return Result.Failure<RequestDetailDto>(Wf.Conflict("Request", $"This request is {r.Status}, so it can't be decided."));
        var step = Req.Current(r);
        if (step is null) return Result.Failure<RequestDetailDto>(Wf.Conflict("Request", "This request has no step waiting for a decision."));
        var mine = step.Assignees.FirstOrDefault(a => a.UserId == me);
        if (mine is null) return Result.Failure<RequestDetailDto>(Wf.Forbidden($"This step is waiting for {string.Join(" or ", step.Assignees.Select(a => a.Name))}, not for you."));

        try
        {
            await engine.DecideAsync(r, step, approve.Value, c.Comment, user, mine.Designation ?? step.PositionName, ct);
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            db.ChangeTracker.Clear();
            return Result.Failure<RequestDetailDto>(Wf.Conflict("Request", "Someone else has just acted on this request. Refresh to see where it stands."));
        }
        return Result.Success(await Req.DetailAsync(db, access, user, (await Req.LoadAsync(db, r.Id, ct))!, ct));
    }
}

internal sealed class CancelRequestHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user, INotificationDispatcher notifier)
    : ICommandHandler<CancelRequestCommand, RequestDetailDto>
{
    public async Task<Result<RequestDetailDto>> Handle(CancelRequestCommand c, CancellationToken ct)
    {
        var r = await Req.LoadAsync(db, c.Id, ct);
        if (r is null || !Req.CanSee(r, access)) return Result.Failure<RequestDetailDto>(Wf.NotFound("Request"));
        if (r.RequesterId != user.Id && !access.IsAdmin) return Result.Failure<RequestDetailDto>(Wf.Forbidden("Only the person who made the request, or an administrator, can cancel it."));
        if (r.Status != RequestStatus.Pending) return Result.Failure<RequestDetailDto>(Wf.Conflict("Request", "Only a request that is waiting for approval can be cancelled."));
        var who = r.Steps.Where(s => s.Status == StepStatus.Pending).SelectMany(s => s.Assignees.Select(a => a.UserId)).Distinct().ToList();
        foreach (var s in r.Steps.Where(s => s.Status is StepStatus.Pending or StepStatus.Waiting)) s.Skip("The request was cancelled.");
        r.Complete(RequestStatus.Cancelled, c.Reason);
        Wf.Log(db, user, "request.cancelled", "request", r.Id, r.Id, c.Reason);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException)
        {
            db.ChangeTracker.Clear();
            return Result.Failure<RequestDetailDto>(Wf.Conflict("Request", "Someone else has just acted on this request. Refresh to see where it stands."));
        }
        await notifier.PublishManyAsync(who.Select(u => Req.Alert(u, "request.cancelled", $"{r.FormName} cancelled",
            $"{r.Number} was cancelled by {user.Name}. Nothing more is needed from you.", r.Id, user.Id)), ct);
        return Result.Success(await Req.DetailAsync(db, access, user, (await Req.LoadAsync(db, r.Id, ct))!, ct));
    }
}

internal sealed class DeleteRequestHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : ICommandHandler<DeleteRequestCommand>
{
    public async Task<Result> Handle(DeleteRequestCommand c, CancellationToken ct)
    {
        var r = await db.Requests.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (r is null || r.RequesterId != user.Id) return Result.Failure(Wf.NotFound("Request"));
        if (r.Status != RequestStatus.Draft) return Result.Failure(Wf.Conflict("Request", "Only a draft can be deleted. A submitted request is kept on record; cancel it instead."));
        r.Delete();
        foreach (var a in await db.Attachments.Where(a => a.RequestId == r.Id).ToListAsync(ct)) a.Delete();
        Wf.Log(db, user, "request.draft.deleted", "request", r.Id, r.Id, r.Number);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class ResubmitRequestHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user)
    : ICommandHandler<ResubmitRequestCommand, RequestDetailDto>
{
    public async Task<Result<RequestDetailDto>> Handle(ResubmitRequestCommand c, CancellationToken ct)
    {
        var old = await db.Requests.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (old is null || old.RequesterId != user.Id) return Result.Failure<RequestDetailDto>(Wf.NotFound("Request"));
        if (old.Status is not (RequestStatus.Rejected or RequestStatus.Cancelled))
            return Result.Failure<RequestDetailDto>(Wf.Conflict("Request", "Only a rejected or cancelled request can be started again."));
        var form = await db.Forms.AsNoTracking().FirstOrDefaultAsync(f => f.Id == old.FormId && !f.IsDeleted && f.IsActive, ct);
        if (form is null) return Result.Failure<RequestDetailDto>(Wf.Conflict("Form", "That form has been switched off."));
        if (!await access.CanUseBaseAsync(old.BaseId, ct)) return Result.Failure<RequestDetailDto>(Wf.Forbidden("You no longer have access to that location."));

        var settings = await Wf.SettingsAsync(db, ct);
        var copy = new WfRequest(Wf.NewNumber(settings.NumberPrefix), form.Id, form.Key, form.Name, form.Version, form.FieldsJson,
            old.BaseId, old.BaseName, old.UnitId, old.UnitName, user.Id!.Value, user.Name ?? old.RequesterName);
        copy.SetRequesterInfo(old.RequesterEmail, old.RequesterDesignation);
        copy.SetContent(old.Title, old.DataJson, old.Amount, old.UnitId, old.UnitName);
        copy.SetResubmittedFrom(old.Id);
        db.Requests.Add(copy);
        foreach (var a in await db.Attachments.AsNoTracking().Where(a => a.RequestId == old.Id && !a.IsDeleted).ToListAsync(ct))
            db.Attachments.Add(new WfAttachment(copy.Id, a.FieldKey, a.FileName, a.ContentType, a.Data, user.Id.Value, user.Name ?? ""));
        Wf.Log(db, user, "request.created", "request", copy.Id, copy.Id, $"Started again from {old.Number}");
        Wf.Log(db, user, "request.resubmit.started", "request", old.Id, old.Id, $"New draft {copy.Number}");
        await db.SaveChangesAsync(ct);
        return Result.Success(await Req.DetailAsync(db, access, user, (await Req.LoadAsync(db, copy.Id, ct))!, ct));
    }
}

internal sealed class AddCommentHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user, INotificationDispatcher notifier)
    : ICommandHandler<AddCommentCommand, RequestDetailDto>
{
    public async Task<Result<RequestDetailDto>> Handle(AddCommentCommand c, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(c.Text)) return Result.Failure<RequestDetailDto>(Wf.Invalid("Write something first."));
        if (c.Text.Length > 2000) return Result.Failure<RequestDetailDto>(Wf.Invalid("That comment is too long."));
        var r = await Req.LoadAsync(db, c.Id, ct);
        if (r is null || !Req.CanSee(r, access)) return Result.Failure<RequestDetailDto>(Wf.NotFound("Request"));
        db.Comments.Add(new WfComment(r.Id, user.Id!.Value, user.Name ?? "Unknown", c.Text));
        Wf.Log(db, user, "request.commented", "request", r.Id, r.Id, c.Text.Length > 200 ? c.Text[..200] : c.Text);
        await db.SaveChangesAsync(ct);
        var to = r.Steps.SelectMany(s => s.Assignees.Select(a => a.UserId)).Append(r.RequesterId).Distinct().Where(u => u != user.Id).ToList();
        await notifier.PublishManyAsync(to.Select(u => Req.Alert(u, "request.commented", $"New comment on {r.Number}", $"{user.Name}: {(c.Text.Length > 120 ? c.Text[..120] + "…" : c.Text)}", r.Id, user.Id)), ct);
        return Result.Success(await Req.DetailAsync(db, access, user, r, ct));
    }
}

internal sealed class ReassignStepHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user, RequestEngine engine)
    : ICommandHandler<ReassignStepCommand, RequestDetailDto>
{
    public async Task<Result<RequestDetailDto>> Handle(ReassignStepCommand c, CancellationToken ct)
    {
        if (!access.CanReassign) return Result.Failure<RequestDetailDto>(Wf.Forbidden("Only a super administrator can reassign an approval."));
        if (c.Users.Count == 0) return Result.Failure<RequestDetailDto>(Wf.Invalid("Choose at least one person."));
        if (string.IsNullOrWhiteSpace(c.Reason)) return Result.Failure<RequestDetailDto>(Wf.Invalid("Say why the approval is being reassigned."));
        var r = await Req.LoadAsync(db, c.Id, ct);
        if (r is null) return Result.Failure<RequestDetailDto>(Wf.NotFound("Request"));
        if (r.Status != RequestStatus.Pending) return Result.Failure<RequestDetailDto>(Wf.Conflict("Request", "Only a request waiting for approval can be reassigned."));
        var step = r.Steps.FirstOrDefault(s => s.Id == c.StepId);
        if (step is null || step.Status is not (StepStatus.Pending or StepStatus.Waiting)) return Result.Failure<RequestDetailDto>(Wf.Conflict("Step", "That step has already been decided."));
        var users = c.Users.Where(u => u.UserId != Guid.Empty && u.UserId != r.RequesterId).GroupBy(u => u.UserId).Select(g => g.First()).ToList();
        if (users.Count == 0) return Result.Failure<RequestDetailDto>(Wf.Invalid("The person who made the request can't approve it."));

        var before = string.Join(", ", step.Assignees.Select(a => a.Name));
        var known = await db.Holders.AsNoTracking().Where(h => h.PositionId == step.PositionId).ToListAsync(ct);
        db.Assignees.RemoveRange(step.Assignees);
        foreach (var u in users)
        {
            var d = known.FirstOrDefault(h => h.UserId == u.UserId);
            db.Assignees.Add(step.NewAssignee(u.UserId, u.UserName, d?.Email, d?.Designation));
        }
        r.Touch();
        Wf.Log(db, user, "request.reassigned", "request", r.Id, r.Id, $"Step {step.Order} ({step.PositionName}): {before} → {string.Join(", ", users.Select(u => u.UserName))}. Reason: {c.Reason}");
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException)
        {
            db.ChangeTracker.Clear();
            return Result.Failure<RequestDetailDto>(Wf.Conflict("Request", "Someone else has just acted on this request. Refresh to see where it stands."));
        }
        var fresh = (await Req.LoadAsync(db, r.Id, ct))!;
        if (fresh.Steps.First(s => s.Id == step.Id).Status == StepStatus.Pending) await engine.NotifyStepAsync(fresh, fresh.Steps.First(s => s.Id == step.Id), users.Select(u => u.UserId), user.Id, ct);
        return Result.Success(await Req.DetailAsync(db, access, user, fresh, ct));
    }
}

// ── Attachments and PDFs ────────────────────────────────────────────────────

internal sealed class UploadAttachmentHandler(WorkflowDbContext db, ICurrentUser user) : ICommandHandler<UploadAttachmentCommand, AttachmentDto>
{
    private static readonly string[] Blocked = [".exe", ".bat", ".cmd", ".com", ".msi", ".ps1", ".vbs", ".js", ".jar", ".dll", ".sh", ".scr", ".html", ".htm", ".svg"];

    public async Task<Result<AttachmentDto>> Handle(UploadAttachmentCommand c, CancellationToken ct)
    {
        var r = await db.Requests.FirstOrDefaultAsync(x => x.Id == c.RequestId && !x.IsDeleted, ct);
        if (r is null || r.RequesterId != user.Id) return Result.Failure<AttachmentDto>(Wf.NotFound("Request"));
        if (r.Status != RequestStatus.Draft) return Result.Failure<AttachmentDto>(Wf.Conflict("Request", "Files can only be added before the request is submitted."));
        if (c.Data.Length == 0) return Result.Failure<AttachmentDto>(Wf.Invalid("That file is empty."));
        if (c.Data.Length > Wf.MaxFileBytes) return Result.Failure<AttachmentDto>(Wf.Invalid("Files can be at most 10 MB."));
        var name = Wf.Sanitise(c.FileName);
        if (Blocked.Contains(Path.GetExtension(name).ToLowerInvariant())) return Result.Failure<AttachmentDto>(Wf.Invalid("That type of file can't be attached."));
        if (await db.Attachments.CountAsync(a => a.RequestId == r.Id && !a.IsDeleted, ct) >= 30) return Result.Failure<AttachmentDto>(Wf.Conflict("Request", "A request can have at most 30 files."));
        var fields = FormEngine.Parse(r.FieldsJson);
        string? key = null;
        if (!string.IsNullOrWhiteSpace(c.FieldKey))
        {
            var f = fields.FirstOrDefault(x => x.Key.Equals(c.FieldKey, StringComparison.OrdinalIgnoreCase) && x.Type == "attachment");
            if (f is null) return Result.Failure<AttachmentDto>(Wf.Invalid("That form has no such file field."));
            key = f.Key;
        }
        var a = new WfAttachment(r.Id, key, name, string.IsNullOrWhiteSpace(c.ContentType) ? "application/octet-stream" : c.ContentType, c.Data, user.Id!.Value, user.Name ?? "Unknown");
        db.Attachments.Add(a);
        Wf.Log(db, user, "attachment.added", "request", r.Id, r.Id, name);
        await db.SaveChangesAsync(ct);
        return Result.Success(new AttachmentDto(a.Id, a.FieldKey, a.FileName, a.ContentType, a.Size, a.UploadedByName, a.CreatedAt));
    }
}

internal sealed class DeleteAttachmentHandler(WorkflowDbContext db, ICurrentUser user) : ICommandHandler<DeleteAttachmentCommand>
{
    public async Task<Result> Handle(DeleteAttachmentCommand c, CancellationToken ct)
    {
        var r = await db.Requests.FirstOrDefaultAsync(x => x.Id == c.RequestId && !x.IsDeleted, ct);
        if (r is null || r.RequesterId != user.Id) return Result.Failure(Wf.NotFound("Request"));
        if (r.Status != RequestStatus.Draft) return Result.Failure(Wf.Conflict("Request", "Files can't be removed once the request is submitted."));
        var a = await db.Attachments.FirstOrDefaultAsync(x => x.Id == c.AttachmentId && x.RequestId == r.Id && !x.IsDeleted, ct);
        if (a is null) return Result.Failure(Wf.NotFound("Attachment"));
        a.Delete();
        Wf.Log(db, user, "attachment.removed", "request", r.Id, r.Id, a.FileName);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class GetAttachmentHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : IQueryHandler<GetAttachmentQuery, FileDto>
{
    public async Task<Result<FileDto>> Handle(GetAttachmentQuery q, CancellationToken ct)
    {
        var r = await Req.LoadAsync(db, q.RequestId, ct);
        if (r is null || !Req.CanSee(r, access)) return Result.Failure<FileDto>(Wf.NotFound("Request"));
        var a = await db.Attachments.AsNoTracking().FirstOrDefaultAsync(x => x.Id == q.AttachmentId && x.RequestId == r.Id && !x.IsDeleted, ct);
        if (a is null) return Result.Failure<FileDto>(Wf.NotFound("Attachment"));
        Wf.Log(db, user, "attachment.downloaded", "request", r.Id, r.Id, a.FileName);
        await db.SaveChangesAsync(ct);
        return Result.Success(new FileDto(a.FileName, a.ContentType, a.Data));
    }
}

internal sealed class GetStepPdfHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : IQueryHandler<GetStepPdfQuery, FileDto>
{
    public async Task<Result<FileDto>> Handle(GetStepPdfQuery q, CancellationToken ct)
    {
        var r = await Req.LoadAsync(db, q.RequestId, ct);
        if (r is null || !Req.CanSee(r, access)) return Result.Failure<FileDto>(Wf.NotFound("Request"));
        var s = r.Steps.FirstOrDefault(x => x.Id == q.StepId);
        if (s?.PdfData is null) return Result.Failure<FileDto>(Wf.NotFound("Decision record"));
        Wf.Log(db, user, "pdf.downloaded", "request", r.Id, r.Id, $"Step {s.Order} {s.PdfName}");
        await db.SaveChangesAsync(ct);
        return Result.Success(new FileDto(s.PdfName ?? "decision.pdf", "application/pdf", s.PdfData));
    }
}

internal sealed class GetRequestPdfHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user, WfBranding branding)
    : IQueryHandler<GetRequestPdfQuery, FileDto>
{
    public async Task<Result<FileDto>> Handle(GetRequestPdfQuery q, CancellationToken ct)
    {
        var r = await Req.LoadAsync(db, q.RequestId, ct);
        if (r is null || !Req.CanSee(r, access)) return Result.Failure<FileDto>(Wf.NotFound("Request"));
        var settings = await Wf.SettingsAsync(db, ct);
        var atts = await db.Attachments.AsNoTracking().Where(a => a.RequestId == r.Id && !a.IsDeleted).ToListAsync(ct);
        var brand = await branding.GetAsync(TenantAmbient.TenantId, ct);
        var (name, data, _) = DecisionPdf.Build(new DecisionPdf.Input(r, r.Steps.ToList(), atts, brand, settings.TimeZoneId, null));
        Wf.Log(db, user, "pdf.downloaded", "request", r.Id, r.Id, name);
        await db.SaveChangesAsync(ct);
        return Result.Success(new FileDto(name, "application/pdf", data));
    }
}
