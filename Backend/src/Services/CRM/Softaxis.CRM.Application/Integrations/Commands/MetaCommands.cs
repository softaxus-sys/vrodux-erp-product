using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.CRM.Application.Integrations.Commands;

/// <summary>Build the Meta OAuth authorize URL for an existing (disconnected) integration.</summary>
public sealed record StartMetaOAuthCommand(Guid IntegrationId, string RedirectUri) : ICommand<MetaOAuthUrl>;

public sealed record MetaOAuthUrl(string Url);

/// <summary>
/// Handle the Meta OAuth redirect (anonymous): exchange the code for a long-lived token,
/// store it encrypted, and discover the user's pages. Returns the integration id to redirect to.
/// </summary>
public sealed record MetaOAuthCallbackCommand(string Code, string State, string RedirectUri) : ICommand<MetaCallbackResult>;

public sealed record MetaCallbackResult(Guid IntegrationId);

/// <summary>Enable the chosen pages/forms, subscribe pages to webhooks, mark the integration connected.</summary>
public sealed record SelectMetaTargetsCommand(Guid IntegrationId, IReadOnlyList<MetaPageSelection> Pages) : ICommand;

public sealed record MetaPageSelection(string PageId, IReadOnlyList<MetaFormSelection> Forms);
public sealed record MetaFormSelection(string FormId, string Name);
