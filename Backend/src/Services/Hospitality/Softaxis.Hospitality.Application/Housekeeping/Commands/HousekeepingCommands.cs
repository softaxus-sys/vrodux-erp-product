using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Hospitality.Application.Housekeeping.Dtos;

namespace Softaxis.Hospitality.Application.Housekeeping.Commands;

public sealed record CreateHousekeepingTaskCommand(
    Guid RoomId, string RoomNumber, string TaskType, string Priority,
    string? AssignedTo, string? Notes) : ICommand<HousekeepingTaskStatusDto>;

public sealed class CreateHousekeepingTaskValidator : AbstractValidator<CreateHousekeepingTaskCommand>
{
    public CreateHousekeepingTaskValidator()
    {
        RuleFor(x => x.RoomNumber).NotEmpty();
        RuleFor(x => x.TaskType).NotEmpty();
        RuleFor(x => x.Priority).NotEmpty();
    }
}

public sealed record StartHousekeepingTaskCommand(Guid Id) : ICommand<HousekeepingTaskStatusDto>;

public sealed record CompleteHousekeepingTaskCommand(Guid Id) : ICommand<HousekeepingTaskStatusDto>;

public sealed record VerifyHousekeepingTaskCommand(Guid Id) : ICommand<HousekeepingTaskStatusDto>;
