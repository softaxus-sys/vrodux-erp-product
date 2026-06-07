using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Transactions.Commands.RefundTransaction;

public sealed record RefundTransactionCommand(
    Guid                        OriginalTransactionId,
    Guid                        SessionId,
    IReadOnlyList<LineItemRequest> LineItems,   // partial refund: subset of original items
    IReadOnlyList<PaymentRequest>  Payments,
    string?                     Reason) : ICommand<POSTransactionDto>;

public sealed class RefundTransactionCommandValidator : AbstractValidator<RefundTransactionCommand>
{
    public RefundTransactionCommandValidator()
    {
        RuleFor(x => x.OriginalTransactionId).NotEmpty();
        RuleFor(x => x.SessionId).NotEmpty();
        RuleFor(x => x.LineItems).NotEmpty();
        RuleForEach(x => x.LineItems).ChildRules(item =>
        {
            item.RuleFor(i => i.ProductId).NotEmpty();
            item.RuleFor(i => i.Quantity).GreaterThan(0);
        });
        RuleFor(x => x.Payments).NotEmpty();
        RuleForEach(x => x.Payments).ChildRules(pay =>
        {
            pay.RuleFor(p => p.Method).NotEmpty();
            pay.RuleFor(p => p.Amount).GreaterThan(0);
        });
    }
}
