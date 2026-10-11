using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Library.Application.Catalogue;

namespace Softaxis.Library.Application.Portal;

// ── Staff side: switching the portal on, and giving a member a PIN ───────────

public sealed record PortalSettingsDto(bool Enabled, bool AllowRenewals, bool AllowReservations, bool PublicCatalogue,
    int MembersWithAccess);

public sealed record GetPortalSettingsQuery : IQuery<PortalSettingsDto>;

public sealed record UpdatePortalSettingsCommand(bool Enabled, bool AllowRenewals, bool AllowReservations, bool PublicCatalogue)
    : ICommand<PortalSettingsDto>;

/// <summary>The PIN is returned once, here, and is never readable again.</summary>
public sealed record MemberPortalPinDto(string MemberNumber, string Pin);

/// <summary>Gives the member online access with a fresh PIN, replacing any earlier one.</summary>
public sealed record SetMemberPortalPinCommand(Guid MemberId) : ICommand<MemberPortalPinDto>;

public sealed record ClearMemberPortalPinCommand(Guid MemberId) : ICommand;

// ── Member side (anonymous: the workspace comes from the slug, the member from the session) ──

public sealed record PortalBranchDto(Guid Id, string Name);

public sealed record PortalInfoDto(
    string LibraryName, bool AllowRenewals, bool AllowReservations, bool PublicCatalogue, string? Currency,
    IReadOnlyList<PortalBranchDto> Branches);

public sealed record GetPortalInfoQuery(string Slug) : IQuery<PortalInfoDto>;

public sealed record PortalSessionDto(string Token, DateTime ExpiresAt, string MemberName, string MemberNumber);

public sealed record PortalSignInCommand(string Slug, string MemberNumber, string Pin) : ICommand<PortalSessionDto>;

public sealed record PortalChangePinCommand(string Slug, string? Token, string CurrentPin, string NewPin)
    : ICommand<PortalSessionDto>;

public sealed record PortalMemberDto(
    string MemberNumber, string FullName, string MembershipType, string? ExpiresOn, bool IsExpired, string Status,
    int MaxLoans, int MaxRenewals, int MaxReservations, string? HomeBranchName);

public sealed record PortalLoanDto(
    Guid Id, string Title, string Authors, string Barcode, string BranchName, string IssuedOn, string DueDate,
    int RenewalCount, bool IsOverdue, int DaysOverdue);

public sealed record PortalReservationDto(
    Guid Id, Guid TitleId, string Title, string PickupBranchName, string Status, string ReservedOn,
    string? HoldUntil, bool HoldExpired);

public sealed record PortalFineDto(Guid Id, string Type, string? Title, string? Reason, decimal Balance, string CreatedOn);

public sealed record PortalAccountDto(
    PortalMemberDto Member, IReadOnlyList<PortalLoanDto> Loans, IReadOnlyList<PortalReservationDto> Reservations,
    IReadOnlyList<PortalFineDto> Fines, decimal FinesTotal);

public sealed record GetPortalAccountQuery(string Slug, string? Token, string? Today) : IQuery<PortalAccountDto>;

public sealed record PortalBranchStockDto(Guid BranchId, string BranchName, int Copies, int Available);

public sealed record PortalTitleDto(
    Guid Id, string Title, string? Subtitle, string Authors, string? Category, string MaterialType,
    string? Publisher, int? PublicationYear, string? Language, string? Description,
    int Copies, int Available, int Waiting, IReadOnlyList<PortalBranchStockDto> Branches);

/// <param name="Token">Needed unless the library has opened its catalogue to everyone.</param>
public sealed record PortalSearchQuery(string Slug, string? Token, string? Search, int Page = 1)
    : IQuery<PagedDto<PortalTitleDto>>;

public sealed record PortalRenewCommand(string Slug, string? Token, Guid LoanId, string? Today) : ICommand<PortalLoanDto>;

public sealed record PortalReserveCommand(string Slug, string? Token, Guid TitleId, Guid PickupBranchId, string? Today)
    : ICommand<PortalReservationDto>;

public sealed record PortalCancelReservationCommand(string Slug, string? Token, Guid ReservationId, string? Today) : ICommand;

public sealed class PortalSignInValidator : AbstractValidator<PortalSignInCommand>
{
    public PortalSignInValidator()
    {
        RuleFor(x => x.MemberNumber).NotEmpty().WithMessage("Enter your card number.").MaximumLength(40);
        RuleFor(x => x.Pin).NotEmpty().WithMessage("Enter your PIN.").MaximumLength(20);
    }
}

public sealed class PortalChangePinValidator : AbstractValidator<PortalChangePinCommand>
{
    public PortalChangePinValidator() =>
        RuleFor(x => x.NewPin).Matches("^[0-9]{4,8}$").WithMessage("A PIN is 4 to 8 digits.");
}

public sealed class PortalReserveValidator : AbstractValidator<PortalReserveCommand>
{
    public PortalReserveValidator()
    {
        RuleFor(x => x.TitleId).NotEmpty();
        RuleFor(x => x.PickupBranchId).NotEmpty().WithMessage("Choose where you will collect it.");
    }
}
