using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Fitness.Domain.Entities;

namespace Softaxis.Fitness.Application.Members;

public sealed record MemberSummaryDto(Guid Id, string MemberNumber, string FullName, string? Phone, string? Email,
    string? Gender, Guid HomeBranchId, string? HomeBranchName, string Status, string? PlanName, string? EndDate,
    string MembershipState, int? DaysLeft, decimal Balance, string JoinedOn, bool HasPhoto);

public sealed record SubscriptionDto(Guid Id, Guid MemberId, Guid PlanId, string PlanName, string Category,
    Guid? BranchId, string StartDate, string EndDate, int DurationDays, decimal Price, decimal Discount,
    decimal JoiningFee, decimal Total, decimal AmountPaid, decimal Balance, int? ClassCredits, int? ClassCreditsLeft,
    int PtSessionsLeft, int? VisitsPerDay, int? TotalVisits, int VisitsUsed, bool AllowFreeze, int MaxFreezeDays,
    int FreezeDaysUsed, int GuestPassesLeft, bool AllBranches, string? AccessFrom, string? AccessUntil,
    string Status, string State, string? FrozenFrom, string? CancelledOn, string? CancelReason, Guid? RenewedFromId,
    string? SoldByName, string? Notes, DateTime CreatedAt);

public sealed record FreezeDto(Guid Id, Guid SubscriptionId, string FromDate, string? ToDate, int Days, string? Reason);

public sealed record MemberDetailDto(Guid Id, string MemberNumber, string FirstName, string LastName, string FullName,
    string? Gender, string? DateOfBirth, string? Phone, string? Email, string? Address, string? NationalId,
    string? EmergencyName, string? EmergencyPhone, string? HealthNotes, string? FitnessGoal, string? Source,
    string? ReferredBy, string? Notes, string? PhotoData, Guid HomeBranchId, string? HomeBranchName, Guid? TrainerId,
    string? TrainerName, string JoinedOn, string? WaiverSignedOn, string Status, string? StatusReason,
    decimal Balance, int Visits30Days, string? LastVisit, IReadOnlyList<SubscriptionDto> Subscriptions,
    IReadOnlyList<FreezeDto> Freezes, string? LockerNumber, bool HasPortalAccess = false);

public sealed record MemberPageDto(IReadOnlyList<MemberSummaryDto> Items, int Total, int Page, int PageSize);

/// <summary>State: active | expiring | expired | frozen | none | owing.</summary>
public sealed record GetMembersQuery(string? Search, string? State, Guid? BranchId, Guid? PlanId, string? Today,
    int Page = 1, int PageSize = 50) : IQuery<MemberPageDto>;

public sealed record GetMemberQuery(Guid Id, string? Today) : IQuery<MemberDetailDto>;

public sealed record MemberInput(string FirstName, string? LastName, string? Gender, string? DateOfBirth,
    string? Phone, string? Email, string? Address, string? NationalId, string? EmergencyName, string? EmergencyPhone,
    string? HealthNotes, string? FitnessGoal, string? Source, string? ReferredBy, string? Notes, Guid? HomeBranchId,
    Guid? TrainerId, string? WaiverSignedOn, string? JoinedOn, string? PhotoData);

public sealed record CreateMemberCommand(MemberInput Member, Guid? LeadId, string? Today) : ICommand<MemberDetailDto>;
public sealed record UpdateMemberCommand(Guid Id, MemberInput Member, string? Today) : ICommand<MemberDetailDto>;
public sealed record SetMemberStatusCommand(Guid Id, string Status, string? Reason) : ICommand;
public sealed record DeleteMemberCommand(Guid Id) : ICommand;

public sealed class MemberInputValidator : AbstractValidator<MemberInput>
{
    public MemberInputValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().WithMessage("First name is required.").MaximumLength(100);
        RuleFor(x => x.LastName).MaximumLength(100);
        RuleFor(x => x.Email).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email));
        RuleFor(x => x.Phone).MaximumLength(30);
        RuleFor(x => x.PhotoData).Must(p => p!.StartsWith("data:image/") && p.Length <= 2_800_000)
            .When(x => !string.IsNullOrEmpty(x.PhotoData)).WithMessage("Photo must be an image under 2 MB.");
        RuleFor(x => x.DateOfBirth).Must(Dates.Valid).When(x => !string.IsNullOrWhiteSpace(x.DateOfBirth)).WithMessage("Use yyyy-MM-dd.");
        RuleFor(x => x.WaiverSignedOn).Must(Dates.Valid).When(x => !string.IsNullOrWhiteSpace(x.WaiverSignedOn)).WithMessage("Use yyyy-MM-dd.");
        RuleFor(x => x.JoinedOn).Must(Dates.Valid).When(x => !string.IsNullOrWhiteSpace(x.JoinedOn)).WithMessage("Use yyyy-MM-dd.");
    }
}

