using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.PropertyFinderImport.Dtos;

namespace Softaxis.CRM.Application.PropertyFinderImport.Queries;

/// <summary>
/// Read-only. Fetches the Property Finder account's roles, users and lead statistics so an
/// administrator can review the mapping before any login is created or any lead is written.
/// Touches nothing in our database.
/// </summary>
public sealed record GetPropertyFinderPreviewQuery : IQuery<PfImportPreviewDto>;

/// <summary>
/// Is live sync actually running? Reads the subscriptions Property Finder holds and compares them
/// with this integration's inbound URL. Read-only.
/// </summary>
public sealed record GetPropertyFinderWebhooksQuery(Guid IntegrationId) : IQuery<PfWebhookStatusDto>;
