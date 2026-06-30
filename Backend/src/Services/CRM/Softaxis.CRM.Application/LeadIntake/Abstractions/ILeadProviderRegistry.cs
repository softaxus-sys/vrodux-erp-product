namespace Softaxis.CRM.Application.LeadIntake.Abstractions;

/// <summary>
/// Resolves <see cref="ILeadProvider"/> implementations by key (Factory pattern). Backed
/// by DI — every registered provider is discoverable here, so the catalog endpoint and the
/// pipeline never hard-code a provider list.
/// </summary>
public interface ILeadProviderRegistry
{
    /// <summary>All registered providers (used to build the Settings → Integrations catalog).</summary>
    IReadOnlyList<ILeadProvider> All { get; }

    /// <summary>Resolve a provider by key, or null if none is registered.</summary>
    ILeadProvider? Find(string key);

    /// <summary>Resolve a provider by key, or throw when missing.</summary>
    ILeadProvider Get(string key);
}
