namespace Softaxis.RealEstate.Application.Brokers.Dtos;

public sealed record BrokerDto(
    Guid Id, string BrokerNumber, string Name, string Agency, string Email, string Phone,
    string LicenseNumber, string LicenseExpiry, string Specialization,
    int DealsCompleted, decimal TotalCommission, decimal CommissionRate, decimal Rating, string Status);

public sealed record BrokersSummaryDto(
    int Total, int Residential, int Commercial, int Both,
    int TotalDeals, decimal TotalCommission, double AvgRating);
