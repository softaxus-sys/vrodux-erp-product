using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Sessions.Commands.OpenSession;

public sealed record OpenSessionCommand(
    string  RegisterId,
    decimal OpeningCash) : ICommand<POSSessionDto>;

public sealed class OpenSessionCommandValidator : AbstractValidator<OpenSessionCommand>
{
    public OpenSessionCommandValidator()
    {
        RuleFor(x => x.RegisterId).NotEmpty().MaximumLength(50);
        RuleFor(x => x.OpeningCash).GreaterThanOrEqualTo(0);
    }
}
