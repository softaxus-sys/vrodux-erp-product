using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.Messaging.Application.WhatsApp;

// ── DTOs ─────────────────────────────────────────────────────────────────────

public sealed record WaConnectionDto(
    bool Connected, string? Status, string? PhoneNumberId, string? WabaId, string? DisplayPhone,
    string? VerifiedName, string? LastError, DateTime? ConnectedAt,
    string WebhookUrl, bool WebhookConfigured,
    WaAutoReplyDto AutoReplies,
    // Incoming-message setup for THIS workspace. A workspace on its own Meta app pastes VerifyToken
    // into that app and saves the app's secret here; IncomingReady says whether deliveries will verify.
    string? VerifyToken = null, bool AppSecretSet = false, bool SharedAppAvailable = false, bool IncomingReady = false);

public sealed record WaAutoReplyDto(
    bool WelcomeEnabled, string? WelcomeMessage, bool AwayEnabled, string? AwayMessage,
    string TimeZoneId, string OpensAt, string ClosesAt, IReadOnlyList<int> WorkDays, bool CreateLeads,
    string DefaultCountryCode);

public sealed record WaTemplateDto(
    Guid Id, string Name, string Language, string Category, string Status, string? HeaderText,
    string BodyText, string? FooterText, int VariableCount, string? RejectedReason, DateTime SyncedAt);

public sealed record WaConversationDto(
    Guid Id, string ContactPhone, string? ContactName, string? RelatedType, Guid? RelatedId, string? RelatedName,
    DateTime LastMessageAt, string? LastMessagePreview, int UnreadCount, bool OptedOut, bool WindowOpen,
    DateTime? WindowClosesAt);

public sealed record WaMessageDto(
    Guid Id, Guid ConversationId, string Direction, string Type, string Body, string? TemplateName,
    string Status, string? Error, string Origin, string? SentByName, DateTime CreatedAt, DateTime? StatusAt);

public sealed record WaKeywordRuleDto(Guid Id, string Keyword, string MatchType, string Reply, bool IsActive);

public sealed record WaAutomationDto(
    string EventKey, string Label, string Description, bool Enabled, string? TemplateName, string? Language,
    IReadOnlyList<string> VariableFields, IReadOnlyList<string> AvailableFields);

public sealed record WaSendResultDto(Guid MessageId, Guid ConversationId, string Status, string? Error);

/// <summary>A record's WhatsApp history, for the timeline in a lead / prospect drawer.</summary>
public sealed record WaRecordThreadDto(WaConversationDto? Conversation, IReadOnlyList<WaMessageDto> Messages);

// ── The one way anything sends a WhatsApp message ────────────────────────────

/// <summary>
/// Sends through the current workspace's own connection, logs the message, and enforces the rules
/// (opt-out, Meta's 24-hour window for free text). Used by the API, automations and auto-replies.
/// </summary>
public interface IWhatsAppSender
{
    Task<Result<WaSendResultDto>> SendAsync(WaSendRequest request, CancellationToken ct);
}

public sealed record WaSendRequest(
    string To, string? Text, string? TemplateName, string? Language, IReadOnlyList<string>? Variables,
    string Origin, string? RelatedType = null, Guid? RelatedId = null, string? RelatedName = null,
    string? ContactName = null, Guid? UserId = null, string? UserName = null);

// ── Connection ───────────────────────────────────────────────────────────────

public sealed record GetWaConnectionQuery : IQuery<WaConnectionDto>;

/// <summary>Connects by Phone Number ID + WABA ID + a permanent access token from Meta.</summary>
public sealed record ConnectWaCommand(string PhoneNumberId, string WabaId, string AccessToken, string? AppSecret = null) : ICommand<WaConnectionDto>;

/// <summary>Saves this workspace's own Meta app secret. Blank removes it (falls back to the shared Vrodux app).</summary>
public sealed record SetWaAppSecretCommand(string? AppSecret) : ICommand<WaConnectionDto>;

