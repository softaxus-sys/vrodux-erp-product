using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.ProjectManagement.Application.Sprints.Dtos;

namespace Softaxis.ProjectManagement.Application.Sprints.Commands;

public sealed record CreateSprintCommand(Guid ProjectId, string Name, string? Goal = null, string? StartDate = null, string? EndDate = null) : ICommand<SprintDto>;

public sealed class CreateSprintValidator : AbstractValidator<CreateSprintCommand>
{
    public CreateSprintValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Goal).MaximumLength(2000);
    }
}

public sealed record UpdateSprintCommand(Guid Id, string Name, string? Goal = null, string? StartDate = null, string? EndDate = null) : ICommand<SprintDto>;

public sealed class UpdateSprintValidator : AbstractValidator<UpdateSprintCommand>
{
    public UpdateSprintValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Goal).MaximumLength(2000);
    }
}

public sealed record StartSprintCommand(Guid Id) : ICommand<SprintDto>;

public sealed record CompleteSprintCommand(Guid Id) : ICommand<SprintDto>;

public sealed record DeleteSprintCommand(Guid Id) : ICommand;