public sealed class CreateMemberValidator : AbstractValidator<CreateMemberCommand>
{ public CreateMemberValidator() => RuleFor(x => x.Member).SetValidator(new MemberInputValidator()); }

public sealed class UpdateMemberValidator : AbstractValidator<UpdateMemberCommand>
{ public UpdateMemberValidator() => RuleFor(x => x.Member).SetValidator(new MemberInputValidator()); }

public sealed class SetMemberStatusValidator : AbstractValidator<SetMemberStatusCommand>
{
    public SetMemberStatusValidator() =>
        RuleFor(x => x.Status).Must(s => s is MemberStatus.Active or MemberStatus.Inactive or MemberStatus.Blacklisted)
            .WithMessage("Status is active, inactive or blacklisted.");
}

// ── Memberships ────────────────────────────────────────────────────────────

public sealed record SellMembershipCommand(Guid MemberId, Guid PlanId, string? StartDate, decimal? Price,
    decimal Discount, bool ChargeJoiningFee, decimal AmountPaid, string? PaymentMethod, string? PaymentReference,
    Guid? BranchId, string? Notes, Guid? RenewFromId, string? Today) : ICommand<SubscriptionDto>;

public sealed record FreezeMembershipCommand(Guid SubscriptionId, string? FromDate, string? Reason, string? Today) : ICommand<SubscriptionDto>;
public sealed record UnfreezeMembershipCommand(Guid SubscriptionId, string? Today) : ICommand<SubscriptionDto>;
public sealed record CancelMembershipCommand(Guid SubscriptionId, string? Reason, string? Today) : ICommand<SubscriptionDto>;
public sealed record AdjustMembershipCommand(Guid SubscriptionId, decimal Discount, string? EndDate) : ICommand<SubscriptionDto>;

public sealed class SellMembershipValidator : AbstractValidator<SellMembershipCommand>
{
    public SellMembershipValidator()
    {
        RuleFor(x => x.Discount).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Price).GreaterThanOrEqualTo(0).When(x => x.Price.HasValue);
        RuleFor(x => x.AmountPaid).GreaterThanOrEqualTo(0);
        RuleFor(x => x.PaymentMethod).Must(m => PaymentMethods.All.Contains(m))
            .When(x => x.AmountPaid > 0).WithMessage("Choose how the member paid.");
        RuleFor(x => x.StartDate).Must(Dates.Valid).When(x => !string.IsNullOrWhiteSpace(x.StartDate)).WithMessage("Use yyyy-MM-dd.");
    }
}

public sealed class AdjustMembershipValidator : AbstractValidator<AdjustMembershipCommand>
{
    public AdjustMembershipValidator()
    {
        RuleFor(x => x.Discount).GreaterThanOrEqualTo(0);
        RuleFor(x => x.EndDate).Must(Dates.Valid).When(x => !string.IsNullOrWhiteSpace(x.EndDate)).WithMessage("Use yyyy-MM-dd.");
    }
}

// ── Payments ───────────────────────────────────────────────────────────────

public sealed record PaymentDto(Guid Id, string ReceiptNumber, Guid MemberId, string? MemberName, string? MemberNumber,
    Guid? SubscriptionId, Guid? PtPackageId, Guid? BranchId, decimal Amount, string Method,
    string PaidOn, string? Reference, string? Notes, string? ReceivedByName, bool IsVoided, string? VoidReason,
    string? VoidedByName, DateTime CreatedAt);

public sealed record PaymentPageDto(IReadOnlyList<PaymentDto> Items, int Total, decimal TotalAmount);

public sealed record GetPaymentsQuery(Guid? MemberId, string? From, string? To, string? Method, Guid? BranchId,
    bool IncludeVoided = false, int Page = 1, int PageSize = 100) : IQuery<PaymentPageDto>;

public sealed record RecordPaymentCommand(Guid MemberId, Guid? SubscriptionId, Guid? PtPackageId, decimal Amount,
    string Method, string? PaidOn, string? Reference, string? Notes, Guid? BranchId, string? Today) : ICommand<PaymentDto>;