public sealed record DisconnectWaCommand : ICommand;

public sealed record UpdateWaAutoRepliesCommand(
    bool WelcomeEnabled, string? WelcomeMessage, bool AwayEnabled, string? AwayMessage,
    string TimeZoneId, string OpensAt, string ClosesAt, IReadOnlyList<int> WorkDays, bool CreateLeads,
    string DefaultCountryCode) : ICommand<WaConnectionDto>;

public sealed class ConnectWaValidator : AbstractValidator<ConnectWaCommand>
{
    public ConnectWaValidator()
    {
        RuleFor(x => x.PhoneNumberId).NotEmpty().WithMessage("Phone Number ID is required.").Matches("^[0-9]{5,30}$")
            .WithMessage("Phone Number ID is the long number Meta shows under the phone number, digits only.");
        RuleFor(x => x.WabaId).NotEmpty().WithMessage("WhatsApp Business Account ID is required.").Matches("^[0-9]{5,30}$")
            .WithMessage("WhatsApp Business Account ID is digits only.");
        RuleFor(x => x.AccessToken).NotEmpty().WithMessage("Access token is required.").MaximumLength(2000);
        RuleFor(x => x.AppSecret).Matches("^[A-Fa-f0-9]{32}$").When(x => !string.IsNullOrWhiteSpace(x.AppSecret))
            .WithMessage("The app secret is the 32-character code under App settings → Basic in your Meta app.");
    }
}

public sealed class SetWaAppSecretValidator : AbstractValidator<SetWaAppSecretCommand>
{
    public SetWaAppSecretValidator()
    {
        RuleFor(x => x.AppSecret).Matches("^[A-Fa-f0-9]{32}$").When(x => !string.IsNullOrWhiteSpace(x.AppSecret))
            .WithMessage("The app secret is the 32-character code under App settings → Basic in your Meta app.");
    }
}

public sealed class UpdateWaAutoRepliesValidator : AbstractValidator<UpdateWaAutoRepliesCommand>
{
    public UpdateWaAutoRepliesValidator()
    {
        RuleFor(x => x.WelcomeMessage).NotEmpty().When(x => x.WelcomeEnabled).WithMessage("Write the welcome message.").MaximumLength(1000);
        RuleFor(x => x.AwayMessage).NotEmpty().When(x => x.AwayEnabled).WithMessage("Write the away message.").MaximumLength(1000);
        RuleFor(x => x.OpensAt).Matches("^([01][0-9]|2[0-3]):[0-5][0-9]$").WithMessage("Opening time must be HH:mm.");
        RuleFor(x => x.ClosesAt).Matches("^([01][0-9]|2[0-3]):[0-5][0-9]$").WithMessage("Closing time must be HH:mm.");
        RuleFor(x => x.TimeZoneId).NotEmpty().MaximumLength(100);
        RuleForEach(x => x.WorkDays).InclusiveBetween(0, 6);
        RuleFor(x => x.DefaultCountryCode).Matches("^[0-9]{1,4}$").WithMessage("Country code is 1–4 digits, e.g. 971.");
    }
}

// ── Templates ────────────────────────────────────────────────────────────────

public sealed record GetWaTemplatesQuery(bool ApprovedOnly = false) : IQuery<IReadOnlyList<WaTemplateDto>>;
public sealed record SyncWaTemplatesCommand : ICommand<IReadOnlyList<WaTemplateDto>>;

public sealed record CreateWaTemplateCommand(
    string Name, string Language, string Category, string? HeaderText, string BodyText, string? FooterText,
    IReadOnlyList<string>? Examples) : ICommand<WaTemplateDto>;

