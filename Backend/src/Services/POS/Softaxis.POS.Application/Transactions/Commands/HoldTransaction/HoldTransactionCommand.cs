using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Transactions.Commands.HoldTransaction;

public sealed record HoldTransactionCommand(
    Guid    SessionId,
    string  Label,
    string  ItemsJson,
    Guid?   CustomerId) : ICommand<HeldTransactionDto>;

public sealed class HoldTransactionCommandValidator : AbstractValidator<HoldTransactionCommand>
{
    public HoldTransactionCommandValidator()
    {
        RuleFor(x => x.SessionId).NotEmpty();
        RuleFor(x => x.Label).NotEmpty().MaximumLength(100);
        RuleFor(x => x.ItemsJson).NotEmpty();
    }
}
