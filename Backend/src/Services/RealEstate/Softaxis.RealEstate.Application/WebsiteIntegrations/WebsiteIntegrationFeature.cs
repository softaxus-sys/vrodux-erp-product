using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.RealEstate.Application.WebsiteIntegrations;

// ── DTOs ─────────────────────────────────────────────────────────────────────

/// <summary>The integration as an administrator sees it. Never carries the key or its hash.</summary>
public sealed record WebsiteIntegrationDto(
    Guid Id,
    string Name,
    string WebsiteOrigin,
    string KeyHint,
    bool IsActive,
    DateTime CreatedAt,
    DateTime KeyGeneratedAt,
    DateTime? LastUsedAt,
    int PublishedPropertyCount);

/// <summary>Returned only by create and regenerate — the one moment the plaintext key exists.</summary>
public sealed record WebsiteApiKeyDto(WebsiteIntegrationDto Integration, string ApiKey);

public sealed record PublishedPropertyDto(
    Guid Id, string PropertyNumber, string Name, string City, DateTime? PublishedAt, int ImageCount);

/// <summary>What an authenticated website request resolves to. Internal to the request pipeline.</summary>
public sealed record WebsiteClientDto(Guid IntegrationId, Guid TenantId, string TenantName, string WebsiteOrigin);

// ── Queries ──────────────────────────────────────────────────────────────────

/// <summary>Null when the workspace has not connected a website yet.</summary>
public sealed record GetWebsiteIntegrationQuery : IQuery<WebsiteIntegrationDto?>;

public sealed record GetPublishedPropertiesQuery : IQuery<IReadOnlyList<PublishedPropertyDto>>;

/// <summary>
/// Resolves a presented API key to its workspace. Anonymous: runs before any tenant is known.
/// Fails for an unknown key, a disabled integration, and a suspended/expired workspace alike.
/// </summary>
public sealed record ResolveWebsiteClientQuery(string ApiKey) : IQuery<WebsiteClientDto>;

// ── Commands ─────────────────────────────────────────────────────────────────

public sealed record CreateWebsiteIntegrationCommand(string Name, string WebsiteUrl) : ICommand<WebsiteApiKeyDto>;

public sealed record UpdateWebsiteIntegrationCommand(string Name, string WebsiteUrl) : ICommand<WebsiteIntegrationDto>;

public sealed record RegenerateWebsiteApiKeyCommand : ICommand<WebsiteApiKeyDto>;

public sealed record SetWebsiteIntegrationActiveCommand(bool IsActive) : ICommand<WebsiteIntegrationDto>;

/// <summary>Takes every property off the website at once. Returns how many were withdrawn.</summary>
public sealed record WithdrawAllWebsiteListingsCommand : ICommand<int>;

internal static class WebsiteUrlRule
{
    public static bool IsValid(string? url) =>
        Domain.Entities.WebsiteIntegration.NormaliseOrigin(url) is not null;
}

public sealed class CreateWebsiteIntegrationValidator : AbstractValidator<CreateWebsiteIntegrationCommand>
{
    public CreateWebsiteIntegrationValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Website name is required").MaximumLength(120);
        RuleFor(x => x.WebsiteUrl).Must(WebsiteUrlRule.IsValid)
            .WithMessage("Enter the website address, e.g. https://www.example.com");
    }
}

public sealed class UpdateWebsiteIntegrationValidator : AbstractValidator<UpdateWebsiteIntegrationCommand>
{
    public UpdateWebsiteIntegrationValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Website name is required").MaximumLength(120);
        RuleFor(x => x.WebsiteUrl).Must(WebsiteUrlRule.IsValid)
            .WithMessage("Enter the website address, e.g. https://www.example.com");
    }
}
