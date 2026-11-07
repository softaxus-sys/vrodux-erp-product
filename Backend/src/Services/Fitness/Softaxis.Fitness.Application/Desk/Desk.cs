using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Fitness.Application.Desk;

/// <summary>Result of a check-in attempt. A refused attempt is kept too, so the desk can see why.</summary>
public sealed record CheckInResultDto(Guid Id, bool Allowed, string? DenyReason, Guid MemberId, string MemberName,
    string MemberNumber, bool HasPhoto, string? PlanName, string? EndDate, int? DaysLeft, decimal Balance,
    int? ClassCreditsLeft, int? VisitsLeft, string? HealthNotes, IReadOnlyList<string> Warnings, DateTime At);

public sealed record VisitDto(Guid Id, Guid MemberId, string MemberName, string MemberNumber, Guid BranchId,
    string? BranchName, string Date, DateTime CheckedInAt, DateTime? CheckedOutAt, bool Allowed, string? DenyReason,
    string Method, bool IsGuest, string? GuestName, string? RecordedByName);

public sealed record VisitPageDto(IReadOnlyList<VisitDto> Items, int Total);

/// <summary>Check a member in. MemberRef is the member number, phone or id (a card scan sends the number).</summary>
public sealed record CheckInCommand(string MemberRef, Guid BranchId, string? Method, bool Override, string? Today,
    string? LocalTime) : ICommand<CheckInResultDto>;

public sealed record GuestCheckInCommand(Guid HostMemberId, Guid BranchId, string GuestName, string? Today) : ICommand<VisitDto>;
public sealed record CheckOutCommand(Guid VisitId) : ICommand<VisitDto>;
public sealed record CheckOutAllCommand(Guid BranchId, string? Today) : ICommand<int>;

public sealed record GetVisitsQuery(Guid? BranchId, Guid? MemberId, string? From, string? To, bool InGymOnly,
    bool IncludeRefused, int Page = 1, int PageSize = 100) : IQuery<VisitPageDto>;

public sealed record OccupancyDto(Guid BranchId, string BranchName, int InGym, int? Capacity, int VisitsToday);
public sealed record GetOccupancyQuery(string? Today) : IQuery<IReadOnlyList<OccupancyDto>>;

public sealed class CheckInValidator : AbstractValidator<CheckInCommand>
{
    public CheckInValidator()
    {
        RuleFor(x => x.MemberRef).NotEmpty().WithMessage("Scan a card or enter a member number.").MaximumLength(100);
        RuleFor(x => x.BranchId).NotEmpty().WithMessage("Choose the branch.");
        RuleFor(x => x.LocalTime).Matches("^([01]\\d|2[0-3]):[0-5]\\d$").When(x => !string.IsNullOrWhiteSpace(x.LocalTime));
    }
}

public sealed class GuestCheckInValidator : AbstractValidator<GuestCheckInCommand>
{
    public GuestCheckInValidator()
    {
        RuleFor(x => x.GuestName).NotEmpty().WithMessage("Enter the guest's name.").MaximumLength(150);
        RuleFor(x => x.BranchId).NotEmpty();
    }
}