public sealed class CreateWaTemplateValidator : AbstractValidator<CreateWaTemplateCommand>
{
    public CreateWaTemplateValidator()
    {
        RuleFor(x => x.Name).NotEmpty().Matches("^[a-z0-9_]{1,512}$")
            .WithMessage("Template name may only use lower-case letters, numbers and underscores.");
        RuleFor(x => x.Language).NotEmpty().MaximumLength(15);
        RuleFor(x => x.Category).Must(c => c is "MARKETING" or "UTILITY").WithMessage("Category must be Marketing or Utility.");
        RuleFor(x => x.HeaderText).MaximumLength(60);
        RuleFor(x => x.BodyText).NotEmpty().WithMessage("Write the message.").MaximumLength(1024);
        RuleFor(x => x.FooterText).MaximumLength(60);
    }
}

// ── Sending ──────────────────────────────────────────────────────────────────

public sealed record SendWaMessageCommand(
    string To, string? Text, string? TemplateName, string? Language, IReadOnlyList<string>? Variables,
    string? RelatedType, Guid? RelatedId, string? RelatedName, string? ContactName) : ICommand<WaSendResultDto>;

public sealed class SendWaMessageValidator : AbstractValidator<SendWaMessageCommand>
{
    public SendWaMessageValidator()
    {
        RuleFor(x => x.To).NotEmpty().WithMessage("Enter a phone number.");
        RuleFor(x => x).Must(x => !string.IsNullOrWhiteSpace(x.Text) || !string.IsNullOrWhiteSpace(x.TemplateName))
            .WithMessage("Choose a template or write a message.");
        RuleFor(x => x.Text).MaximumLength(4096);
        RuleFor(x => x.RelatedType).MaximumLength(40);
    }
}

// ── Inbox ────────────────────────────────────────────────────────────────────

public sealed record GetWaConversationsQuery(string? Search, bool UnreadOnly) : IQuery<IReadOnlyList<WaConversationDto>>;
public sealed record GetWaMessagesQuery(Guid ConversationId) : IQuery<IReadOnlyList<WaMessageDto>>;
public sealed record MarkWaConversationReadCommand(Guid ConversationId) : ICommand;
public sealed record GetWaRecordThreadQuery(string RelatedType, Guid RelatedId, string? Phone) : IQuery<WaRecordThreadDto>;

// ── Auto replies + automations ───────────────────────────────────────────────

public sealed record GetWaKeywordRulesQuery : IQuery<IReadOnlyList<WaKeywordRuleDto>>;
public sealed record SaveWaKeywordRuleCommand(Guid? Id, string Keyword, string MatchType, string Reply, bool IsActive) : ICommand<WaKeywordRuleDto>;
public sealed record DeleteWaKeywordRuleCommand(Guid Id) : ICommand;

public sealed class SaveWaKeywordRuleValidator : AbstractValidator<SaveWaKeywordRuleCommand>
{
    public SaveWaKeywordRuleValidator()
    {
        RuleFor(x => x.Keyword).NotEmpty().WithMessage("Enter a keyword.").MaximumLength(100);
        RuleFor(x => x.Reply).NotEmpty().WithMessage("Write the reply.").MaximumLength(1000);
    }
}

public sealed record GetWaAutomationsQuery : IQuery<IReadOnlyList<WaAutomationDto>>;
public sealed record SaveWaAutomationCommand(
    string EventKey, bool Enabled, string? TemplateName, string? Language, IReadOnlyList<string> VariableFields) : ICommand<WaAutomationDto>;

/// <summary>
/// Processes a webhook delivery from Meta. Runs with no signed-in user. Each change is checked
/// against the app secret of the workspace that owns its phone number (or the shared Vrodux secret),
/// and only changes whose signature matches are processed. Fails with *.Unauthorized when nothing verified.
/// </summary>
public sealed record ProcessWaWebhookCommand(byte[] RawBody, string? Signature) : ICommand;

/// <summary>Meta's GET handshake: true when the token belongs to a workspace or is the shared one.</summary>
public sealed record VerifyWaWebhookTokenQuery(string Token) : IQuery<bool>;
