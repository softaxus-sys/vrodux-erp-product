using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Sessions.Commands.CloseSession;

public sealed record CloseSessionCommand(
    Guid    SessionId,
    decimal ClosingCash,
    string? Notes) : ICommand<POSSessionDto>;

public sealed class CloseSessionCommandValidator : AbstractValidator<CloseSessionCommand>
{
    public CloseSessionCommandValidator()
    {
        RuleFor(x => x.SessionId).NotEmpty();
        RuleFor(x => x.ClosingCash).GreaterThanOrEqualTo(0);
    }
}
