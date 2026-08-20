using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Abstractions;
using Softaxis.CRM.Application.Documents.Commands;
using Softaxis.CRM.Application.Documents.Dtos;
using Softaxis.CRM.Application.Documents.Queries;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Documents;

/// <summary>
/// Access rule for every handler here: a document inherits the permissions of the record it is
/// attached to. <c>ILeadAccessGuard.CanManageActivityAsync</c> already encodes exactly that for
/// lead / deal / customer targets (including the assigned-only lead tier), so it is reused rather
/// than duplicated. Failures return NotFound, not Forbidden, so we never leak the existence of a
/// record the caller cannot see.
/// </summary>
internal sealed class GetCrmDocumentsHandler(CrmDbContext db, ILeadAccessGuard access)
    : IQueryHandler<GetCrmDocumentsQuery, IReadOnlyList<CrmDocumentDto>>
{
    public async Task<Result<IReadOnlyList<CrmDocumentDto>>> Handle(GetCrmDocumentsQuery q, CancellationToken ct)
    {
        if (!CrmDocumentTargets.IsValid(q.RelatedToType))
            return Result.Failure<IReadOnlyList<CrmDocumentDto>>(
                Error.Custom("CrmDocument.InvalidTarget", $"Unsupported record type '{q.RelatedToType}'."));

        if (!await access.CanManageActivityAsync(q.RelatedToType, q.RelatedToId, ct))
            return Result.Failure<IReadOnlyList<CrmDocumentDto>>(Error.NotFoundById("Record", q.RelatedToId));

        var type = q.RelatedToType.Trim().ToLowerInvariant();

        // An account rolls up the documents of its opportunities and of the leads that converted
        // into it, so a contract uploaded while the record was still a lead stays visible after
        // conversion instead of being stranded on the lead. Documents are never copied — the file
        // lives once and is surfaced from the account. Mirrors GetCustomerTimelineHandler exactly.
        // The sub-queries carry their own tenant filter, so the union stays tenant-scoped.
        var isAccount = type == CrmDocumentTargets.Customer;
        var dealIds    = db.Deals.Where(d => d.CustomerId == q.RelatedToId && !d.IsDeleted).Select(d => d.Id);
        var leadIds    = db.Leads.Where(l => l.ConvertedCustomerId == q.RelatedToId && !l.IsDeleted).Select(l => l.Id);
        var contactIds = db.Contacts.Where(c => c.CustomerId == q.RelatedToId && !c.IsDeleted).Select(c => c.Id);

        // Projects metadata only — Data is never selected here, so the blobs stay out of the query.
        var items = await db.Documents.AsNoTracking()
            .Where(x => !x.IsDeleted && (
                (x.RelatedToType == type && x.RelatedToId == q.RelatedToId) ||
                (isAccount && x.RelatedToType == CrmDocumentTargets.Deal    && dealIds.Contains(x.RelatedToId)) ||
                (isAccount && x.RelatedToType == CrmDocumentTargets.Lead    && leadIds.Contains(x.RelatedToId)) ||
                (isAccount && x.RelatedToType == CrmDocumentTargets.Contact && contactIds.Contains(x.RelatedToId))))
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new CrmDocumentDto(
                x.Id, x.RelatedToType, x.RelatedToId, x.RelatedToName,
                x.FileName, x.ContentType, x.SizeBytes,
                x.DocumentType, x.Description, x.UploadedByName, x.CreatedAt))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<CrmDocumentDto>>(items);
    }
}

/// <summary>
/// Tenant-wide document library.
///
/// <para>Lead-scoped users see only the documents of leads assigned to them; documents on
/// accounts/opportunities/contacts stay visible to anyone with the CRM view permission, matching
/// how <c>ScopeActivities</c> treats the activity list. Filtering happens after the query because
/// the per-lead check is not expressible in SQL.</para>
/// </summary>
internal sealed class SearchCrmDocumentsHandler(CrmDbContext db, ILeadAccessGuard access)
    : IQueryHandler<SearchCrmDocumentsQuery, IReadOnlyList<CrmDocumentDto>>
{
    public async Task<Result<IReadOnlyList<CrmDocumentDto>>> Handle(SearchCrmDocumentsQuery q, CancellationToken ct)
    {
        var query = db.Documents.AsNoTracking().Where(x => !x.IsDeleted);

        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(x =>
                x.FileName.Contains(s) ||
                (x.Description != null && x.Description.Contains(s)) ||
                (x.RelatedToName != null && x.RelatedToName.Contains(s)));
        }

        if (!string.IsNullOrWhiteSpace(q.DocumentType))
        {
            var dt = q.DocumentType.Trim().ToLowerInvariant();
            query = query.Where(x => x.DocumentType == dt);
        }

        if (!string.IsNullOrWhiteSpace(q.RelatedToType))
        {
            var rt = q.RelatedToType.Trim().ToLowerInvariant();
            query = query.Where(x => x.RelatedToType == rt);
        }

        // MUST project before materialising: selecting the entity would pull every row's Data blob
        // (up to 10 MB each) into memory. Only metadata is needed here.
        var rows = await query
            .OrderByDescending(x => x.CreatedAt)
            .Take(500)
            .Select(x => new CrmDocumentDto(
                x.Id, x.RelatedToType, x.RelatedToId, x.RelatedToName,
                x.FileName, x.ContentType, x.SizeBytes,
                x.DocumentType, x.Description, x.UploadedByName, x.CreatedAt))
            .ToListAsync(ct);

        // Drop lead documents the caller may not see. Only lead access is record-scoped, so the
        // other target types need no per-row check.
        var visible = new List<CrmDocumentDto>(rows.Count);
        foreach (var x in rows)
        {
            if (x.RelatedToType == CrmDocumentTargets.Lead &&
                !await access.CanManageActivityAsync(x.RelatedToType, x.RelatedToId, ct))
                continue;

            visible.Add(x);
        }

        return Result.Success<IReadOnlyList<CrmDocumentDto>>(visible);
    }
}

