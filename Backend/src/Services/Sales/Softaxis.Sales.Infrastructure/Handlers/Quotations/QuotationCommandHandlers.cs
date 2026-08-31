using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Sales.Application.Quotations.Commands;
using Softaxis.Sales.Application.Quotations.Dtos;
using Softaxis.Sales.Domain.Entities;
using Softaxis.Sales.Infrastructure.Persistence;

namespace Softaxis.Sales.Infrastructure.Handlers.Quotations;

internal static class QuotationErrors
{
    public static Error NotFound   => Error.Custom("Quotation.NotFound", "Quotation not found.");
    public static Error Conflict(string why) => Error.Custom("Quotation.Conflict", why);
}

/// <summary>
/// Rebuilds a quotation's sections and lines from a builder submission.
///
/// Shared by create and update so the two can never drift — the section client-id mapping in
/// particular is fiddly enough that a second copy would eventually disagree with this one.
/// </summary>
internal static class QuotationComposer
{
    public static void Apply(
        SalesQuotation q,
        IReadOnlyList<QuotationItemRequest> items,
        IReadOnlyList<QuotationSectionRequest>? sections)
    {
        // The builder submits the whole document each save, so sections and lines are replaced
        // wholesale rather than diffed: a line can move between sections, be reordered, or be
        // deleted, and reconciling that in place buys nothing on a document of this size.
        q.Sections.Clear();
        q.Items.Clear();

        // Map the browser's temporary section ids onto the real ones it cannot know yet.
        var byClientId = new Dictionary<string, Guid>(StringComparer.Ordinal);
        foreach (var s in (sections ?? []).OrderBy(s => s.SortOrder))
        {
            if (string.IsNullOrWhiteSpace(s.Title)) continue;
            var section = new SalesQuotationSection(q.Id, s.Title, s.Description, s.SortOrder);
            q.Sections.Add(section);
            if (!string.IsNullOrWhiteSpace(s.ClientId)) byClientId[s.ClientId] = section.Id;
        }

        var order = 0;
        foreach (var i in items)
        {
            Guid? sectionId = i.SectionClientId is not null
                              && byClientId.TryGetValue(i.SectionClientId, out var sid)
                              ? sid : null;

            q.Items.Add(new SalesQuotationItem(
                q.Id, i.ProductId, i.Description, i.Quantity, i.UnitPrice,
                i.DiscountPercent, i.TaxRate, sectionId, i.Unit, i.Notes,
                i.IsOptional, i.SortOrder != 0 ? i.SortOrder : order));
            order++;
        }
    }

    public static void ApplyDocument(SalesQuotation q, QuotationDocumentRequest? doc)
    {
        if (doc is null) return;
        q.SetDocument(doc.Title, doc.Reference, doc.IssueDate, doc.CoverNote,
                      doc.TermsAndConditions, doc.PaymentTerms, doc.PreparedByName, doc.CustomFields);
        q.SetCustomerContact(doc.CustomerEmail, doc.CustomerPhone, doc.CustomerAddress);
    }
}

// ── Create ────────────────────────────────────────────────────────────────────
internal sealed class CreateQuotationHandler(SalesDbContext db)
    : ICommandHandler<CreateQuotationCommand, QuotationDto>
{
    public async Task<Result<QuotationDto>> Handle(CreateQuotationCommand cmd, CancellationToken ct)
    {
        var validUntil      = cmd.ValidUntil;
        var discountPercent = cmd.DiscountPercent;
        var document        = cmd.Document;

        // A template only ever seeds a NEW draft, and only where the caller left a gap: the
        // quotation keeps its own copy of every value from here on, so editing the template later
        // never rewrites a proposal that has already gone out.
        if (cmd.TemplateId is { } templateId)
        {
            var template = await db.QuotationTemplates
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == templateId, ct);

            if (template is null)
                return Result.Failure<QuotationDto>(
                    Error.Custom("QuotationTemplate.NotFound", "Quotation template not found."));

            validUntil ??= DateTime.UtcNow.AddDays(template.ValidityDays).ToString("yyyy-MM-dd");
            if (discountPercent == 0) discountPercent = template.DefaultDiscount;

            document = new QuotationDocumentRequest(
                Title:              document?.Title              ?? template.TitleTemplate,
                Reference:          document?.Reference,
                IssueDate:          document?.IssueDate,
                CoverNote:          document?.CoverNote          ?? template.CoverNote,
                TermsAndConditions: document?.TermsAndConditions  ?? template.TermsAndConditions,
                PaymentTerms:       document?.PaymentTerms        ?? template.PaymentTerms,
                PreparedByName:     document?.PreparedByName,
                CustomerEmail:      document?.CustomerEmail,
                CustomerPhone:      document?.CustomerPhone,
                CustomerAddress:    document?.CustomerAddress,
                CustomFields:       document?.CustomFields        ?? template.CustomFields);
        }

        var quotation = new SalesQuotation(
            cmd.CustomerId, cmd.CustomerName, cmd.Notes, validUntil, discountPercent);

        QuotationComposer.ApplyDocument(quotation, document);
        QuotationComposer.Apply(quotation, cmd.Items, cmd.Sections);

        db.SalesQuotations.Add(quotation);
        await db.SaveChangesAsync(ct);

        return Result.Success(QuotationMappings.ToDto(quotation));
    }
}

