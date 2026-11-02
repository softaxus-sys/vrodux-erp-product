using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Fitness.Application.Portal;

// Staff side
public sealed record PortalSettingsDto(bool Enabled, bool AllowBooking, int MembersWithAccess);
public sealed record GetPortalSettingsQuery : IQuery<PortalSettingsDto>;
public sealed record UpdatePortalSettingsCommand(bool Enabled, bool AllowBooking) : ICommand<PortalSettingsDto>;
/// <summary>The PIN in the reply cannot be read again.</summary>
public sealed record MemberPortalPinDto(string MemberNumber, string Pin);
public sealed record SetMemberPortalPinCommand(Guid MemberId) : ICommand<MemberPortalPinDto>;
public sealed record ClearMemberPortalPinCommand(Guid MemberId) : ICommand;

// Member side (anonymous: the gym comes from the address, the member from the session token)
public sealed record PortalInfoDto(string GymName, bool AllowBooking, string? Currency);
public sealed record GetPortalInfoQuery(string Slug) : IQuery<PortalInfoDto>;

public sealed record PortalSessionDto(string Token, DateTime ExpiresAt, string FullName, string MemberNumber);
public sealed record PortalSignInCommand(string Slug, string MemberNumber, string Pin) : ICommand<PortalSessionDto>;
public sealed record PortalChangePinCommand(string Slug, string? Token, string CurrentPin, string NewPin) : ICommand<PortalSessionDto>;

public sealed record PortalMembershipDto(Guid Id, string PlanName, string StartDate, string EndDate, string State,
    int? ClassCreditsLeft, int PtSessionsLeft, decimal Balance, string? FrozenFrom);
public sealed record PortalBookingDto(Guid Id, Guid SessionId, string? ClassName, string? Date, string? StartTime, string Status, int? WaitlistPosition);
public sealed record PortalPaymentDto(string ReceiptNumber, string PaidOn, decimal Amount, string Method);
public sealed record PortalVisitDto(string Date, DateTime CheckedInAt, string? BranchName);
public sealed record PortalClassDto(Guid Id, string ClassName, string? TrainerName, string? BranchName, string Date,
    string StartTime, string EndTime, int SeatsLeft, int Waitlisted, bool BookedByMe);

public sealed record PortalAccountDto(string FullName, string MemberNumber, string Status, string? HomeBranchName,
    string? TrainerName, decimal Balance, int Visits30Days, string? LastVisit,
    IReadOnlyList<PortalMembershipDto> Memberships, IReadOnlyList<PortalBookingDto> Bookings,
    IReadOnlyList<PortalPaymentDto> Payments, IReadOnlyList<PortalVisitDto> Visits);

public sealed record GetPortalAccountQuery(string Slug, string? Token, string? Today) : IQuery<PortalAccountDto>;
public sealed record GetPortalClassesQuery(string Slug, string? Token, string? Today) : IQuery<IReadOnlyList<PortalClassDto>>;
public sealed record PortalBookClassCommand(string Slug, string? Token, Guid SessionId, string? Today, string? LocalTime) : ICommand<PortalBookingDto>;
public sealed record PortalCancelBookingCommand(string Slug, string? Token, Guid BookingId, string? Today, string? LocalTime) : ICommand;

public sealed class PortalChangePinValidator : AbstractValidator<PortalChangePinCommand>
{
    public PortalChangePinValidator()
    {
        RuleFor(x => x.NewPin).Matches(@"^\d{4,8}$").WithMessage("The new PIN must be 4 to 8 digits.");
    }
}
