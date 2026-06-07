using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Transactions.Commands.VoidTransaction;

public sealed record VoidTransactionCommand(
    Guid    TransactionId,
    string? Reason) : ICommand<POSTransactionDto>;

public sealed class VoidTransactionCommandValidator : AbstractValidator<VoidTransactionCommand>
{
    public VoidTransactionCommandValidator()
    {
        RuleFor(x => x.TransactionId).NotEmpty();
        RuleFor(x => x.Reason).MaximumLength(500);
    }
}
