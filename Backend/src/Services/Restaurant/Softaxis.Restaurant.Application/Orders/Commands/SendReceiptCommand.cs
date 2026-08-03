using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Restaurant.Application.Orders.Commands;

/// <summary>POST /api/restaurant/orders/{id}/send-receipt</summary>
public sealed record SendReceiptCommand(Guid OrderId, string Channel, string RecipientAddress) : ICommand<SendReceiptResultDto>;

public sealed record SendReceiptResultDto(bool Success, string Channel, string RecipientAddress);

public sealed class SendReceiptValidator : AbstractValidator<SendReceiptCommand>
{
    public SendReceiptValidator()
    {
        RuleFor(x => x.Channel).Must(c => c is "email" or "sms" or "whatsapp").WithMessage("Channel must be 'email', 'sms', or 'whatsapp'.");
        RuleFor(x => x.RecipientAddress).NotEmpty();
    }
}
