using System.Text.RegularExpressions;
using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.LeadGen.Domain.Entities;

namespace Softaxis.LeadGen.Application.Campaigns;

public sealed record StepDto(Guid Id, int Number, int DelayDays, string Subject, string Body);
public sealed record StepInput(int DelayDays, string Subject, string Body);

public sealed record CampaignCountsDto(int Total, int Pending, int Active, int Completed, int Replied, int Bounced,
    int Unsubscribed, int Stopped, int Failed, int Skipped);

public sealed record CampaignDto(
    Guid Id, string Name, Guid MailboxId, string? MailboxAddress, string Status, string? PauseReason,
    string TimeZoneId, string WindowStart, string WindowEnd, string SendDays, int DailyCap, bool StopOnReply,
    IReadOnlyList<StepDto> Steps, CampaignCountsDto Counts, int Sent, int Replies, double ReplyRatePercent,
    double BounceRatePercent, string? CreatedByName, DateTime CreatedAt, DateTime? StartedAt);

public sealed record CampaignInput(
    string Name, Guid MailboxId, string TimeZoneId, string WindowStart, string WindowEnd, string SendDays,
    int DailyCap, bool StopOnReply, IReadOnlyList<StepInput> Steps);

public sealed record RecipientDto(Guid Id, Guid ProspectId, string ProspectName, string Email, string Status,
    int CurrentStep, DateTime? NextSendAt, DateTime? LastSentAt, string? LastError, Guid? ThreadId);

public sealed record GetCampaignsQuery : IQuery<IReadOnlyList<CampaignDto>>;
public sealed record GetCampaignByIdQuery(Guid Id) : IQuery<CampaignDto>;
public sealed record GetRecipientsQuery(Guid CampaignId, string? Status, int Page = 1, int PageSize = 50)
    : IQuery<PagedResult<RecipientDto>>;

public sealed record CreateCampaignCommand(CampaignInput Input) : ICommand<CampaignDto>;
public sealed record UpdateCampaignCommand(Guid Id, CampaignInput Input) : ICommand<CampaignDto>;
public sealed record DeleteCampaignCommand(Guid Id) : ICommand;

/// <summary>Adds prospects to a campaign. Each one that cannot be added is counted by reason, never silently dropped.</summary>
public sealed record AddRecipientsCommand(Guid CampaignId, IReadOnlyList<Guid> ProspectIds) : ICommand<AddRecipientsResult>;
public sealed record AddRecipientsResult(int Added, int NoEmail, int NotSendable, int Suppressed, int Duplicate, int NotRevealed);
public sealed record RemoveRecipientsCommand(Guid CampaignId, IReadOnlyList<Guid> RecipientIds) : ICommand<int>;

public sealed record StartCampaignCommand(Guid Id) : ICommand<CampaignDto>;
public sealed record PauseCampaignCommand(Guid Id) : ICommand<CampaignDto>;
public sealed record StopCampaignCommand(Guid Id) : ICommand<CampaignDto>;

public sealed record PreviewDto(string Subject, string Body, string To, IReadOnlyList<string> Warnings);
public sealed record PreviewEmailQuery(Guid CampaignId, int Step, Guid? ProspectId) : IQuery<PreviewDto>;
public sealed record SendCampaignTestCommand(Guid CampaignId, int Step, string To) : ICommand;

/// <summary>The merge fields a template may use. Anything else is rejected so a typo never reaches a customer.</summary>
public static class MergeFields
{
    public static readonly string[] Allowed =
        ["business_name", "category", "area", "city", "region", "website", "sender_name", "sender_business"];

    private static readonly Regex Tag = new(@"\{\{\s*([a-z_]+)\s*\}\}", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public static IEnumerable<string> Used(string text) =>
        Tag.Matches(text ?? "").Select(m => m.Groups[1].Value.ToLowerInvariant()).Distinct();

    public static IEnumerable<string> Unknown(string text) => Used(text).Where(t => !Allowed.Contains(t));

    public static string Render(string text, IReadOnlyDictionary<string, string?> values) =>
        Tag.Replace(text ?? "", m => values.TryGetValue(m.Groups[1].Value.ToLowerInvariant(), out var v) ? v ?? "" : m.Value);
}

public sealed class CampaignInputValidator : AbstractValidator<CampaignInput>
{
    public CampaignInputValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Give the campaign a name.").MaximumLength(120);
        RuleFor(x => x.MailboxId).NotEmpty().WithMessage("Choose the mailbox to send from.");
        RuleFor(x => x.TimeZoneId).Must(SendSchedule.IsValidZone).WithMessage("Unknown time zone.");
        RuleFor(x => x.WindowStart).Must(s => SendSchedule.TryParseTime(s, out _)).WithMessage("Start time must look like 09:00.");
        RuleFor(x => x.WindowEnd).Must(s => SendSchedule.TryParseTime(s, out _)).WithMessage("End time must look like 17:00.");
        RuleFor(x => x).Must(x => !SendSchedule.TryParseTime(x.WindowStart, out var s) || !SendSchedule.TryParseTime(x.WindowEnd, out var e) || e > s)
            .WithMessage("The sending window must end after it starts.");
        RuleFor(x => x.SendDays).NotEmpty().Matches(@"^[1-7](,[1-7])*$").WithMessage("Choose at least one sending day.");
        RuleFor(x => x.DailyCap).InclusiveBetween(1, 500);
        RuleFor(x => x.Steps).NotNull().Must(s => s.Count is >= 1 and <= 6).WithMessage("A campaign needs between 1 and 6 emails.");
        RuleForEach(x => x.Steps).ChildRules(st =>
        {
            st.RuleFor(s => s.Subject).NotEmpty().WithMessage("Every email needs a subject.").MaximumLength(200);
            st.RuleFor(s => s.Body).NotEmpty().WithMessage("Every email needs a body.").MaximumLength(8000);
            st.RuleFor(s => s.DelayDays).InclusiveBetween(0, 60);
            st.RuleFor(s => s.Subject).Must(t => !MergeFields.Unknown(t).Any())
                .WithMessage("The subject uses an unknown merge field.");
            st.RuleFor(s => s.Body).Must(t => !MergeFields.Unknown(t).Any())
                .WithMessage("The body uses an unknown merge field.");
        });
    }
}

public sealed class CreateCampaignValidator : AbstractValidator<CreateCampaignCommand>
{
    public CreateCampaignValidator() => RuleFor(x => x.Input).SetValidator(new CampaignInputValidator());
}

public sealed class UpdateCampaignValidator : AbstractValidator<UpdateCampaignCommand>
{
    public UpdateCampaignValidator() => RuleFor(x => x.Input).SetValidator(new CampaignInputValidator());
}

public sealed class AddRecipientsValidator : AbstractValidator<AddRecipientsCommand>
{
    public AddRecipientsValidator() => RuleFor(x => x.ProspectIds).NotNull().Must(i => i.Count is >= 1 and <= 2000)
        .WithMessage("Select between 1 and 2,000 prospects.");
}

public sealed class SendCampaignTestValidator : AbstractValidator<SendCampaignTestCommand>
{
    public SendCampaignTestValidator() => RuleFor(x => x.To).NotEmpty().EmailAddress();
}