internal sealed class GetCrmDocumentContentHandler(CrmDbContext db, ILeadAccessGuard access)
    : IQueryHandler<GetCrmDocumentContentQuery, CrmDocumentContentDto>
{
    public async Task<Result<CrmDocumentContentDto>> Handle(GetCrmDocumentContentQuery q, CancellationToken ct)
    {
        var doc = await db.Documents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == q.Id && !x.IsDeleted, ct);

        if (doc is null)
            return Result.Failure<CrmDocumentContentDto>(Error.NotFoundById("CrmDocument", q.Id));

        if (!await access.CanManageActivityAsync(doc.RelatedToType, doc.RelatedToId, ct))
            return Result.Failure<CrmDocumentContentDto>(Error.NotFoundById("CrmDocument", q.Id));

        return Result.Success(new CrmDocumentContentDto(doc.Data, doc.FileName, doc.ContentType));
    }
}

internal sealed class UploadCrmDocumentHandler(CrmDbContext db, ILeadAccessGuard access, ICurrentUser user)
    : ICommandHandler<UploadCrmDocumentCommand, CrmDocumentDto>
{
    public async Task<Result<CrmDocumentDto>> Handle(UploadCrmDocumentCommand cmd, CancellationToken ct)
    {
        if (!await access.CanManageActivityAsync(cmd.RelatedToType, cmd.RelatedToId, ct))
            return Result.Failure<CrmDocumentDto>(Error.NotFoundById("Record", cmd.RelatedToId));

        // Confirm the owning record actually exists — otherwise a typo'd id silently creates an
        // orphaned document that no screen will ever show.
        var relatedName = await CrmDocumentMappings.ResolveRelatedNameAsync(db, cmd.RelatedToType, cmd.RelatedToId, ct);
        if (relatedName is null)
            return Result.Failure<CrmDocumentDto>(Error.NotFoundById("Record", cmd.RelatedToId));

        var doc = new CrmDocument(
            cmd.RelatedToType, cmd.RelatedToId, relatedName,
            cmd.FileName, cmd.ContentType, cmd.Data,
            cmd.DocumentType, cmd.Description,
            user.Id, user.Username ?? user.Email);

        db.Documents.Add(doc);
        await db.SaveChangesAsync(ct);

        return Result.Success(CrmDocumentMappings.ToDto(doc));
    }
}

internal sealed class UpdateCrmDocumentHandler(CrmDbContext db, ILeadAccessGuard access)
    : ICommandHandler<UpdateCrmDocumentCommand, CrmDocumentDto>
{
    public async Task<Result<CrmDocumentDto>> Handle(UpdateCrmDocumentCommand cmd, CancellationToken ct)
    {
        var doc = await db.Documents.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);

        if (doc is null)
            return Result.Failure<CrmDocumentDto>(Error.NotFoundById("CrmDocument", cmd.Id));

        if (!await access.CanManageActivityAsync(doc.RelatedToType, doc.RelatedToId, ct))
            return Result.Failure<CrmDocumentDto>(Error.NotFoundById("CrmDocument", cmd.Id));

        doc.UpdateMetadata(cmd.DocumentType, cmd.Description);
        await db.SaveChangesAsync(ct);

        return Result.Success(CrmDocumentMappings.ToDto(doc));
    }
}

internal sealed class DeleteCrmDocumentHandler(CrmDbContext db, ILeadAccessGuard access)
    : ICommandHandler<DeleteCrmDocumentCommand>
{
    public async Task<Result> Handle(DeleteCrmDocumentCommand cmd, CancellationToken ct)
    {
        var doc = await db.Documents.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);

        if (doc is null)
            return Result.Failure(Error.NotFoundById("CrmDocument", cmd.Id));

        if (!await access.CanManageActivityAsync(doc.RelatedToType, doc.RelatedToId, ct))
            return Result.Failure(Error.NotFoundById("CrmDocument", cmd.Id));

        doc.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
