using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Application.Billing.Credits;

// ── DTOs ──────────────────────────────────────────────────────────────────────

public sealed record CreditQuoteDto(
    string ModuleKey, int Credits, decimal UnitPrice, decimal DiscountPercent, decimal GrossAmount, decimal NetAmount,
    decimal VatPercent, decimal VatAmount, decimal TotalAmount, string Currency);

public sealed record CreditTierDto(int FromCredits, decimal DiscountPercent);

/// <summary>One add-on card on the Billing page.</summary>
public sealed record CreditProductDto(
    string ModuleKey, string Name, string Description, IReadOnlyList<string> HowItWorks, string UnitName,
    bool ForSale, decimal PricePerCredit, long Balance, long Swappable);

public sealed record CreditCatalogDto(
    IReadOnlyList<CreditProductDto> Products, IReadOnlyList<CreditTierDto> Tiers,
    int MinCredits, decimal MinOrderUsd, decimal MaxOrderUsd, decimal VatPercent, string Currency,
    IReadOnlyList<string> Providers, bool SwapEnabled, decimal SwapFeePercent, int MinSwapCredits);

public sealed record CreditCheckoutDto(Guid PurchaseId, string Url, string Provider);

public sealed record CreditPurchaseDto(
    Guid Id, string ModuleKey, int Credits, decimal UnitPrice, decimal DiscountPercent, decimal TotalAmount, string Currency,
    string Provider, string Status, string? Error, string? PurchasedBy, DateTime CreatedAt, DateTime? CreditedAt);

public sealed record CreditPricingDto(
    IReadOnlyDictionary<string, decimal> PricePerCredit, IReadOnlyList<CreditTierDto> Tiers,
    int MinCredits, decimal MinOrderUsd, decimal MaxOrderUsd, decimal VatPercent,
    bool SwapEnabled, decimal SwapFeePercent, int MinSwapCredits,
    IReadOnlyList<CreditModuleInfoDto> Modules);

/// <summary>A module that can have a price, so the pricing screen lists every add-on even before it has one.</summary>
public sealed record CreditModuleInfoDto(string ModuleKey, string Name);

public sealed record UpdateCreditPricingRequest(
    Dictionary<string, decimal> PricePerCredit, List<CreditTierDto> Tiers, int MinCredits, decimal MinOrderUsd, decimal MaxOrderUsd, decimal VatPercent,
    bool SwapEnabled = true, decimal SwapFeePercent = 0m, int MinSwapCredits = 10);

// ── The price rule (pure, so it is unit-tested) ───────────────────────────────

public static class CreditPricing
{
    public static decimal Round(decimal v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);

    public static decimal DiscountFor(CreditPricingSettings s, int credits) =>
        s.Tiers.Where(t => credits >= t.FromCredits).OrderByDescending(t => t.FromCredits).Select(t => t.DiscountPercent).FirstOrDefault();

    /// <summary>
    /// Prices an order. The server is the only place a price is decided: the browser sends a module and a
    /// quantity, never an amount. Errors are written for the customer ("the minimum order is $5.00 — that is N credits").
    /// </summary>
    public static Result<CreditQuoteDto> Quote(CreditPricingSettings s, string moduleKey, int credits)
    {
        moduleKey = (moduleKey ?? "").Trim().ToLowerInvariant();
        if (!s.PricePerCredit.TryGetValue(moduleKey, out var unit) || unit <= 0)
            return Result.Failure<CreditQuoteDto>(Error.Custom("Credits.NotForSale", "These credits are not on sale yet."));
        if (credits < s.MinCredits)
            return Result.Failure<CreditQuoteDto>(Error.Custom("Validation.Failed", $"The minimum is {s.MinCredits} credits."));

        var q = Build(s, moduleKey, unit, credits);
        if (q.NetAmount < s.MinOrderUsd)
        {
            var needed = MinCreditsForMinimumOrder(s, unit);
            return Result.Failure<CreditQuoteDto>(Error.Custom("Validation.Failed",
                $"The minimum order is ${s.MinOrderUsd:0.00}. At this price that is {needed:N0} credits."));
        }
        if (q.NetAmount > s.MaxOrderUsd)
            return Result.Failure<CreditQuoteDto>(Error.Custom("Validation.Failed",
                $"The largest online order is ${s.MaxOrderUsd:#,0.00}. For more credits than that, please contact us."));
        return Result.Success(q);
    }

