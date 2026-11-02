using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Seo.Application.Credits;

public sealed record CreditEntryDto(Guid Id, string Type, int Amount, long BalanceAfter, string Reason, string? ActorName, DateTime CreatedAt);

/// <param name="PagesPerCredit">One credit buys this many crawled pages (rounded up per audit, minimum one credit).</param>
public sealed record SeoCreditsDto(long Balance, long LifetimeAdded, long LifetimeSpent, int PagesPerCredit, int MaxPagesPerAudit, IReadOnlyList<CreditEntryDto> Recent);

public sealed record GetSeoCreditsQuery : IQuery<SeoCreditsDto>;

/// <summary>Platform administrator only: add (or, negative, remove) credits for one workspace.</summary>
public sealed record AdminGrantSeoCreditsCommand(Guid TenantId, int Amount, string Reason) : ICommand<SeoCreditsDto>;

public sealed class AdminGrantSeoCreditsValidator : AbstractValidator<AdminGrantSeoCreditsCommand>
{
    public AdminGrantSeoCreditsValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty().WithMessage("Choose a workspace.");
        RuleFor(x => x.Amount).NotEqual(0).WithMessage("The amount cannot be zero.").InclusiveBetween(-100000, 100000).WithMessage("The amount must be within 100,000.");
        RuleFor(x => x.Reason).NotEmpty().WithMessage("A reason is required.").MaximumLength(200);
    }
}

/// <summary>One workspace's balance, for the platform owner's overview.</summary>
public sealed record AdminSeoWalletDto(Guid TenantId, long Balance, long LifetimeAdded, long LifetimeSpent, DateTime? UpdatedAt);

/// <summary>Platform administrator only: every workspace that has an SEO wallet.</summary>
public sealed record AdminSeoCreditsOverviewQuery : IQuery<IReadOnlyList<AdminSeoWalletDto>>;

/// <summary>Platform administrator only: one workspace's balance and recent movements.</summary>
public sealed record AdminTenantSeoCreditsQuery(Guid TenantId) : IQuery<SeoCreditsDto>;
