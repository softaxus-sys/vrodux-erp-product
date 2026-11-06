using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Fitness.Application.Members;
using Softaxis.Fitness.Domain.Entities;

namespace Softaxis.Fitness.Application.Facility;

// ── Equipment ──────────────────────────────────────────────────────────────

public sealed record EquipmentDto(Guid Id, string Name, string? Category, string? Brand, string? Model,
    string? SerialNumber, Guid BranchId, string? BranchName, string? Location, string? PurchasedOn,
    decimal PurchaseCost, string? WarrantyUntil, int ServiceIntervalDays, string? LastServicedOn,
    string? NextServiceOn, string Status, string? Notes, bool ServiceDue, decimal MaintenanceCost);

public sealed record GetEquipmentQuery(Guid? BranchId, string? Status, bool ServiceDueOnly, string? Today) : IQuery<IReadOnlyList<EquipmentDto>>;

public sealed record SaveEquipmentCommand(Guid? Id, string Name, string? Category, string? Brand, string? Model,
    string? SerialNumber, Guid BranchId, string? Location, string? PurchasedOn, decimal PurchaseCost,
    string? WarrantyUntil, int ServiceIntervalDays, string? NextServiceOn, string Status, string? Notes) : ICommand<EquipmentDto>;

public sealed record DeleteEquipmentCommand(Guid Id) : ICommand;

public sealed record MaintenanceDto(Guid Id, Guid EquipmentId, string Date, string Type, string Description,
    decimal Cost, string? PerformedBy, string StatusAfter, string? RecordedByName, DateTime CreatedAt);

public sealed record GetMaintenanceQuery(Guid EquipmentId) : IQuery<IReadOnlyList<MaintenanceDto>>;

public sealed record RecordMaintenanceCommand(Guid EquipmentId, string Date, string Type, string Description,
    decimal Cost, string? PerformedBy, string StatusAfter) : ICommand<MaintenanceDto>;

public sealed class SaveEquipmentValidator : AbstractValidator<SaveEquipmentCommand>
{
    public SaveEquipmentValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Name is required.").MaximumLength(150);
        RuleFor(x => x.BranchId).NotEmpty().WithMessage("Choose the branch.");
        RuleFor(x => x.Status).Must(s => EquipmentStatus.All.Contains(s));
        RuleFor(x => x.PurchaseCost).GreaterThanOrEqualTo(0);
        RuleFor(x => x.ServiceIntervalDays).InclusiveBetween(0, 3650);
        RuleFor(x => x.PurchasedOn).Must(Dates.Valid).When(x => !string.IsNullOrWhiteSpace(x.PurchasedOn)).WithMessage("Use yyyy-MM-dd.");
        RuleFor(x => x.WarrantyUntil).Must(Dates.Valid).When(x => !string.IsNullOrWhiteSpace(x.WarrantyUntil)).WithMessage("Use yyyy-MM-dd.");
        RuleFor(x => x.NextServiceOn).Must(Dates.Valid).When(x => !string.IsNullOrWhiteSpace(x.NextServiceOn)).WithMessage("Use yyyy-MM-dd.");
    }
}

public sealed class RecordMaintenanceValidator : AbstractValidator<RecordMaintenanceCommand>
{
    public RecordMaintenanceValidator()
    {
        RuleFor(x => x.Date).Must(Dates.Valid).WithMessage("Use yyyy-MM-dd.");
        RuleFor(x => x.Type).Must(t => t is "service" or "repair" or "inspection" or "issue");
        RuleFor(x => x.Description).NotEmpty().MaximumLength(1000);
        RuleFor(x => x.Cost).GreaterThanOrEqualTo(0);
        RuleFor(x => x.StatusAfter).Must(s => EquipmentStatus.All.Contains(s));
    }
}

// ── Lockers ────────────────────────────────────────────────────────────────

