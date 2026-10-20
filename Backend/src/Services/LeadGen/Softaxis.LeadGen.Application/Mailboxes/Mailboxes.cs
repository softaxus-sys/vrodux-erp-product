using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.LeadGen.Domain.Entities;

namespace Softaxis.LeadGen.Application.Mailboxes;

public sealed record MailboxDto(
    Guid Id, string Provider, string Address, string? DisplayName, string Status, string? StatusReason,
    int DailyLimit, int TodayLimit, int SentToday, int RemainingToday, int WarmupDay,
    int TotalSent, int TotalBounced, int TotalReplies, double BounceRatePercent,
    DateTime? LastSyncAt, DateTime? LastSentAt, string? LastError, string? SignatureText, Guid OwnerUserId,
    DateTime CreatedAt);

public sealed record MailboxProvidersDto(bool Google, bool Microsoft, bool Imap);

public sealed record GetMailboxesQuery : IQuery<IReadOnlyList<MailboxDto>>;
public sealed record GetMailboxProvidersQuery : IQuery<MailboxProvidersDto>;

public sealed record ConnectImapInput(
    string Address, string? DisplayName, string Username, string Password,
    string SmtpHost, int SmtpPort, string ImapHost, int ImapPort);

/// <summary>Connects any mailbox that speaks SMTP + IMAP. The login is tested for real before anything is saved.</summary>
public sealed record ConnectImapCommand(ConnectImapInput Input) : ICommand<MailboxDto>;

public sealed record OAuthUrlDto(string Url);
public sealed record StartMailboxOAuthCommand(string Provider, string CallbackUri, string ReturnPath) : ICommand<OAuthUrlDto>;
public sealed record MailboxOAuthCallbackCommand(string Code, string State, string CallbackUri) : ICommand<OAuthResultDto>;
public sealed record OAuthResultDto(bool Connected, string? Address, string ReturnPath, string? Error);

public sealed record UpdateMailboxCommand(Guid Id, int DailyLimit, string? SignatureText, string? DisplayName) : ICommand<MailboxDto>;
public sealed record PauseMailboxCommand(Guid Id) : ICommand;
public sealed record ResumeMailboxCommand(Guid Id) : ICommand;
public sealed record DisconnectMailboxCommand(Guid Id) : ICommand;
public sealed record SendTestEmailCommand(Guid Id, string To) : ICommand;
public sealed record SyncMailboxNowCommand(Guid Id) : ICommand<SyncResultDto>;
public sealed record SyncResultDto(int Received, int Replies, int Bounces);

public sealed class ConnectImapValidator : AbstractValidator<ConnectImapCommand>
{
    public ConnectImapValidator()
    {
        RuleFor(x => x.Input.Address).NotEmpty().EmailAddress().MaximumLength(320);
        RuleFor(x => x.Input.DisplayName).MaximumLength(120);
        RuleFor(x => x.Input.Username).NotEmpty().MaximumLength(320);
        RuleFor(x => x.Input.Password).NotEmpty().MaximumLength(500);
        RuleFor(x => x.Input.SmtpHost).NotEmpty().MaximumLength(255);
        RuleFor(x => x.Input.ImapHost).NotEmpty().MaximumLength(255);
        RuleFor(x => x.Input.SmtpPort).InclusiveBetween(1, 65535);
        RuleFor(x => x.Input.ImapPort).InclusiveBetween(1, 65535);
    }
}

public sealed class StartOAuthValidator : AbstractValidator<StartMailboxOAuthCommand>
{
    public StartOAuthValidator()
    {
        RuleFor(x => x.Provider).Must(p => p is MailboxProvider.Google or MailboxProvider.Microsoft)
            .WithMessage("Choose Google or Microsoft.");
        RuleFor(x => x.ReturnPath).Must(p => p.StartsWith('/') && !p.StartsWith("//")).WithMessage("Invalid return path.");
    }
}

public sealed class UpdateMailboxValidator : AbstractValidator<UpdateMailboxCommand>
{
    public UpdateMailboxValidator()
    {
        RuleFor(x => x.DailyLimit).InclusiveBetween(1, 500);
        RuleFor(x => x.SignatureText).MaximumLength(1000);
        RuleFor(x => x.DisplayName).MaximumLength(120);
    }
}

public sealed class SendTestValidator : AbstractValidator<SendTestEmailCommand>
{
    public SendTestValidator() => RuleFor(x => x.To).NotEmpty().EmailAddress();
}
