namespace Softaxis.RealEstate.Application.Contracts.Dtos;

public sealed record ContractDto(
    Guid Id, string ContractNumber, Guid PropertyId, string PropertyName, Guid UnitId, string UnitNumber,
    Guid TenantId, string TenantName, string StartDate, string EndDate, decimal AnnualRent, int Cheques,
    decimal SecurityDeposit, string Status, decimal TotalPaid, decimal Balance, string? EjariNumber, string? Notes,
    // ── added with the rent schedule ────────────────────────────────────────
    // The frontend ContractDto has always DECLARED paymentFrequency/nextPaymentDate/lastPaymentDate.
    // The mapper never returned them, so they were undefined at runtime. These are the real values.
    string PaymentFrequency = "annual",
    string? NextDueDate = null,
    decimal NextDueAmount = 0,
    string? LastPaymentDate = null,
    int OverdueCount = 0,
    decimal OverdueAmount = 0,
    int InstallmentCount = 0,
    int? DaysToExpiry = null);

public sealed record RentInstallmentDto(
    Guid Id, Guid ContractId, int InstallmentNumber, string DueDate,
    decimal Amount, decimal AmountPaid, decimal Balance,
    // "overdue" here is DERIVED against today, never stored, so it cannot go stale between sweeps.
    // Values: pending / partial / paid / waived / overdue.
    string Status, int DaysOverdue,
    string? PaidDate, string? PaymentMethod, string? Reference, string? Notes);

public sealed record ContractDetailDto(ContractDto Contract, IReadOnlyList<RentInstallmentDto> Installments);

public sealed record ContractsSummaryDto(
    int Total, int Active, int Expired, int Terminated,
    decimal TotalAnnualRent, decimal TotalCollected, decimal Outstanding, int ExpiringSoon,
    int OverdueInstallments = 0, decimal OverdueAmount = 0, int DueThisMonth = 0, decimal DueThisMonthAmount = 0);

public sealed record CreatedContractDto(
    Guid Id, string ContractNumber, int InstallmentsCreated,
    decimal AdvanceApplied = 0, int InstallmentsSettledByAdvance = 0,
    string? NextDueDate = null);

/// <summary>A payment that is due or late, flattened with the lease context an operator needs to chase it.</summary>
public sealed record RentDueItemDto(
    Guid InstallmentId, Guid ContractId, string ContractNumber, Guid TenantId, string TenantName,
    string TenantEmail, string PropertyName, string UnitNumber,
    string DueDate, decimal Amount, decimal Balance, string Status, int DaysOverdue, int DaysUntilDue);
