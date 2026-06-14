using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.ProjectManagement.Application.Labels.Dtos;

namespace Softaxis.ProjectManagement.Application.Labels.Commands;

public sealed record CreateLabelCommand(Guid ProjectId, string Name, string Color = "#64748b") : ICommand<LabelDto>;

public sealed class CreateLabelValidator : AbstractValidator<CreateLabelCommand>
{
    public CreateLabelValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Color).NotEmpty().MaximumLength(20);
    }
}

public sealed record UpdateLabelCommand(Guid Id, string Name, string Color) : ICommand<LabelDto>;

public sealed class UpdateLabelValidator : AbstractValidator<UpdateLabelCommand>
{
    public UpdateLabelValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Color).NotEmpty().MaximumLength(20);
    }
}

public sealed record DeleteLabelCommand(Guid Id) : ICommand;
