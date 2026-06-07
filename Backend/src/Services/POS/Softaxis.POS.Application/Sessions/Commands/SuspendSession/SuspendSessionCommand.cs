using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.POS.Application.Sessions.Commands.SuspendSession;

public sealed record SuspendSessionCommand(Guid SessionId, string? Notes) : ICommand;

public sealed class SuspendSessionCommandValidator : AbstractValidator<SuspendSessionCommand>
{
    public SuspendSessionCommandValidator()
    {
        RuleFor(x => x.SessionId).NotEmpty();
    }
}
