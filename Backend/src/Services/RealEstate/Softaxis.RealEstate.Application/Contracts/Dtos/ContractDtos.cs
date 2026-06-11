namespace Softaxis.RealEstate.Application.Contracts.Dtos;

public sealed record ContractDto(
    Guid Id, string ContractNumber, Guid PropertyId, string PropertyName, Guid UnitId, string UnitNumber,
    Guid TenantId, string TenantName, string StartDate, string EndDate, decimal AnnualRent, int Cheques,
    decimal SecurityDeposit, string Status, decimal TotalPaid, decimal Balance, string? EjariNumber, string? Notes);

public sealed record ContractsSummaryDto(
    int Total, int Active, int Expired, int Terminated,
    decimal TotalAnnualRent, decimal TotalCollected, decimal Outstanding, int ExpiringSoon);
