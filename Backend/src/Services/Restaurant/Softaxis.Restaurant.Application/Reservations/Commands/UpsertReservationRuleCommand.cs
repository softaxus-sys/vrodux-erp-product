using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Reservations.Dtos;

namespace Softaxis.Restaurant.Application.Reservations.Commands;

/// <summary>PUT /api/restaurant/reservations/rules — creates or updates the (one per branch) reservation policy.</summary>
public sealed record UpsertReservationRuleCommand(
    Guid? BranchId,
    int SlotDurationMinutes,
    int MaxCoversPerSlot,
    int MaxAdvanceDays,
    int MinNoticeMinutes,
    int AutoNoShowMinutes,
    bool DepositRequired,
    decimal DepositAmount
) : ICommand<ReservationRuleDto>;

public sealed class UpsertReservationRuleValidator : AbstractValidator<UpsertReservationRuleCommand>
{
    public UpsertReservationRuleValidator()
    {
        RuleFor(x => x.SlotDurationMinutes).GreaterThan(0);
        RuleFor(x => x.MaxCoversPerSlot).GreaterThan(0);
        RuleFor(x => x.MaxAdvanceDays).GreaterThanOrEqualTo(0);
        RuleFor(x => x.MinNoticeMinutes).GreaterThanOrEqualTo(0);
        RuleFor(x => x.AutoNoShowMinutes).GreaterThanOrEqualTo(0);
        RuleFor(x => x.DepositAmount).GreaterThanOrEqualTo(0);
    }
}
