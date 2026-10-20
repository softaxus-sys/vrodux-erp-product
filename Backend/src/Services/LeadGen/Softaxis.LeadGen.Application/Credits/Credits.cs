using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.LeadGen.Domain.Entities;

namespace Softaxis.LeadGen.Application.Credits;

public sealed record WalletDto(long Balance, long LifetimePurchased, long LifetimeSpent, long LifetimeRefunded,
    long? LowBalanceAlert, bool TrialGranted, int RevealCost, int VerifiedEmailBonus);

public sealed record LedgerEntryDto(Guid Id, string Type, int Amount, long BalanceAfter, string Reason,
    string? RefType, Guid? RefId, string? ActorName, DateTime CreatedAt);

public sealed record PackDto(Guid Id, string Name, int Credits, long PriceMinor, string Currency, string? Badge,
    bool IsActive, int SortOrder);

public sealed record PurchaseDto(Guid Id, string PackName, int Credits, long AmountMinor, string Currency,
    string Provider, string Status, string? FailureReason, string? CreatedByName, DateTime CreatedAt, DateTime? PaidAt);

public sealed record CheckoutDto(Guid PurchaseId, string Url);

public sealed record PaymentOptionsDto(bool Stripe, bool PayPal);

public sealed record GetWalletQuery : IQuery<WalletDto>;
public sealed record GetLedgerQuery(string? Type = null, int Page = 1, int PageSize = 50) : IQuery<PagedResult<LedgerEntryDto>>;
public sealed record GetPacksQuery : IQuery<IReadOnlyList<PackDto>>;
public sealed record GetPurchasesQuery : IQuery<IReadOnlyList<PurchaseDto>>;
public sealed record GetPaymentOptionsQuery : IQuery<PaymentOptionsDto>;

/// <summary>Starts a card checkout. Credits are added only when the provider confirms payment.</summary>
public sealed record StartCheckoutCommand(Guid PackId, string Provider, string ReturnPath) : ICommand<CheckoutDto>;

/// <summary>Called when the customer comes back from PayPal; captures the approved order.</summary>
public sealed record ConfirmPayPalCommand(string OrderId) : ICommand<PurchaseDto>;

public sealed record SetLowBalanceAlertCommand(long? Threshold) : ICommand;

public sealed class StartCheckoutValidator : AbstractValidator<StartCheckoutCommand>
{
    public static readonly string[] Providers = ["stripe", "paypal"];

    public StartCheckoutValidator()
    {
        RuleFor(x => x.Provider).Must(p => Providers.Contains(p)).WithMessage("Choose Stripe or PayPal.");
        RuleFor(x => x.ReturnPath).NotEmpty().Must(p => p.StartsWith('/') && !p.StartsWith("//"))
            .WithMessage("Invalid return path.");
    }
}

// ── Platform admin (super admin only) ────────────────────────────────────────────────────────

public sealed record PackInput(string Name, int Credits, long PriceMinor, string Currency, int SortOrder, string? Badge, bool IsActive);

public sealed record AdminGetPacksQuery : IQuery<IReadOnlyList<PackDto>>;
public sealed record UpsertPackCommand(Guid? Id, PackInput Input) : ICommand<PackDto>;
public sealed record DeletePackCommand(Guid Id) : ICommand;

public sealed class UpsertPackValidator : AbstractValidator<UpsertPackCommand>
{
    public UpsertPackValidator()
    {
        RuleFor(x => x.Input.Name).NotEmpty().MaximumLength(80);
        RuleFor(x => x.Input.Credits).InclusiveBetween(1, 1_000_000);
        RuleFor(x => x.Input.PriceMinor).InclusiveBetween(50, 100_000_000);
        RuleFor(x => x.Input.Currency).Length(3);
        RuleFor(x => x.Input.Badge).MaximumLength(30);
    }
}

public sealed record PlatformSettingsDto(
    bool Enabled, int RevealCost, int VerifiedEmailBonus, int TrialGrantCredits, int DailySearchLimit,
    int DailyDiscoveryLimit, int MaxResultsPerSearch, int MaxRevealsPerRequest, int PoolFreshDays,
    int BounceRefundDays, IReadOnlyList<string> AllowedCountries, bool RequireSenderIdentity,
    int MaxMailboxesPerWorkspace, int MaxDailySendsPerMailbox, int MaxDailySendsPerWorkspace,
    int BounceRatePauseBp, int ComplaintRatePauseBp, bool BlockSendingOnTrial);

public sealed record GetPlatformSettingsQuery : IQuery<PlatformSettingsDto>;
public sealed record UpdatePlatformSettingsCommand(PlatformSettingsDto Settings) : ICommand<PlatformSettingsDto>;

public sealed class UpdatePlatformSettingsValidator : AbstractValidator<UpdatePlatformSettingsCommand>
{
    public UpdatePlatformSettingsValidator()
    {
        RuleFor(x => x.Settings.RevealCost).InclusiveBetween(1, 100);
        RuleFor(x => x.Settings.VerifiedEmailBonus).InclusiveBetween(0, 100);
        RuleFor(x => x.Settings.TrialGrantCredits).InclusiveBetween(0, 10_000);
        RuleFor(x => x.Settings.DailySearchLimit).InclusiveBetween(1, 1000);
        RuleFor(x => x.Settings.DailyDiscoveryLimit).InclusiveBetween(10, 100_000);
        RuleFor(x => x.Settings.MaxResultsPerSearch).InclusiveBetween(10, 1000);
        RuleFor(x => x.Settings.MaxRevealsPerRequest).InclusiveBetween(1, 200);
        RuleFor(x => x.Settings.PoolFreshDays).InclusiveBetween(1, 730);
        RuleFor(x => x.Settings.BounceRefundDays).InclusiveBetween(0, 60);
        RuleFor(x => x.Settings.MaxMailboxesPerWorkspace).InclusiveBetween(1, 100);
        RuleFor(x => x.Settings.MaxDailySendsPerMailbox).InclusiveBetween(1, 500);
        RuleFor(x => x.Settings.MaxDailySendsPerWorkspace).InclusiveBetween(1, 50_000);
        RuleFor(x => x.Settings.BounceRatePauseBp).InclusiveBetween(50, 2000);
        RuleFor(x => x.Settings.ComplaintRatePauseBp).InclusiveBetween(1, 500);
        RuleFor(x => x.Settings.AllowedCountries).NotNull();
    }
}

public sealed record AdminTenantUsageDto(Guid TenantId, string? TenantName, long Balance, long LifetimePurchased,
    long LifetimeSpent, int Searches, int Prospects, int Revealed, int Mailboxes, int Campaigns, int Sent30d,
    int Bounced30d, DateTime? LastActivityAt);

public sealed record AdminOverviewDto(int Workspaces, long CreditsOutstanding, long CreditsSold, long CreditsSpent,
    int ProvidersRequests30d, int Sent30d, int Bounced30d, int Replies30d, int PausedMailboxes, int PoolSize,
    int PoolEnriched, IReadOnlyList<AdminTenantUsageDto> Top);

public sealed record AdminOverviewQuery : IQuery<AdminOverviewDto>;
public sealed record AdminGrantCreditsCommand(Guid TenantId, int Amount, string Reason) : ICommand<WalletDto>;

public sealed class AdminGrantValidator : AbstractValidator<AdminGrantCreditsCommand>
{
    public AdminGrantValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.Amount).InclusiveBetween(-100_000, 100_000).NotEqual(0);
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(200);
    }
}
