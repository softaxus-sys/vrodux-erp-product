using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Fitness.Application.Setup;

// ── Branches ───────────────────────────────────────────────────────────────

public sealed record BranchDto(Guid Id, string Name, string? Code, string? Address, string? Phone, string? Email,
    string? OpeningTime, string? ClosingTime, int? Capacity, bool IsActive, int Members, int InGymNow);

public sealed record GetBranchesQuery(bool ActiveOnly = false) : IQuery<IReadOnlyList<BranchDto>>;

public sealed record SaveBranchCommand(Guid? Id, string Name, string? Code, string? Address, string? Phone,
    string? Email, string? OpeningTime, string? ClosingTime, int? Capacity, bool IsActive = true) : ICommand<BranchDto>;

public sealed record DeleteBranchCommand(Guid Id) : ICommand;

public sealed class SaveBranchValidator : AbstractValidator<SaveBranchCommand>
{
    public SaveBranchValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Branch name is required.").MaximumLength(150);
        RuleFor(x => x.Code).MaximumLength(20);
        RuleFor(x => x.Email).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email));
        RuleFor(x => x.OpeningTime).Matches(@"^([01]\d|2[0-3]):[0-5]\d$").When(x => !string.IsNullOrWhiteSpace(x.OpeningTime)).WithMessage("Use HH:mm.");
        RuleFor(x => x.ClosingTime).Matches(@"^([01]\d|2[0-3]):[0-5]\d$").When(x => !string.IsNullOrWhiteSpace(x.ClosingTime)).WithMessage("Use HH:mm.");
        RuleFor(x => x.Capacity).GreaterThanOrEqualTo(0).When(x => x.Capacity.HasValue);
    }
}

// ── Membership plans ───────────────────────────────────────────────────────

public sealed record PlanDto(Guid Id, string Name, string? Code, string? Description, string Category,
    int DurationDays, decimal Price, decimal JoiningFee, int? ClassCredits, int PtSessions, int? VisitsPerDay,
    int? TotalVisits, bool AllowFreeze, int MaxFreezeDays, int GuestPasses, bool AllBranches, string? AccessFrom,
    string? AccessUntil, bool IsActive, int ActiveMembers);

public sealed record GetPlansQuery(bool ActiveOnly = false) : IQuery<IReadOnlyList<PlanDto>>;

public sealed record SavePlanCommand(Guid? Id, string Name, string? Code, string? Description, string Category,
    int DurationDays, decimal Price, decimal JoiningFee, int? ClassCredits, int PtSessions, int? VisitsPerDay,
    int? TotalVisits, bool AllowFreeze, int MaxFreezeDays, int GuestPasses, bool AllBranches, string? AccessFrom,
    string? AccessUntil, bool IsActive = true) : ICommand<PlanDto>;

public sealed record DeletePlanCommand(Guid Id) : ICommand;

public sealed class SavePlanValidator : AbstractValidator<SavePlanCommand>
{
    public SavePlanValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Plan name is required.").MaximumLength(150);
        RuleFor(x => x.Category).Must(c => Domain.Entities.PlanCategory.All.Contains(c)).WithMessage("Unknown plan category.");
        RuleFor(x => x.DurationDays).InclusiveBetween(1, 3660).WithMessage("Duration must be between 1 and 3660 days.");
        RuleFor(x => x.Price).GreaterThanOrEqualTo(0);
        RuleFor(x => x.JoiningFee).GreaterThanOrEqualTo(0);
        RuleFor(x => x.ClassCredits).GreaterThanOrEqualTo(0).When(x => x.ClassCredits.HasValue);
        RuleFor(x => x.PtSessions).GreaterThanOrEqualTo(0);
        RuleFor(x => x.VisitsPerDay).GreaterThan(0).When(x => x.VisitsPerDay.HasValue);
        RuleFor(x => x.TotalVisits).GreaterThan(0).When(x => x.TotalVisits.HasValue);
        RuleFor(x => x.MaxFreezeDays).InclusiveBetween(0, 365);
        RuleFor(x => x.GuestPasses).InclusiveBetween(0, 100);
        RuleFor(x => x.AccessFrom).Matches(@"^([01]\d|2[0-3]):[0-5]\d$").When(x => !string.IsNullOrWhiteSpace(x.AccessFrom)).WithMessage("Use HH:mm.");
        RuleFor(x => x.AccessUntil).Matches(@"^([01]\d|2[0-3]):[0-5]\d$").When(x => !string.IsNullOrWhiteSpace(x.AccessUntil)).WithMessage("Use HH:mm.");
    }
}

// ── Settings ───────────────────────────────────────────────────────────────

public sealed record SettingsDto(string MemberNumberPrefix, int GraceDays, bool AllowCheckInWithDues,
    bool RequireWaiver, int ExpiringWithinDays, int LateCancelHours, bool ChargeCreditForNoShow,
    int BookingWindowDays, bool ExpiryAlertsEnabled);

public sealed record GetSettingsQuery : IQuery<SettingsDto>;

public sealed record UpdateSettingsCommand(string MemberNumberPrefix, int GraceDays, bool AllowCheckInWithDues,
    bool RequireWaiver, int ExpiringWithinDays, int LateCancelHours, bool ChargeCreditForNoShow,
    int BookingWindowDays, bool ExpiryAlertsEnabled) : ICommand<SettingsDto>;

public sealed class UpdateSettingsValidator : AbstractValidator<UpdateSettingsCommand>
{
    public UpdateSettingsValidator()
    {
        RuleFor(x => x.MemberNumberPrefix).NotEmpty().MaximumLength(10).Matches("^[A-Za-z0-9-]+$").WithMessage("Letters, digits and dashes only.");
        RuleFor(x => x.GraceDays).InclusiveBetween(0, 60);
        RuleFor(x => x.ExpiringWithinDays).InclusiveBetween(1, 90);
        RuleFor(x => x.LateCancelHours).InclusiveBetween(0, 72);
        RuleFor(x => x.BookingWindowDays).InclusiveBetween(1, 90);
    }
}
