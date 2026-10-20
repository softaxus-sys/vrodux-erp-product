using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.POS.Application.Customers.Credit.Reminders;

public sealed record CreditReminderSettingsDto(
    bool Enabled, int DaysBeforeDue, int OverdueAfterDays, int RepeatEveryDays, int MaxOverdueReminders,
    string SenderName, string? CcEmail, string TimeZoneId, bool MailConfigured);

public sealed record CreditReminderLogDto(
    Guid Id, Guid CustomerId, string CustomerName, string Email, string Kind, decimal Amount, string Status, string? Error, DateTime At);

public sealed record CreditReminderRecipientDto(Guid CustomerId, string Name, string Email, string Kind, decimal Amount);

public sealed record CreditReminderRunDto(
    int DueSoon, int Overdue, int Failed, int NoEmail, bool DryRun, IReadOnlyList<CreditReminderRecipientDto> Recipients);

public sealed record GetCreditReminderSettingsQuery : IQuery<CreditReminderSettingsDto>;
public sealed record GetCreditReminderLogQuery(Guid? CustomerId = null) : IQuery<IReadOnlyList<CreditReminderLogDto>>;

public sealed record UpdateCreditReminderSettingsCommand(
    bool Enabled, int DaysBeforeDue, int OverdueAfterDays, int RepeatEveryDays, int MaxOverdueReminders,
    string SenderName, string? CcEmail, string TimeZoneId) : ICommand<CreditReminderSettingsDto>;

public sealed class UpdateCreditReminderSettingsValidator : AbstractValidator<UpdateCreditReminderSettingsCommand>
{
    public UpdateCreditReminderSettingsValidator()
    {
        RuleFor(x => x.DaysBeforeDue).InclusiveBetween(0, 30);
        RuleFor(x => x.OverdueAfterDays).InclusiveBetween(0, 60);
        RuleFor(x => x.RepeatEveryDays).InclusiveBetween(1, 90);
        RuleFor(x => x.MaxOverdueReminders).InclusiveBetween(1, 12);
        RuleFor(x => x.SenderName).NotEmpty().MaximumLength(100).WithMessage("Say whose name the emails come from, e.g. your shop name.");
        RuleFor(x => x.CcEmail).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.CcEmail)).WithMessage("The copy address is not a valid email.");
        RuleFor(x => x.TimeZoneId).NotEmpty();
    }
}

/// <summary>Runs the automatic rules now (or previews them) for this workspace.</summary>
public sealed record RunCreditRemindersCommand(bool DryRun) : ICommand<CreditReminderRunDto>;

/// <summary>A reminder to one customer, sent on request: everything overdue, or everything open if nothing is late.</summary>
public sealed record SendCustomerCreditReminderCommand(Guid CustomerId) : ICommand<CreditReminderLogDto>;

/// <summary>What the handlers need from the infrastructure.</summary>
public interface ICreditReminderService
{
    Task<CreditReminderSettingsDto> GetSettingsAsync(CancellationToken ct);
    Task<CreditReminderSettingsDto> UpdateSettingsAsync(UpdateCreditReminderSettingsCommand cmd, CancellationToken ct);
    Task<CreditReminderRunDto> RunAsync(bool dryRun, CancellationToken ct);
    Task<(CreditReminderLogDto? Log, string? Error)> SendToCustomerAsync(Guid customerId, CancellationToken ct);
    Task<IReadOnlyList<CreditReminderLogDto>> GetLogAsync(Guid? customerId, CancellationToken ct);
}

public sealed class GetCreditReminderSettingsHandler(ICreditReminderService svc) : IQueryHandler<GetCreditReminderSettingsQuery, CreditReminderSettingsDto>
{
    public async Task<Result<CreditReminderSettingsDto>> Handle(GetCreditReminderSettingsQuery q, CancellationToken ct) =>
        Result.Success(await svc.GetSettingsAsync(ct));
}

public sealed class GetCreditReminderLogHandler(ICreditReminderService svc) : IQueryHandler<GetCreditReminderLogQuery, IReadOnlyList<CreditReminderLogDto>>
{
    public async Task<Result<IReadOnlyList<CreditReminderLogDto>>> Handle(GetCreditReminderLogQuery q, CancellationToken ct) =>
        Result.Success(await svc.GetLogAsync(q.CustomerId, ct));
}

public sealed class UpdateCreditReminderSettingsHandler(ICreditReminderService svc) : ICommandHandler<UpdateCreditReminderSettingsCommand, CreditReminderSettingsDto>
{
    public async Task<Result<CreditReminderSettingsDto>> Handle(UpdateCreditReminderSettingsCommand cmd, CancellationToken ct) =>
        Result.Success(await svc.UpdateSettingsAsync(cmd, ct));
}

public sealed class RunCreditRemindersHandler(ICreditReminderService svc) : ICommandHandler<RunCreditRemindersCommand, CreditReminderRunDto>
{
    public async Task<Result<CreditReminderRunDto>> Handle(RunCreditRemindersCommand cmd, CancellationToken ct) =>
        Result.Success(await svc.RunAsync(cmd.DryRun, ct));
}

public sealed class SendCustomerCreditReminderHandler(ICreditReminderService svc) : ICommandHandler<SendCustomerCreditReminderCommand, CreditReminderLogDto>
{
    public async Task<Result<CreditReminderLogDto>> Handle(SendCustomerCreditReminderCommand cmd, CancellationToken ct)
    {
        var (log, error) = await svc.SendToCustomerAsync(cmd.CustomerId, ct);
        if (log is not null) return Result.Success(log);
        var code = error!.StartsWith("Customer not found", StringComparison.Ordinal) ? "Customer.NotFound" : "Reminder.Conflict";
        return Result.Failure<CreditReminderLogDto>(Error.Custom(code, error));
    }
}