    /// <summary>The fewest credits that reach the minimum order value (the discount can move the answer, so it is searched).</summary>
    public static int MinCreditsForMinimumOrder(CreditPricingSettings s, decimal unit)
    {
        var credits = Math.Max(s.MinCredits, (int)Math.Ceiling(s.MinOrderUsd / unit));
        for (var i = 0; i < 100_000 && Build(s, "", unit, credits).NetAmount < s.MinOrderUsd; i++) credits++;
        return credits;
    }

    private static CreditQuoteDto Build(CreditPricingSettings s, string moduleKey, decimal unit, int credits)
    {
        var gross = Round(credits * unit);
        var disc = DiscountFor(s, credits);
        var net = Round(gross * (1 - disc / 100m));
        var vat = Round(net * s.VatPercent / 100m);
        return new CreditQuoteDto(moduleKey, credits, unit, disc, gross, net, s.VatPercent, vat, net + vat, "USD");
    }
}

// ── Swapping credits between modules ──────────────────────────────────────────

public sealed record CreditSwapQuoteDto(
    string FromModule, string ToModule, int RequestedCredits, int CreditsTaken, int CreditsReceived,
    decimal FromPrice, decimal ToPrice, decimal FeePercent, decimal ValueMoved, decimal ValueReceived, string Formula);

public sealed record CreditSwapDto(
    Guid Id, string FromModule, string ToModule, int FromCredits, int ToCredits, decimal FromPrice, decimal ToPrice,
    decimal FeePercent, string Status, string? Error, string? SwappedBy, DateTime CreatedAt);

public static class CreditSwapPricing
{
    /// <summary>
    /// THE SWAP RULE. A credit is worth what it costs to buy, so credits move at equal value:
    ///
    ///   value moved   = credits × price of the credit you give
    ///   after the fee = value moved × (1 − fee%)
    ///   you receive   = floor( after the fee ÷ price of the credit you get )
    ///
    /// Prices are the list price per credit, before any volume discount (a discount is a reward for buying
    /// many, not part of what a credit is worth). Rounding always goes down, and only as many credits as are
    /// needed to produce the credits you receive are taken, so you never lose a fraction of a credit.
    /// Example: 20 SEO credits at $0.05 = $1.00; Lead Generation at $0.10 per credit, no fee: floor(1.00 ÷ 0.10) = 10 credits.
    /// </summary>
    public static Result<CreditSwapQuoteDto> Quote(CreditPricingSettings s, string from, string to, int credits)
    {
        from = (from ?? "").Trim().ToLowerInvariant(); to = (to ?? "").Trim().ToLowerInvariant();
        if (!s.SwapEnabled) return Result.Failure<CreditSwapQuoteDto>(Error.Custom("Credits.SwapOff", "Swapping credits is not available right now."));
        if (from == to) return Result.Failure<CreditSwapQuoteDto>(Error.Custom("Validation.Failed", "Choose two different modules."));
        if (!s.PricePerCredit.TryGetValue(from, out var pFrom) || pFrom <= 0 || !s.PricePerCredit.TryGetValue(to, out var pTo) || pTo <= 0)
            return Result.Failure<CreditSwapQuoteDto>(Error.Custom("Credits.NotForSale", "Both modules need a credit price before credits can be swapped."));
        if (credits < s.MinSwapCredits)
            return Result.Failure<CreditSwapQuoteDto>(Error.Custom("Validation.Failed", $"The smallest swap is {s.MinSwapCredits} credits."));

        var keep = 1m - s.SwapFeePercent / 100m;
        var received = (int)Math.Floor(credits * pFrom * keep / pTo);
        if (received < 1)
            return Result.Failure<CreditSwapQuoteDto>(Error.Custom("Validation.Failed", "That is too little to swap: it is worth less than one credit in the other module. Swap more."));

        // Fewest credits that still give exactly that many back.
        var perCredit = pFrom * keep / pTo;
        var taken = (int)Math.Ceiling(received / perCredit);
        while (taken > 1 && (int)Math.Floor((taken - 1) * perCredit) >= received) taken--;
        while ((int)Math.Floor(taken * perCredit) < received) taken++;
        taken = Math.Min(taken, credits);

        var moved = Math.Round(taken * pFrom, 4);
        var formula = $"{taken:N0} credits × ${pFrom:0.####} = ${moved:0.##}" +
            (s.SwapFeePercent > 0 ? $", minus {s.SwapFeePercent:0.##}% fee = ${moved * keep:0.##}" : "") +
            $", ÷ ${pTo:0.####} per credit = {received:N0} credits";
        return Result.Success(new CreditSwapQuoteDto(from, to, credits, taken, received, pFrom, pTo, s.SwapFeePercent, moved, Math.Round(received * pTo, 4), formula));
    }
}

