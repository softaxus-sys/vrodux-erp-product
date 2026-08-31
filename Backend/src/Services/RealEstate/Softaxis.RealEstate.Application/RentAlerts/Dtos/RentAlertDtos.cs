namespace Softaxis.RealEstate.Application.RentAlerts.Dtos;

public sealed record RentAlertSettingsDto(
    bool Enabled,
    string DueReminderDaysBefore,
    int OverdueRepeatDays,
    int OverdueMaxReminders,
    string ExpiryReminderDaysBefore,
    string? CcEmails,
    bool CcAllRealEstateUsers,
    string TimeZoneId,
    // False when the deployment has no SMTP account configured — the schedule and the screen
    // still work, but nothing is actually delivered, and saying so beats silence.
    bool EmailConfigured);

public sealed record RentAlertLogDto(
    Guid Id, Guid ContractId, Guid? InstallmentId, string Kind, string OffsetKey,
    string ToEmail, string? CcEmails, bool Sent, string? FailureReason, DateTime CreatedAt);

public sealed record ExpiringContractDto(
    Guid ContractId, string ContractNumber, Guid TenantId, string TenantName, string TenantEmail,
    string PropertyName, string UnitNumber, string EndDate, int DaysToExpiry,
    decimal AnnualRent, decimal Outstanding, string Status);

/// <summary>What one sweep did. Returned by the manual "run now" so an operator can see the
/// effect immediately rather than waiting a day and guessing.</summary>
public sealed record RentAlertRunResultDto(
    int DueRemindersSent, int OverdueRemindersSent, int ExpiryRemindersSent,
    int Skipped, int Failed, IReadOnlyList<string> Messages);
