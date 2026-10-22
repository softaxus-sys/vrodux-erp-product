using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.CRM.Application.Integrations.MetaConversions;

// ── DTOs ─────────────────────────────────────────────────────────────────────

/// <param name="HasToken">Whether an access token is stored. The token itself is never returned.</param>
/// <param name="LeadEvents">Lead status → event name in force (defaults filled in). Blank = nothing is sent for it.</param>
public sealed record MetaConversionsDto(
    Guid IntegrationId,
    bool Enabled,
    string? DatasetId,
    bool HasToken,
    string? DatasetName,
    DateTime? LastVerifiedAt,
    bool SendDealValue,
    string? DefaultCallingCode,
    IReadOnlyDictionary<string, string> LeadEvents,
    IReadOnlyDictionary<string, string> DealEvents,
    IReadOnlyDictionary<string, string> DefaultLeadEvents,
    IReadOnlyDictionary<string, string> DefaultDealEvents,
    DateTime? EnabledAt,
    DateTime? LastSentAt,
    DateTime? LastFailureAt,
    string? LastError,
    MetaConversionStatsDto Stats,
    /// <summary>Leads in this integration that came from a Meta ad and so can be reported on.</summary>
    int MetaLeads,
    string LeadEventSource);

public sealed record MetaConversionStatsDto(int Pending, int Sent, int Failed, int Skipped, int SentLast7Days);

public sealed record MetaConversionEventDto(
    Guid Id, Guid LeadId, string LeadName, Guid? DealId, string EventName, DateTime EventTime,
    decimal? Value, string? Currency, string Status, int Attempts, DateTime? NextAttemptAt,
    DateTime? SentAt, string? LastError);

public sealed record MetaVerifyResultDto(bool Ok, string? DatasetName, string Message);
public sealed record MetaTestResultDto(bool Ok, string Message);
public sealed record MetaCatchUpResultDto(int LeadsQueued, int EventsQueued, int AlreadyTracked, int OutsideWindow);

// ── Queries ──────────────────────────────────────────────────────────────────

public sealed record GetMetaConversionsQuery(Guid IntegrationId) : IQuery<MetaConversionsDto>;

public sealed record GetMetaConversionEventsQuery(Guid IntegrationId, string? Status, int Take = 50)
    : IQuery<IReadOnlyList<MetaConversionEventDto>>;

// ── Commands ─────────────────────────────────────────────────────────────────

/// <summary>
/// Saves the link to a Meta dataset. A blank <paramref name="AccessToken"/> keeps the stored one, so the screen
/// never has to hold (or be sent) a secret just to change a mapping. Null mappings = use the defaults.
/// </summary>
public sealed record SaveMetaConversionsCommand(
    Guid IntegrationId,
    bool Enabled,
    string? DatasetId,
    string? AccessToken,
    bool SendDealValue,
    string? DefaultCallingCode,
    Dictionary<string, string>? LeadEvents,
    Dictionary<string, string>? DealEvents) : ICommand<MetaConversionsDto>;

public sealed class SaveMetaConversionsValidator : AbstractValidator<SaveMetaConversionsCommand>
{
    public SaveMetaConversionsValidator()
    {
        // Dataset ids are plain numbers. Catching a pasted URL or token here saves a confusing Meta error later.
        RuleFor(x => x.DatasetId)
            .Matches(@"^\d{5,25}$").WithMessage("The Dataset ID is a number (for example 468275456140994). Copy it from Events Manager → Data sources.")
            .When(x => !string.IsNullOrWhiteSpace(x.DatasetId));
        RuleFor(x => x.AccessToken).MaximumLength(1000);
        RuleFor(x => x.DefaultCallingCode)
            .Matches(@"^\+?\d{1,4}$").WithMessage("Enter the calling code as digits only, for example 971.")
            .When(x => !string.IsNullOrWhiteSpace(x.DefaultCallingCode));
        RuleForEach(x => x.LeadEvents).Must(kv => (kv.Value ?? "").Trim().Length <= 100).WithMessage("Event names can be at most 100 characters.");
        RuleForEach(x => x.DealEvents).Must(kv => (kv.Value ?? "").Trim().Length <= 100).WithMessage("Event names can be at most 100 characters.");
    }
}

/// <summary>Checks the saved dataset + token against Meta and stores the dataset's name for the screen.</summary>
public sealed record VerifyMetaConversionsCommand(Guid IntegrationId) : ICommand<MetaVerifyResultDto>;

/// <summary>
/// Sends one clearly-labelled event to Meta's "Test events" tab, using the code Events Manager shows there.
/// It never reaches the live dataset and is never counted.
/// </summary>
public sealed record SendMetaTestEventCommand(Guid IntegrationId, string TestEventCode) : ICommand<MetaTestResultDto>;

public sealed class SendMetaTestEventValidator : AbstractValidator<SendMetaTestEventCommand>
{
    public SendMetaTestEventValidator() =>
        RuleFor(x => x.TestEventCode).NotEmpty().MaximumLength(50)
            .WithMessage("Paste the test code from Events Manager → Test events (it looks like TEST12345).");
}

/// <summary>
/// Queues the stage history of recent Meta leads that were never reported (leads that arrived before this
/// was switched on). Limited to a short window because Meta only accepts recent events.
/// </summary>
public sealed record CatchUpMetaConversionsCommand(Guid IntegrationId, int Days = 7) : ICommand<MetaCatchUpResultDto>;

/// <summary>Puts failed events back in the queue — after fixing the token or dataset.</summary>
public sealed record RetryFailedMetaConversionsCommand(Guid IntegrationId) : ICommand<int>;
