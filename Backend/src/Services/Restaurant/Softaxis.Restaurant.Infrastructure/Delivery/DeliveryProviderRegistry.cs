using Softaxis.Restaurant.Application.Delivery.Abstractions;

namespace Softaxis.Restaurant.Infrastructure.Delivery;

internal sealed class DeliveryProviderRegistry(IEnumerable<IDeliveryProvider> providers) : IDeliveryProviderRegistry
{
    public IReadOnlyList<IDeliveryProvider> All { get; } = providers.ToList();
    public IDeliveryProvider? Find(string key) => All.FirstOrDefault(p => p.Key == key);
}
