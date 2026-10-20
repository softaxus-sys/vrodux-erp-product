using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Library.Application.Catalogue;

namespace Softaxis.Library.Application.Circulation;

// ── Loans ───────────────────────────────────────────────────────────────────

public sealed record LoanDto(
    Guid Id, Guid CopyId, string Barcode, Guid TitleId, string Title, string Authors,
    Guid MemberId, string MemberNumber, string MemberName, string? MemberPhone,
    Guid BranchId, string BranchName, string IssuedOn, string DueDate, string? ReturnedOn,
    string? ReturnBranchName, int RenewalCount, string Status, bool IsOverdue, int DaysOverdue,
    string? IssuedByName);

/// <param name="Status">active | overdue | returned | lost, or null for all.</param>
public sealed record GetLoansQuery(
    string? Status = null, Guid? BranchId = null, Guid? MemberId = null, Guid? TitleId = null,
    string? Search = null, int Page = 1, int PageSize = 50, string? Today = null)
    : IQuery<PagedDto<LoanDto>>;

/// <summary>The loan is issued at the branch the copy is at.</summary>
/// <param name="DueDate">Overrides the membership type's loan period.</param>
public sealed record IssueLoanCommand(
    Guid MemberId, Guid CopyId, string? DueDate, string? Today, string? IssuedByName)
    : ICommand<LoanDto>;

public sealed record ReturnResultDto(
    LoanDto Loan, int DaysOverdue, decimal FineAmount, string? HeldForMemberName, string? HeldAtBranchName);

/// <param name="ReturnBranchId">Where it was handed in. Defaults to the issuing branch.</param>
public sealed record ReturnLoanCommand(Guid LoanId, Guid? ReturnBranchId, bool Damaged, string? Notes, string? Today)
    : ICommand<ReturnResultDto>;

public sealed record RenewLoanCommand(Guid LoanId, string? Today) : ICommand<LoanDto>;

public sealed record MarkLoanLostCommand(Guid LoanId, string? Today) : ICommand<LoanDto>;

public sealed class IssueLoanValidator : AbstractValidator<IssueLoanCommand>
{
    public IssueLoanValidator()
    {
        RuleFor(x => x.MemberId).NotEmpty().WithMessage("Choose a member.");
        RuleFor(x => x.CopyId).NotEmpty().WithMessage("Scan or choose a copy.");
    }
}

// ── Reservations ────────────────────────────────────────────────────────────

public sealed record ReservationDto(
    Guid Id, Guid TitleId, string Title, Guid MemberId, string MemberNumber, string MemberName,
    string? MemberPhone, Guid PickupBranchId, string PickupBranchName, string Status, Guid? CopyId,
    string? Barcode, string ReservedOn, string? ReadyOn, string? HoldUntil, bool HoldExpired);

/// <param name="Status">waiting | ready | fulfilled | cancelled | open (waiting + ready), or null for all.</param>
public sealed record GetReservationsQuery(
    string? Status = null, Guid? BranchId = null, Guid? MemberId = null, Guid? TitleId = null, string? Today = null)
    : IQuery<IReadOnlyList<ReservationDto>>;

public sealed record CreateReservationCommand(Guid TitleId, Guid MemberId, Guid PickupBranchId, string? Today)
    : ICommand<ReservationDto>;

public sealed record CancelReservationCommand(Guid Id, string? Today) : ICommand;

public sealed class CreateReservationValidator : AbstractValidator<CreateReservationCommand>
{
    public CreateReservationValidator()
    {
        RuleFor(x => x.TitleId).NotEmpty().WithMessage("Choose a title.");
        RuleFor(x => x.MemberId).NotEmpty().WithMessage("Choose a member.");
        RuleFor(x => x.PickupBranchId).NotEmpty().WithMessage("Choose a pickup branch.");
    }
}

// ── Fines ───────────────────────────────────────────────────────────────────

public sealed record FineDto(
    Guid Id, Guid MemberId, string MemberNumber, string MemberName, Guid? LoanId, string? Title,
    string Type, decimal Amount, decimal AmountPaid, decimal Balance, string Status, string? Reason,
    string CreatedOn, string? SettledOn, string? PaymentMethod);

public sealed record FinesSummaryDto(decimal Outstanding, int UnpaidCount, decimal CollectedThisMonth, decimal WaivedThisMonth);

public sealed record GetFinesQuery(string? Status = null, Guid? MemberId = null, string? Search = null)
    : IQuery<IReadOnlyList<FineDto>>;

public sealed record GetFinesSummaryQuery(string? Today = null) : IQuery<FinesSummaryDto>;

public sealed record CreateFineCommand(Guid MemberId, string Type, decimal Amount, string? Reason, string? Today)
    : ICommand<FineDto>;

public sealed record PayFineCommand(Guid Id, decimal Amount, string? Method, string? Today) : ICommand<FineDto>;

public sealed record WaiveFineCommand(Guid Id, string? Reason, string? Today) : ICommand<FineDto>;

public sealed class CreateFineValidator : AbstractValidator<CreateFineCommand>
{
    public CreateFineValidator()
    {
        RuleFor(x => x.MemberId).NotEmpty().WithMessage("Choose a member.");
        RuleFor(x => x.Type).NotEmpty().MaximumLength(20);
        RuleFor(x => x.Amount).GreaterThan(0).WithMessage("Amount must be more than zero.");
        RuleFor(x => x.Reason).MaximumLength(900);
    }
}

public sealed class PayFineValidator : AbstractValidator<PayFineCommand>
{
    public PayFineValidator() =>
        RuleFor(x => x.Amount).GreaterThan(0).WithMessage("Amount must be more than zero.");
}

// ── Dashboard ───────────────────────────────────────────────────────────────

public sealed record BranchStatDto(Guid BranchId, string Name, int Copies, int Available, int OnLoan, int Overdue);

public sealed record TopTitleDto(Guid TitleId, string Title, string Authors, int Loans);

public sealed record LibraryDashboardDto(
    int Titles, int Copies, int Available, int OnLoan, int Overdue, int DueToday, int InTransit,
    int ActiveMembers, int WaitingReservations, int ReadyReservations, decimal UnpaidFines,
    int IssuedLast30Days, int ReturnedLast30Days,
    IReadOnlyList<BranchStatDto> Branches, IReadOnlyList<TopTitleDto> TopTitles);

public sealed record GetLibraryDashboardQuery(string? Today = null) : IQuery<LibraryDashboardDto>;