public sealed record VoidPaymentCommand(Guid Id, string Reason) : ICommand<PaymentDto>;

public sealed class RecordPaymentValidator : AbstractValidator<RecordPaymentCommand>
{
    public RecordPaymentValidator()
    {
        RuleFor(x => x.Amount).GreaterThan(0).WithMessage("Amount must be more than zero.");
        RuleFor(x => x.Method).Must(m => PaymentMethods.All.Contains(m)).WithMessage("Unknown payment method.");
        RuleFor(x => x).Must(x => x.SubscriptionId.HasValue ^ x.PtPackageId.HasValue)
            .WithMessage("A payment is for one membership or one training package.");
    }
}

public sealed class VoidPaymentValidator : AbstractValidator<VoidPaymentCommand>
{ public VoidPaymentValidator() => RuleFor(x => x.Reason).NotEmpty().WithMessage("Give a reason for voiding.").MaximumLength(300); }

// ── Progress ───────────────────────────────────────────────────────────────

public sealed record MeasurementDto(Guid Id, Guid MemberId, string MeasuredOn, decimal? WeightKg, decimal? HeightCm,
    decimal? BodyFatPct, decimal? MuscleMassKg, decimal? ChestCm, decimal? WaistCm, decimal? HipsCm, decimal? ArmCm,
    decimal? ThighCm, int? RestingHeartRate, string? BloodPressure, string? Notes, decimal? Bmi, Guid? TrainerId);

public sealed record GetMeasurementsQuery(Guid MemberId) : IQuery<IReadOnlyList<MeasurementDto>>;

public sealed record SaveMeasurementCommand(Guid? Id, Guid MemberId, string MeasuredOn, decimal? WeightKg,
    decimal? HeightCm, decimal? BodyFatPct, decimal? MuscleMassKg, decimal? ChestCm, decimal? WaistCm, decimal? HipsCm,
    decimal? ArmCm, decimal? ThighCm, int? RestingHeartRate, string? BloodPressure, string? Notes, Guid? TrainerId) : ICommand<MeasurementDto>;

public sealed record DeleteMeasurementCommand(Guid Id) : ICommand;

public sealed class SaveMeasurementValidator : AbstractValidator<SaveMeasurementCommand>
{
    public SaveMeasurementValidator()
    {
        RuleFor(x => x.MeasuredOn).Must(Dates.Valid).WithMessage("Use yyyy-MM-dd.");
        RuleFor(x => x.WeightKg).InclusiveBetween(1, 500).When(x => x.WeightKg.HasValue);
        RuleFor(x => x.HeightCm).InclusiveBetween(30, 280).When(x => x.HeightCm.HasValue);
        RuleFor(x => x.BodyFatPct).InclusiveBetween(1, 80).When(x => x.BodyFatPct.HasValue);
    }
}

public sealed record ProgramDto(Guid Id, string Type, string Name, string? Goal, string? Level, int? Weeks,
    string? Description, string ItemsJson, Guid? MemberId, string? MemberName, Guid? TrainerId, string? TrainerName,
    Guid? TemplateId, string? StartDate, bool IsActive, DateTime CreatedAt);

public sealed record GetProgramsQuery(string? Type, Guid? MemberId, bool TemplatesOnly) : IQuery<IReadOnlyList<ProgramDto>>;

public sealed record SaveProgramCommand(Guid? Id, string Type, string Name, string? Goal, string? Level, int? Weeks,
    string? Description, string? ItemsJson, Guid? MemberId, Guid? TrainerId, string? StartDate, bool IsActive = true) : ICommand<ProgramDto>;

public sealed record AssignProgramCommand(Guid TemplateId, Guid MemberId, Guid? TrainerId, string? StartDate) : ICommand<ProgramDto>;
public sealed record DeleteProgramCommand(Guid Id) : ICommand;

public sealed class SaveProgramValidator : AbstractValidator<SaveProgramCommand>
{
    public SaveProgramValidator()
    {
        RuleFor(x => x.Type).Must(t => t is ProgramType.Workout or ProgramType.Diet).WithMessage("Type is workout or diet.");
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.ItemsJson).MaximumLength(200_000);
        RuleFor(x => x.Weeks).InclusiveBetween(1, 104).When(x => x.Weeks.HasValue);
    }
}

public static class Dates
{
    public static bool Valid(string? s) =>
        DateOnly.TryParseExact(s, "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.None, out _);
}
