using System.Net.Mail;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Sales.Application.Quotations.Commands;
using Softaxis.Sales.Application.Quotations.Dtos;
using Softaxis.Sales.Domain.Entities;
using Softaxis.Sales.Infrastructure.Persistence;

namespace Softaxis.Sales.Infrastructure.Handlers.Quotations;

/// <summary>
/// Fills the placeholders a template may carry. A template has no customer, so its wording uses
/// <c>{customer}</c> (the company or person billed) and <c>{contact}</c> (who to address it to);
/// they are replaced when a quotation is raised for someone specific.
/// </summary>
internal static class TemplateText
{
    public static string? Fill(string? text, string customer, string contact)
    {
        if (string.IsNullOrEmpty(text)) return text;
        return text
            .Replace("{customer}", customer, StringComparison.OrdinalIgnoreCase)
            .Replace("{contact}",  contact,  StringComparison.OrdinalIgnoreCase);
    }
}

// ── New quotation for a CRM lead / account, straight from a template ──────────
internal sealed class CreateQuotationFromTemplateHandler(SalesDbContext db)
    : ICommandHandler<CreateQuotationFromTemplateCommand, QuotationDto>
{
    public async Task<Result<QuotationDto>> Handle(CreateQuotationFromTemplateCommand cmd, CancellationToken ct)
    {
        var template = await db.QuotationTemplates
            .AsNoTracking()
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == cmd.TemplateId && !x.IsDeleted, ct);

        if (template is null)
            return Result.Failure<QuotationDto>(
                Error.Custom("QuotationTemplate.NotFound", "Quotation template not found."));

        var customer = cmd.CustomerName.Trim();
        var contact  = string.IsNullOrWhiteSpace(cmd.ContactName) ? customer : cmd.ContactName.Trim();

        var quotation = new SalesQuotation(
            customerId:      null,                    // CRM people are not Sales customers
            customerName:    customer,
            notes:           null,
            validUntil:      DateTime.UtcNow.AddDays(template.ValidityDays).ToString("yyyy-MM-dd"),
            discountPercent: template.DefaultDiscount);

        quotation.SetDocument(
            title:              TemplateText.Fill(template.TitleTemplate, customer, contact),
            reference:          null,
            issueDate:          DateTime.UtcNow.ToString("yyyy-MM-dd"),
            coverNote:          TemplateText.Fill(template.CoverNote, customer, contact),
            termsAndConditions: TemplateText.Fill(template.TermsAndConditions, customer, contact),
            paymentTerms:       TemplateText.Fill(template.PaymentTerms, customer, contact),
            preparedByName:     cmd.PreparedByName,
            customFields:       template.CustomFields is null ? null : new Dictionary<string, string>(template.CustomFields));

        // A lead's email is whatever the enquiry form captured; a malformed one must not stop the
        // quotation being raised (it can still be shared by link), so it is dropped, not refused.
        var email = IsUsableEmail(cmd.CustomerEmail) ? cmd.CustomerEmail : null;
        quotation.SetCustomerContact(email, cmd.CustomerPhone, cmd.CustomerAddress);

        // Template lines become the quotation's own copy. Sections are grouped by title and
        // numbered by where they first appear, so the document reads in the template's order.
        var ordered  = template.Items.OrderBy(i => i.SortOrder).ToList();
        var sections = ordered
            .Where(i => !string.IsNullOrWhiteSpace(i.SectionTitle))
            .Select(i => i.SectionTitle!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Select((title, idx) => new QuotationSectionRequest(title, title, null, idx))
            .ToList();

        var items = ordered.Select((i, idx) => new QuotationItemRequest(
            ProductId:       null,
            Description:     i.Description,
            Unit:            i.Unit,
            Notes:           null,
            Quantity:        i.Quantity,
            UnitPrice:       i.UnitPrice,
            DiscountPercent: i.DiscountPercent,
            TaxRate:         i.TaxRate,
            SectionClientId: string.IsNullOrWhiteSpace(i.SectionTitle) ? null : i.SectionTitle,
            IsOptional:      i.IsOptional,
            SortOrder:       idx)).ToList();

        QuotationComposer.Apply(quotation, items, sections);

        quotation.SetPresentation(template.AccentColor, template.ShowLogo, template.FooterNote, template.Id);
        quotation.SetCrmLinks(cmd.LeadId, cmd.CrmCustomerId, cmd.DealId, cmd.LeadOwnerUserId);
        quotation.SetCreatedBy(cmd.CreatedByUserId);

        db.SalesQuotations.Add(quotation);
        await db.SaveChangesAsync(ct);

        return Result.Success(QuotationMappings.ToDto(quotation));
    }

    private static bool IsUsableEmail(string? s) =>
        !string.IsNullOrWhiteSpace(s) && MailAddress.TryCreate(s.Trim(), out _);
}

// ── Follow the lead onto the account / opportunity it converted into ──────────
internal sealed class RelinkLeadQuotationsHandler(SalesDbContext db)
    : ICommandHandler<RelinkLeadQuotationsCommand, int>
{
    public async Task<Result<int>> Handle(RelinkLeadQuotationsCommand cmd, CancellationToken ct)
    {
        if (cmd.CrmCustomerId is null && cmd.DealId is null) return Result.Success(0);

        var rows = await db.SalesQuotations
            .Where(x => !x.IsDeleted && x.LeadId == cmd.LeadId)
            .ToListAsync(ct);

        foreach (var q in rows) q.RelinkAfterConversion(cmd.CrmCustomerId, cmd.DealId);

        if (rows.Count > 0) await db.SaveChangesAsync(ct);
        return Result.Success(rows.Count);
    }
}
