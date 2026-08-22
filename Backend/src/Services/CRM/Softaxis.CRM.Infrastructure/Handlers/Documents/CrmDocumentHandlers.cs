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
/// Tenant-wide document library, backing the File Manager.
///
/// <para>Every document is scoped by the access tier of the record it hangs off — leads via
/// <c>ScopeReadable</c>, opportunities via <c>ScopeDeals</c>, accounts via <c>ScopeCustomers</c>,
/// and contacts through their account. So an admin sees every rep's files, a team lead sees their
/// team's, and a rep sees only their own.</para>
///
/// <para>Each row also carries the <b>owner of the linked record</b> (not the uploader), which is
/// what the File Manager groups its folders by.</para>
/// </summary>
internal sealed class SearchCrmDocumentsHandler(CrmDbContext db, ILeadAccessGuard access)
    : IQueryHandler<SearchCrmDocumentsQuery, IReadOnlyList<CrmDocumentDto>>
{
    public async Task<Result<IReadOnlyList<CrmDocumentDto>>> Handle(SearchCrmDocumentsQuery q, CancellationToken ct)
    {
        // ── Visible records, per target type ──────────────────────────────────────────────────
        //
        // Previously only LEAD documents were access-checked here; deal, account and contact
        // documents were returned to anyone who could open the library, so a rep saw files from
        // other reps' opportunities. Every type is now scoped through its own guard, and the owner
        // of each record is carried through so the File Manager can group by rep.
        //
        // Done as four set queries rather than a per-row permission call: the old row-by-row
        // CanManageActivityAsync hit the database once per document (up to 500 round-trips).

        var leads = await access.ScopeReadable(db.Leads.AsNoTracking())
            .Where(l => !l.IsDeleted)
            .Select(l => new { l.Id, OwnerId = l.AssignedToUserId, OwnerName = l.AssignedTo })
            .ToListAsync(ct);

        var deals = await access.ScopeDeals(db.Deals.AsNoTracking())
            .Where(d => !d.IsDeleted)
            .Select(d => new { d.Id, OwnerId = d.AssignedToUserId, OwnerName = d.AssignedTo })
            .ToListAsync(ct);

        var customers = await access.ScopeCustomers(db.Customers.AsNoTracking())
            .Where(c => !c.IsDeleted)
            .Select(c => new { c.Id, OwnerId = c.AccountManagerUserId, OwnerName = c.AccountManager })
            .ToListAsync(ct);

        // A contact has no owner of its own — it inherits the account manager of the account it
        // belongs to, so a contact's files land in the same folder as that account's.
        var customerOwners = customers.ToDictionary(c => c.Id, c => (c.OwnerId, c.OwnerName));
        var visibleCustomerIds = customerOwners.Keys.ToList();

        var contacts = await db.Contacts.AsNoTracking()
            .Where(c => !c.IsDeleted && visibleCustomerIds.Contains(c.CustomerId))
            .Select(c => new { c.Id, c.CustomerId })
            .ToListAsync(ct);

        var owners = new Dictionary<(string Type, Guid Id), (Guid? OwnerId, string? OwnerName)>();
        foreach (var l in leads)     owners[(CrmDocumentTargets.Lead, l.Id)]     = (l.OwnerId, l.OwnerName);
        foreach (var d in deals)     owners[(CrmDocumentTargets.Deal, d.Id)]     = (d.OwnerId, d.OwnerName);
        foreach (var c in customers) owners[(CrmDocumentTargets.Customer, c.Id)] = (c.OwnerId, c.OwnerName);
        foreach (var c in contacts)
        {
            if (customerOwners.TryGetValue(c.CustomerId, out var o))
                owners[(CrmDocumentTargets.Contact, c.Id)] = o;
        }

        // ── Documents ─────────────────────────────────────────────────────────────────────────

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
        //
        // Two bounds, on purpose. The old code took 500 rows and *then* filtered, so a restricted
        // user got only the visible remainder of the newest 500 overall — often almost nothing. The
        // fetch bound is now wider than the result bound so their own files fill a page, while the
        // query stays bounded rather than materialising an unbounded table.
        const int fetchLimit = 2_000;
        const int resultLimit = 500;

        var rows = await query
            .OrderByDescending(x => x.CreatedAt)
            .Take(fetchLimit)
            .Select(x => new
            {
                x.Id, x.RelatedToType, x.RelatedToId, x.RelatedToName,
                x.FileName, x.ContentType, x.SizeBytes,
                x.DocumentType, x.Description, x.UploadedByName, x.CreatedAt,
            })
            .ToListAsync(ct);

        var visible = new List<CrmDocumentDto>();
        foreach (var x in rows)
        {
            // Not in the owner map = the linked record is outside the caller's tier (or deleted).
            if (!owners.TryGetValue((x.RelatedToType, x.RelatedToId), out var owner)) continue;

            visible.Add(new CrmDocumentDto(
                x.Id, x.RelatedToType, x.RelatedToId, x.RelatedToName,
                x.FileName, x.ContentType, x.SizeBytes,
                x.DocumentType, x.Description, x.UploadedByName, x.CreatedAt,
                owner.OwnerId, string.IsNullOrWhiteSpace(owner.OwnerName) ? null : owner.OwnerName));

            if (visible.Count >= resultLimit) break;
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