// ── Update ────────────────────────────────────────────────────────────────────
internal sealed class UpdateQuotationHandler(SalesDbContext db)
    : ICommandHandler<UpdateQuotationCommand, QuotationDto>
{
    public async Task<Result<QuotationDto>> Handle(UpdateQuotationCommand cmd, CancellationToken ct)
    {
        var q = await db.SalesQuotations
            .Include(x => x.Items)
            .Include(x => x.Sections)
            .FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (q is null) return Result.Failure<QuotationDto>(QuotationErrors.NotFound);

        // Editing a quotation the customer already accepted, or one already turned into an
        // order, would silently change what was agreed. Duplicate it into a revision instead.
        if (q.Status is SalesQuotation.StatusConverted)
            return Result.Failure<QuotationDto>(QuotationErrors.Conflict(
                "This quotation has been converted to a sales order and can no longer be edited. Duplicate it to raise a revision."));

        if (q.Status is SalesQuotation.StatusApproved or SalesQuotation.StatusRejected
            && cmd.Status == q.Status)
            return Result.Failure<QuotationDto>(QuotationErrors.Conflict(
                "This quotation has already been answered by the customer. Duplicate it to raise a revision."));

        // The old rows must be deleted explicitly: clearing the collections detaches them, and
        // EF would otherwise try to null out their required parent key instead of removing them.
        db.SalesQuotationItems.RemoveRange(q.Items);
        db.SalesQuotationSections.RemoveRange(q.Sections);

        q.Update(cmd.CustomerId, cmd.CustomerName, cmd.Notes, cmd.ValidUntil, cmd.DiscountPercent, cmd.Status);
        QuotationComposer.ApplyDocument(q, cmd.Document);
        QuotationComposer.Apply(q, cmd.Items, cmd.Sections);

        await db.SaveChangesAsync(ct);
        return Result.Success(QuotationMappings.ToDto(q));
    }
}

