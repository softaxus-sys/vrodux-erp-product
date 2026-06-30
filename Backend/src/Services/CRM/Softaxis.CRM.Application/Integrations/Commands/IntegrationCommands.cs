using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Integrations.Dtos;

namespace Softaxis.CRM.Application.Integrations.Commands;

/// <summary>
/// Create a tenant integration for a provider. Used by no-credential providers
/// (webhook / custom-api / website) and as the first step of OAuth providers.
/// </summary>
public sealed record CreateIntegrationCommand(string ProviderKey, string? Name) : ICommand<IntegrationDto>;

public sealed class CreateIntegrationValidator : AbstractValidator<CreateIntegrationCommand>
{
    public CreateIntegrationValidator() => RuleFor(x => x.ProviderKey).NotEmpty();
}

/// <summary>Update tenant-shaped configuration: provider config + dedupe + routing + field mappings.</summary>
public sealed record UpdateIntegrationConfigCommand(
    Guid Id,
    string? Config,
    string? DedupeConfig,
    string? RoutingConfig,
    IReadOnlyList<FieldMappingInput>? FieldMappings) : ICommand;

public sealed record FieldMappingInput(string SourceField, string TargetField);

/// <summary>Set an API-key / token credential (encrypted at rest) for ApiKey providers.</summary>
public sealed record SetIntegrationApiKeyCommand(Guid Id, string ApiKey) : ICommand;

public sealed class SetIntegrationApiKeyValidator : AbstractValidator<SetIntegrationApiKeyCommand>
{
    public SetIntegrationApiKeyValidator() => RuleFor(x => x.ApiKey).NotEmpty();
}

public sealed record RotateInboundKeyCommand(Guid Id) : ICommand<IntegrationDto>;

public sealed record DisconnectIntegrationCommand(Guid Id) : ICommand;

public sealed record DeleteIntegrationCommand(Guid Id) : ICommand;
