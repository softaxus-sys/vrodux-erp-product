using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Restaurant.Application.Tax;

public sealed record TaxRegionPreset(string Code, string Name, string Label, decimal Rate, string Authority);
public sealed record TaxCountryPreset(string Code, string Name, string Currency, string Label, decimal Rate,
    IReadOnlyList<TaxRegionPreset> Regions, bool SupportsFbr);

/// <summary>
/// Starting rates per country (and region, where restaurant tax is set locally — Pakistan's
/// provinces). They only pre-fill the form; the rate a workspace saves is what it charges.
/// </summary>
public static class TaxPresets
{
    public static readonly IReadOnlyList<TaxCountryPreset> All =
    [
        new("PK", "Pakistan", "PKR", "Sales Tax", 16m,
        [
            new("PK-PB", "Punjab", "PST", 16m, "Punjab Revenue Authority (PRA)"),
            new("PK-SD", "Sindh", "SST", 15m, "Sindh Revenue Board (SRB)"),
            new("PK-KP", "Khyber Pakhtunkhwa", "Sales Tax", 15m, "KP Revenue Authority (KPRA)"),
            new("PK-BA", "Balochistan", "Sales Tax", 15m, "Balochistan Revenue Authority (BRA)"),
            new("PK-IS", "Islamabad (ICT)", "GST", 16m, "Federal Board of Revenue (FBR)"),
            new("PK-JK", "Azad Jammu & Kashmir", "GST", 16m, "AJK Inland Revenue"),
            new("PK-GB", "Gilgit-Baltistan", "Sales Tax", 0m, "GB Revenue Authority"),
        ], SupportsFbr: true),
        new("AE", "United Arab Emirates", "AED", "VAT", 5m, [], false),
        new("SA", "Saudi Arabia", "SAR", "VAT", 15m, [], false),
        new("BH", "Bahrain", "BHD", "VAT", 10m, [], false),
        new("OM", "Oman", "OMR", "VAT", 5m, [], false),
        new("QA", "Qatar", "QAR", "Tax", 0m, [], false),
        new("KW", "Kuwait", "KWD", "Tax", 0m, [], false),
        new("EG", "Egypt", "EGP", "VAT", 14m, [], false),
        new("IN", "India", "INR", "GST", 5m, [], false),
        new("BD", "Bangladesh", "BDT", "VAT", 15m, [], false),
        new("GB", "United Kingdom", "GBP", "VAT", 20m, [], false),
        new("TR", "Türkiye", "TRY", "KDV", 10m, [], false),
        new("MY", "Malaysia", "MYR", "SST", 6m, [], false),
        new("US", "United States", "USD", "Sales Tax", 0m, [], false),
    ];

    /// <summary>Finds a country by ISO code, English name, or (as a last resort) currency.</summary>
    public static TaxCountryPreset? Find(string? countryOrCode, string? currency = null)
    {
        if (!string.IsNullOrWhiteSpace(countryOrCode))
        {
            var v = countryOrCode.Trim();
            var hit = All.FirstOrDefault(c => c.Code.Equals(v, StringComparison.OrdinalIgnoreCase)
                                           || c.Name.Equals(v, StringComparison.OrdinalIgnoreCase));
            if (hit is not null) return hit;
        }
        return string.IsNullOrWhiteSpace(currency) ? null
            : All.FirstOrDefault(c => c.Currency.Equals(currency.Trim(), StringComparison.OrdinalIgnoreCase));
    }
}

public sealed record TaxProfileDto(
    Guid? Id, Guid? BranchId, string CountryCode, string? RegionCode, string TaxLabel, decimal RatePercent,
    bool FbrEnabled, string FbrEnvironment, int? FbrPosId, bool FbrTokenSet, decimal FbrServiceFee, string FbrPctCode,
    bool IsSaved);

public sealed record TaxSettingsDto(
    string? WorkspaceCountry, TaxProfileDto Workspace, IReadOnlyList<TaxProfileDto> Branches,
    IReadOnlyList<TaxCountryPreset> Presets);

public sealed record GetTaxSettingsQuery : IQuery<TaxSettingsDto>;

/// <summary>Saves the workspace profile (BranchId null) or one branch's override.
/// <paramref name="FbrToken"/> null keeps the stored token; empty string clears it.</summary>
public sealed record SaveTaxProfileCommand(
    Guid? BranchId, string CountryCode, string? RegionCode, string TaxLabel, decimal RatePercent,
    bool FbrEnabled, string FbrEnvironment, int? FbrPosId, string? FbrToken, decimal FbrServiceFee, string? FbrPctCode)
    : ICommand<TaxProfileDto>;

public sealed record DeleteBranchTaxProfileCommand(Guid BranchId) : ICommand;

public sealed record FbrTestResultDto(bool Ok, string Message, string? InvoiceNumber);
/// <summary>Sends a test invoice with the saved credentials. Only allowed in the sandbox.</summary>
public sealed record TestFbrConnectionCommand(Guid? BranchId) : ICommand<FbrTestResultDto>;

public sealed record FbrQueueItemDto(Guid OrderId, string OrderNumber, decimal Total, string? Status, string? Error,
    int Attempts, string? InvoiceNumber, DateTime CreatedAt, Guid? BranchId);
public sealed record GetFbrQueueQuery(Guid? BranchId) : IQuery<IReadOnlyList<FbrQueueItemDto>>;
/// <summary>Sends now every bill that is paid but not yet accepted by FBR.</summary>
public sealed record RetryFbrCommand(Guid? OrderId) : ICommand<int>;

public sealed class SaveTaxProfileValidator : AbstractValidator<SaveTaxProfileCommand>
{
    public SaveTaxProfileValidator()
    {
        RuleFor(x => x.CountryCode).NotEmpty().Length(2).WithMessage("Choose a country.");
        RuleFor(x => x.RatePercent).InclusiveBetween(0, 100).WithMessage("Tax rate must be between 0 and 100%.");
        RuleFor(x => x.TaxLabel).MaximumLength(20);
        RuleFor(x => x.FbrServiceFee).InclusiveBetween(0, 1000);
        RuleFor(x => x.FbrPosId).GreaterThan(0).When(x => x.FbrPosId.HasValue).WithMessage("POS ID must be a positive number.");
        RuleFor(x => x.FbrPctCode).MaximumLength(20);
    }
}

/// <summary>What a new bill at the branch is charged — read by the till (also kept for offline use).</summary>
public sealed record CurrentTaxDto(decimal Rate, string Label, decimal ServiceFee, bool ReportToFbr);
public sealed record GetCurrentTaxQuery(Guid? BranchId) : IQuery<CurrentTaxDto>;
