namespace Softaxis.CRM.Application.Insurance.Dtos;

public sealed record PolicyDto(
    Guid Id, string PolicyNumber, Guid? LeadId, Guid? DealId, Guid? CustomerId, string HolderName,
    string ProductType, decimal Premium, decimal SumInsured, string StartDate, string EndDate,
    string Status, string? Agent, string? Notes, DateTime CreatedAt);

public sealed record PolicyRenewalDto(
    Guid Id, Guid PolicyId, string PolicyNumber, string HolderName, string RenewalDate,
    decimal NewPremium, string Status, string? Notes, DateTime CreatedAt);

public sealed record InsuranceClaimDto(
    Guid Id, string ClaimNumber, Guid PolicyId, string PolicyNumber, Guid? CustomerId, string HolderName,
    string ClaimDate, decimal ClaimAmount, decimal ApprovedAmount, string Status, string? Reason,
    string? Notes, DateTime CreatedAt);

public sealed record InsuranceSummaryDto(
    int TotalPolicies, int ActivePolicies, int Proposals, decimal PremiumInForce,
    int RenewalsDue, int OpenClaims, decimal ClaimsPaid);
