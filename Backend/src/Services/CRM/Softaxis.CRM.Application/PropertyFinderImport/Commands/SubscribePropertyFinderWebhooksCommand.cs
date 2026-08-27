using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.PropertyFinderImport.Dtos;

namespace Softaxis.CRM.Application.PropertyFinderImport.Commands;

/// <summary>
/// Registers this tenant's inbound URL with Property Finder so new enquiries arrive on their own,
/// instead of only appearing when someone re-runs the import.
///
/// <para>Subscribes to <c>lead.created</c> and <c>lead.assigned</c>. The second matters as much as
/// the first: Property Finder reassigns leads between agents, and without it a lead would keep the
/// owner it happened to have when it was first imported.</para>
///
/// <para>Idempotent — a subscription already pointing at our URL is left alone rather than
/// duplicated. Property Finder permits several subscriptions per event, so blind re-subscribing
/// would quietly deliver every lead twice.</para>
/// </summary>
public sealed record SubscribePropertyFinderWebhooksCommand(Guid IntegrationId) : ICommand<PfWebhookStatusDto>;
