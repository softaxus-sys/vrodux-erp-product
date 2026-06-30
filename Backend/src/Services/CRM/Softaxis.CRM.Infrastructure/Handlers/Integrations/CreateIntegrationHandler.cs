using System.Security.Cryptography;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Integrations.Commands;
using Softaxis.CRM.Application.Integrations.Dtos;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Domain.Entities.Integrations;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations;

internal sealed class CreateIntegrationHandler(
    CrmDbContext db,
    ILeadProviderRegistry registry,
    ISecretProtector protector,
    IConfiguration config) : ICommandHandler<CreateIntegrationCommand, IntegrationDto>
{
    public async Task<Result<IntegrationDto>> Handle(CreateIntegrationCommand cmd, CancellationToken ct)
    {
        var provider = registry.Find(cmd.ProviderKey);
        if (provider is null)
            return Result.Failure<IntegrationDto>(Error.Custom("Integration.UnknownProvider",
                $"No lead provider is registered for '{cmd.ProviderKey}'."));

        if (provider.Descriptor.ComingSoon)
            return Result.Failure<IntegrationDto>(Error.Custom("Integration.Conflict",
                $"The '{provider.Descriptor.DisplayName}' integration is not available yet."));

        var integration = new Integration(cmd.ProviderKey, cmd.Name ?? provider.Descriptor.DisplayName);

        // Generate + encrypt an HMAC signing secret for inbound-key providers (webhook/custom/website).
        var rawSecret = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        integration.SetSigningSecret(protector.Protect(rawSecret));

        // Inbound-key providers (webhook/custom/website/zapier/make) are live on creation —
        // possession of the inbound URL is the credential. OAuth providers connect separately.
        var caps = provider.Descriptor.Capabilities;
        if (caps.HasFlag(ProviderCapabilities.InboundKey) && !caps.HasFlag(ProviderCapabilities.OAuth))
            integration.MarkConnected();

        db.Integrations.Add(integration);
        await db.SaveChangesAsync(ct);

        return Result.Success(IntegrationMappings.ToDto(integration, config["Integrations:PublicBaseUrl"]));
    }
}
