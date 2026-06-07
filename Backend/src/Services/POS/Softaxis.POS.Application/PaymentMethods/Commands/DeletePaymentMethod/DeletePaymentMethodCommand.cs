using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.POS.Application.PaymentMethods.Commands.DeletePaymentMethod;

/// <summary>Soft-deletes a custom payment method. System methods cannot be deleted.</summary>
public sealed record DeletePaymentMethodCommand(Guid Id) : ICommand;
