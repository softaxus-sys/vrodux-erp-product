using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Fitness.Application.Members;

namespace Softaxis.Fitness.Application.Training;

public sealed record TrainerDto(Guid Id, string Name, string? Phone, string? Email, string? Specialties,
    string? Certifications, string? Bio, Guid? BranchId, string? BranchName, Guid? LinkedUserId, decimal SessionRate,
    decimal CommissionPct, bool HasPhoto, bool IsActive, int Clients, int UpcomingSessions);

public sealed record GetTrainersQuery(bool ActiveOnly = false) : IQuery<IReadOnlyList<TrainerDto>>;
public sealed record GetTrainerPhotoQuery(Guid Id) : IQuery<string?>;

public sealed record SaveTrainerCommand(Guid? Id, string Name, string? Phone, string? Email, string? Specialties,
    string? Certifications, string? Bio, Guid? BranchId, Guid? LinkedUserId, decimal SessionRate, decimal CommissionPct,
    string? PhotoData, bool IsActive = true) : ICommand<TrainerDto>;

public sealed record DeleteTrainerCommand(Guid Id) : ICommand;

public sealed class SaveTrainerValidator : AbstractValidator<SaveTrainerCommand>
{
    public SaveTrainerValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Trainer name is required.").MaximumLength(150);
        RuleFor(x => x.Email).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email));
        RuleFor(x => x.SessionRate).GreaterThanOrEqualTo(0);
        RuleFor(x => x.CommissionPct).InclusiveBetween(0, 100);
        RuleFor(x => x.PhotoData).Must(p => p!.StartsWith("data:image/")).When(x => !string.IsNullOrEmpty(x.PhotoData))
            .WithMessage("Photo must be an image.").MaximumLength(2_800_000);
    }
}

public sealed record PtPackageDto(Guid Id, Guid MemberId, string? MemberName, string? MemberNumber, Guid TrainerId,
    string? TrainerName, string Name, int TotalSessions, int UsedSessions, int Remaining, decimal Price,
    decimal AmountPaid, decimal Balance, string StartDate, string? ExpiresOn, string? Notes, bool IsCancelled,
    string State, DateTime CreatedAt);

public sealed record GetPtPackagesQuery(Guid? MemberId, Guid? TrainerId, bool ActiveOnly, string? Today) : IQuery<IReadOnlyList<PtPackageDto>>;

public sealed record SellPtPackageCommand(Guid MemberId, Guid TrainerId, string? Name, int Sessions, decimal? Price,
    string? StartDate, string? ExpiresOn, decimal AmountPaid, string? PaymentMethod, string? PaymentReference,
    Guid? BranchId, string? Notes, string? Today) : ICommand<PtPackageDto>;

public sealed record CancelPtPackageCommand(Guid Id) : ICommand<PtPackageDto>;

public sealed class SellPtPackageValidator : AbstractValidator<SellPtPackageCommand>
{
    public SellPtPackageValidator()
    {
        RuleFor(x => x.Sessions).InclusiveBetween(1, 500);
        RuleFor(x => x.Price).GreaterThanOrEqualTo(0).When(x => x.Price.HasValue);
        RuleFor(x => x.AmountPaid).GreaterThanOrEqualTo(0);
        RuleFor(x => x.PaymentMethod).Must(m => Softaxis.Fitness.Domain.Entities.PaymentMethods.All.Contains(m))
            .When(x => x.AmountPaid > 0).WithMessage("Choose how the member paid.");
        RuleFor(x => x.ExpiresOn).Must(Dates.Valid).When(x => !string.IsNullOrWhiteSpace(x.ExpiresOn)).WithMessage("Use yyyy-MM-dd.");
    }
}

public sealed record PtSessionDto(Guid Id, Guid PackageId, string? PackageName, Guid MemberId, string? MemberName,
    Guid TrainerId, string? TrainerName, Guid? BranchId, string Date, string StartTime, int DurationMinutes,
    string Status, string? Notes, string? SessionLog, bool Counted);

public sealed record GetPtSessionsQuery(string? From, string? To, Guid? TrainerId, Guid? MemberId, Guid? PackageId) : IQuery<IReadOnlyList<PtSessionDto>>;

public sealed record BookPtSessionCommand(Guid PackageId, string Date, string StartTime, int DurationMinutes,
    Guid? BranchId, string? Notes) : ICommand<PtSessionDto>;

public sealed record ReschedulePtSessionCommand(Guid Id, string Date, string StartTime, int DurationMinutes, string? Notes) : ICommand<PtSessionDto>;

/// <summary>completed | no_show | cancelled | scheduled (reopen).</summary>
public sealed record ClosePtSessionCommand(Guid Id, string Status, string? SessionLog) : ICommand<PtSessionDto>;

public sealed class BookPtSessionValidator : AbstractValidator<BookPtSessionCommand>
{
    public BookPtSessionValidator()
    {
        RuleFor(x => x.Date).Must(Dates.Valid).WithMessage("Use yyyy-MM-dd.");
        RuleFor(x => x.StartTime).Matches("^([01]\\d|2[0-3]):[0-5]\\d$").WithMessage("Use HH:mm.");
        RuleFor(x => x.DurationMinutes).InclusiveBetween(15, 240);
    }
}

public sealed class ReschedulePtSessionValidator : AbstractValidator<ReschedulePtSessionCommand>
{
    public ReschedulePtSessionValidator()
    {
        RuleFor(x => x.Date).Must(Dates.Valid).WithMessage("Use yyyy-MM-dd.");
        RuleFor(x => x.StartTime).Matches("^([01]\\d|2[0-3]):[0-5]\\d$").WithMessage("Use HH:mm.");
        RuleFor(x => x.DurationMinutes).InclusiveBetween(15, 240);
    }
}
