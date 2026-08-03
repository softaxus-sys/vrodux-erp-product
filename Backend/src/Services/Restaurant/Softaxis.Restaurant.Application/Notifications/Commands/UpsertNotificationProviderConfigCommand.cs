using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Notifications.Dtos;

namespace Softaxis.Restaurant.Application.Notifications.Commands;

/// <summary>AccountSid/AuthToken are plaintext in (encrypted before storage) — null means "leave the
/// currently-stored value unchanged" (never round-trips the actual secret to the frontend).</summary>
public sealed record UpsertNotificationProviderConfigCommand(
    string Channel, string Provider, string? AccountSid, string? AuthToken, string? FromNumber, bool IsEnabled)
    : ICommand<NotificationProviderConfigDto>;

public sealed class UpsertNotificationProviderConfigValidator : AbstractValidator<UpsertNotificationProviderConfigCommand>
{
    public UpsertNotificationProviderConfigValidator()
    {
        RuleFor(x => x.Channel).Must(c => c is "sms" or "whatsapp").WithMessage("Channel must be 'sms' or 'whatsapp'.");
        RuleFor(x => x.Provider).NotEmpty();
    }
}