public sealed record LockerDto(Guid Id, string Number, Guid BranchId, string? BranchName, string? Area, string? Size,
    decimal MonthlyRate, Guid? MemberId, string? MemberName, string? MemberNumber, string? AssignedFrom,
    string? AssignedUntil, bool OutOfUse, string? Notes, string State);

public sealed record GetLockersQuery(Guid? BranchId, string? State, string? Today) : IQuery<IReadOnlyList<LockerDto>>;

public sealed record SaveLockerCommand(Guid? Id, string Number, Guid BranchId, string? Area, string? Size,
    decimal MonthlyRate, bool OutOfUse, string? Notes) : ICommand<LockerDto>;

/// <summary>Add many lockers at once, numbered Prefix + From..To.</summary>
public sealed record AddLockersCommand(Guid BranchId, string? Prefix, int From, int To, string? Area, string? Size,
    decimal MonthlyRate) : ICommand<int>;

public sealed record AssignLockerCommand(Guid Id, Guid MemberId, string? From, string? Until, string? Today) : ICommand<LockerDto>;
public sealed record ReleaseLockerCommand(Guid Id) : ICommand<LockerDto>;
public sealed record DeleteLockerCommand(Guid Id) : ICommand;

public sealed class SaveLockerValidator : AbstractValidator<SaveLockerCommand>
{
    public SaveLockerValidator()
    {
        RuleFor(x => x.Number).NotEmpty().WithMessage("Locker number is required.").MaximumLength(20);
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.MonthlyRate).GreaterThanOrEqualTo(0);
    }
}

public sealed class AddLockersValidator : AbstractValidator<AddLockersCommand>
{
    public AddLockersValidator()
    {
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.From).GreaterThanOrEqualTo(0);
        RuleFor(x => x).Must(x => x.To >= x.From && x.To - x.From < 500).WithMessage("Add up to 500 lockers at a time.");
        RuleFor(x => x.Prefix).MaximumLength(10);
    }
}

// ── Leads ──────────────────────────────────────────────────────────────────

public sealed record LeadDto(Guid Id, string Name, string? Phone, string? Email, string? Gender, string? Source,
    string? Interest, Guid? BranchId, string? BranchName, Guid? AssignedToUserId, string? AssignedToName,
    string Status, string? TrialDate, string? FollowUpOn, string? LostReason, string? Notes, Guid? MemberId,
    bool FollowUpDue, DateTime CreatedAt);

public sealed record GetLeadsQuery(string? Status, string? Search, Guid? BranchId, bool FollowUpDueOnly, string? Today) : IQuery<IReadOnlyList<LeadDto>>;

public sealed record SaveLeadCommand(Guid? Id, string Name, string? Phone, string? Email, string? Gender,
    string? Source, string? Interest, Guid? BranchId, Guid? AssignedToUserId, string? AssignedToName, string Status,
    string? TrialDate, string? FollowUpOn, string? LostReason, string? Notes) : ICommand<LeadDto>;

public sealed record DeleteLeadCommand(Guid Id) : ICommand;

public sealed class SaveLeadValidator : AbstractValidator<SaveLeadCommand>
{
    public SaveLeadValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Name is required.").MaximumLength(150);
        RuleFor(x => x).Must(x => !string.IsNullOrWhiteSpace(x.Phone) || !string.IsNullOrWhiteSpace(x.Email))
            .WithMessage("Enter a phone number or an email address.");
        RuleFor(x => x.Email).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email));
        RuleFor(x => x.Status).Must(s => LeadStatus.All.Contains(s) && s != LeadStatus.Converted)
            .WithMessage("Convert a lead by creating the member.");
        RuleFor(x => x.TrialDate).Must(Dates.Valid).When(x => !string.IsNullOrWhiteSpace(x.TrialDate)).WithMessage("Use yyyy-MM-dd.");
        RuleFor(x => x.FollowUpOn).Must(Dates.Valid).When(x => !string.IsNullOrWhiteSpace(x.FollowUpOn)).WithMessage("Use yyyy-MM-dd.");
    }
}
