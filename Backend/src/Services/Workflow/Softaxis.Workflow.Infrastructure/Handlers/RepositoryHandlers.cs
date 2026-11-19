using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Workflow.Application;
using Softaxis.Workflow.Domain.Entities;
using Softaxis.Workflow.Infrastructure.Persistence;
using Softaxis.Workflow.Infrastructure.Services;

namespace Softaxis.Workflow.Infrastructure.Handlers;

internal static class RepoMap
{
    public static DocTypeDto Dto(WfDocType d) => new(d.Id, d.Name, d.Frequency, d.Description, d.SortOrder, d.IsActive, d.TemplateName);
    public static readonly string[] Blocked = [".exe", ".bat", ".cmd", ".com", ".msi", ".ps1", ".vbs", ".js", ".jar", ".dll", ".sh", ".scr", ".html", ".htm", ".svg"];
}

// ── Document types ──────────────────────────────────────────────────────────

internal sealed class GetDocTypesHandler(WorkflowDbContext db) : IQueryHandler<GetDocTypesQuery, IReadOnlyList<DocTypeDto>>
{
    public async Task<Result<IReadOnlyList<DocTypeDto>>> Handle(GetDocTypesQuery q, CancellationToken ct) =>
        Result.Success<IReadOnlyList<DocTypeDto>>((await db.DocTypes.AsNoTracking().Where(d => !d.IsDeleted)
            .OrderBy(d => d.Frequency).ThenBy(d => d.SortOrder).ThenBy(d => d.Name).ToListAsync(ct)).Select(RepoMap.Dto).ToList());
}

internal sealed class SaveDocTypeHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : ICommandHandler<SaveDocTypeCommand, DocTypeDto>
{
    public async Task<Result<DocTypeDto>> Handle(SaveDocTypeCommand c, CancellationToken ct)
    {
        if (Guard.RequireAdmin<DocTypeDto>(access) is { } no) return no;
        if (string.IsNullOrWhiteSpace(c.Name)) return Result.Failure<DocTypeDto>(Wf.Invalid("A name is required."));
        if (!DocFrequency.Valid(c.Frequency)) return Result.Failure<DocTypeDto>(Wf.Invalid("Frequency must be daily or monthly."));
        var name = c.Name.Trim();
        if (await db.DocTypes.AnyAsync(d => d.Name == name && d.Id != c.Id && !d.IsDeleted, ct))
            return Result.Failure<DocTypeDto>(Wf.Conflict("DocType", $"There is already a document type called {name}."));
        WfDocType d;
        if (c.Id is { } id)
        {
            d = (await db.DocTypes.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct))!;
            if (d is null) return Result.Failure<DocTypeDto>(Wf.NotFound("DocType"));
            if (d.Frequency != c.Frequency && await db.RepoDocs.AnyAsync(x => x.DocTypeId == d.Id && !x.IsDeleted, ct))
                return Result.Failure<DocTypeDto>(Wf.Conflict("DocType", "Files already exist for this type, so its frequency can't change."));
        }
        else { d = new WfDocType(name, c.Frequency); db.DocTypes.Add(d); }
        d.Update(name, c.Frequency, c.Description, c.SortOrder, c.IsActive);
        Wf.Log(db, user, c.Id is null ? "doctype.created" : "doctype.updated", "doctype", d.Id, null, d.Name);
        await db.SaveChangesAsync(ct);
        return Result.Success(RepoMap.Dto(d));
    }
}

