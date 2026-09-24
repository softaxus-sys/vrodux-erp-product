using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Seo.Application.Google.Dtos;

namespace Softaxis.Seo.Application.Google.Commands;

public sealed record StartGoogleOAuthCommand(Guid SiteId, string RedirectUri) : ICommand<GoogleOAuthUrlDto>;
public sealed record GoogleOAuthCallbackCommand(string Code, string State, string RedirectUri) : ICommand<GoogleCallbackResultDto>;
public sealed record SelectGooglePropertiesCommand(
    Guid SiteId, string? GscPropertyId, string? GscPropertyName, string? Ga4PropertyId, string? Ga4PropertyName) : ICommand;
