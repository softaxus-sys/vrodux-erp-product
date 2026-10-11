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
    int? DaysToExpiry = null,
    // ── renewal chain + early termination ───────────────────────────────────
    Guid? RenewedFromContractId = null,
    Guid? RenewedToContractId = null,
    int RenewalNumber = 0,
    decimal? PreviousAnnualRent = null,
    // null when the lease has no termination on record; otherwise scheduled / pending_settlement / settled.
    string? TerminationStatus = null,
    string? TerminationDate = null);

public sealed record RentInstallmentDto(
    Guid Id, Guid ContractId, int InstallmentNumber, string DueDate,
    decimal Amount, decimal AmountPaid, decimal Balance,
    // "overdue" here is DERIVED against today, never stored, so it cannot go stale between sweeps.
    // Values: pending / partial / paid / waived / overdue.
    string Status, int DaysOverdue,
    string? PaidDate, string? PaymentMethod, string? Reference, string? Notes);

public sealed record ContractDetailDto(
    ContractDto Contract, IReadOnlyList<RentInstallmentDto> Installments,
    // Every lease in this tenancy, oldest first — the original and each renewal after it.
    IReadOnlyList<LeaseHistoryItemDto>? History = null,
    LeaseTerminationDto? Termination = null);

public sealed record LeaseHistoryItemDto(
    Guid Id, string ContractNumber, string StartDate, string EndDate,
    decimal AnnualRent, string Status, int RenewalNumber);

public sealed record RenewedContractDto(
    Guid Id, string ContractNumber, int RenewalNumber, int InstallmentsCreated,
    decimal PreviousAnnualRent, decimal RentChangePercent,
    // Rent still unpaid on the lease being replaced. It stays owed and stays in the chase queue.
    decimal OutstandingOnPreviousLease,
    decimal AdvanceApplied = 0, string? NextDueDate = null);

/// <summary>
/// The final account for ending a lease on a given day. NetSettlement is positive when the
/// landlord owes the tenant a refund and negative when the tenant still owes money.
/// </summary>
public sealed record TerminationStatementDto(
    string TerminationDate, decimal RentOwed, decimal RentPaid, decimal RentArrears, decimal RentRefund,
    decimal DepositHeld, decimal PenaltyAmount, decimal DeductionsAmount, decimal NetSettlement,
    int InstallmentsCancelled, decimal CancelledAmount,
    // False when the date is still ahead: the lease stays active until then.
    bool TakesEffectNow);

public sealed record LeaseTerminationDto(
    Guid Id, Guid ContractId, string Status, string TerminationDate, string? NoticeDate,
    string Reason, string? ReasonNotes,
    decimal RentOwed, decimal RentPaid, decimal RentArrears, decimal RentRefund,
    decimal DepositHeld, decimal PenaltyAmount, decimal DeductionsAmount, string? DeductionNotes,
    decimal NetSettlement,
    string? SettledOn, string? SettlementMethod, string? SettlementReference, string? SettlementNotes,
    string? RecordedByName, DateTime CreatedAt);

public sealed record ContractsSummaryDto(
    int Total, int Active, int Expired, int Terminated,
    decimal TotalAnnualRent, decimal TotalCollected, decimal Outstanding, int ExpiringSoon,
    int OverdueInstallments = 0, decimal OverdueAmount = 0, int DueThisMonth = 0, decimal DueThisMonthAmount = 0,
    int Renewed = 0, int NoticeGiven = 0, int PendingSettlements = 0);

public sealed record CreatedContractDto(
    Guid Id, string ContractNumber, int InstallmentsCreated,
    decimal AdvanceApplied = 0, int InstallmentsSettledByAdvance = 0,
    string? NextDueDate = null);

/// <summary>A payment that is due or late, flattened with the lease context an operator needs to chase it.</summary>
public sealed record RentDueItemDto(
    Guid InstallmentId, Guid ContractId, string ContractNumber, Guid TenantId, string TenantName,
    string TenantEmail, string PropertyName, string UnitNumber,
    string DueDate, decimal Amount, decimal Balance, string Status, int DaysOverdue, int DaysUntilDue);
