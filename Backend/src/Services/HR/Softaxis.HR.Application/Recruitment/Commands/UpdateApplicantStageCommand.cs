using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.HR.Application.Recruitment.Commands;

public sealed record UpdateApplicantStageCommand(Guid Id, string Stage) : ICommand;

public sealed class UpdateApplicantStageValidator : AbstractValidator<UpdateApplicantStageCommand>
{
    private static readonly string[] ValidStages = ["applied", "screening", "interview", "offer", "hired", "rejected"];

    public UpdateApplicantStageValidator()
    {
        RuleFor(x => x.Stage)
            .Must(s => ValidStages.Contains(s))
            .WithMessage("Invalid stage.");
    }
}
