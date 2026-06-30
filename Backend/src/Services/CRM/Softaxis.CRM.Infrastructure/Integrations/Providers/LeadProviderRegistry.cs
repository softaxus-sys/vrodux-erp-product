using Softaxis.CRM.Application.LeadIntake.Abstractions;

namespace Softaxis.CRM.Infrastructure.Integrations.Providers;

/// <summary>
/// DI-backed <see cref="ILeadProviderRegistry"/>. Every <see cref="ILeadProvider"/> registered
/// in the container is injected here, so the catalog and pipeline auto-discover providers —
/// adding a provider is one DI line, nothing else.
/// </summary>
public sealed class LeadProviderRegistry : ILeadProviderRegistry
{
    private readonly Dictionary<string, ILeadProvider> _byKey;

    public LeadProviderRegistry(IEnumerable<ILeadProvider> providers)
    {
        _byKey = providers.ToDictionary(p => p.Key, StringComparer.OrdinalIgnoreCase);
        All    = _byKey.Values.OrderBy(p => p.Descriptor.DisplayName).ToList();
    }

    public IReadOnlyList<ILeadProvider> All { get; }

    public ILeadProvider? Find(string key) =>
        _byKey.TryGetValue(key, out var p) ? p : null;

    public ILeadProvider Get(string key) =>
        Find(key) ?? throw new InvalidOperationException($"No lead provider registered for key '{key}'.");
}
