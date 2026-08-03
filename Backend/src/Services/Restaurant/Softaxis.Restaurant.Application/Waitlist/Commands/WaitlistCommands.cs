using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Waitlist.Dtos;

namespace Softaxis.Restaurant.Application.Waitlist.Commands;

/// <summary>POST /api/restaurant/waitlist</summary>
public sealed record CreateWaitlistEntryCommand(
    string GuestName,
    string GuestPhone,
    int PartySize,
    int QuotedWaitMinutes,
    string? Notes,
    Guid? BranchId = null
) : ICommand<WaitlistEntryDto>;

public sealed class CreateWaitlistEntryValidator : AbstractValidator<CreateWaitlistEntryCommand>
{
    public CreateWaitlistEntryValidator()
    {
        RuleFor(x => x.GuestName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.GuestPhone).NotEmpty().MaximumLength(50);
        RuleFor(x => x.PartySize).GreaterThan(0);
        RuleFor(x => x.QuotedWaitMinutes).GreaterThanOrEqualTo(0);
    }
}

/// <summary>PATCH /api/restaurant/waitlist/{id}/seat — seats the party at the given table.</summary>
public sealed record SeatWaitlistEntryCommand(Guid Id, Guid TableId) : ICommand<WaitlistEntryDto>;

/// <summary>PATCH /api/restaurant/waitlist/{id}/cancel</summary>
public sealed record CancelWaitlistEntryCommand(Guid Id) : ICommand<WaitlistEntryDto>;

/// <summary>PATCH /api/restaurant/waitlist/{id}/no-show</summary>
public sealed record MarkWaitlistNoShowCommand(Guid Id) : ICommand<WaitlistEntryDto>;
