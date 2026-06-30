using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Application.LeadIntake.Dtos;
using Softaxis.CRM.Domain.Entities.Integrations;

namespace Softaxis.CRM.Infrastructure.Integrations.Providers;

/// <summary>
/// A registered-but-not-yet-functional provider. It appears in the catalog as a "Coming soon"
/// card and cannot be connected. Turning a stub into a real integration is: implement the
/// concrete provider (Strategy) and swap its DI registration — no other change.
/// </summary>
public sealed class StubLeadProvider(string key, string displayName, string category, string description,
    ProviderCapabilities plannedCapabilities) : ILeadProvider
{
    public string Key => key;

    public ProviderDescriptor Descriptor =>
        new(key, displayName, category, description, plannedCapabilities, ComingSoon: true);

    public IReadOnlyList<CanonicalLead> Normalize(string rawPayload, Integration integration) => [];
}
