using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Transactions.Commands.RecallTransaction;

public sealed record RecallTransactionCommand(Guid HeldTransactionId) : ICommand<HeldTransactionDto>;

public sealed class RecallTransactionCommandValidator : AbstractValidator<RecallTransactionCommand>
{
    public RecallTransactionCommandValidator()
    {
        RuleFor(x => x.HeldTransactionId).NotEmpty();
    }
}