internal sealed class DeleteDocTypeHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : ICommandHandler<DeleteDocTypeCommand>
{
    public async Task<Result> Handle(DeleteDocTypeCommand c, CancellationToken ct)
    {
        if (Guard.RequireAdmin(access) is { } no) return no;
        var d = await db.DocTypes.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (d is null) return Result.Failure(Wf.NotFound("DocType"));
        if (await db.RepoDocs.AnyAsync(x => x.DocTypeId == d.Id && !x.IsDeleted, ct))
            return Result.Failure(Wf.Conflict("DocType", "Files exist for this type. Switch it off instead of deleting it."));
        d.Delete();
        Wf.Log(db, user, "doctype.deleted", "doctype", d.Id, null, d.Name);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class SetDocTemplateHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : ICommandHandler<SetDocTemplateCommand, DocTypeDto>
{
    public async Task<Result<DocTypeDto>> Handle(SetDocTemplateCommand c, CancellationToken ct)
    {
        if (Guard.RequireAdmin<DocTypeDto>(access) is { } no) return no;
        var d = await db.DocTypes.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (d is null) return Result.Failure<DocTypeDto>(Wf.NotFound("DocType"));
        if (c.Data is { Length: > 0 })
        {
            if (c.Data.Length > Wf.MaxFileBytes) return Result.Failure<DocTypeDto>(Wf.Invalid("The template can be at most 10 MB."));
            var name = Wf.Sanitise(c.FileName ?? "template");
            if (RepoMap.Blocked.Contains(Path.GetExtension(name).ToLowerInvariant())) return Result.Failure<DocTypeDto>(Wf.Invalid("That type of file can't be used."));
            d.SetTemplate(name, string.IsNullOrWhiteSpace(c.ContentType) ? "application/octet-stream" : c.ContentType, c.Data);
        }
        else d.SetTemplate(null, null, null);
        Wf.Log(db, user, "doctype.template.set", "doctype", d.Id, null, d.TemplateName ?? "removed");
        await db.SaveChangesAsync(ct);
        return Result.Success(RepoMap.Dto(d));
    }
}

internal sealed class GetDocTemplateHandler(WorkflowDbContext db) : IQueryHandler<GetDocTemplateQuery, FileDto>
{
    public async Task<Result<FileDto>> Handle(GetDocTemplateQuery q, CancellationToken ct)
    {
        var d = await db.DocTypes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == q.Id && !x.IsDeleted, ct);
        if (d?.TemplateData is null) return Result.Failure<FileDto>(Wf.NotFound("Template"));
        return Result.Success(new FileDto(d.TemplateName ?? "template", d.TemplateContentType ?? "application/octet-stream", d.TemplateData));
    }
}

// ── Documents and the calendar ──────────────────────────────────────────────

internal static class Period
{
    /// <summary>Monthly documents are filed under the first day of their month.</summary>
    public static string Normalise(string frequency, string date) => frequency == DocFrequency.Monthly ? date[..7] + "-01" : date;
}

internal sealed class GetCalendarHandler(WorkflowDbContext db, WfAccess access) : IQueryHandler<GetCalendarQuery, CalendarDto>
{
    public async Task<Result<CalendarDto>> Handle(GetCalendarQuery q, CancellationToken ct)
    {
        if (q.Month is not { Length: 7 } || !Wf.ValidDate(q.Month + "-01")) return Result.Failure<CalendarDto>(Wf.Invalid("Month must look like 2026-11."));
        if (!await access.CanUseBaseAsync(q.BaseId, ct)) return Result.Failure<CalendarDto>(Wf.Forbidden("You do not have access to that location."));
        var types = (await db.DocTypes.AsNoTracking().Where(d => !d.IsDeleted && d.IsActive).OrderBy(d => d.Frequency).ThenBy(d => d.SortOrder).ToListAsync(ct)).Select(RepoMap.Dto).ToList();
        var cells = await db.RepoDocs.AsNoTracking().Where(d => !d.IsDeleted && d.BaseId == q.BaseId && d.PeriodDate.StartsWith(q.Month))
            .GroupBy(d => new { d.DocTypeId, d.PeriodDate }).Select(g => new CalendarCellDto(g.Key.DocTypeId, g.Key.PeriodDate, g.Count())).ToListAsync(ct);
        return Result.Success(new CalendarDto(q.Month, q.BaseId, types, cells));
    }
}

internal sealed class GetRepoDocsHandler(WorkflowDbContext db, WfAccess access) : IQueryHandler<GetRepoDocsQuery, Paged<RepoDocDto>>
{
    public async Task<Result<Paged<RepoDocDto>>> Handle(GetRepoDocsQuery q, CancellationToken ct)
    {
        var allowed = await access.AllowedBaseIdsAsync(ct);
        var query = db.RepoDocs.AsNoTracking().Where(d => !d.IsDeleted);
        if (allowed is not null) query = query.Where(d => allowed.Contains(d.BaseId));
        if (q.BaseId is { } b) query = query.Where(d => d.BaseId == b);
        if (q.DocTypeId is { } t) query = query.Where(d => d.DocTypeId == t);
        if (Wf.ValidDate(q.From)) query = query.Where(d => string.Compare(d.PeriodDate, q.From) >= 0);
        if (Wf.ValidDate(q.To)) query = query.Where(d => string.Compare(d.PeriodDate, q.To) <= 0);
        if (!string.IsNullOrWhiteSpace(q.Search)) { var s = q.Search.Trim(); query = query.Where(d => d.FileName.Contains(s) || (d.Notes != null && d.Notes.Contains(s))); }
        var total = await query.CountAsync(ct);
        var size = Math.Clamp(q.PageSize, 1, 200); var page = Math.Max(1, q.Page);
        var rows = await query.OrderByDescending(d => d.PeriodDate).ThenByDescending(d => d.CreatedAt).Skip((page - 1) * size).Take(size).ToListAsync(ct);
        var types = await db.DocTypes.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        var bases = await db.Bases.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        return Result.Success(new Paged<RepoDocDto>(rows.Select(d => new RepoDocDto(d.Id, d.DocTypeId, types.GetValueOrDefault(d.DocTypeId, "?"), d.BaseId,
            bases.GetValueOrDefault(d.BaseId, "?"), d.PeriodDate, d.FileName, d.ContentType, d.Size, d.Notes, d.UploadedByName, d.CreatedAt)).ToList(), total, page, size));
    }
}

internal sealed class UploadRepoDocHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : ICommandHandler<UploadRepoDocCommand, RepoDocDto>
{
    public async Task<Result<RepoDocDto>> Handle(UploadRepoDocCommand c, CancellationToken ct)
    {
        var type = await db.DocTypes.FirstOrDefaultAsync(d => d.Id == c.DocTypeId && !d.IsDeleted && d.IsActive, ct);
        if (type is null) return Result.Failure<RepoDocDto>(Wf.NotFound("DocType"));
        var b = await db.Bases.FirstOrDefaultAsync(x => x.Id == c.BaseId && !x.IsDeleted && x.IsActive, ct);
        if (b is null) return Result.Failure<RepoDocDto>(Wf.NotFound("Base"));
        if (!await access.CanUseBaseAsync(b.Id, ct)) return Result.Failure<RepoDocDto>(Wf.Forbidden($"You do not have access to {b.Name}."));
        if (!Wf.ValidDate(c.PeriodDate)) return Result.Failure<RepoDocDto>(Wf.Invalid("Choose the day (or month) this document covers."));
        if (string.Compare(c.PeriodDate, DateTime.UtcNow.AddDays(2).ToString("yyyy-MM-dd"), StringComparison.Ordinal) > 0)
            return Result.Failure<RepoDocDto>(Wf.Invalid("A document can't be filed for a date in the future."));
        if (c.Data.Length == 0) return Result.Failure<RepoDocDto>(Wf.Invalid("That file is empty."));
        if (c.Data.Length > Wf.MaxFileBytes) return Result.Failure<RepoDocDto>(Wf.Invalid("Files can be at most 10 MB."));
        var name = Wf.Sanitise(c.FileName);
        if (RepoMap.Blocked.Contains(Path.GetExtension(name).ToLowerInvariant())) return Result.Failure<RepoDocDto>(Wf.Invalid("That type of file can't be uploaded."));

        var period = Period.Normalise(type.Frequency, c.PeriodDate);
        var d = new WfRepoDocument(type.Id, b.Id, period, name, string.IsNullOrWhiteSpace(c.ContentType) ? "application/octet-stream" : c.ContentType,
            c.Data, c.Notes, user.Id ?? Guid.Empty, user.Name ?? "Unknown");
        db.RepoDocs.Add(d);
        Wf.Log(db, user, "repository.uploaded", "document", d.Id, null, $"{type.Name} · {b.Code} · {period} · {name}");
        await db.SaveChangesAsync(ct);
        return Result.Success(new RepoDocDto(d.Id, type.Id, type.Name, b.Id, b.Name, d.PeriodDate, d.FileName, d.ContentType, d.Size, d.Notes, d.UploadedByName, d.CreatedAt));
    }
}

internal sealed class DeleteRepoDocHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : ICommandHandler<DeleteRepoDocCommand>
{
    public async Task<Result> Handle(DeleteRepoDocCommand c, CancellationToken ct)
    {
        var d = await db.RepoDocs.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (d is null || !await access.CanUseBaseAsync(d.BaseId, ct)) return Result.Failure(Wf.NotFound("Document"));
        d.Delete();
        Wf.Log(db, user, "repository.deleted", "document", d.Id, null, $"{d.FileName} · {d.PeriodDate}");
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class GetRepoDocFileHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : IQueryHandler<GetRepoDocFileQuery, FileDto>
{
    public async Task<Result<FileDto>> Handle(GetRepoDocFileQuery q, CancellationToken ct)
    {
        var d = await db.RepoDocs.AsNoTracking().FirstOrDefaultAsync(x => x.Id == q.Id && !x.IsDeleted, ct);
        if (d is null || !await access.CanUseBaseAsync(d.BaseId, ct)) return Result.Failure<FileDto>(Wf.NotFound("Document"));
        Wf.Log(db, user, "repository.downloaded", "document", d.Id, null, d.FileName);
        await db.SaveChangesAsync(ct);
        return Result.Success(new FileDto(d.FileName, d.ContentType, d.Data));
    }
}

// ── Audit log ───────────────────────────────────────────────────────────────

internal sealed class GetAuditHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : IQueryHandler<GetAuditQuery, Paged<AuditDto>>
{
    public async Task<Result<Paged<AuditDto>>> Handle(GetAuditQuery q, CancellationToken ct)
    {
        if (!user.IsSuperAdmin && !user.HasPermission(WfPerm.AuditView) && !access.IsAdmin)
            return Result.Failure<Paged<AuditDto>>(Wf.Forbidden("You do not have permission to read the audit log."));
        var query = db.Audit.AsNoTracking().AsQueryable();
        if (Wf.ValidDate(q.From)) { var d = DateTime.Parse(q.From!).ToUniversalTime(); query = query.Where(a => a.At >= d); }
        if (Wf.ValidDate(q.To)) { var d = DateTime.Parse(q.To!).AddDays(1).ToUniversalTime(); query = query.Where(a => a.At < d); }
        if (q.UserId is { } u) query = query.Where(a => a.UserId == u);
        if (q.RequestId is { } r) query = query.Where(a => a.RequestId == r);
        if (!string.IsNullOrWhiteSpace(q.Action)) { var a0 = q.Action.Trim(); query = query.Where(a => a.Action.StartsWith(a0)); }
        if (!string.IsNullOrWhiteSpace(q.Search)) { var s = q.Search.Trim(); query = query.Where(a => (a.Detail != null && a.Detail.Contains(s)) || (a.UserName != null && a.UserName.Contains(s)) || a.Action.Contains(s)); }
        var total = await query.CountAsync(ct);
        var size = Math.Clamp(q.PageSize, 1, 200); var page = Math.Max(1, q.Page);
        var rows = await query.OrderByDescending(a => a.At).Skip((page - 1) * size).Take(size).ToListAsync(ct);
        var rids = rows.Where(a => a.RequestId != null).Select(a => a.RequestId!.Value).Distinct().ToList();
        var nums = await db.Requests.AsNoTracking().Where(x => rids.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.Number, ct);
        return Result.Success(new Paged<AuditDto>(rows.Select(a => new AuditDto(a.Id, a.At, a.UserId, a.UserName, a.Action, a.EntityType, a.EntityId,
            a.RequestId, a.RequestId is { } id ? nums.GetValueOrDefault(id) : null, a.Detail, a.Ip)).ToList(), total, page, size));
    }
}

// ── Dashboard ───────────────────────────────────────────────────────────────

internal sealed class GetDashboardHandler(WorkflowDbContext db, WfAccess access) : IQueryHandler<GetDashboardQuery, DashboardDto>
{
    public async Task<Result<DashboardDto>> Handle(GetDashboardQuery q, CancellationToken ct)
    {
        var me = access.UserId;
        var scope = db.Requests.AsNoTracking().Where(r => !r.IsDeleted && (r.Status != RequestStatus.Draft || r.RequesterId == me));
        if (!access.SeesAll)
            scope = scope.Where(r => r.RequesterId == me || db.Assignees.Any(a => a.RequestId == r.Id && a.UserId == me));

        var myOpen = await db.Requests.CountAsync(r => !r.IsDeleted && r.RequesterId == me && r.Status == RequestStatus.Pending, ct);
        var toApprove = await db.Steps.CountAsync(s => s.Status == StepStatus.Pending
            && db.Requests.Any(r => r.Id == s.RequestId && !r.IsDeleted && r.Status == RequestStatus.Pending)
            && db.Assignees.Any(a => a.StepId == s.Id && a.UserId == me), ct);

        var since = DateTime.UtcNow.AddDays(-30);
        var approved = await scope.CountAsync(r => r.Status == RequestStatus.Approved && r.CompletedAt >= since, ct);
        var rejected = await scope.CountAsync(r => r.Status == RequestStatus.Rejected && r.CompletedAt >= since, ct);
        var times = await scope.Where(r => r.Status == RequestStatus.Approved && r.CompletedAt >= since && r.SubmittedAt != null)
            .Select(r => new { r.SubmittedAt, r.CompletedAt }).ToListAsync(ct);
        var avg = times.Count == 0 ? 0 : Math.Round(times.Average(t => (t.CompletedAt!.Value - t.SubmittedAt!.Value).TotalHours), 1);

        var since90 = DateTime.UtcNow.AddDays(-90);
        var recent = scope.Where(r => r.Status != RequestStatus.Draft && (r.SubmittedAt ?? r.CreatedAt) >= since90);
        // Order on an anonymous projection and build the DTOs afterwards: EF can't order by a property of a constructed record.
        var byFormRows = await recent.GroupBy(r => r.FormName).Select(g => new { Label = g.Key, N = g.Count() }).OrderByDescending(x => x.N).Take(8).ToListAsync(ct);
        var byBaseRows = await recent.GroupBy(r => r.BaseName).Select(g => new { Label = g.Key, N = g.Count() }).OrderByDescending(x => x.N).Take(8).ToListAsync(ct);
        var byStatusRows = await scope.GroupBy(r => r.Status).Select(g => new { Label = g.Key, N = g.Count() }).ToListAsync(ct);
        var byForm = byFormRows.Select(x => new CountDto(x.Label, x.N)).ToList();
        var byBase = byBaseRows.Select(x => new CountDto(x.Label, x.N)).ToList();
        var byStatus = byStatusRows.Select(x => new CountDto(x.Label, x.N)).ToList();

        var cutoff = DateTime.UtcNow.AddHours(-48);
        var stuck = await db.Steps.CountAsync(s => s.Status == StepStatus.Pending && s.ActivatedAt < cutoff
            && db.Requests.Any(r => r.Id == s.RequestId && !r.IsDeleted && r.Status == RequestStatus.Pending)
            && (access.SeesAll || db.Assignees.Any(a => a.StepId == s.Id && a.UserId == me)), ct);

        return Result.Success(new DashboardDto(myOpen, toApprove, approved, rejected, avg, byForm, byBase, byStatus, stuck));
    }
}
