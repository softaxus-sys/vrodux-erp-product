using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.HR.Application.Recruitment.Commands;

public sealed record SetJobStatusCommand(Guid Id, string Status) : ICommand;

public sealed class SetJobStatusValidator : AbstractValidator<SetJobStatusCommand>
{
    private static readonly string[] ValidStatuses = ["draft", "open", "on_hold", "closed"];

    public SetJobStatusValidator()
    {
        RuleFor(x => x.Status)
            .Must(s => ValidStatuses.Contains(s))
            .WithMessage($"Status must be one of: {string.Join(", ", ValidStatuses)}.");
    }
}
