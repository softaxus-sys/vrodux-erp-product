namespace Softaxis.Construction.Application.Contractors.Dtos;

public sealed record ContractorDto(
    Guid Id, string CompanyName, string Trade, string ContactPerson, string Email, string Phone,
    string City, string LicenseNumber, string LicenseExpiry, int ActiveProjects, int CompletedProjects,
    decimal TotalContractValue, decimal Rating);

public sealed record ContractorsSummaryDto(
    int Total, int Civil, int Structural, int Mep,
    int TotalActiveProjects, decimal TotalContractValue, double AvgRating);
