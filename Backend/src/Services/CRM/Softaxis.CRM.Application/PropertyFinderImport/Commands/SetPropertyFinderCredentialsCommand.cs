using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.CRM.Application.PropertyFinderImport.Commands;

/// <summary>
/// Stores a workspace's own Property Finder API credentials, encrypted, on its integration.
///
/// <para>Per-tenant by design. A Property Finder account belongs to one agency, so a key held in
/// shared configuration would be used by every tenant on the deployment — one agency's import would
/// pull another agency's agents and enquiries into their CRM.</para>
///
/// <para>The pair is verified against Property Finder before being saved: storing a key that does
/// not work leaves an integration that looks connected and fails later, at the least convenient
/// moment.</para>
/// </summary>
public sealed record SetPropertyFinderCredentialsCommand(
    Guid IntegrationId, string ApiKey, string ApiSecret) : ICommand;

public sealed class SetPropertyFinderCredentialsCommandValidator
    : AbstractValidator<SetPropertyFinderCredentialsCommand>
{
    public SetPropertyFinderCredentialsCommandValidator()
    {
        // Lengths come from Property Finder's own schema — catching a mistyped key here is far
        // clearer than a 401 from their API.
        RuleFor(x => x.ApiKey).NotEmpty().Length(40)
            .WithMessage("A Property Finder API key is exactly 40 characters.");
        RuleFor(x => x.ApiSecret).NotEmpty().Length(32)
            .WithMessage("A Property Finder API secret is exactly 32 characters.");
    }
}
