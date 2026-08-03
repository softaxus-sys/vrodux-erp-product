namespace Softaxis.Restaurant.Application.Delivery.Abstractions;

/// <summary>DI-discovered registry over every registered IDeliveryProvider — mirrors CRM's
/// ILeadProviderRegistry.</summary>
public interface IDeliveryProviderRegistry
{
    IReadOnlyList<IDeliveryProvider> All { get; }
    IDeliveryProvider? Find(string key);
}
