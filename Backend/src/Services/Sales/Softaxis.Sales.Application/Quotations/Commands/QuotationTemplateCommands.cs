using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Sales.Application.Quotations.Dtos;

namespace Softaxis.Sales.Application.Quotations.Commands;

public sealed record QuotationTemplateItemRequest(
    string  Description,
    string? Unit,
    decimal Quantity,
    decimal UnitPrice,
    decimal DiscountPercent,
    decimal TaxRate,
    string? SectionTitle,
    bool    IsOptional,
    int     SortOrder);

public sealed record CreateQuotationTemplateCommand(
    string  Name,
    string? Description,
    string? TitleTemplate,
    string? CoverNote,
    string? TermsAndConditions,
    string? PaymentTerms,
    string? FooterNote,
    int     ValidityDays,
    decimal DefaultTaxRate,
    decimal DefaultDiscount,
    string? AccentColor,
    bool    ShowLogo,
    Dictionary<string, string>? CustomFields,
    bool    IsDefault,
    IReadOnlyList<QuotationTemplateItemRequest> Items
) : ICommand<QuotationTemplateDto>;

public sealed record UpdateQuotationTemplateCommand(
    Guid    Id,
    string  Name,
    string? Description,
    string? TitleTemplate,
    string? CoverNote,
    string? TermsAndConditions,
    string? PaymentTerms,
    string? FooterNote,
    int     ValidityDays,
    decimal DefaultTaxRate,
    decimal DefaultDiscount,
    string? AccentColor,
    bool    ShowLogo,
    Dictionary<string, string>? CustomFields,
    bool    IsDefault,
    bool    IsActive,
    IReadOnlyList<QuotationTemplateItemRequest> Items
) : ICommand<QuotationTemplateDto>;

public sealed record DeleteQuotationTemplateCommand(Guid Id) : ICommand;

public sealed class QuotationTemplateItemRequestValidator : AbstractValidator<QuotationTemplateItemRequest>
{
    public QuotationTemplateItemRequestValidator()
    {
        RuleFor(x => x.Description).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Unit).MaximumLength(30).When(x => x.Unit is not null);
        RuleFor(x => x.SectionTitle).MaximumLength(200).When(x => x.SectionTitle is not null);
        RuleFor(x => x.Quantity).GreaterThanOrEqualTo(0);
        RuleFor(x => x.UnitPrice).GreaterThanOrEqualTo(0);
        RuleFor(x => x.DiscountPercent).InclusiveBetween(0, 100);
        RuleFor(x => x.TaxRate).InclusiveBetween(0, 100);
    }
}

public sealed class CreateQuotationTemplateValidator : AbstractValidator<CreateQuotationTemplateCommand>
{
    public CreateQuotationTemplateValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Template name is required.").MaximumLength(150);
        RuleFor(x => x.ValidityDays).InclusiveBetween(1, 3650)
            .WithMessage("Validity must be between 1 and 3650 days.");
        RuleFor(x => x.DefaultTaxRate).InclusiveBetween(0, 100);
        RuleFor(x => x.DefaultDiscount).InclusiveBetween(0, 100);
        RuleForEach(x => x.Items).SetValidator(new QuotationTemplateItemRequestValidator());
    }
}

public sealed class UpdateQuotationTemplateValidator : AbstractValidator<UpdateQuotationTemplateCommand>
{
    public UpdateQuotationTemplateValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().WithMessage("Template name is required.").MaximumLength(150);
        RuleFor(x => x.ValidityDays).InclusiveBetween(1, 3650)
            .WithMessage("Validity must be between 1 and 3650 days.");
        RuleFor(x => x.DefaultTaxRate).InclusiveBetween(0, 100);
        RuleFor(x => x.DefaultDiscount).InclusiveBetween(0, 100);
        RuleForEach(x => x.Items).SetValidator(new QuotationTemplateItemRequestValidator());
    }
}
