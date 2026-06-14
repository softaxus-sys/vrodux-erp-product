namespace Softaxis.Construction.Application.Bidding.Dtos;

public sealed record RfqDto(
    Guid Id, string RfqNumber, Guid? LeadId, Guid? CustomerId, string ClientName, string ProjectTitle,
    string? Scope, decimal? Budget, string DueDate, string Status, string AssignedTo, string? Notes,
    DateTime CreatedAt);

public sealed record EstimateDto(
    Guid Id, string EstimateNumber, Guid? RfqId, Guid? DealId, Guid? CustomerId, string ClientName,
    string Title, decimal Amount, string ValidUntil, string Status, string? Notes, DateTime CreatedAt);

public sealed record ConstructionContractDto(
    Guid Id, string ContractNumber, Guid? DealId, Guid? CustomerId, Guid? EstimateId, Guid? ProjectId,
    string ClientName, string Title, decimal ContractValue, string StartDate, string EndDate,
    string Status, string? Contractor, string? Notes, DateTime CreatedAt);

public sealed record BiddingSummaryDto(
    int OpenRfqs, int TotalRfqs, int PendingEstimates, decimal EstimatedValue,
    int ActiveContracts, decimal ContractValue);
