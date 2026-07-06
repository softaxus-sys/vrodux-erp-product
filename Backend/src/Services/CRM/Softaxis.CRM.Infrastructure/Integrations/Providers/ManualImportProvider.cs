using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Application.LeadIntake.Dtos;
using Softaxis.CRM.Domain.Entities.Integrations;

namespace Softaxis.CRM.Infrastructure.Integrations.Providers;

/// <summary>
/// A manual, file-upload lead source (CSV / Excel). Unlike push/poll providers it holds no
/// persistent connection — the file is parsed in the browser and the rows are posted to the
/// authenticated bulk endpoint (<c>POST /api/internal/leads/import</c>), which runs each through
/// the same intake pipeline. This provider exists only so the source shows as an available card
/// in the catalog; <see cref="Normalize"/> is never invoked (there is no inbound payload).
/// </summary>
public sealed class ManualImportProvider(string key, string displayName, string description) : ILeadProvider
{
    public string Key => key;

    public ProviderDescriptor Descriptor => new(
        key, displayName, ProviderCategory.Import, description,
        ProviderCapabilities.ManualImport, ComingSoon: false);

    public IReadOnlyList<CanonicalLead> Normalize(string rawPayload, Integration integration) => [];
}
