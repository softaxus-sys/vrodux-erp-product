using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.CRM.Application.Integrations.Queries;

/// <summary>Pages discovered during the Meta OAuth flow (for the selection step).</summary>
public sealed record GetMetaPagesQuery(Guid IntegrationId) : IQuery<IReadOnlyList<MetaPageDto>>;

public sealed record MetaPageDto(string PageId, string Name, bool Enabled);

/// <summary>Live-fetch the lead forms for a page during selection.</summary>
public sealed record GetMetaFormsQuery(Guid IntegrationId, string PageId) : IQuery<IReadOnlyList<MetaFormDto>>;

public sealed record MetaFormDto(string FormId, string Name, bool Enabled);

/// <summary>App-level Meta webhook verification handshake (hub.challenge against the app verify token).</summary>
public sealed record VerifyMetaWebhookQuery(IReadOnlyDictionary<string, string> Query) : IQuery<string>;
