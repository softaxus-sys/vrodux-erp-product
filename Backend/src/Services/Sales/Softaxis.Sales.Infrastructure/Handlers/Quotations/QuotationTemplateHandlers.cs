using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Sales.Application.Quotations.Commands;
using Softaxis.Sales.Application.Quotations.Dtos;
using Softaxis.Sales.Domain.Entities;
using Softaxis.Sales.Infrastructure.Persistence;

namespace Softaxis.Sales.Infrastructure.Handlers.Quotations;

internal static class TemplateComposer
{
    public static void ApplyItems(
        QuotationTemplate t, IReadOnlyList<QuotationTemplateItemRequest> items)
    {
        t.Items.Clear();
        var order = 0;
        foreach (var i in items)
        {
            t.Items.Add(new QuotationTemplateItem(
                t.Id, i.Description, i.Unit, i.Quantity, i.UnitPrice,
                i.DiscountPercent, i.TaxRate, i.SectionTitle, i.IsOptional,
                i.SortOrder != 0 ? i.SortOrder : order));
            order++;
        }
    }

    /// <summary>
    /// Exactly one default per tenant. Enforced here rather than with a filtered unique index:
    /// promoting a template demotes the incumbent, and expressing "one row true at a time" as a
    /// constraint would make that two-row swap fail on ordering.
    /// </summary>
    public static async Task ClearOtherDefaultsAsync(
        SalesDbContext db, Guid keepId, CancellationToken ct)
    {
        var others = await db.QuotationTemplates
            .Where(x => x.IsDefault && x.Id != keepId)
            .ToListAsync(ct);
        foreach (var o in others) o.SetDefault(false);
    }
}

internal sealed class CreateQuotationTemplateHandler(SalesDbContext db)
    : ICommandHandler<CreateQuotationTemplateCommand, QuotationTemplateDto>
{
    public async Task<Result<QuotationTemplateDto>> Handle(
        CreateQuotationTemplateCommand cmd, CancellationToken ct)
    {
        var t = new QuotationTemplate(cmd.Name, cmd.Description);
        t.Update(cmd.Name, cmd.Description, cmd.TitleTemplate, cmd.CoverNote,
                 cmd.TermsAndConditions, cmd.PaymentTerms, cmd.FooterNote,
                 cmd.ValidityDays, cmd.DefaultTaxRate, cmd.DefaultDiscount,
                 cmd.AccentColor, cmd.ShowLogo, cmd.CustomFields);
        TemplateComposer.ApplyItems(t, cmd.Items);

        // The very first template becomes the default whether or not it was asked for —
        // otherwise a tenant can have templates and still get a blank quotation by default.
        var isFirst = !await db.QuotationTemplates.AnyAsync(ct);
        if (cmd.IsDefault || isFirst)
        {
            t.SetDefault(true);
            await TemplateComposer.ClearOtherDefaultsAsync(db, t.Id, ct);
        }

        db.QuotationTemplates.Add(t);
        await db.SaveChangesAsync(ct);
        return Result.Success(QuotationMappings.ToDto(t));
    }
}

internal sealed class UpdateQuotationTemplateHandler(SalesDbContext db)
    : ICommandHandler<UpdateQuotationTemplateCommand, QuotationTemplateDto>
{
    public async Task<Result<QuotationTemplateDto>> Handle(
        UpdateQuotationTemplateCommand cmd, CancellationToken ct)
    {
        var t = await db.QuotationTemplates
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (t is null)
            return Result.Failure<QuotationTemplateDto>(
                Error.Custom("QuotationTemplate.NotFound", "Quotation template not found."));

        db.QuotationTemplateItems.RemoveRange(t.Items);

        t.Update(cmd.Name, cmd.Description, cmd.TitleTemplate, cmd.CoverNote,
                 cmd.TermsAndConditions, cmd.PaymentTerms, cmd.FooterNote,
                 cmd.ValidityDays, cmd.DefaultTaxRate, cmd.DefaultDiscount,
                 cmd.AccentColor, cmd.ShowLogo, cmd.CustomFields);
        t.SetActive(cmd.IsActive);
        TemplateComposer.ApplyItems(t, cmd.Items);

        if (cmd.IsDefault)
        {
            t.SetDefault(true);
            await TemplateComposer.ClearOtherDefaultsAsync(db, t.Id, ct);
        }
        else if (t.IsDefault)
        {
            // Only let the default be dropped if another template can take over; a tenant with
            // templates but no default is a state nothing else in the feature expects.
            var replacement = await db.QuotationTemplates
                .Where(x => x.Id != t.Id && x.IsActive)
                .OrderBy(x => x.Name)
                .FirstOrDefaultAsync(ct);
            if (replacement is not null) { t.SetDefault(false); replacement.SetDefault(true); }
        }

        await db.SaveChangesAsync(ct);
        return Result.Success(QuotationMappings.ToDto(t));
    }
}

internal sealed class DeleteQuotationTemplateHandler(SalesDbContext db)
    : ICommandHandler<DeleteQuotationTemplateCommand>
{
    public async Task<Result> Handle(DeleteQuotationTemplateCommand cmd, CancellationToken ct)
    {
        var t = await db.QuotationTemplates.FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);
        if (t is null)
            return Result.Failure(Error.Custom("QuotationTemplate.NotFound", "Quotation template not found."));

        var wasDefault = t.IsDefault;
        t.Delete();

        if (wasDefault)
        {
            var replacement = await db.QuotationTemplates
                .Where(x => x.Id != t.Id && x.IsActive)
                .OrderBy(x => x.Name)
                .FirstOrDefaultAsync(ct);
            replacement?.SetDefault(true);
        }

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