// ── Delete ────────────────────────────────────────────────────────────────────
internal sealed class DeleteQuotationHandler(SalesDbContext db)
    : ICommandHandler<DeleteQuotationCommand>
{
    public async Task<Result> Handle(DeleteQuotationCommand cmd, CancellationToken ct)
    {
        var q = await db.SalesQuotations.FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);
        if (q is null) return Result.Failure(QuotationErrors.NotFound);

        q.Delete();
        // A deleted quotation must stop answering its public link — the customer's copy of the
        // URL does not disappear when the tenant deletes the record.
        q.RevokeShareLink();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Duplicate (revision) ──────────────────────────────────────────────────────
internal sealed class DuplicateQuotationHandler(SalesDbContext db)
    : ICommandHandler<DuplicateQuotationCommand, QuotationDto>
{
    public async Task<Result<QuotationDto>> Handle(DuplicateQuotationCommand cmd, CancellationToken ct)
    {
        var src = await db.SalesQuotations
            .AsNoTracking()
            .Include(x => x.Items)
            .Include(x => x.Sections)
            .FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (src is null) return Result.Failure<QuotationDto>(QuotationErrors.NotFound);

        var copy = new SalesQuotation(
            src.CustomerId, src.CustomerName, src.Notes, src.ValidUntil, src.DiscountPercent);

        copy.SetDocument(src.Title, src.Reference, DateTime.UtcNow.ToString("yyyy-MM-dd"),
                         src.CoverNote, src.TermsAndConditions, src.PaymentTerms, src.PreparedByName,
                         src.CustomFields is null ? null : new Dictionary<string, string>(src.CustomFields));
        copy.SetCustomerContact(src.CustomerEmail, src.CustomerPhone, src.CustomerAddress);

        // Sections are recreated with fresh ids, so the copied lines are re-pointed by position.
        var sectionMap = new Dictionary<Guid, Guid>();
        foreach (var s in src.Sections.OrderBy(s => s.SortOrder))
        {
            var section = new SalesQuotationSection(copy.Id, s.Title, s.Description, s.SortOrder);
            copy.Sections.Add(section);
            sectionMap[s.Id] = section.Id;
        }

        foreach (var i in src.Items.OrderBy(i => i.SortOrder))
        {
            Guid? sectionId = i.SectionId.HasValue && sectionMap.TryGetValue(i.SectionId.Value, out var sid)
                              ? sid : null;
            copy.Items.Add(new SalesQuotationItem(
                copy.Id, i.ProductId, i.Description, i.Quantity, i.UnitPrice,
                i.DiscountPercent, i.TaxRate, sectionId, i.Unit, i.Notes, i.IsOptional, i.SortOrder));
        }

        // The copy is a brand-new draft: no share token, no send/view/response history, and no
        // link to the original's order or invoice. Carrying any of that over would make a
        // revision look answered before it had been sent.
        db.SalesQuotations.Add(copy);
        await db.SaveChangesAsync(ct);

        return Result.Success(QuotationMappings.ToDto(copy));
    }
}

// ── Record an in-app decision ─────────────────────────────────────────────────
internal sealed class RespondToQuotationHandler(SalesDbContext db)
    : ICommandHandler<RespondToQuotationCommand, QuotationDto>
{
    public async Task<Result<QuotationDto>> Handle(RespondToQuotationCommand cmd, CancellationToken ct)
    {
        var q = await db.SalesQuotations
            .Include(x => x.Items)
            .Include(x => x.Sections)
            .FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (q is null) return Result.Failure<QuotationDto>(QuotationErrors.NotFound);

        // A quotation still in draft was never put to the customer, so there is nothing to
        // accept on their behalf; send it first.
        if (q.Status == SalesQuotation.StatusDraft)
            return Result.Failure<QuotationDto>(QuotationErrors.Conflict(
                "Send the quotation to the customer before recording their decision."));

        if (!q.Respond(cmd.Accepted, cmd.ByName, cmd.Comment))
            return Result.Failure<QuotationDto>(QuotationErrors.Conflict(
                $"A quotation that is {q.Status} can no longer be answered."));

        await db.SaveChangesAsync(ct);
        return Result.Success(QuotationMappings.ToDto(q));
    }
}

// ── Convert to sales order ────────────────────────────────────────────────────
internal sealed class ConvertQuotationToOrderHandler(SalesDbContext db)
    : ICommandHandler<ConvertQuotationToOrderCommand, ConvertQuotationResultDto>
{
    public async Task<Result<ConvertQuotationResultDto>> Handle(
        ConvertQuotationToOrderCommand cmd, CancellationToken ct)
    {
        var q = await db.SalesQuotations
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (q is null) return Result.Failure<ConvertQuotationResultDto>(QuotationErrors.NotFound);

        if (q.Status != SalesQuotation.StatusApproved)
            return Result.Failure<ConvertQuotationResultDto>(QuotationErrors.Conflict(
                "Only an accepted quotation can be converted to a sales order."));

        var order = new SalesOrder(q.CustomerId, q.CustomerName, q.Notes, null);

        // Optional lines are quoted, not ordered — the customer never committed to them, and
        // they are excluded from the quotation's own total, so pulling them onto the order would
        // bill for something that was never agreed.
        foreach (var item in q.Items.Where(i => !i.IsOptional).OrderBy(i => i.SortOrder))
            order.Items.Add(new SalesOrderItem(
                order.Id, item.ProductId, item.Description,
                item.Quantity, item.UnitPrice, item.DiscountPercent, item.TaxRate));

        db.SalesOrders.Add(order);
        q.MarkConverted(order.Id);
        await db.SaveChangesAsync(ct);

        return Result.Success(new ConvertQuotationResultDto(order.Id, order.OrderNumber));
    }
}

// ── Link / unlink a Finance invoice ───────────────────────────────────────────
internal sealed class LinkQuotationInvoiceHandler(SalesDbContext db)
    : ICommandHandler<LinkQuotationInvoiceCommand, QuotationDto>
{
    public async Task<Result<QuotationDto>> Handle(LinkQuotationInvoiceCommand cmd, CancellationToken ct)
    {
        var q = await db.SalesQuotations
            .Include(x => x.Items)
            .Include(x => x.Sections)
            .FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (q is null) return Result.Failure<QuotationDto>(QuotationErrors.NotFound);

        q.LinkInvoice(cmd.InvoiceId, cmd.InvoiceNumber);
        await db.SaveChangesAsync(ct);
        return Result.Success(QuotationMappings.ToDto(q));
    }
}
