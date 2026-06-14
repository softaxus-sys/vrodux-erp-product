using Softaxis.RealEstate.Application.Brokers.Dtos;
using Softaxis.RealEstate.Domain.Entities;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Brokers;

internal static class BrokerMappings
{
    public static BrokerDto ToDto(Broker b) => new(
        b.Id, b.BrokerNumber, b.Name, b.Agency, b.Email, b.Phone,
        b.LicenseNumber, b.LicenseExpiry, b.Specialization,
        b.DealsCompleted, b.TotalCommission, b.CommissionRate, b.Rating, b.Status);
}
