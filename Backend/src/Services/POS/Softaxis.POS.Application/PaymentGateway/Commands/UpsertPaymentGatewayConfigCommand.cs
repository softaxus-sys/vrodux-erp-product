using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.PaymentGateway.Dtos;

namespace Softaxis.POS.Application.PaymentGateway.Commands;

/// <summary>ApiKey/SecretKey are plaintext in (encrypted before storage) — null means "leave the
/// currently-stored value unchanged" (never round-trips the actual secret to the frontend, so a
/// blank field must not be interpreted as "clear it"). Pass an empty string to explicitly clear one.</summary>
public sealed record UpsertPaymentGatewayConfigCommand(
    string Provider, string? ApiKey, string? SecretKey, string? PublicKey, string Mode, bool IsEnabled)
    : ICommand<PaymentGatewayConfigDto>;

public sealed class UpsertPaymentGatewayConfigValidator : AbstractValidator<UpsertPaymentGatewayConfigCommand>
{
    public UpsertPaymentGatewayConfigValidator()
    {
        RuleFor(x => x.Provider).NotEmpty()
            .Must(p => PaymentGatewayCatalog.All.Any(c => c.Key == p))
            .WithMessage("Unknown payment gateway provider.");
        RuleFor(x => x.Mode).Must(m => m is "test" or "live").WithMessage("Mode must be test or live.");
    }
}
