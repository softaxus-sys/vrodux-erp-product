using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Services;

/// <summary>
/// The monthly "you still owe X to charity" nudge. Runs inside the daily finance pass; the month it
/// last fired for is remembered, so it goes out once a month (the first run of the month) and never
/// twice, even if the service restarts.
/// </summary>
internal static class SetAsideReminder
{
    public static async Task<bool> RunAsync(
        FinanceDbContext db, INotificationDispatcher dispatcher, INotificationRecipients recipients,
        Guid tenantId, DateTime nowUtc, CancellationToken ct)
    {
        var month = nowUtc.ToString("yyyy-MM");

        var state = await db.SetAsideStates.FirstOrDefaultAsync(ct);
        if (state?.LastReminderMonth == month) return false;

        var owed = await db.SetAsideEntries.AsNoTracking()
            .Where(e => !e.IsDeleted && e.PayoutId == null).ToListAsync(ct);
        if (owed.Count == 0) return false;

        var userIds = await recipients.WithPermissionAsync(tenantId, "finance.accounting.edit", ct);
        if (userIds.Count == 0) return false;

        var total = owed.Sum(e => e.LedgerAmount);
        var names = string.Join(", ", owed.Select(e => e.Name).Distinct().Take(3));
        var currency = TenantCurrencyOrDefault();

        await dispatcher.PublishManyAsync(userIds.Select(id => new NotificationRequest(
            id, "finance", "setaside.monthly-reminder",
            "Set-aside payment due",
            $"{currency} {total:N2} is waiting to be paid out ({names}) across {owed.Count} payment(s).",
            Link: "/finance/set-asides", Type: "warning", TenantId: tenantId)), ct);

        if (state is null) { state = new SetAsideState("x"); db.SetAsideStates.Add(state); }
        state.RecordReminder(month);
        await db.SaveChangesAsync(ct);
        return true;
    }

    private static string TenantCurrencyOrDefault() =>
        Softaxis.BuildingBlocks.Domain.Multitenancy.TenantCurrency.Resolve();
}
