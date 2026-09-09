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

/// <summary>
/// Store a signing secret that the PROVIDER issued, rather than one we generated.
///
/// <para>Most inbound providers accept a secret we invent and hand to them. Bayut and dubizzle work
/// the other way round: their integration team issues the key (their "Push Key") once they register
/// your endpoint, and signs every delivery with <c>md5(key . body)</c>. Without a way to store
/// their value, a signed Bayut delivery could never be verified — the generated secret would never
/// match, so the signature would have to be ignored entirely.</para>
/// </summary>
public sealed record SetIntegrationSigningSecretCommand(Guid Id, string Secret) : ICommand;

public sealed class SetIntegrationSigningSecretValidator : AbstractValidator<SetIntegrationSigningSecretCommand>
{
    public SetIntegrationSigningSecretValidator() => RuleFor(x => x.Secret).NotEmpty();
}

public sealed record RotateInboundKeyCommand(Guid Id) : ICommand<IntegrationDto>;

public sealed record DisconnectIntegrationCommand(Guid Id) : ICommand;

public sealed record DeleteIntegrationCommand(Guid Id) : ICommand;