// ── Queries / commands ────────────────────────────────────────────────────────

public sealed record GetCreditCatalogQuery : IQuery<CreditCatalogDto>;
public sealed record GetCreditQuoteQuery(string ModuleKey, int Credits) : IQuery<CreditQuoteDto>;
public sealed record GetCreditPurchasesQuery : IQuery<IReadOnlyList<CreditPurchaseDto>>;
public sealed record GetCreditSwapQuoteQuery(string FromModule, string ToModule, int Credits) : IQuery<CreditSwapQuoteDto>;
public sealed record GetCreditSwapsQuery : IQuery<IReadOnlyList<CreditSwapDto>>;

/// <summary>Moves purchased credits from one module to another at equal value (see <see cref="CreditSwapPricing"/>).</summary>
public sealed record SwapCreditsCommand(string FromModule, string ToModule, int Credits) : ICommand<CreditSwapDto>;

public sealed class SwapCreditsValidator : AbstractValidator<SwapCreditsCommand>
{
    public SwapCreditsValidator()
    {
        RuleFor(x => x.FromModule).NotEmpty().WithMessage("Choose where the credits come from.");
        RuleFor(x => x.ToModule).NotEmpty().WithMessage("Choose where the credits go.");
        RuleFor(x => x.Credits).GreaterThan(0).WithMessage("Enter how many credits to swap.");
    }
}

public sealed record CreateCreditCheckoutCommand(string ModuleKey, int Credits, string Provider) : ICommand<CreditCheckoutDto>;

public sealed class CreateCreditCheckoutValidator : AbstractValidator<CreateCreditCheckoutCommand>
{
    public CreateCreditCheckoutValidator()
    {
        RuleFor(x => x.ModuleKey).NotEmpty().WithMessage("Choose what to buy credits for.");
        RuleFor(x => x.Credits).GreaterThan(0).WithMessage("Enter how many credits you want.");
        RuleFor(x => x.Provider).NotEmpty().WithMessage("Choose how to pay.");
    }
}

/// <summary>PayPal sends the buyer back with an order id; the credits are only added once WE capture that order.</summary>
public sealed record CapturePayPalCreditOrderCommand(string OrderId) : ICommand<CreditPurchaseDto>;

public sealed record GetCreditPricingQuery : IQuery<CreditPricingDto>;
public sealed record UpdateCreditPricingCommand(UpdateCreditPricingRequest Request) : ICommand<CreditPricingDto>;

public sealed class UpdateCreditPricingValidator : AbstractValidator<UpdateCreditPricingCommand>
{
    public UpdateCreditPricingValidator()
    {
        RuleFor(x => x.Request.MinCredits).InclusiveBetween(1, 100_000);
        RuleFor(x => x.Request.MinOrderUsd).InclusiveBetween(0m, 100_000m);
        RuleFor(x => x.Request.MaxOrderUsd).InclusiveBetween(1m, 1_000_000m);
        RuleFor(x => x.Request.VatPercent).InclusiveBetween(0m, 100m);
        RuleForEach(x => x.Request.PricePerCredit).Must(kv => kv.Value >= 0m && kv.Value <= 1000m).WithMessage("A credit price must be between 0 and 1,000.");
        RuleForEach(x => x.Request.Tiers).Must(t => t.FromCredits >= 0 && t.DiscountPercent is >= 0 and < 100).WithMessage("Each discount must be below 100%.");
    }
}
